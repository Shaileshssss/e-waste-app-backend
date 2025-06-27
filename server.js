// server.js
require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const { MailerSend, EmailParams, Sender, Recipient } = require('mailersend');

const app = express();
const port = 3000; // This port might be overwritten by Render's PORT env var

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

// Load environment variables
const MAILERSEND_API_KEY = process.env.MAILERSEND_API_KEY;
const SENDER_EMAIL = process.env.SENDER_EMAIL;

// Initialize MailerSend
if (!MAILERSEND_API_KEY) {
    console.error("ERROR: MAILERSEND_API_KEY is not set in environment variables!");
    process.exit(1);
}
if (!SENDER_EMAIL) {
    console.error("ERROR: SENDER_EMAIL is not set in environment variables! Please set it to your MailerSend verified sender (e.g., admin@yourtrialdomain.mlsender.net).");
    process.exit(1);
}

const mailerSend = new MailerSend({
    apiKey: MAILERSEND_API_KEY,
});

console.log(`MailerSend initialized with API Key (masked): ${MAILERSEND_API_KEY ? MAILERSEND_API_KEY.substring(0, 5) + '...' : 'N/A'}`);
console.log(`Default SENDER_EMAIL configured: ${SENDER_EMAIL}`);

// --- CHANGE IS HERE: Renamed endpoint from '/send-email' to '/send-confirmation-email' ---
app.post('/send-confirmation-email', async (req, res) => {
    console.log('[API] Backend received POST request for /send-confirmation-email.'); // Updated log message

    const { toEmail, toName, subject, htmlContent, textContent } = req.body;

    console.log(`[API] Recipient Email: ${toEmail}`);
    console.log(`[API] Recipient Name: ${toName}`);
    console.log(`[API] Subject: ${subject}`);

    if (!toEmail || !subject || (!htmlContent && !textContent)) {
        console.error('[API] Validation Error: Missing required fields (toEmail, subject, htmlContent/textContent).');
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

    console.log('[API] Final emailParams object prepared (showing a few props):');
    console.log(`  From: ${emailParams.from.email} (${emailParams.from.name})`);
    console.log(`  To: ${emailParams.to.map(r => `${r.email} (${r.name})`).join(', ')}`);
    console.log(`  Subject: ${emailParams.subject}`);

    try {
        console.log('[API] Attempting to send email via MailerSend...');
        const response = await mailerSend.email.send(emailParams);
        console.log('[API] MailerSend API call successful.');

        console.log('[API] Email successfully queued to MailerSend. Responding to Convex action.'); // Updated log message
        res.status(200).json({ message: 'Email successfully queued.', mailerSendResponse: response.data });
    } catch (error) {
        console.error('[API] Error sending email via MailerSend:', error);
        let errorMessage = 'Network or internal server error.';
        let errorDetails = error.message;

        if (error.response && error.response.data) {
            errorMessage = error.response.data.message || errorMessage;
            errorDetails = error.response.data.errors || error.response.data;
            console.error('[API] MailerSend API Error Response Data:', error.response.data);
        } else if (error.message) {
            errorMessage = error.message;
        }

        console.error(`[API] Error processing email send request: ${errorMessage}`);
        res.status(500).json({ error: errorMessage, details: errorDetails });
    }
});

app.get('/', (req, res) => {
    res.send('E-Waste App Email Service is running!');
});

// Render deployments often dynamically assign a PORT. Use process.env.PORT if available.
app.listen(process.env.PORT || port, () => {
    console.log(`[SERVER] E-Waste App Email Service listening at http://localhost:${process.env.PORT || port}`);
    console.log('[SERVER] Make sure your Convex BACKEND_SERVER_URL points to the public URL of this deployed service.');
});