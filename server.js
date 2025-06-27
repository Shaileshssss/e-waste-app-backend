// server.js
require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
// MailerSend v2 uses MailerSend and Email classes directly,
// EmailParams, Sender, Recipient are often part of Email or separate new instances
const { MailerSend, Email, Recipient, Sender } = require('mailersend'); // Ensure correct imports for MailerSend v2

console.log('[SERVER_START] Starting E-Waste App Email Service...');

const app = express();
const port = 3000; // This port might be overridden by Render's PORT environment variable

// Middleware
app.use(bodyParser.json()); // Essential for parsing JSON request bodies
app.use(cors({
    origin: [
        'http://localhost:3000', // For local testing if your frontend hits this directly
        'http://localhost:5173', // Common Expo dev server port
        /\.convex.cloud$/,       // Allows all Convex deployments (cloud-based actions)
        /^exp:\/\//,             // Allows Expo Go development builds
        /^https?:\/\/(.*)\.expo.dev$/, // Allows Expo Cloud builds/previews
        // IMPORTANT: If you deploy your Expo frontend to a specific domain (e.g., Vercel, Netlify), add its public URL here
    ],
    methods: ['GET', 'POST'], // Allow GET and POST requests
    allowedHeaders: ['Content-Type', 'Authorization'], // Allow these headers
}));
console.log('[SERVER_START] Middleware (bodyParser, cors) configured.');

// Load environment variables
const MAILERSEND_API_KEY = process.env.MAILERSEND_API_KEY;
const SENDER_EMAIL = process.env.SENDER_EMAIL;

// Validate environment variables on startup
if (!MAILERSEND_API_KEY) {
    console.error("ERROR: MAILERSEND_API_KEY is not set in environment variables!");
    process.exit(1); // Exit if critical env var is missing
}
if (!SENDER_EMAIL) {
    console.error("ERROR: SENDER_EMAIL is not set in environment variables! Please set it to your MailerSend verified sender (e.g., admin@yourtrialdomain.mlsender.net).");
    process.exit(1);
}

// Initialize MailerSend client
const mailerSend = new MailerSend({
    apiKey: MAILERSEND_API_KEY,
});

console.log(`[SERVER_START] MailerSend initialized with API Key (masked): ${MAILERSEND_API_KEY ? MAILERSEND_API_KEY.substring(0, 5) + '...' : 'N/A'}`);
console.log(`[SERVER_START] Default SENDER_EMAIL configured: ${SENDER_EMAIL}`);

