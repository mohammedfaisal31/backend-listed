const { google } = require("googleapis");
const authorize = require("./authorize");

/**
 * Fetches new emails, processes subject and body, and adds labels.
 *
 * @param {google.auth.OAuth2} auth An authorized OAuth2 client.
 * @param {string} userId The Gmail ID of the user to fetch emails for.
 */
async function handleEmails(auth, userId) {
  const gmail = google.gmail({ version: "v1", auth });
  // Fetch new emails
  const response = await gmail.users.messages.list({
    userId: userId,
    labelIds: ["INBOX", "UNREAD"],
    q: "in:inbox", // Filter by inbox
  });

  const messages = response.data.messages || [];
  let count = 0;
  console.log("NEW EMAILS");
  for (const message of messages) {
    // Get the full message details
    const messageResponse = await gmail.users.messages.get({
      userId: userId,
      id: message.id,
    });
    count++;
    const subject = getMessageHeaderValue(messageResponse, "Subject");
    const body = getMessageBody(messageResponse);
    console.log(
      `\n+--------------------------------- EMAIL ${count} ----------------------------------------------+\n`
    );
    console.log("| Subject:", subject);
    console.log("|  Body:", body);
    console.log(
      `\n+---------------------------------------------------------------------------------------+`
    );

    if (count > 9) break;
  }
}

/**
 * Extracts the value of a specific header from the message.
 *
 * @param {object} messageResponse The message response object.
 * @param {string} headerName The name of the header to extract.
 * @return {string} The value of the header if found, or an empty string.
 */
function getMessageHeaderValue(messageResponse, headerName) {
  const headers = messageResponse.data.payload.headers || [];
  const header = headers.find((h) => h.name === headerName);
  return header ? header.value : "";
}

/**
 * Extracts the body of the message.
 *
 * @param {object} messageResponse The message response object.
 * @return {string} The first two paragraphs of the message body.
 */
function getMessageBody(messageResponse) {
  const parts = messageResponse.data.payload.parts || [];
  const bodyPart = parts.find((part) => part.mimeType === "text/plain");
  const body = bodyPart
    ? Buffer.from(bodyPart.body.data, "base64").toString()
    : "";

  // Extract the first two paragraphs
  const paragraphs = body.split("\n");
  const firstTwoParagraphs = paragraphs
    .filter((p) => p.trim() !== "")
    .slice(0, 2);

  return firstTwoParagraphs.join("\n");
}

// Authorize and handle emails
authorize()
  .then((auth) => handleEmails(auth, "me")) // Here I added 'me' because I have to check my own mail box
  .then(() => {
    console.log("Email processing completed.");
  })
  .catch((error) => {
    console.error("Error processing emails:", error);
  });
