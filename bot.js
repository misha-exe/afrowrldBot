require('dotenv').config();
const { Telegraf, Markup } = require('telegraf');
const cron = require('node-cron');
const { Client, Databases, Query } = require('node-appwrite');
const express = require('express'); // Import Express

// --- 1. DUMMY WEB SERVER (MANDATORY FOR RENDER FREE TIER) ---
const app = express();
const PORT = process.env.PORT || 3000; // Render sets this port automatically

// This is the "website" Render visits to check if we are alive
app.get('/', (req, res) => {
    res.send('Afrowrld Bot is running...');
});

// Open the "door" (port) so Render doesn't kill us
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
const CONFIG_COLL_ID = 'config';

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

// --- 4. TWO-HOUR CHECK ---
cron.schedule('0 */2 * * *', async () => { 
    console.log('Cron: Checking status...');
    try {
        // 1. Check for videos
        const timeWindow = new Date(Date.now() - 125 * 60 * 1000).toISOString();
        const response = await databases.listDocuments(
            DB_ID, 
            COLL_ID, 
            [ Query.greaterThan('$createdAt', timeWindow) ]
        );

        let msg = '';
        if (response.documents.length > 0) {
            msg = `🚨 <b>NEW AFROWORLD VIDEOS</b> 🚨\n\n` +
                  `New videos from Afroworld were just posted!\n\n` +
                  `👇 Watch Now!`;
        } else {
            msg = `🔞 <b>DON'T MISS OUT</b> 🔞\n\n` +
                  `You may have missed some videos from Afroworld.\n\n` +
                  `👇 Check them out now!`;
        }

        // 2. DELETE PREVIOUS MESSAGE
        try {
            // Get the stored ID from Appwrite
            const configDoc = await databases.getDocument(DB_ID, CONFIG_COLL_ID, 'main');
            const prevMsgId = configDoc.lastMsgId;

            if (prevMsgId) {
                // Attempt to delete the message from Telegram
                await bot.telegram.deleteMessage(process.env.CHANNEL_ID, prevMsgId);
                console.log(`Deleted previous message ID: ${prevMsgId}`);
            }
        } catch (delError) {
            // Ignore errors if message is too old or already deleted
            console.log("Could not delete old message (it might not exist):", delError.description);
        }

        // 3. SEND NEW MESSAGE
        const sentMsg = await bot.telegram.sendMessage(process.env.CHANNEL_ID, msg, {
            parse_mode: 'HTML',
            disable_web_page_preview: true,
            reply_markup: {
                inline_keyboard: [[
                    { text: "🔞 WATCH NOW 🔞", url: `http://t.me/afrowrld_bot/afrowrld` }
                ]]
            }
        });

        // 4. SAVE NEW ID TO APPWRITE
        try {
            await databases.updateDocument(DB_ID, CONFIG_COLL_ID, 'main', {
                lastMsgId: sentMsg.message_id
            });
            console.log(`Saved new message ID: ${sentMsg.message_id}`);
        } catch (saveError) {
            console.error("Failed to save message ID to DB:", saveError);
        }

    } catch (error) {
        console.error('Cron Error:', error);
    }
});

// Start the bot
bot.launch();
console.log('Bot started...');

// Graceful stop
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