// --- CONFIRMATION EMAIL ROUTE ---
console.log('[SERVER_START] Attempting to define POST /send-confirmation-email route...');
app.post('/send-confirmation-email', async (req, res) => {
    console.log('[API_HIT] Backend received POST request for /send-confirmation-email.');
    console.log('[API_HIT] Incoming Request Body:', req.body); // Log the full incoming request body

    // Destructure required fields from the request body, including new purchase details
    const { toEmail, toName, subject, purchaseDetails, totalPrice } = req.body;

    // Log the extracted fields for debugging
    console.log(`[API_HIT] Extracted Recipient Email: ${toEmail}`);
    console.log(`[API_HIT] Extracted Recipient Name: ${toName}`);
    console.log(`[API_HIT] Extracted Subject: ${subject}`);
    console.log(`[API_HIT] Extracted Purchase Details (count): ${purchaseDetails ? purchaseDetails.length : 0}`);
    console.log(`[API_HIT] Extracted Total Price: ${totalPrice}`);

    // --- Validation (UPDATED to include purchaseDetails and totalPrice) ---
    if (!toEmail || !toName || !subject || !Array.isArray(purchaseDetails) || typeof totalPrice !== 'number') {
        console.error('[API_HIT] Validation Error: Missing or invalid required fields (toEmail, toName, subject, purchaseDetails (array), totalPrice (number)).');
        return res.status(400).json({ error: 'Missing or invalid required email fields or purchase details.', details: req.body });
    }
    if (purchaseDetails.length === 0) {
        console.warn('[API_HIT] Warning: Purchase details array is empty. Email will be sent without item breakdown.');
    }
    // --- END Validation ---

    // --- Dynamically generate HTML and Text content for the email ---
    let itemsHtml = '';
    let itemsText = '';

    if (purchaseDetails && purchaseDetails.length > 0) {
        itemsHtml += `
            <h2 style="color:#333;">Purchase Details:</h2>
            <table style="width:100%; border-collapse: collapse; margin-bottom: 20px;">
                <thead>
                    <tr style="background-color:#f8f8f8;">
                        <th style="padding: 10px; border: 1px solid #ddd; text-align: left;">Product</th>
                        <th style="padding: 10px; border: 1px solid #ddd; text-align: left;">Qty</th>
                        <th style="padding: 10px; border: 1px solid #ddd; text-align: right;">Price</th>
                        <th style="padding: 10px; border: 1px solid #ddd; text-align: right;">Subtotal</th>
                    </tr>
                </thead>
                <tbody>
        `;
        purchaseDetails.forEach(item => {
            const itemSubtotal = item.price * item.quantity;
            itemsHtml += `
                <tr>
                    <td style="padding: 10px; border: 1px solid #ddd;">${item.name}</td>
                    <td style="padding: 10px; border: 1px solid #ddd;">${item.quantity}</td>
                    <td style="padding: 10px; border: 1px solid #ddd; text-align: right;">₹${item.price.toFixed(2)}</td>
                    <td style="padding: 10px; border: 1px solid #ddd; text-align: right;">₹${itemSubtotal.toFixed(2)}</td>
                </tr>
            `;
            itemsText += `- ${item.name} (x${item.quantity}) @ ₹${item.price.toFixed(2)} = ₹${itemSubtotal.toFixed(2)}\n`;
        });
        itemsHtml += `
                </tbody>
                <tfoot>
                    <tr>
                        <td colspan="3" style="padding: 10px; border: 1px solid #ddd; text-align: right; font-weight: bold; background-color:#f2f2f2;">Total Payable:</td>
                        <td style="padding: 10px; border: 1px solid #ddd; text-align: right; font-weight: bold; background-color:#f2f2f2;">₹${totalPrice.toFixed(2)}</td>
                    </tr>
                </tfoot>
            </table>
        `;
    } else {
        itemsHtml = `<p>No specific item details were provided for this order.</p>`;
        itemsText = `No specific item details were provided for this order.\n`;
    }

    // Construct the full HTML email body
    const emailHtmlBody = `
        <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
            <h1 style="color: ${process.env.APP_PRIMARY_COLOR || '#4CAF50'};">E-Waste App - Order Confirmation</h1>
            <p>Dear ${toName},</p>
            <p>Thank you for your recent purchase with E-Waste App! Your order has been successfully placed and confirmed.</p>
            <p><strong>Order Total: ₹${totalPrice.toFixed(2)}</strong></p>
            ${itemsHtml}
            <p>We appreciate your business and look forward to serving you again.</p>
            <p>Best regards,</p>
            <p><strong>The E-Waste App Team</strong></p>
            <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
            <p style="font-size: 0.8em; color: #777;">This is an automated email, please do not reply.</p>
        </div>
    `;

    // Construct the full Plain Text email body
    const emailTextBody = `
        Dear ${toName},

        Thank you for your recent purchase with E-Waste App! Your order has been successfully placed and confirmed.

        Order Total: ₹${totalPrice.toFixed(2)}

        Purchase Details:
        ${itemsText}

        We appreciate your business and look forward to serving you again.

        Best regards,
        The E-Waste App Team

        ---
        This is an automated email, please do not reply.
    `;
    // --- END Dynamic Content Generation ---


    const sender = new Sender(SENDER_EMAIL, "E-Waste App Notifications"); // Use configured sender email
    const recipients = [new Recipient(toEmail, toName)]; // Ensure toName is always used for Recipient

    const emailParams = new Email() // Use new MailerSend v2 Email class
        .setFrom(sender)
        .setTo(recipients)
        .setReplyTo(sender)
        .setSubject(subject)
        .setHtml(emailHtmlBody)   // Use the generated HTML content
        .setText(emailTextBody);   // Use the generated Plain Text content

    console.log('[API_HIT] Email parameters prepared. Attempting to send via MailerSend...');
    console.log(`  To: ${toEmail} (${toName})`);
    console.log(`  Subject: ${subject}`);

    try {
        const response = await mailerSend.email.send(emailParams); // Use the MailerSend instance method
        console.log('[API_HIT] MailerSend API call successful. Response:', response.statusCode); // Log status code
        // console.log('[API_HIT] MailerSend API Response Data:', response.body); // Log full response body if needed

        console.log('[API_HIT] Email successfully queued to MailerSend. Responding to Convex action.');
        res.status(200).json({ message: 'Email successfully queued.', mailerSendResponse: response.body });
    } catch (error) { // Use 'any' for error type for broader compatibility
        console.error('[API_HIT] Error sending email via MailerSend:', error);
        let errorMessage = 'Network or internal server error.';
        let errorDetails = error.message;

        if (error.response && error.response.body) {
            // MailerSend specific API error details
            errorMessage = error.response.body.message || errorMessage;
            errorDetails = error.response.body.errors || error.response.body;
            console.error('[API_HIT] MailerSend API Error Response Data:', error.response.body);
        } else if (error.message) {
            errorMessage = error.message;
        }

        console.error(`[API_HIT] Error processing email send request: ${errorMessage}`);
        res.status(500).json({ error: errorMessage, details: errorDetails });
    }
});

// --- Basic GET route for health checks ---
app.get('/', (req, res) => {
    console.log('[API_HIT] Received GET request to /');
    res.send('E-Waste App Email Service is running!');
});
console.log('[SERVER_START] GET / route defined.');

// --- Start the Express server ---
// Use process.env.PORT for Render deployments, fallback to local port
app.listen(process.env.PORT || port, () => {
    console.log(`[SERVER_START] E-Waste App Email Service listening on port ${process.env.PORT || port}`);
    console.log('[SERVER_START] Make sure your Convex BACKEND_SERVER_URL points to the public URL of this deployed service.');
    console.log('[SERVER_START] Server is fully started and routes are registered.');
});