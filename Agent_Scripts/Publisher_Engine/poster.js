const fs = require('fs');
const axios = require('axios');
const FormData = require('form-data');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

async function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

let cachedIgId = null;


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

    // --- ZERNIO HOSTING FOR APIS (Facebook/IG/X) ---
    const uploadedUrls = [];
    let zernioSuccess = false;
    while (!zernioSuccess) {
        try {
            console.log(`Uploading ${imageArray.length} image(s) to Zernio for hosting...`);
            const zernioKey = process.env.ZERNIO_API_KEY;
            if (!zernioKey) throw new Error("ZERNIO_API_KEY is not defined in environment/.env");
            
            uploadedUrls.length = 0; // Clear any partial uploads
            for (const img of imageArray) {
                const mediaForm = new FormData();
                mediaForm.append('files', fs.createReadStream(img));
                const res = await axios.post('https://zernio.com/api/v1/media', mediaForm, {
                    headers: { ...mediaForm.getHeaders(), 'Authorization': `Bearer ${zernioKey}` }
                });
                uploadedUrls.push(res.data.files[0].url);
            }
            console.log(`  ✅ Uploaded ${uploadedUrls.length} image(s) to Zernio.`);
            zernioSuccess = true;
        } catch (e) {
            console.error('❌ Zernio upload failed:', e.message);
            if (sendErrorAlertFn) {
                const alertRes = await sendErrorAlertFn(
                    `Zernio Image Upload failed: ${e.message}`, 
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
    if (uploadedUrls.length > 0) {
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
                    variables: { input: { channelId: bufferChannelId, schedulingType: 'automatic', mode: 'shareNow', text: captionShort, assets: uploadedUrls.map(url => ({ image: { url } })) } }
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
    
    if (fbToken && fbPageId && uploadedUrls.length > 0) {
        let fbSuccess = false;
        while (!fbSuccess) {
            try {
                if (uploadedUrls.length === 1) {
                    await axios.post(`https://graph.facebook.com/v20.0/${fbPageId}/photos`, { url: uploadedUrls[0], message: captionLong, access_token: fbToken });
                } else {
                    const mediaIds = [];
                    for (const url of uploadedUrls) {
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
    if (fbToken && fbPageId && uploadedUrls.length > 0) {
        let igSuccess = false;
        while (!igSuccess) {
            try {
                let igId = cachedIgId;
                if (!igId) {
                    const accRes = await axios.get(`https://graph.facebook.com/v20.0/${fbPageId}?fields=instagram_business_account&access_token=${fbToken}`);
                    igId = accRes.data?.instagram_business_account?.id;
                    if (igId) {
                        cachedIgId = igId;
                    }
                }
                
                if (igId) {
                    if (uploadedUrls.length === 1) {
                        const r1 = await axios.post(`https://graph.facebook.com/v20.0/${igId}/media`, { image_url: uploadedUrls[0], caption: captionLong, access_token: fbToken });
                        console.log('⏳ Waiting 5 seconds for Instagram to download and process the image container...');
                        await delay(5000);
                        await axios.post(`https://graph.facebook.com/v20.0/${igId}/media_publish`, { creation_id: r1.data.id, access_token: fbToken });
                    } else {
                        const itemIds = [];
                        for (const url of uploadedUrls) {
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
