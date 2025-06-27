// utils/emailService.js

// IMPORTANT: Replace with your Node.js backend URL
// If running locally: 'http://YOUR_LOCAL_IP_ADDRESS:3000' (e.g., 'http://192.168.1.5:3000')
// If deployed: 'https://your-deployed-backend.com'
const BACKEND_BASE_URL = 'http://localhost:3000'; // Make sure this matches your Node.js server URL

export const sendEmail = async (toEmail, toName, subject, htmlContent, textContent) => {
  console.log('[EmailService] Preparing email data for backend...');
  const emailData = { toEmail, toName, subject, htmlContent, textContent };
  // console.log('[EmailService] Email data:', emailData);

  try {
    console.log(`[EmailService] Sending POST request to ${BACKEND_BASE_URL}/send-email`);
    const response = await fetch(`${BACKEND_BASE_URL}/send-email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(emailData),
    });

    const data = await response.json();
    console.log('[EmailService] Received response from backend:', data);

    if (response.ok) {
      console.log('[EmailService] Email sent successfully via backend.');
      return { success: true, message: data.message };
    } else {
      console.error('[EmailService] Error sending email from backend:', data.error, data.details);
      return { success: false, error: data.error, details: data.details };
    }
  } catch (error) {
    console.error('[EmailService] Network or frontend error sending email:', error);
    return { success: false, error: "Could not connect to the email service. Check your backend URL or server status." };
  }
};