const { google } = require("googleapis");

// Gmail API configuration
const credentials = require("../credentials.json");
const SCOPES = ["https://www.googleapis.com/auth/gmail.modify"];

// Create a new instance of the Gmail API
const gmail = google.gmail({
  version: "v1",
  auth: new google.auth.OAuth2(
    credentials.installed.client_id,
    credentials.installed.client_secret,
    credentials.installed.redirect_uris[0]
  ),
});

// Function to send a reply email
async function sendReplyEmail(threadId) {
  const emailContent = "This is an automated reply.";
  const message = {
    userId: "me",
    requestBody: {
      threadId,
      raw: Buffer.from(
        `To: ${EMAIL}\nSubject: Re: Vacation Auto Reply\n\n${emailContent}`
      ).toString("base64"),
    },
  };
  await gmail.users.messages.send(message);
}
module.exports = { sendReplyEmail };
