/**
 * scout.js
 * 
 * The Scout Agent — Data extraction engine.
 * Reads news sources from Config/sources_config.json,
 * fetches RSS feeds, extracts articles with images,
 * and deduplicates against feed_history.json.
 * 
 * Modularity: ALL source URLs and categories come from the config JSON.
 */

const Parser = require('rss-parser');
const fs = require('fs');
const path = require('path');
const axios = require('axios');

const CONFIG_PATH = path.join(__dirname, '../../Config/sources_config.json');
const OUTPUT_FEED_PATH = path.join(__dirname, 'feed.json');
const HISTORY_PATH = path.join(__dirname, 'feed_history.json');

const parser = new Parser({
    timeout: 15000,
    customFields: {
        item: [
            ['media:content', 'mediaContent', { keepArray: false }],
            ['media:thumbnail', 'mediaThumbnail', { keepArray: false }],
            ['enclosure', 'enclosure']
        ]
    }
});

/**
 * Extracts the best available image URL from an RSS item.
 * Checks: enclosure, media:content, media:thumbnail, og-style content parsing.
 */
function extractImageUrl(item) {
    // 1. Check enclosure (most common for images in RSS)
    if (item.enclosure && item.enclosure.url && item.enclosure.type && item.enclosure.type.startsWith('image')) {
        return item.enclosure.url;
    }
    // Also handle enclosure without type but with image extension
    if (item.enclosure && item.enclosure.url) {
        const url = item.enclosure.url.toLowerCase();
        if (url.match(/\.(jpg|jpeg|png|webp|gif)/)) {
            return item.enclosure.url;
        }
    }

    // 2. Check media:content
    if (item.mediaContent) {
        const url = item.mediaContent.$ ? item.mediaContent.$.url : item.mediaContent.url;
        if (url) return url;
    }

    // 3. Check media:thumbnail
    if (item.mediaThumbnail) {
        const url = item.mediaThumbnail.$ ? item.mediaThumbnail.$.url : item.mediaThumbnail.url;
        if (url) return url;
    }

    // 4. Try extracting from content/description HTML (img src)
    const htmlContent = item.content || item['content:encoded'] || item.description || '';
    const imgMatch = htmlContent.match(/<img[^>]+src=["']([^"']+)["']/i);
    if (imgMatch && imgMatch[1]) {
        return imgMatch[1];
    }

    return null;
}

/**
 * Fetches the web page at url and attempts to extract the og:image meta tag.
 */
async function fetchOgImage(url) {
    try {
        const response = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            },
            timeout: 8000
        });
        const html = response.data;
        const ogMatch = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i) ||
                        html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i);
        if (ogMatch && ogMatch[1]) {
            return ogMatch[1].trim();
        }
    } catch (e) {
        console.log(`⚠️ Failed to fetch og:image for ${url}:`, e.message);
    }
    return null;
}

async function runScout() {
    console.log("📡 [Scout Engine] Booting up...");

    // 1. Load Configurations (Modularity Check)
    if (!fs.existsSync(CONFIG_PATH)) {
        console.error("❌ ERROR: sources_config.json not found! Halting Scout Engine.");
        process.exit(1);
    }
    const sourcesConfig = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));
    
    // 2. Load History (Anti-Duplication)
    let history = [];
    if (fs.existsSync(HISTORY_PATH)) {
        history = JSON.parse(fs.readFileSync(HISTORY_PATH, 'utf-8'));
    }

    const fetchedArticles = [];
    const newHistoryLinks = [...history];

    console.log("🔍 Scanning approved sources...");

    // 3. Iterate over categories and sources
    for (const [category, sources] of Object.entries(sourcesConfig)) {
        for (const source of sources) {
            if (source.type === 'rss') {
                console.log(`⏳ Fetching RSS: [${category}] ${source.name} -> ${source.url}`);
                try {
                    const feed = await parser.parseURL(source.url);
                    
                    // Take top 20 items from each feed for higher volume
                    let items = feed.items.slice(0, 20);
                    
                    // Apply keyword filter for international sources
                    if (source.filter_keywords && source.filter_keywords.length > 0) {
                        items = items.filter(item => {
                            const text = (item.title || '') + ' ' + (item.contentSnippet || item.content || '');
                            return source.filter_keywords.some(kw => text.includes(kw));
                        });
                        console.log(`  🔍 Keyword filter applied: ${items.length} items match Syria/World Cup keywords`);
                    }
                    
                    let newItemsAdded = 0;

                    for (const item of items) {
                        // Check duplication
                        if (!history.includes(item.link)) {
                            let imageUrl = extractImageUrl(item);
                            if (!imageUrl && item.link) {
                                imageUrl = await fetchOgImage(item.link);
                            }
                            
                            fetchedArticles.push({
                                category: category,
                                source: source.name,
                                title: item.title,
                                description: item.contentSnippet || item.content || "No description available",
                                link: item.link,
                                imageUrl: imageUrl,
                                pubDate: item.pubDate || new Date().toISOString(),
                                fetchedAt: new Date().toISOString()
                            });
                            newHistoryLinks.push(item.link);
                            newItemsAdded++;
                        }
                    }
                    console.log(`✅ Fetched ${newItemsAdded} new articles from ${source.name}`);
                } catch (error) {
                    console.error(`⚠️ Failed to fetch ${source.name}:`, error.message);
                }
            } else {
                console.log(`ℹ️ Skipping non-RSS source: [${category}] ${source.name}`);
            }
        }
    }


    // 4. Save results
    if (fetchedArticles.length > 0) {
        fs.writeFileSync(OUTPUT_FEED_PATH, JSON.stringify(fetchedArticles, null, 2), 'utf-8');
        console.log(`\n🎉 [Scout Engine] Success! Extracted ${fetchedArticles.length} NEW articles and saved to feed.json`);
        
        // Keep history manageable (last 1000 items)
        if (newHistoryLinks.length > 1000) {
            newHistoryLinks.splice(0, newHistoryLinks.length - 1000);
        }
        fs.writeFileSync(HISTORY_PATH, JSON.stringify(newHistoryLinks, null, 2), 'utf-8');
    } else {
        console.log(`\n😴 [Scout Engine] No new articles found. Everything is up to date.`);
        // Write empty array to feed.json to signal nothing new
        fs.writeFileSync(OUTPUT_FEED_PATH, JSON.stringify([], null, 2), 'utf-8');
    }

    return fetchedArticles;
}

// CLI execution
if (require.main === module) {
    runScout().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });
}

module.exports = { runScout };
