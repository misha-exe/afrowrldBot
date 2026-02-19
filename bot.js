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
cron.schedule('0 */2 * * *', async () => { // Runs every 2 hours
    console.log('Cron: Checking status...');
    try {
        // Check time window: 2 hours + 5 mins buffer = 125 minutes
        const timeWindow = new Date(Date.now() - 125 * 60 * 1000).toISOString();

        // Check if ANY video was uploaded in this window
        const response = await databases.listDocuments(
            DB_ID, 
            COLL_ID, 
            [ Query.greaterThan('$createdAt', timeWindow) ]
        );

        let msg = '';

        if (response.documents.length > 0) {
            // SCENARIO A: New videos were found
            msg = `🚨 <b>NEW AFROWORLD VIDEOS</b> 🚨\n\n` +
                  `New videos from Afroworld were just posted!\n\n` +
                  `👇 Watch Now!`;
        } else {
            // SCENARIO B: No new videos (Engagement message)
            msg = `🔞 <b>DON’T MISS OUT</b> 🔞\n\n` +
                  `You may have missed some videos from Afroworld.\n\n` +
                  `👇 Check them out now!`;
        }

        // Send the message to the channel
        await bot.telegram.sendMessage(process.env.CHANNEL_ID, msg, {
            parse_mode: 'HTML',
            disable_web_page_preview: true,
            reply_markup: {
                inline_keyboard: [[
                    { text: "🔞 WATCH NOW 🔞", url: `http://t.me/afrowrld_bot/afrowrld` }
                ]]
            }
        });
        
        console.log(`Notification sent. New videos found: ${response.documents.length > 0}`);

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
