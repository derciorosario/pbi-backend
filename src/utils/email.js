const nodemailer = require("nodemailer");
const path = require("path");

const BRAND = {
  name: "PBI",
  website: process.env.WEBSITE_URL || "https://pbi.africa",
  supportEmail: process.env.SUPPORT_EMAIL || "support@pbi.africa",
  primary: "#8a358a",
  text: "#202124",
  muted: "#5f6368",
  bg: "#f6f7fb",
  cardBg: "#ffffff",
  border: "#e6e6ef",
};

async function getTransport() {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_SECURE } = process.env;

  // 🔁 DEV fallback: no SMTP configured → just log
  if (!SMTP_HOST || !SMTP_PORT || !SMTP_USER || !SMTP_PASS) return null;

  const transport = nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT),
    secure: String(SMTP_SECURE) === "true",
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });

  // ⚙️ ESM module — import dynamically in CJS
  const hbsMod = await import("nodemailer-express-handlebars");
  const hbs = hbsMod.default || hbsMod; // handle default export

  transport.use(
    "compile",
    hbs({
      viewEngine: {
        extname: ".hbs",
        layoutsDir: path.resolve(__dirname, "../emails/layouts"),
        partialsDir: path.resolve(__dirname, "../emails/partials"),
        defaultLayout: "main",
      },
      viewPath: path.resolve(__dirname, "../emails"),
      extName: ".hbs",
    })
  );

  return transport;
}

/**
 * Send an email using a Handlebars template
 * @param {object} opts
 * @param {string} opts.to
 * @param {string} opts.subject
 * @param {string} opts.template - template name without extension (e.g., 'verify-email')
 * @param {object} opts.context - handlebars variables available to template
 */
async function sendTemplatedEmail({ to, subject, template, context = {} }) {
  const from = process.env.EMAIL_FROM || "PBI <no-reply@pbi.africa>";
  const transport = await getTransport();

  // DEV fallback: log to console if SMTP not configured
  if (!transport) {
    console.log("📧 [DEV EMAIL - TEMPLATE]", {
      to,
      subject,
      template,
      context: { BRAND, ...context },
    });
    return { mocked: true };
  }

  const mergedContext = {
    BRAND,
    year: new Date().getFullYear(),
    ...context,
  };

  return transport.sendMail({
    from,
    to,
    subject,
    template,
    context: mergedContext,
  });
}

module.exports = {
  sendTemplatedEmail,
  BRAND,
};
