const db = require("../storage/database");


function getRow(query, params = []) {
    return new Promise((resolve, reject) => {
        db.get(query, params, (err, row) => {
            if (err) reject(err);
            resolve(row);
        });
    });
}


module.exports = async (ctx, next) => {
    console.log('Middleware In Action')
    try {
        if (!ctx.chat || (ctx.chat.type !== "supergroup" && ctx.chat.type !== "group")) {
            return ctx.reply("⚠️ This command must be run inside a group.");
        }

        const userId = ctx.message.from.id;
        const groupId = ctx.chat.id;

        console.log(`🔍 Checking access control for group ID: ${groupId}`);


        const group = await getRow("SELECT group_id, access_control FROM support_groups WHERE group_id = ?", [groupId]);

        if (!group) {
            console.log("❌ Group not registered.");
            return ctx.reply("⚠️ This group is not registered. Please run `/setup` first.");
        }

        const accessControl = group.access_control || "admin";


        if (accessControl === "anyone") {
            console.log(`✅ Access granted: Anyone can use this command in Group ${groupId}`);
            return next();
        }


        const admin = await getRow("SELECT user_id FROM admins WHERE user_id = ? AND group_id = ?", [userId, groupId]);

        if (admin) {
            console.log(`✅ Access granted: @${ctx.message.from.username} is an admin.`);
            return next();
        }

        console.log(`❌ Access denied: @${ctx.message.from.username} is NOT an admin.`);
        return ctx.reply("⛔ Only group admins can use this command.");

    } catch (error) {
        console.error("❌ Error in admin middleware:", error);
        return ctx.reply("⚠️ An error occurred while checking authorization.");
    }
};
