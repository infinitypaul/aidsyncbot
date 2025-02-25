const db = require("../storage/database");

const activeSessions = {};
const pendingSessions = {};
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

module.exports = async (ctx, bot) => {
    console.log("📩 /help command received!");
    if (!ctx.message.reply_to_message) {
        return ctx.reply("⚠️ Please reply to a user's message to use /help.");
    }

    const user = ctx.message.reply_to_message.from;
    const originalMessage = ctx.message.reply_to_message.text || "No Text Available";
    const groupId = ctx.chat.id;

    const args = ctx.message.text.split(" ").slice(1);
    const requestedFields = args.length ? args : ["email", "description", "file"];

    console.log(`🔎 Fetching support details for group ID: ${groupId}`);

    db.get("SELECT company_name, email FROM support_groups WHERE group_id = ?", [groupId], async (err, row) => {
        if (err) {
            console.error("❌ Database Error:", err);
            return ctx.reply("⚠️ An error occurred while fetching support details.");
        }

        if (!row) {
            console.log("⚠️ Group is not registered.");
            return ctx.reply("⚠️ This group is not registered. Please run `/setup` first.");
        }

        const { company_name, email } = row;
        console.log(`✅ Support info found: ${company_name}`);
        console.log(`🛠 Asking for fields: ${requestedFields.join(", ")}`);

        try {
            // ✅ Send DM to the user
            await ctx.telegram.sendMessage(
                user.id,
                `🔹 **${company_name} || ${email} Support** 🔹\n\n`
                + `Hi @${user.username || user.first_name}, we are here to assist you.\n\n`
                + `📌 **Your original message:**\n"${originalMessage}"\n\n`
                + `I will now ask you a few questions based on your request.`
            );

            // ✅ Notify the group **only if DM succeeds**
            // ctx.telegram.sendMessage(
            //     groupId,
            //     `🚨 **New Support Request** 🚨\n👤 Username: @${user.username || user.first_name}\n📌 Issue: "${originalMessage}"\n📝 Awaiting user details...`
            // );
            ctx.reply(
                `🚨 **New Support Request** 🚨\n👤 Username: @${user.username || user.first_name}\n📌 Issue: "${originalMessage}"\n📝 Awaiting user details...`,
                { parse_mode: "Markdown" }
            );

            // ✅ Start the help session
            activeSessions[user.id] = {
                groupId,
                username: user.username || user.first_name,
                originalMessage,
                stepIndex: 0,
                steps: requestedFields,
                responses: {},
            };

            // Ask the first question
            await askNextQuestion(user.id, bot);
        } catch (error) {
            if (error.response && error.response.error_code === 403) {
                console.error(`❌ Error: Cannot message @${user.username || user.first_name}, they haven't started the bot.`);

                // Store session to resume later
                pendingSessions[user.id] = {
                    groupId,
                    username: user.username || user.first_name,
                    originalMessage,
                    stepIndex: 0,
                    steps: requestedFields,
                    responses: {},
                };

                return ctx.reply(
                    `👋 Hi @${user.username || user.first_name},\n\n`
                    + `Admin @${ctx.message.from.first_name || ''} is trying to assist you with your request, but I need some additional details from you.\n\n`
                    + `🚨 *I can only message you directly if you start the bot first.*\n\n`
                    + `👉 Please click here to continue: [Start CareBot](https://t.me/${process.env.BOT_USERNAME}?start=help)\n\n`
                    + `Once you've started the bot, I'll send you a message with the next steps! 😊`,
                    { parse_mode: "Markdown" }
                );
            }

            console.error("❌ Error sending DM:", error);
            ctx.reply(`⚠️ Unable to send a DM to @${user.username || user.first_name}. They might have blocked the bot.`);
        }
    });
};



module.exports.handleStart = async (ctx, bot) => {
    const userId = ctx.message.from.id;

    if (!pendingSessions[userId]) {
        return ctx.reply("✅ Welcome back! You can start a new help session with `/help`.");
    }

    console.log(`🔄 Resuming session for @${pendingSessions[userId].username}`);


    activeSessions[userId] = pendingSessions[userId];
    delete pendingSessions[userId];

    const session = activeSessions[userId];

    return bot.telegram.sendMessage(
        userId,
        `✅ Thanks for starting the bot! Let's continue from where we stopped.\n\n`
        + `📌 *Your Original Request:* "${session.originalMessage}"\n\n`
        + `📩 Please enter your **${session.steps[session.stepIndex]}**:`,
        { parse_mode: "Markdown" }
    );
    // return bot.telegram.sendMessage(userId, `✅ Thanks for starting the bot! Let's continue from where we stopped.\n\n📩 Please enter your **${activeSessions[userId].steps[activeSessions[userId].stepIndex]}**:`);
};


