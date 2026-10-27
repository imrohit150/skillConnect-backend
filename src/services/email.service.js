const BREVO_EMAIL_URL = "https://api.brevo.com/v3/smtp/email";
const EMAIL_TIMEOUT_MS = 15_000;

const sendEmail = async ({ to, subject, html, text }) => {
  try {
    const response = await fetch(BREVO_EMAIL_URL, {
      method: "POST",
      headers: {
        accept: "application/json",
        "content-type": "application/json",
        "api-key": process.env.BREVO_API_KEY.trim(),
      },
      signal: AbortSignal.timeout(EMAIL_TIMEOUT_MS),
      body: JSON.stringify({
        sender: { name: "SkillConnect", email: process.env.EMAIL_FROM.trim() },
        to: (Array.isArray(to) ? to : [to]).map((email) => ({ email })),
        subject,
        ...(html ? { htmlContent: html } : {}),
        ...(text ? { textContent: text } : {}),
      }),
    });
    const result = await response.json().catch(() => null);

    if (!response.ok || !result?.messageId) {
      // Keep provider bodies out of logs: they can contain recipient details.
      console.error("Brevo email was not accepted. HTTP status:", response.status);
      if (response.status === 401) {
        console.error("Brevo authentication failed. Check BREVO_API_KEY uses an active API key from SMTP & API > API Keys, not an SMTP key, and restart the backend after updating it.");
      }
      return false;
    }

    // Acceptance by Brevo does not guarantee delivery to the recipient's inbox.
    return true;
  } catch (err) {
    console.error("Brevo email request failed:", err.name);
    return false;
  }
};

module.exports = { sendEmail };
