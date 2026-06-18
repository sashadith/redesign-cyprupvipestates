import { defineType, defineField } from "sanity";

const formStandard = defineType({
  name: "formStandard",
  title: "Form Standard",
  type: "object",
  fields: [
    defineField({
      name: "formTitle",
      title: "Title",
      type: "string",
    }),
    defineField({
      name: "inputName",
      title: "Input Name",
      type: "string",
    }),
    defineField({
      name: "inputSurname",
      title: "Input Surname",
      type: "string",
    }),
    defineField({
      name: "inputPhone",
      title: "Input Phone",
      type: "string",
    }),
    defineField({
      name: "inputCountry",
      title: "Input Country",
      type: "string",
    }),
    defineField({
      name: "inputEmail",
      title: "Input Email",
      type: "string",
    }),
    defineField({
      name: "inputMessage",
      title: "Input Message",
      type: "string",
    }),
    defineField({
      name: "buttonText",
      title: "Button Text",
      type: "string",
    }),
    defineField({
      name: "agreementText",
      title: "Agreement Text",
      type: "string",
    }),
    defineField({
      name: "agreementLinkLabel",
      title: "Agreement Link Label",
      type: "string",
    }),
    defineField({
      name: "agreementLinkDestination",
      title: "Agreement Link Destination",
      type: "string",
    }),
    defineField({
      name: "validationNameRequired",
      title: "Validation Name Required",
      type: "string",
    }),
    defineField({
      name: "validationSurnameRequired",
      title: "Validation Surname Required",
      type: "string",
    }),
    defineField({
      name: "validationNameTooShort",
      title: "Validation Name Too Short",
      type: "string",
    }),
    defineField({
      name: "validationSurnameTooShort",
      title: "Validation Surname Too Short",
      type: "string",
    }),
    defineField({
      name: "validationNameTooLong",
      title: "Validation Name Too Long",
      type: "string",
    }),
    defineField({
      name: "validationSurnameTooLong",
      title: "Validation Surname Too Long",
      type: "string",
    }),
    defineField({
      name: "validationPhoneRequired",
      title: "Validation Phone Required",
      type: "string",
      description: "Validation message for phone input",
    }),
    defineField({
      name: "validationPhoneTooShort",
      title: "Validation Phone Too Short",
      type: "string",
      description: "Validation message for phone input",
    }),
    defineField({
      name: "validationPhoneTooLong",
      title: "Validation Phone Too Long",
      type: "string",
      description: "Validation message for phone input",
    }),
    defineField({
      name: "validationPhoneInvalid",
      title: "Validation Phone Invalid",
      type: "string",
    }),
    defineField({
      name: "validationCountryRequired",
      title: "Validation Country Required",
      type: "string",
      description: "Validation message for country input",
    }),
    defineField({
      name: "validationEmailRequired",
      title: "Validation Email Required",
      type: "string",
      description: "Validation message for email input",
    }),
    defineField({
      name: "validationEmailInvalid",
      title: "Validation Email Invalid",
      type: "string",
      description: "Validation message for invalid email",
    }),
    defineField({
      name: "validationMessageRequired",
      title: "Validation Message Required",
      type: "string",
      description: "Validation message for message input",
    }),
    defineField({
      name: "validationAgreementRequired",
      title: "Validation Agreement Required",
      type: "string",
      description: "Validation message for agreement checkbox",
    }),
    defineField({
      name: "validationAgreementOneOf",
      title: "Validation Agreement One Of",
      type: "string",
      description: "Validation message for agreement checkbox",
    }),
    defineField({
      name: "successMessage",
      title: "Success Message",
      type: "string",
      description: "Message displayed after successful form submission",
    }),
    defineField({
      name: "errorMessage",
      title: "Error Message",
      type: "string",
      description: "Message displayed after failed form submission",
    }),
    defineField({
      name: "spamBlockedMessage",
      title: "Spam Blocked Message",
      type: "string",
      description:
        "Message displayed if spam is detected (e.g., honeypot field filled or too fast submission)",
    }),
  ],
});

export default formStandard;