async function askNextQuestion(userId, bot) {
    const session = activeSessions[userId];
    if (!session) return;

    const currentStep = session.steps[session.stepIndex];

    if (currentStep === "email") {
        await bot.telegram.sendMessage(userId, "📩 Please enter your **Email**:");
    } else if (currentStep === "description") {
        await bot.telegram.sendMessage(userId, "📄 Please describe your issue briefly:");
    } else if (currentStep === "file") {
        await bot.telegram.sendMessage(userId, "📎 (Optional) You can upload a file or screenshot. If not, type 'skip'.");
    }
}


module.exports.handleUserResponse = async (ctx, bot) => {
    const userId = ctx.message.from.id;
    const session = activeSessions[userId];

    if (!session) return;

    let userResponse = ctx.message.text || "Attachment Received";

    console.log(`📩 User response from @${session.username}: ${userResponse}`);

    if (session.steps[session.stepIndex] === "email") {
        if (!emailRegex.test(userResponse)) {
            return bot.telegram.sendMessage(userId, "⚠️ Invalid email format. Please enter a valid email address:");
        }
    }


    // if (ctx.message.document) {
    //     session.responses.file = ctx.message.document.file_id;
    //     userResponse = `[File uploaded: ${ctx.message.document.file_name}]`;
    // } else if (ctx.message.photo) {
    //     const largestPhoto = ctx.message.photo[ctx.message.photo.length - 1]; // Get the highest resolution
    //     session.responses.file = largestPhoto.file_id;
    //     userResponse = "[Photo uploaded]";
    // } else {
    //     session.responses[session.steps[session.stepIndex]] = userResponse;
    // }

    if (session.steps[session.stepIndex] === "file") {
        if (ctx.message.document) {
            session.responses.file = ctx.message.document.file_id;
            userResponse = `[File uploaded: ${ctx.message.document.file_name}]`;
        } else if (ctx.message.photo) {
            const largestPhoto = ctx.message.photo[ctx.message.photo.length - 1];
            session.responses.file = largestPhoto.file_id;
            userResponse = "[Photo uploaded]";
        } else if (userResponse.toLowerCase() === "skip") {
            session.responses.file = "No file uploaded.";
            userResponse = "User skipped file upload.";
        } else {
            return bot.telegram.sendMessage(userId, "⚠️ Invalid response. Please upload a file or type 'skip' if you do not want to upload.");
        }
    } else {
        session.responses[session.steps[session.stepIndex]] = userResponse;
    }

    session.stepIndex++;

    if (session.stepIndex < session.steps.length) {
        return askNextQuestion(userId, bot);
    }

    notifyAdmins(session, bot);
    delete activeSessions[userId];

    return bot.telegram.sendMessage(userId, "✅ Thank you! Your issue has been forwarded to our support team.");
};



async function notifyAdmins(session, bot) {
    const { groupId, username, originalMessage, responses } = session;

    db.all("SELECT user_id FROM admins WHERE group_id = ?", [groupId], async (err, admins) => {
        if (err) {
            console.error("❌ Error fetching admins:", err);
            return;
        }

        let fileMessage = "No file uploaded.";

        if (responses.file && responses.file !== "No file uploaded.") {
            const fileId = responses.file;
            try {
                // ✅ Fetch file path from Telegram API
                const fileInfo = await bot.telegram.getFile(fileId);
                const filePath = fileInfo.file_path;


                fileMessage = `[📎 Download File](https://api.telegram.org/file/bot${process.env.BOT_TOKEN}/${filePath})`;
            } catch (error) {
                console.error("❌ Error retrieving file path:", error);
                fileMessage = "⚠️ Failed to fetch file.";
            }
        }


        const message = `📩 **New Support Request from @${username}**\n\n`
            + `📌 **Original Message:** "${originalMessage}"\n`
            + `📧 **Email:** ${responses.email || "Not Provided"}\n`
            + `📝 **Description:** ${responses.description || "Not Provided"}\n`
            + `📎 **File:** ${fileMessage}`;

        admins.forEach((admin) => {
            bot.telegram.sendMessage(admin.user_id, message, { parse_mode: "Markdown" });
        });

        console.log(`✅ Support request sent to ${admins.length} admins.`);
    });
}




module.exports.activeSessions = activeSessions;
module.exports.pendingSessions = pendingSessions;
