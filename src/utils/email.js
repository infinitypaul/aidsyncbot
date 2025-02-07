const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || "smtp.mailgun.org",
    port: process.env.SMTP_PORT || 587,
    secure: process.env.SMTP_PORT === 465,
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
    },
    tls: {
        rejectUnauthorized: false
    }
});

async function sendVerificationEmail(email, token) {
    try {
        await transporter.sendMail({
            from: `"CareBot" <no-reply@${process.env.MAILGUN_DOMAIN}>`,
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
