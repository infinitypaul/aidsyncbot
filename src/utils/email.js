const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || "127.0.0.1",
    port: process.env.SMTP_PORT || 1025,
    secure: false,
    auth: process.env.SMTP_USER && process.env.SMTP_PASS ? {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
    } : undefined,
    tls: {
        rejectUnauthorized: false
    }
});

async function sendVerificationEmail(email, token) {
    try {
        await transporter.sendMail({
            from: `"CareBot" <no-reply@carebot.test>`,
            to: email,
            subject: 'CareBot Email Verification',
            text: `Your CareBot verification token is: ${token}`,
            html: `<p>Your CareBot verification token is: <b>${token}</b></p>`
        });

        console.log(`✅ Email sent to ${email}`);
        return true;
    } catch (error) {
        console.error("❌ Error Sending Email:", error);
        return false;
    }
}

module.exports = {
    sendVerificationEmail
};
