const fs = require('fs');
const axios = require('axios');
const FormData = require('form-data');
const path = require('path');
const { execSync } = require('child_process');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

async function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

let cachedIgId = null;

async function sendTelegramNotification(text) {
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    const adminId = process.env.TELEGRAM_ADMIN_ID;
    if (botToken && adminId) {
        try {
            await axios.post(`https://api.telegram.org/bot${botToken}/sendMessage`, {
                chat_id: adminId,
                text: text,
                parse_mode: 'HTML'
            });
        } catch (e) {
            console.error('Failed to send Telegram notification:', e.message);
        }
    }
}

async function isAlreadyPublishedIG(igId, caption, fbToken) {
    try {
        const res = await axios.get(`https://graph.facebook.com/v20.0/${igId}/media`, {
            params: {
                fields: 'caption,timestamp',
                limit: 5,
                access_token: fbToken
            }
        });
        const items = res.data?.data || [];
        const cleanCaption = caption.trim().substring(0, 50); // Match first 50 characters to handle formatting variations
        for (const item of items) {
            const itemCaption = item.caption || "";
            if (itemCaption.trim().includes(cleanCaption)) {
                return true;
            }
        }
    } catch (err) {
        console.error('Failed to check recent IG media for duplication:', err.message);
    }
    return false;
}

async function isAlreadyPublishedFB(fbPageId, caption, fbToken) {
    try {
        const res = await axios.get(`https://graph.facebook.com/v20.0/${fbPageId}/feed`, {
            params: {
                fields: 'message,created_time',
                limit: 5,
                access_token: fbToken
            }
        });
        const items = res.data?.data || [];
        const cleanCaption = caption.trim().substring(0, 50);
        for (const item of items) {
            const itemMsg = item.message || "";
            if (itemMsg.trim().includes(cleanCaption)) {
                return true;
            }
        }
    } catch (err) {
        console.error('Failed to check recent FB feed for duplication:', err.message);
    }
    return false;
}

function isRateLimitError(e) {
    const errMsg = e.response?.data?.error?.message || e.message || "";
    const errCode = e.response?.data?.error?.code;
    
    // Facebook API error codes for rate limiting/request limit reached are typically 4, 17, 32, 613, or 80000+
    if (errCode === 4 || errCode === 17 || errCode === 32 || errCode === 613) {
        return true;
    }
    
    const lowerMsg = errMsg.toLowerCase();
    if (lowerMsg.includes('request limit reached') || 
        lowerMsg.includes('rate limit') || 
        lowerMsg.includes('too many requests') || 
        lowerMsg.includes('limit reached')) {
        return true;
    }
    
    return false;
}

/**
 * Generates an MP4 video from an array of images.
 * Uses 4 seconds per slide.
 */
function generateVideoFromImages(imagePaths, postId) {
    console.log(`\n🎬 Generating Video for Post ID: ${postId}...`);
    const tempDir = path.join(__dirname, 'temp_video');
    if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir);
    
    const outputVideoPath = path.join(tempDir, `video_${postId}.mp4`);
    const listFilePath = path.join(tempDir, `list_${postId}.txt`);
    
    try {
        let listContent = "";
        for (const img of imagePaths) {
            listContent += `file '${img}'\nduration 4\n`;
        }
        // Last image must be repeated without duration for concat demuxer
        if (imagePaths.length > 0) {
            listContent += `file '${imagePaths[imagePaths.length - 1]}'\n`;
        }
        fs.writeFileSync(listFilePath, listContent);
        
        execSync(`ffmpeg -y -f concat -safe 0 -i "${listFilePath}" -c:v libx264 -crf 15 -preset slow -pix_fmt yuv420p -r 30 -vf scale=1080:1350 "${outputVideoPath}"`, { stdio: 'ignore' });
        console.log(`✅ Video generated successfully: ${outputVideoPath}`);
        
        try { fs.unlinkSync(listFilePath); } catch (e) {}
        
        return outputVideoPath;
    } catch (e) {
        console.error("❌ Failed to generate video:", e.message);
        return null;
    }
}

/**
 * Publishes the post across X (Twitter), Facebook, and Instagram.
 * If any platform API fails, it calls sendErrorAlertFn to block and ask the user (Retry/Skip).
 */
