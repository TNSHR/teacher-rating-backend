const nodemailer = require("nodemailer");

// Send OTP email using Gmail + App Password
async function sendOTPEmail(email, otp) {
  try {
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.SMTP_USER, // Gmail
        pass: process.env.SMTP_PASS, // App Password
      },
    });

    await transporter.sendMail({
      from: `"Teacher Rating System" <${process.env.SMTP_USER}>`,
      to: email,
      subject: "Your OTP for Registration / Password Change",
      text: `Your OTP is ${otp}. It will expire in 5 minutes.`,
    });

    console.log(`OTP sent to ${email}: ${otp}`);
  } catch (err) {
    console.error("Failed to send OTP email", err);
    throw new Error("Failed to send OTP");
  }
}

module.exports = { sendOTPEmail };
