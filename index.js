// index.js
const express = require("express");
const bodyParser = require("body-parser");
const { Contact } = require("./models");

const app = express();
app.use(bodyParser.json());

app.post("/identify", async (req, res) => {
  const { email, phoneNumber } = req.body;

  // Fetch contacts with the same email or phoneNumber
  const contacts = await Contact.findAll({
    where: {
      [Sequelize.Op.or]: [{ email }, { phoneNumber }],
    },
  });

  let primaryContact;
  let secondaryContacts = [];

  if (contacts.length === 0) {
    // No existing contacts, create a new primary contact
    primaryContact = await Contact.create({
      email,
      phoneNumber,
      linkPrecedence: "primary",
    });
  } else {
    // Existing contacts found
    primaryContact = contacts.find((c) => c.linkPrecedence === "primary");

    if (!primaryContact) {
      // If no primary contact is found, take the oldest contact as primary
      primaryContact = contacts.reduce((oldest, current) => {
        return new Date(current.createdAt) < new Date(oldest.createdAt)
          ? current
          : oldest;
      });
    }

    for (let contact of contacts) {
      if (contact.id !== primaryContact.id) {
        if (contact.linkPrecedence === "primary") {
          // Update primary contact to secondary and link to the primary contact
          await contact.update({
            linkedId: primaryContact.id,
            linkPrecedence: "secondary",
          });
        }
        secondaryContacts.push(contact);
      }
    }

    // Create new secondary contact if new information
    if (
      !contacts.some((c) => c.email === email && c.phoneNumber === phoneNumber)
    ) {
      const newContact = await Contact.create({
        email,
        phoneNumber,
        linkedId: primaryContact.id,
        linkPrecedence: "secondary",
      });
      secondaryContacts.push(newContact);
    }
  }

  const response = {
    contact: {
      primaryContatctId: primaryContact.id,
      emails: [
        primaryContact.email,
        ...secondaryContacts.map((c) => c.email).filter(Boolean),
      ],
      phoneNumbers: [
        primaryContact.phoneNumber,
        ...secondaryContacts.map((c) => c.phoneNumber).filter(Boolean),
      ],
      secondaryContactIds: secondaryContacts.map((c) => c.id),
    },
  };

  res.json(response);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
