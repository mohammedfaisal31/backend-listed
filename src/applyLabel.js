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

// Function to add a label to an email
async function addLabelToEmail(emailId, labelName) {
  // Add label to email logic here
  // ...
}

module.exports = { addLabelToEmail };
