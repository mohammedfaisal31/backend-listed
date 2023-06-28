const checkEmails = require("./checkEmails");

checkEmails()
  .then(() => {
    console.log("Email processing completed.");
  })
  .catch((error) => {
    console.error("Error processing emails:", error);
  });
