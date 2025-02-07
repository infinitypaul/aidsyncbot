const db = require("../storage/database");

module.exports = async (ctx) => {
    try {

        if (!ctx.chat || (ctx.chat.type !== "supergroup" && ctx.chat.type !== "group")) {
            return ctx.reply("⚠️ This command must be run inside a group.");
        }

        const groupId = ctx.chat.id;
        const senderId = ctx.message.from.id;
        const mentionedUser = ctx.message.reply_to_message?.from; // Get the user who was replied to

        if (!mentionedUser) {
            return ctx.reply("⚠️ Please reply to a user's message to add them as an admin.");
        }

        const newAdminId = mentionedUser.id;
        const newAdminUsername = mentionedUser.username || mentionedUser.first_name;

        console.log(`🔍 Checking if ${senderId} is an admin...`);


        db.get("SELECT user_id FROM admins WHERE user_id = ? AND group_id = ?", [senderId, groupId], (err, admin) => {
            if (err) {
                console.error("❌ Database Error:", err);
                return ctx.reply("⚠️ An error occurred while checking admin privileges.");
            }

            if (!admin) {
                console.log("⛔ User is NOT an admin.");
                return ctx.reply("⛔ Only existing admins can add new admins.");
            }

            console.log(`✅ User ${senderId} is an admin. Proceeding to add @${newAdminUsername}`);


            db.get("SELECT user_id FROM admins WHERE user_id = ? AND group_id = ?", [newAdminId, groupId], (err, existingAdmin) => {
                if (existingAdmin) {
                    return ctx.telegram.sendMessage(senderId, `⚠️ @${newAdminUsername} is already an admin.`, {
                        reply_markup: { force_reply: true },
                    });
                }


                db.run(
                    "INSERT INTO admins (user_id, username, group_id) VALUES (?, ?, ?)",
                    [newAdminId, newAdminUsername, groupId],
                    (insertErr) => {
                        if (insertErr) {
                            console.error("❌ Error adding admin:", insertErr);
                            return ctx.telegram.sendMessage(senderId, "⚠️ Failed to add the admin. Please try again.", {
                                reply_markup: { force_reply: true },
                            });
                        }

                        console.log(`✅ Successfully added @${newAdminUsername} as an admin.`);
                        return ctx.telegram.sendMessage(senderId, `✅ @${newAdminUsername} has been added as an admin!`, {
                            reply_markup: { force_reply: true },
                        });
                    }
                );
            });
        });

    } catch (error) {
        console.error("❌ Error in /addadmin:", error);
        await ctx.telegram.sendMessage(ctx.message.from.id, "⚠️ An unexpected error occurred.", {
            reply_markup: {force_reply: true},
        });
    }
};
