require('dotenv').config();
const { Telegraf, Markup } = require('telegraf');
const cron = require('node-cron');
const { Client, Databases } = require('node-appwrite');
const express = require('express'); 

// --- 1. DUMMY WEB SERVER (MANDATORY FOR RENDER FREE TIER) ---
const app = express();
const PORT = process.env.PORT || 3000; 

app.get('/', (req, res) => {
    res.send('Afrowrld Bot is running...');
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});

// --- 2. APPWRITE CONFIG ---
const client = new Client()
    .setEndpoint('https://cloud.appwrite.io/v1')
    .setProject('698f0cd0001f4942659c') 
    .setKey(process.env.APPWRITE_API_KEY); 

const databases = new Databases(client);
const DB_ID = '698f1af90006323451cf'; 
const COLL_ID = 'videos';
const CONFIG_COLL_ID = 'config'; // Used for storing the last message ID

// --- 3. TELEGRAM BOT SETUP ---
const bot = new Telegraf(process.env.BOT_TOKEN);

// /start command
bot.start((ctx) => {
    ctx.reply(
        'Welcome to Afrowrld! 🔞\n\nClick below to verify age and watch:',
        Markup.inlineKeyboard([
            Markup.button.webApp('🔥 ENTER AFROWRLD 🔥', process.env.WEB_APP_URL)
        ])
    );
});

// /watch command
bot.command('watch', (ctx) => {
    ctx.reply('Open Player:', Markup.inlineKeyboard([
        Markup.button.webApp('▶️ Watch Now', process.env.WEB_APP_URL)
    ]));
});

// --- 4. DAILY 7 PM NOTIFICATION (Nigeria Time) ---
// Nigeria is UTC+1. To post at 19:00 (7 PM) Nigeria, we use 18:00 UTC.
cron.schedule('0 18 * * *', async () => { 
    console.log('Cron: Starting Daily 7 PM Routine...');
    
    try {
        // --- STEP A: DELETE PREVIOUS MESSAGE ---
        try {
            // 1. Get the stored ID from Appwrite
            const configDoc = await databases.getDocument(DB_ID, CONFIG_COLL_ID, 'main');
            const prevMsgId = configDoc.lastMsgId;

            if (prevMsgId) {
                // 2. Delete the old message from Telegram
                await bot.telegram.deleteMessage(process.env.CHANNEL_ID, prevMsgId);
                console.log(`Deleted previous message ID: ${prevMsgId}`);
            }
        } catch (delError) {
            console.log("Skipping delete (message may not exist or is too old).");
        }

        // --- STEP B: PREPARE MESSAGE ---
        const msg = `🚨 <b>NEW AFROWORLD VIDEOS</b> 🚨\n\n` +
                    `New videos from Afroworld were just posted!\n\n` +
                    `👇 Watch Now!`;

        // --- STEP C: SEND NEW MESSAGE ---
        const sentMsg = await bot.telegram.sendMessage(process.env.CHANNEL_ID, msg, {
            parse_mode: 'HTML',
            disable_web_page_preview: true,
            reply_markup: {
                inline_keyboard: [[
                    // Deep link to start the bot
                    { text: "🔞 WATCH NOW 🔞", url: `http://t.me/afrowrld_bot/afrowrld` }
                ]]
            }
        });

        // --- STEP D: SAVE NEW ID TO APPWRITE ---
        try {
            await databases.updateDocument(DB_ID, CONFIG_COLL_ID, 'main', {
                lastMsgId: sentMsg.message_id
            });
            console.log(`Daily notification sent. ID saved: ${sentMsg.message_id}`);
        } catch (saveError) {
            console.error("Failed to save message ID to DB:", saveError);
        }

    } catch (error) {
        console.error('Cron Critical Error:', error);
    }
});

// Start the bot
bot.launch();
console.log('Bot started...');

// Graceful stop
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
