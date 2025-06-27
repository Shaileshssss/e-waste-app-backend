// server.js
require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors'); // Import cors
const { MailerSend, EmailParams, Sender, Recipient } = require('mailersend');

const app = express();
const port = 3000;

// Middleware
app.use(bodyParser.json());
app.use(cors({
    origin: [
        'http://localhost:3000', // Your backend URL for testing
        'http://localhost:5173', // Default Expo dev server port (if you're fetching from there directly)
        /\.convex.cloud$/, // Allow all Convex deployments
        /^exp:\/\//, // Allow Expo development builds
        /^https?:\/\/(.*)\.expo.dev$/, // Allow Expo Go/builds
        // Add your specific deployed frontend URL if applicable
    ],
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type', 'Authorization'],
})); // Use cors middleware to allow cross-origin requests

// Load environment variables
const MAILERSEND_API_KEY = process.env.MAILERSEND_API_KEY;
const SENDER_EMAIL = process.env.SENDER_EMAIL; // e.g., admin@test-65qngkdx068lwr12.mlsender.net

// Initialize MailerSend
if (!MAILERSEND_API_KEY) {
    console.error("ERROR: MAILERSEND_API_KEY is not set in environment variables!");
    process.exit(1); // Exit if essential env var is missing
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

app.post('/send-email', async (req, res) => {
    console.log('[API] Backend received POST request from frontend for /send-email.');

    const { toEmail, toName, subject, htmlContent, textContent } = req.body;

    // Log the data received from the frontend
    console.log(`[API] Recipient Email: ${toEmail}`);
    console.log(`[API] Recipient Name: ${toName}`);
    console.log(`[API] Subject: ${subject}`);
    // console.log(`[API] HTML Content (first 100 chars): ${htmlContent ? htmlContent.substring(0, 100) : 'N/A'}...`);
    // console.log(`[API] Text Content (first 100 chars): ${textContent ? textContent.substring(0, 100) : 'N/A'}...`);

    if (!toEmail || !subject || (!htmlContent && !textContent)) {
        console.error('[API] Validation Error: Missing required fields (toEmail, subject, htmlContent/textContent).');
        return res.status(400).json({ error: 'Missing required email fields.', details: req.body });
    }

    // Prepare email parameters
    const sender = new Sender(SENDER_EMAIL, "E-Waste App Notifications"); // Use configured sender email and a friendly name
    const recipients = [new Recipient(toEmail, toName || toEmail)]; // Use toName if provided, else toEmail

    const emailParams = new EmailParams()
        .setFrom(sender)
        .setTo(recipients)
        .setReplyTo(sender) // Optional: set reply-to to your sender email
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
        // console.log('[API] MailerSend Response Status:', response.status); // Log HTTP status
        // console.log('[API] MailerSend Response Data:', response.data); // Log response data

        console.log('[API] Email successfully queued to MailerSend. Responding to frontend.');
        res.status(200).json({ message: 'Email successfully queued.', mailerSendResponse: response.data });
    } catch (error) {
        console.error('[API] Error sending email via MailerSend:', error);
        let errorMessage = 'Network or internal server error.';
        let errorDetails = error.message;

        if (error.response && error.response.data) {
            // MailerSend specific API error
            errorMessage = error.response.data.message || errorMessage;
            errorDetails = error.response.data.errors || error.response.data;
            console.error('[API] MailerSend API Error Response Data:', error.response.data);
        } else if (error.message) {
            // General JS error
            errorMessage = error.message;
        }

        console.error(`[API] Error processing email send request: ${errorMessage}`);
        res.status(500).json({ error: errorMessage, details: errorDetails });
    }
});

app.get('/', (req, res) => {
    res.send('E-Waste App Email Service is running!');
});

app.listen(port, () => {
    console.log(`[SERVER] E-Waste App Email Service listening at http://localhost:${port}`);
    console.log('[SERVER] Make sure your Expo app uses this URL for BACKEND_BASE_URL.');
});