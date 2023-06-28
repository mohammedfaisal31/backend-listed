const { google } = require("googleapis");
const authorize = require("./authorize");

const EMAIL_CHECK_INTERVAL_MIN = 0;
const EMAIL_CHECK_INTERVAL_MAX = 1;
const LABEL_NAME = "MyLabel";

/**
 * Starts the email processing loop.
 *
 * @param {google.auth.OAuth2} auth An authorized OAuth2 client.
 */
async function startEmailProcessing(auth) {
  setInterval(() => {
    replyToEmails(auth)
      .catch((error) => {
        console.error("Error processing emails:", error);
      });
  }, getRandomInterval());
}

/**
 * Generates a random interval in milliseconds between EMAIL_CHECK_INTERVAL_MIN = 45 and EMAIL_CHECK_INTERVAL_MAX = 120.
 *
 * @returns {number} The random interval in milliseconds.
 */
function getRandomInterval() {
  const min = EMAIL_CHECK_INTERVAL_MIN * 1000;
  const max = EMAIL_CHECK_INTERVAL_MAX * 1000;
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Checks for new emails in the inbox.
 *
 * @param {google.auth.OAuth2} auth An authorized OAuth2 client.
 * @returns {Promise<google.auth.OAuth2>} An authorized OAuth2 client.
 */
async function checkEmails(auth) {
  const gmail = google.gmail({ version: "v1", auth });

  // Fetch new emails
  const response = await gmail.users.messages.list({
    userId: "me",
    labelIds: ["INBOX","UNREAD"],
  });

  const messages = response.data.messages || [];
  let count = 0;
  console.log("NEW EMAILS");
  for (const message of messages) {
    // Get the full message details
    const messageResponse = await gmail.users.messages.get({
      userId: "me",
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

  return auth;
}

/**
 * Sends a reply to emails that have no prior replies.
 *
 * @param {google.auth.OAuth2} auth An authorized OAuth2 client.
 * @returns {Promise<google.auth.OAuth2>} An authorized OAuth2 client.
 */
async function replyToEmails(auth) {
  const gmail = google.gmail({ version: "v1", auth });

  // Fetch emails
  const response = await gmail.users.messages.list({
    userId: "me",
    labelIds: ["INBOX","UNREAD"],
  });

  const messages = response.data.messages || [];
  
  for (const message of messages) {
    console.log("Message,content",message);   
    // Check if the email has any prior replies
    const threadResponse = await gmail.users.threads.get({
      userId: "me",
      id: message.threadId,
    });

    const thread = threadResponse.data;
    const messagesInThread = thread.messages || [];

    // If no prior replies, send a reply
    if (messagesInThread.length === 1) {
      const replyMessage = createReplyMessage(message);
      await gmail.users.messages.send({
        userId: "me",
        requestBody: replyMessage,
      });
      console.log("Reply sent:", message.id);
    }
    break;
  }

  return auth;
}

/**
 * Adds a label to the emails and moves them to the label.
 *
 * @param {google.auth.OAuth2} auth An authorized OAuth2 client.
 * @returns {Promise<google.auth.OAuth2>} An authorized OAuth2 client.
 */
async function addLabelToEmails(auth) {
  const gmail = google.gmail({ version: "v1", auth });

  // Get or create the label
  const labelResponse = await gmail.users.labels.list({ userId: "me" });
  const labels = labelResponse.data.labels || [];
  let labelId = null;

  for (const label of labels) {
    if (label.name === LABEL_NAME) {
      labelId = label.id;
      break;
    }
  }

  if (!labelId) {
    const createLabelResponse = await gmail.users.labels.create({
      userId: "me",
      requestBody: {
        label: {
          name: LABEL_NAME,
          labelListVisibility: "labelShow",
          messageListVisibility: "show",
        },
      },
    });

    labelId = createLabelResponse.data.id;
    console.log("Label created:", LABEL_NAME);
  }

  // Apply the label to the emails
  const response = await gmail.users.messages.list({
    userId: "me",
    labelIds: ["INBOX"],
  });

  const messages = response.data.messages || [];

  for (const message of messages) {
    await gmail.users.messages.modify({
      userId: "me",
      id: message.id,
      requestBody: {
        addLabelIds: [labelId],
        removeLabelIds: ["INBOX"],
      },
    });
    console.log("Label added to email:", message.id);
  }

  return auth;
}

/**
 * Creates a reply message.
 *
 * @param {object} message The original message object.
 * @returns {object} The reply message object.
 */
function createReplyMessage(message) {
  const replySubject = "Re: " + getMessageHeaderValue(message, "Subject");
  const replyBody = "Thank you for your email. This is an automated reply from Mohammed Faisal";

  return {
    threadId: message.threadId,
    requestBody: {
      message: {
        raw: createRawMessage(getMessageHeaderValue(message, "From"), replySubject, replyBody),
      },
    },
  };
}

/**
 * Creates a raw message string.
 *
 * @param {string} to The recipient of the message.
 * @param {string} subject The subject of the message.
 * @param {string} body The body content of the message.
 * @returns {string} The raw message string.
 */
function createRawMessage(to, subject, body) {
  const messageParts = [
    `To: ${to}`,
    "Content-Type: text/plain; charset=\"UTF-8\"",
    "MIME-Version: 1.0",
    `Subject: ${subject}`,
    "",
    body,
  ];

  return Buffer.from(messageParts.join("\n")).toString("base64");
}

/**
 * Retrieves a specific header value from a message.
 *
 * @param {object} message The message object.
 * @param {string} headerName The name of the header.
 * @param {object} gmail An instance of the Gmail API client.
 * @returns {Promise<string|null>} A promise that resolves with the value of the header, or null if not found.
 */
async function getMessageHeaderValue(message, headerName, gmail) {
    if (!message || !message.id) {
      return null;
    }
  
    try {
      const response = await gmail.users.messages.get({
        userId: 'me',
        id: message.id,
      });
  
      const headers = response.data.payload.headers || [];
  
      for (const header of headers) {
        if (header.name.toLowerCase() === headerName.toLowerCase()) {
          return header.value;
        }
      }
  
      return null;
    } catch (error) {
      console.error('Error retrieving message details:', error);
      return null;
    }
  }
  
  
/**
 * Retrieves the body content of a message.
 *
 * @param {object} message The message object.
 * @param {object} gmail An instance of the Gmail API client.
 * @returns {Promise<string>} A promise that resolves with the body content of the message.
 */
async function getMessageBody(message, gmail) {
    if (!message || !message.id) {
      return "";
    }
  
    try {
      const response = await gmail.users.messages.get({
        userId: "me",
        id: message.id,
        format: "full",
      });
  
      const parts = response.data.payload.parts || [];
      const bodyPart = parts.find((part) => part.mimeType === "text/plain");
  
      if (bodyPart) {
        const body = bodyPart.body;
        if (body.size && body.data) {
          return Buffer.from(body.data, "base64").toString("utf-8");
        }
      }
  
      return "";
    } catch (error) {
      console.error("Error retrieving message body:", error);
      return "";
    }
  }
  

// Main function
authorize()
  .then((auth) => {
    console.log("Authorization successful.");
    startEmailProcessing(auth);
  })
  .catch((error) => {
    console.error("Authorization failed:", error);
  });
