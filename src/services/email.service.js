const { Resend } = require("resend");

const resend = new Resend(process.env.RESEND_API_KEY);

const sendEmail = async ({ to, subject, html, text }) => {
  try {
    const { error } = await resend.emails.send({
      from: process.env.EMAIL_FROM,
      to,
      subject,
      html,
      ...(text ? { text } : {}),
    });

    if (error) {
      console.error("Email delivery failed:", error.message);
      return false;
    }

    return true;
  } catch (err) {
    console.error("Email delivery failed:", err.message);
    return false;
  }
};

module.exports = { sendEmail };