async function publishPost(imagePath, captionLong, captionShort, postId, sendErrorAlertFn) {
    if (!captionLong) captionLong = "No caption";
    if (!captionShort) captionShort = "No caption";
    captionLong = captionLong.replace(/\\n/g, '\n');
    captionShort = captionShort.replace(/\\n/g, '\n');
    const imageArray = typeof imagePath === 'string' ? imagePath.split(',') : imagePath;

    // Generate video from images
    const videoPath = generateVideoFromImages(imageArray, postId);

    // --- ZERNIO HOSTING FOR APIS (Facebook/IG/X) ---
    const uploadedImageUrls = [];
    let uploadedVideoUrl = null;
    let zernioSuccess = false;
    while (!zernioSuccess) {
        try {
            console.log(`Uploading media to Zernio for hosting...`);
            const zernioKey = process.env.ZERNIO_API_KEY;
            if (!zernioKey) throw new Error("ZERNIO_API_KEY is not defined in environment/.env");
            
            uploadedImageUrls.length = 0; // Clear any partial uploads
            for (const img of imageArray) {
                const mediaForm = new FormData();
                mediaForm.append('files', fs.createReadStream(img));
                const res = await axios.post('https://zernio.com/api/v1/media', mediaForm, {
                    headers: { ...mediaForm.getHeaders(), 'Authorization': `Bearer ${zernioKey}` }
                });
                uploadedImageUrls.push(res.data.files[0].url);
            }
            console.log(`  ✅ Uploaded ${uploadedImageUrls.length} image(s) to Zernio.`);

            if (videoPath && fs.existsSync(videoPath)) {
                const videoForm = new FormData();
                videoForm.append('files', fs.createReadStream(videoPath));
                const resVideo = await axios.post('https://zernio.com/api/v1/media', videoForm, {
                    headers: { ...videoForm.getHeaders(), 'Authorization': `Bearer ${zernioKey}` }
                });
                uploadedVideoUrl = resVideo.data.files[0].url;
                console.log(`  ✅ Uploaded Video to Zernio.`);
            }

            zernioSuccess = true;
        } catch (e) {
            console.error('❌ Zernio upload failed:', e.message);
            if (sendErrorAlertFn) {
                const alertRes = await sendErrorAlertFn(
                    `Zernio Media Upload failed: ${e.message}`, 
                    postId, 
                    "Check your internet connection, disk space, or Zernio API Key in .env. Click Retry to upload again, or Skip to skip all APIs."
                );
                if (alertRes.action === 'skip') {
                    console.log("⏭️ Admin chose to skip all API publishing due to Zernio failure.");
                    return;
                }
            } else {
                return; // Move on if no alert function
            }
        }
    }

    // --- X (TWITTER) ---
    console.log('\n--- Posting to X (Twitter) ---');
    if (uploadedImageUrls.length > 0) {
        let xSuccess = false;
        while (!xSuccess) {
            try {
                const bufferToken = process.env.BUFFER_ACCESS_TOKEN;
                const bufferChannelId = process.env.BUFFER_CHANNEL_ID;
                if (!bufferToken || !bufferChannelId) {
                    throw new Error("Missing BUFFER_ACCESS_TOKEN or BUFFER_CHANNEL_ID in environment/.env");
                }
                const res = await axios.post('https://api.buffer.com', {
                    query: `mutation createPost($input: CreatePostInput!) { createPost(input: $input) { ... on PostActionSuccess { post { id } } } }`,
                    variables: { input: { channelId: bufferChannelId, schedulingType: 'automatic', mode: 'shareNow', text: captionShort, assets: uploadedImageUrls.map(url => ({ image: { url } })) } }
                }, { headers: { 'Authorization': `Bearer ${bufferToken}`, 'Content-Type': 'application/json' } });
                
                if (res.data.errors) throw new Error(JSON.stringify(res.data.errors));
                console.log('✅ X Posted via API');
                xSuccess = true;
            } catch (e) {
                console.error(`❌ X API publishing failed:`, e.message);
                if (sendErrorAlertFn) {
                    const alertRes = await sendErrorAlertFn(
                        `X (Twitter) API failed: ${e.message}`, 
                        postId, 
                        "Check Buffer access token, channel ID, or network status. Click Retry to try posting again, or Skip to proceed to next platform."
                    );
                    if (alertRes.action === 'skip') {
                        console.log("⏭️ Admin chose to skip X (Twitter) publishing.");
                        break;
                    }
                } else {
                    break; // Skip if no alert function
                }
            }
        }
    }

    // --- FACEBOOK PAGE ---
    console.log('\n--- Posting to Facebook Page ---');
    const fbToken = process.env.FACEBOOK_PAGE_ACCESS_TOKEN;
    const fbPageId = process.env.FACEBOOK_PAGE_ID;
    
    if (fbToken && fbPageId) {
        let fbSuccess = false;
        while (!fbSuccess) {
            try {
                if (uploadedVideoUrl) {
                    console.log("Uploading as Facebook Video/Reel...");
                    await axios.post(`https://graph.facebook.com/v20.0/${fbPageId}/videos`, { 
                        file_url: uploadedVideoUrl, 
                        description: captionLong, 
                        access_token: fbToken 
                    });
                } else if (uploadedImageUrls.length === 1) {
                    await axios.post(`https://graph.facebook.com/v20.0/${fbPageId}/photos`, { url: uploadedImageUrls[0], message: captionLong, access_token: fbToken });
                } else if (uploadedImageUrls.length > 1) {
                    const mediaIds = [];
                    for (const url of uploadedImageUrls) {
                        const r = await axios.post(`https://graph.facebook.com/v20.0/${fbPageId}/photos`, { url, published: false, access_token: fbToken });
                        mediaIds.push(r.data.id);
                    }
                    await axios.post(`https://graph.facebook.com/v20.0/${fbPageId}/feed`, { message: captionLong, attached_media: mediaIds.map(id => ({ media_fbid: id })), access_token: fbToken });
                }
                console.log('✅ Facebook Posted via API');
                fbSuccess = true;
            } catch (e) {
                const errMsg = e.response?.data?.error?.message || e.message;
                console.error(`❌ FB API publishing failed:`, errMsg);
                
                // Double-check if the post actually went through despite the error
                console.log("🔍 Checking if the post went through to Facebook anyway...");
                const alreadyLive = await isAlreadyPublishedFB(fbPageId, captionLong, fbToken);
                if (alreadyLive) {
                    console.log("✅ Verified: Post is already live on Facebook Page. Treating as success.");
                    fbSuccess = true;
                    break;
                }
                
                // Check if it's a rate limit error to auto-skip without stalling
                if (isRateLimitError(e)) {
                    console.log("⚠️ Meta Rate Limit encountered. Auto-skipping Facebook to prevent engine stall.");
                    await sendTelegramNotification(`⚠️ <b>Facebook API Warning:</b> ${errMsg}\n\nSince this is a rate limit error, the engine has skipped it to prevent stalling. Please check manually if it went live.`);
                    break;
                }
                
                if (sendErrorAlertFn) {
                    const alertRes = await sendErrorAlertFn(
                        `Facebook API failed: ${errMsg}`, 
                        postId, 
                        "Check Facebook Page access token, Page ID, or rate limits. Click Retry to try posting again, or Skip to proceed to next platform."
                    );
                    if (alertRes.action === 'skip') {
                        console.log("⏭️ Admin chose to skip Facebook publishing.");
                        break;
                    }
                } else {
                    break;
                }
            }
        }
    } else {
        console.log(`Skipping FB API due to missing credentials or images.`);
    }

    // --- INSTAGRAM ---
    console.log('\n--- Posting to Instagram ---');
    if (fbToken && fbPageId) {
        let igId = cachedIgId;
        let igSuccess = false;
        while (!igSuccess) {
            try {
                if (!igId) {
                    const accRes = await axios.get(`https://graph.facebook.com/v20.0/${fbPageId}?fields=instagram_business_account&access_token=${fbToken}`);
                    igId = accRes.data?.instagram_business_account?.id;
                    if (igId) {
                        cachedIgId = igId;
                    }
                }
                
                if (igId) {
                    if (uploadedVideoUrl) {
                        console.log("Uploading as Instagram Reel...");
                        const r1 = await axios.post(`https://graph.facebook.com/v20.0/${igId}/media`, { 
                            video_url: uploadedVideoUrl, 
                            media_type: 'REELS',
                            caption: captionLong, 
                            access_token: fbToken 
                        });
                        
                        let isReady = false;
                        let attempts = 0;
                        while (!isReady && attempts < 15) {
                            console.log('⏳ Waiting 10 seconds for Instagram to process the Reel...');
                            await delay(10000);
                            const statusRes = await axios.get(`https://graph.facebook.com/v20.0/${r1.data.id}?fields=status_code&access_token=${fbToken}`);
                            const status = statusRes.data.status_code;
                            if (status === 'FINISHED') {
                                isReady = true;
                            } else if (status === 'ERROR') {
                                throw new Error("Instagram Reel processing returned ERROR status.");
                            }
                            attempts++;
                        }
                        
                        await axios.post(`https://graph.facebook.com/v20.0/${igId}/media_publish`, { creation_id: r1.data.id, access_token: fbToken });
                    } else if (uploadedImageUrls.length === 1) {
                        const r1 = await axios.post(`https://graph.facebook.com/v20.0/${igId}/media`, { image_url: uploadedImageUrls[0], caption: captionLong, access_token: fbToken });
                        console.log('⏳ Waiting 5 seconds for Instagram to download and process the image container...');
                        await delay(5000);
                        await axios.post(`https://graph.facebook.com/v20.0/${igId}/media_publish`, { creation_id: r1.data.id, access_token: fbToken });
                    } else {
                        const itemIds = [];
                        for (const url of uploadedImageUrls) {
                            const r = await axios.post(`https://graph.facebook.com/v20.0/${igId}/media`, { image_url: url, is_carousel_item: true, access_token: fbToken });
                            itemIds.push(r.data.id);
                            await delay(2000); // 2s spacing delay to prevent hitting Graph API rate limits
                        }
                        const cRes = await axios.post(`https://graph.facebook.com/v20.0/${igId}/media`, { caption: captionLong, media_type: 'CAROUSEL', children: itemIds.join(','), access_token: fbToken });
                        console.log('⏳ Waiting 8 seconds for Instagram to download and process all carousel items...');
                        await delay(8000); // 8s spacing delay before publishing carousel container
                        await axios.post(`https://graph.facebook.com/v20.0/${igId}/media_publish`, { creation_id: cRes.data.id, access_token: fbToken });
                    }
                    console.log('✅ Instagram Posted via API');
                    igSuccess = true;
                } else {
                    throw new Error(`Instagram Business Account ID not found for Facebook Page ID ${fbPageId}`);
                }
            } catch (e) {
                const errMsg = e.response?.data?.error?.message || e.message;
                console.error(`❌ IG API publishing failed:`, errMsg);
                
                // Double-check if the post actually went through despite the error
                if (igId) {
                    console.log("🔍 Checking if the post went through to Instagram anyway...");
                    const alreadyLive = await isAlreadyPublishedIG(igId, captionLong, fbToken);
                    if (alreadyLive) {
                        console.log("✅ Verified: Post is already live on Instagram. Treating as success.");
                        igSuccess = true;
                        break;
                    }
                }
                
                // Check if it's a rate limit error to auto-skip without stalling
                if (isRateLimitError(e)) {
                    console.log("⚠️ Meta Rate Limit encountered. Auto-skipping Instagram to prevent engine stall.");
                    await sendTelegramNotification(`⚠️ <b>Instagram API Warning:</b> ${errMsg}\n\nSince this is a rate limit error, the engine has skipped it to prevent stalling. Please check manually if it went live.`);
                    break;
                }
                
                if (sendErrorAlertFn) {
                    const alertRes = await sendErrorAlertFn(
                        `Instagram API failed: ${errMsg}`, 
                        postId, 
                        "Check Instagram settings, link state, or Facebook access token. Click Retry to try posting again, or Skip to complete publishing."
                    );
                    if (alertRes.action === 'skip') {
                        console.log("⏭️ Admin chose to skip Instagram publishing.");
                        break;
                    }
                } else {
                    break;
                }
            }
        }
    } else {
        console.log(`Skipping IG API due to missing credentials or images.`);
    }

    console.log('\n🎉 Platform API Publishing Complete!');
    
    // Send final success notification to Telegram admin
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    const adminId = process.env.TELEGRAM_ADMIN_ID;
    if (botToken && adminId) {
        try {
            await axios.post(`https://api.telegram.org/bot${botToken}/sendMessage`, {
                chat_id: adminId,
                text: `🎉 Post publishing process has completed for Post ID ${postId} across active platforms!`
            });
        } catch (e) {
            console.error('Failed to send final Telegram success alert:', e.message);
        }
    }
}

module.exports = { publishPost };
