const db = require("../storage/database");
const { sendVerificationEmail } = require("../utils/email");

const setupSessions = {};

module.exports = async (ctx, bot) => {
    console.log("📩 Setup command received");

    if (!ctx.chat || (ctx.chat.type !== "supergroup" && ctx.chat.type !== "group")) {
        return ctx.reply("⚠️ This command must be run inside a group.");
    }

    console.log("📩 Running setup process...");

    const groupId = ctx.chat.id;
    const groupName = ctx.chat.title;
    const adminId = ctx.message.from.id;
    const adminUsername = ctx.message.from.username || "Admin";

    db.get("SELECT group_id FROM support_groups WHERE group_id = ?", [groupId], (err, row) => {
        if (row) {
            return ctx.reply("⚠️ This group is already registered. Use `/settings` to update.");
        }

        setupSessions[adminId] = { groupId, groupName, step: "company_name" };

        ctx.reply(`🔹 @${adminUsername}, I will send you a DM to complete the setup.`);

        bot.telegram.sendMessage(adminId, `Welcome! Let's set up **CareBot** for *${groupName}*.\n\nWhat is your company name?`);
    });
};


module.exports.handleSetupReply = async (ctx, bot) => {
    const adminId = ctx.message.from.id;
    if (!setupSessions[adminId]) return;

    const session = setupSessions[adminId];

    if (session.step === "company_name") {
        session.companyName = ctx.message.text;
        session.step = "email";
        return ctx.reply("Please enter the **support email** that users will see.");
    }

    if (session.step === "email") {
        session.email = ctx.message.text;
        session.step = "verification";

        const verificationCode = Math.floor(100000 + Math.random() * 900000);
        session.verificationCode = verificationCode;

        const emailSent = await sendVerificationEmail(session.email, verificationCode);
        if (!emailSent) return ctx.reply("⚠️ Failed to send verification email. Try again.");

        return ctx.reply("📩 Please check your email and enter the **6-digit verification code** here.");
    }

    if (session.step === "verification") {
        if (ctx.message.text !== session.verificationCode.toString()) {
            return ctx.reply("❌ Incorrect code. Run `/setup` again.");
        }

        const { groupId, groupName, companyName, email } = session;

        db.run(
            "INSERT INTO support_groups (group_id, group_name, company_name, email) VALUES (?, ?, ?, ?)",
            [groupId, groupName, companyName, email],
            (err) => {
                if (err) return ctx.reply("⚠️ Error saving settings.");
                db.run(
                    "INSERT INTO admins (user_id, username, group_id) VALUES (?, ?, ?)", // ✅ Added group_id
                    [adminId, ctx.message.from.username || ctx.message.from.first_name, groupId], // ✅ Included group_id value
                    (adminErr) => {
                        if (adminErr) return ctx.reply("⚠️ Error saving admin.");
                        ctx.reply(`✅ **CareBot is now active for ${companyName}!**\n📩 Support Email: ${email}`);
                       // bot.telegram.sendMessage(groupId, `✅ **CareBot is now active for ${companyName}!**\n📩 Support Email: ${email}`);
                        delete setupSessions[adminId];
                    }
                );

            }
        );
    }
};

// ✅ Export `setupSessions`
module.exports.setupSessions = setupSessions;
