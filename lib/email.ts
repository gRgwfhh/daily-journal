import nodemailer from "nodemailer";

export function getMailConfiguration() {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD, SMTP_FROM, APP_URL } =
    process.env;

  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASSWORD || !SMTP_FROM || !APP_URL) {
    throw new Error(
      "Email configuration is incomplete. Set APP_URL, SMTP_HOST, SMTP_USER, SMTP_PASSWORD, and SMTP_FROM.",
    );
  }

  const port = Number(SMTP_PORT || 587);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error("SMTP_PORT must be a valid TCP port.");
  }

  let baseUrl: URL;
  try {
    baseUrl = new URL(APP_URL);
  } catch {
    throw new Error("APP_URL must be an absolute HTTP or HTTPS URL.");
  }
  if (
    !["http:", "https:"].includes(baseUrl.protocol) ||
    (process.env.NODE_ENV === "production" && baseUrl.protocol !== "https:")
  ) {
    throw new Error("APP_URL must use HTTPS in production.");
  }

  return {
    host: SMTP_HOST,
    port,
    secure: port === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASSWORD },
    from: SMTP_FROM,
    baseUrl: baseUrl.origin,
  };
}

export async function sendPasswordResetEmail(email: string, token: string) {
  const config = getMailConfiguration();
  const transporter = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: config.auth,
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 15_000,
  });
  const resetUrl = new URL("/reset-password", config.baseUrl);
  resetUrl.searchParams.set("token", token);
  const resetHref = resetUrl
    .toString()
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");

  await transporter.sendMail({
    from: config.from,
    to: email,
    subject: "Reset your Daily Journal password",
    text: `Use this link to reset your password. It expires in one hour:\n\n${resetUrl.toString()}\n\nIf you did not request a password reset, you can ignore this email.`,
    html: `<p>Use the link below to reset your password. It expires in one hour.</p><p><a href="${resetHref}">Reset your password</a></p><p>If you did not request a password reset, you can ignore this email.</p>`,
  });
}
