require('dotenv').config();
const { Telegraf, Markup } = require('telegraf');
const cron = require('node-cron');
const { Client, Databases, Query } = require('node-appwrite');

// --- CONFIGURATION ---
const BOT_TOKEN = process.env.BOT_TOKEN; // Get from BotFather
const WEB_APP_URL = process.env.WEB_APP_URL; // Your hosted HTML URL
const CHANNEL_ID = process.env.CHANNEL_ID; // Channel ID (e.g., @mychannel or -100xxxx)

// Appwrite Config (Backend)
const client = new Client()
    .setEndpoint('https://cloud.appwrite.io/v1')
    .setProject('698f0cd0001f4942659c') // Your Project ID
    .setKey(process.env.APPWRITE_API_KEY); // Create an API Key in Appwrite Console

const databases = new Databases(client);
const DB_ID = '698f1af90006323451cf'; // Your Database ID
const COLL_ID = 'videos'; // Your Video Collection ID

// Initialize Bot
const bot = new Telegraf(BOT_TOKEN);

// --- COMMANDS ---

// /start command
bot.start((ctx) => {
    ctx.reply(
        'Welcome to Afrowrld! 🔞\n\nClick the button below to start watching exclusive content.',
        Markup.inlineKeyboard([
            Markup.button.webApp('🔥 WATCH NOW 🔥', WEB_APP_URL)
        ])
    );
});

// /watch command
bot.command('watch', (ctx) => {
    ctx.reply(
        'Open the App:',
        Markup.inlineKeyboard([
            Markup.button.webApp('▶️ Launch Player', WEB_APP_URL)
        ])
    );
});

// --- HOURLY NOTIFICATION LOGIC ---

// Schedule task to run at minute 0 of every hour
cron.schedule('0 * * * *', async () => {
    console.log('Checking for new videos...');
    
    try {
        // Calculate time 1 hour ago
        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();

        // Query Appwrite for videos created after oneHourAgo
        const response = await databases.listDocuments(
            DB_ID,
            COLL_ID,
            [
                Query.greaterThan('$createdAt', oneHourAgo)
            ]
        );

        if (response.documents.length > 0) {
            const newCount = response.documents.length;
            const videoTitle = response.documents[0].title;
            
            // Construct Message
            const msg = `🚨 <b>NEW CONTENT ALERT</b> 🚨\n\n` +
                        `<b>${videoTitle}</b> ${newCount > 1 ? `and ${newCount - 1} others` : ''} just dropped!\n\n` +
                        `👇 Watch before it gets deleted!`;

            // Send to Channel with a Button to open the App
            await bot.telegram.sendMessage(CHANNEL_ID, msg, {
                parse_mode: 'HTML',
                reply_markup: {
                    inline_keyboard: [[
                        { text: "🔞 WATCH NOW 🔞", url: `https://t.me/${bot.botInfo.username}/start` } 
                        // Note: We use a deep link to the bot because buttons in channels can't open WebApps directly yet.
                    ]]
                }
            });
            console.log(`Notification sent for ${newCount} videos.`);
        } else {
            console.log('No new videos found.');
        }

    } catch (error) {
        console.error('Error in cron job:', error);
    }
});

// Start the bot
bot.launch().then(() => {
    console.log('Bot is running...');
});

// Enable graceful stop
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));