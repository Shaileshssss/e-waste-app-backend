// server.js
require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const { MailerSend, EmailParams, Sender, Recipient } = require('mailersend');

console.log('[SERVER_START] Starting E-Waste App Email Service...'); // New log

const app = express();
const port = 3000;

// Middleware
app.use(bodyParser.json());
app.use(cors({
    origin: [
        'http://localhost:3000',
        'http://localhost:5173',
        /\.convex.cloud$/,
        /^exp:\/\//,
        /^https?:\/\/(.*)\.expo.dev$/,
    ],
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type', 'Authorization'],
}));
console.log('[SERVER_START] Middleware (bodyParser, cors) configured.'); // New log

// Load environment variables
const MAILERSEND_API_KEY = process.env.MAILERSEND_API_KEY;
const SENDER_EMAIL = process.env.SENDER_EMAIL;

if (!MAILERSEND_API_KEY) {
    console.error("ERROR: MAILERSEND_API_KEY is not set in environment variables!");
    process.exit(1);
}
if (!SENDER_EMAIL) {
    console.error("ERROR: SENDER_EMAIL is not set in environment variables! Please set it to your MailerSend verified sender.");
    process.exit(1);
}

const mailerSend = new MailerSend({
    apiKey: MAILERSEND_API_KEY,
});

console.log(`[SERVER_START] MailerSend initialized with API Key (masked): ${MAILERSEND_API_KEY ? MAILERSEND_API_KEY.substring(0, 5) + '...' : 'N/A'}`);
console.log(`[SERVER_START] Default SENDER_EMAIL configured: ${SENDER_EMAIL}`);

// --- THIS IS THE ROUTE DEFINITION ---
console.log('[SERVER_START] Attempting to define POST /send-confirmation-email route...'); // New log
app.post('/send-confirmation-email', async (req, res) => {
    console.log('[API_HIT] Backend received POST request for /send-confirmation-email.'); // New log - This should show if the route is hit!

    const { toEmail, toName, subject, htmlContent, textContent } = req.body;

    console.log(`[API_HIT] Recipient Email: ${toEmail}`);
    console.log(`[API_HIT] Recipient Name: ${toName}`);
    console.log(`[API_HIT] Subject: ${subject}`);

    if (!toEmail || !subject || (!htmlContent && !textContent)) {
        console.error('[API_HIT] Validation Error: Missing required fields (toEmail, subject, htmlContent/textContent).');
        return res.status(400).json({ error: 'Missing required email fields.', details: req.body });
    }

    const sender = new Sender(SENDER_EMAIL, "E-Waste App Notifications");
    const recipients = [new Recipient(toEmail, toName || toEmail)];

    const emailParams = new EmailParams()
        .setFrom(sender)
        .setTo(recipients)
        .setReplyTo(sender)
        .setSubject(subject)
        .setHtml(htmlContent)
        .setText(textContent);

    console.log('[API_HIT] Final emailParams object prepared (showing a few props):');
    console.log(`  From: ${emailParams.from.email} (${emailParams.from.name})`);
    console.log(`  To: ${emailParams.to.map(r => `${r.email} (${r.name})`).join(', ')}`);
    console.log(`  Subject: ${emailParams.subject}`);

    try {
        console.log('[API_HIT] Attempting to send email via MailerSend...');
        const response = await mailerSend.email.send(emailParams);
        console.log('[API_HIT] MailerSend API call successful.');

        console.log('[API_HIT] Email successfully queued to MailerSend. Responding to Convex action.');
        res.status(200).json({ message: 'Email successfully queued.', mailerSendResponse: response.data });
    } catch (error) {
        console.error('[API_HIT] Error sending email via MailerSend:', error);
        let errorMessage = 'Network or internal server error.';
        let errorDetails = error.message;

        if (error.response && error.response.data) {
            errorMessage = error.response.data.message || errorMessage;
            errorDetails = error.response.data.errors || error.response.data;
            console.error('[API_HIT] MailerSend API Error Response Data:', error.response.data);
        } else if (error.message) {
            errorMessage = error.message;
        }

        console.error(`[API_HIT] Error processing email send request: ${errorMessage}`);
        res.status(500).json({ error: errorMessage, details: errorDetails });
    }
});

app.get('/', (req, res) => {
    res.send('E-Waste App Email Service is running!');
});
console.log('[SERVER_START] GET / route defined.'); // New log

app.listen(process.env.PORT || port, () => {
    console.log(`[SERVER_START] E-Waste App Email Service listening at http://localhost:${process.env.PORT || port}`);
    console.log('[SERVER_START] Make sure your Convex BACKEND_SERVER_URL points to the public URL of this deployed service.');
    console.log('[SERVER_START] Server is fully started and routes are registered.'); // New log
});