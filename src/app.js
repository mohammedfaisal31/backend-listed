const { google } = require("googleapis");
const authorize = require("./authorize");

const EMAIL_CHECK_INTERVAL_MIN = 45;
const EMAIL_CHECK_INTERVAL_MAX = 120;

/**
 * Starts the email processing loop.
 *
 * @param {google.auth.OAuth2} auth An authorized OAuth2 client.
 */
async function startEmailProcessing(auth) {
  const interval = getRandomInterval();
  console.log("Set an interval : ", interval/1000, ", Please wait");
  setInterval(() => {
    checkEmails(auth)
      .then(replyToEmailsandAddLabel)
      .catch((error) => {
        console.error("Error processing emails:", error);
      });
  }, interval);
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
    labelIds: ["INBOX", "UNREAD"],
  });

  const messages = response.data.messages || [];
  if (messages === []) {
    console.log("----------------------NO NEW EMAILS!-------------------");
    return auth;
  }
  let count = 0;
  console.log("NEW EMAILS");
  for (const message of messages) {
    // Get the full message details
    const messageResponse = await gmail.users.messages.get({
      userId: "me",
      id: message.id,
    });
    count++;
    const subject = await getMessageHeaderValue(
      messageResponse.data.payload.headers,
      "Subject"
    );
    const body = await getMessageBody(messageResponse.data);
    console.log(
      `\n+--------------------------------- EMAIL ${count} ----------------------------------------------+\n`
    );
    console.log("| Subject:", subject);
    console.log("|  Body:", body);
    console.log(
      `\n+---------------------------------------------------------------------------------------+`
    );

    if (count > 10) break;
  }

  return auth;
}

async function replyToEmailsandAddLabel(auth) {
  try {
    const gmail = google.gmail({ version: "v1", auth });

    // Fetch emails
    const response = await gmail.users.messages.list({
      userId: "me",
      labelIds: ["INBOX"],
    });
    const messages = response.data.messages || [];

    let count = 0;
    for (const message of messages) {
      count++;
      const threadResponse = await gmail.users.threads.get({
        userId: "me",
        id: message.threadId,
      });
      const messageResponse = await gmail.users.messages.get({
        userId: "me",
        id: message.id,
      });
      const thread = threadResponse.data;
      const messagesInThread = thread.messages || [];

      // If no prior replies, send a reply
      if (messagesInThread.length === 1) {
        const { subject, to, messageId } = getMessageHeaders(messageResponse);
        const replyMessage = createReplyMessage(
          subject,
          to,
          messageId,
          message.threadId
        );
        const reply_sent_response = await sendMessage(auth, replyMessage);
        console.log("Reply sent to message ID:", message.id);

        // Add a label to the sent reply
        const labelName = "PREMIUM";
        const labelId = await getOrCreateLabel(auth, labelName);

        const response_label_add = await gmail.users.messages.modify({
          auth: auth,
          userId: "me",
          id: reply_sent_response.data.id,
          resource: {
            addLabelIds: [labelId],
          },
        });
      } else {
        console.log(
          "Reply cannot sent to this message:",
          message.id,
          " as the chat has more than or equal to 2 threads"
        );
      }
      if(count > 10) break; // A test cap of 10 messages
    }
  } catch (error) {
    console.error("Error replying to emails:", error);
  }
}

/**
 * Retrieves the relevant headers from a message.
 *
 * @param {object} message The message object.
 * @returns {object} The relevant headers.
 */
function getMessageHeaders(message) {
  const headers = message.data.payload.headers || [];
  let subject = "";
  let to = "";
  let messageId = "";

  for (const header of headers) {
    const name = header.name.toLowerCase();
    if (name === "subject") {
      subject = header.value;
    } else if (name === "from") {
      to = header.value;
    } else if (name === "message-id" || name === "message-id") {
      messageId = header.value;
    }
  }

  return { subject, to, messageId };
}

/**
 * Sends a reply message.
 *
 * @param {google.auth.OAuth2} auth An authorized OAuth2 client.
 * @param {object} replyMessage The reply message object.
 * @returns {Promise<void>} A promise that resolves when the reply is sent.
 */
async function sendMessage(auth, replyMessage) {
  const gmail = google.gmail({ version: "v1", auth });

  return new Promise((resolve, reject) => {
    gmail.users.messages.send(
      {
        userId: "me",
        requestBody: replyMessage,
      },
      (err, response) => {
        if (err) {
          reject(err);
        } else {
          resolve(response);
        }
      }
    );
  });
}

/**
 * Creates a reply message object.
 *
 * @param {string} subject The subject of the original message.
 * @param {string} to The recipient of the original message.
 * @param {string} inReplyTo The Message-ID of the original message.
 * @param {string} threadId thread-ID to which reply email should be hooked
 * @returns {object} The reply message object.
 */
function createReplyMessage(subject, to, inReplyTo, threadId) {
  const replySubject = "Re: " + subject;
  const replyBody =
    "Thank you for your email. This is an automated reply from Mohammed Faisal";

  return {
    raw: makeBody(to, replySubject, replyBody, inReplyTo),
    threadId: threadId,
  };
}

/**
 * Creates a raw message string.
 *
 * @param {string} to The recipient of the message.
 * @param {string} subject The subject of the message.
 * @param {string} body The body content of the message.
 * @param {string} inReplyTo The Message-ID of the original message.
 * @returns {string} The raw message string.
 */
function makeBody(to, subject, body, inReplyTo) {
  const str = [
    'Content-Type: text/plain; charset="UTF-8"\n',
    "MIME-Version: 1.0\n",
    "Content-Transfer-Encoding: 7bit\n",
    "References: " + inReplyTo + "\n",
    "In-Reply-To: " + inReplyTo + "\n",
    "To: " + to + "\n",
    "Subject: " + subject + "\n\n",
    body,
  ].join("");

  const encodedMail = Buffer.from(str)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
  return encodedMail;
}

function getMessageHeaderValue(headers, name) {
  const header = headers.find(
    (header) => header.name.toLowerCase() === name.toLowerCase()
  );
  return header ? header.value : null;
}

function getMessageBody(msgData) {
  if (msgData && msgData.snippet) {
    const body = msgData.snippet;
    return body;
  }
  return null;
}

// Function to create or get the label ID based on label name
async function getOrCreateLabel(auth, labelName) {
  const gmail = google.gmail({ version: "v1", auth });

  // Get the list of all labels
  const labelsResponse = await gmail.users.labels.list({
    auth: auth,
    userId: "me",
  });

  const labels = labelsResponse.data.labels;
  let labelId = "";

  // Check if the label already exists
  const existingLabel = labels.find((label) => label.name === labelName);
  if (existingLabel) {
    labelId = existingLabel.id;
  } else {
    // Create a new label
    const createLabelResponse = await gmail.users.labels.create({
      auth: auth,
      userId: "me",
      resource: {
        name: labelName,
        labelListVisibility: "labelShow",
        messageListVisibility: "show",
      },
    });
    labelId = createLabelResponse.data.id;
  }

  return labelId;
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
