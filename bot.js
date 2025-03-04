require('dotenv').config();
const { Telegraf } = require('telegraf');
const db = require('./src/storage/database');

const setupCommand = require('./src/commands/setup');
const helpCommand = require('./src/commands/help');
const isAdmin = require('./src/middleware/auth');
const { setupSessions, handleSetupReply } = require('./src/commands/setup');
const { activeSessions, pendingSessions, handleUserResponse, handleStart } = require('./src/commands/help');
const addAdminCommand = require('./src/commands/addAdmin');

const bot = new Telegraf(process.env.BOT_TOKEN);


bot.command("setup", isAdmin, async (ctx) => {
    console.log("🚀 /setup command received!");
    try {
        await setupCommand(ctx, bot);
    } catch (error) {
        console.error("❌ Error executing setup.js:", error);
        ctx.reply("⚠️ Setup failed. Please try again.");
    }
});


bot.command("help", isAdmin, async (ctx) => {
    console.log("📩 /help command received!");
    try {
        await helpCommand(ctx, bot);
    } catch (error) {
        console.error("❌ Error executing help.js:", error);
        ctx.reply("⚠️ Help request failed. Please try again.");
    }
});


bot.command("start", async (ctx) => {
    const user = ctx.message.from;
    console.log(`🔄 /start command received from @${user.username || user.first_name}`);

    await handleStart(ctx, bot);
});

bot.command("addadmin", isAdmin, async (ctx) => {
    console.log("📩 /addadmin command received!");
    try {
        await addAdminCommand(ctx);
    } catch (error) {
        console.error("❌ Error executing addAdmin.js:", error);
        ctx.reply("⚠️ Failed to add an admin. Please try again.");
    }
});


bot.on("message", async (ctx) => {
    const user = ctx.message.from;
    console.log("📩 User message received:", ctx.message.text || "Attachment");


    if (setupSessions[user.id]) {
        return await handleSetupReply(ctx, bot);
    }


    if (pendingSessions[user.id]) {
        console.log(`🔄 Resuming pending session for @${user.username || user.first_name}`);


        activeSessions[user.id] = pendingSessions[user.id];
        delete pendingSessions[user.id];

        return bot.telegram.sendMessage(
            user.id,
            `✅ Thanks for starting the bot! Let's continue from where we stopped.\n\n📩 Please enter your **${activeSessions[user.id].steps[activeSessions[user.id].stepIndex]}**:`
        );

        // return ctx.reply(
        //     `✅ Thanks for starting the bot! Let's continue from where we stopped.\n\n📩 Please enter your **${activeSessions[user.id].steps[activeSessions[user.id].stepIndex]}**:`
        // );
    }


    if (activeSessions[user.id]) {
        return await handleUserResponse(ctx, bot);
    }


    // return ctx.reply("🤖 Hi there! I'm CareBot.\nUse `/help` to request assistance.");
});


bot.launch()
    .then(() => console.log('✅ CareBot is running...'))
    .catch((err) => console.error("❌ Bot failed to launch:", err));

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));

module.exports = bot;
