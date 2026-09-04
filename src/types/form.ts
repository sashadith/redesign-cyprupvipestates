export type Form = {
  inputName: string;
  inputSurname: string;
  inputPhone: string;
  inputCountry: string;
  inputEmail: string;
  inputMessage: string;
  buttonText: string;
  agreementText: string;
  agreementLinkLabel: string;
  agreementLinkDestination: string;
  /* Optional second link in the consent line, so a sentence like
     "Ich stimme den [AGB] und der [Datenschutzrichtlinie] zu" can point at two
     different documents. Absent for a locale that only links one — that renders
     exactly as before. */
  agreementText2?: string;
  agreementLink2Label?: string;
  agreementLink2Destination?: string;
  agreementTextEnd?: string;
  validationNameRequired: string;
  validationSurnameRequired: string;
  validationNameTooShort: string;
  validationNameTooLong: string;
  validationSurnameTooShort: string;
  validationSurnameTooLong: string;
  validationPhoneRequired: string;
  validationPhoneTooShort: string;
  validationPhoneTooLong: string;
  validationPhoneInvalid: string;
  validationCountryRequired: string;
  validationEmailRequired: string;
  validationEmailInvalid: string;
  validationMessageRequired: string;
  validationAgreementRequired: string;
  validationAgreementOneOf: string;
  successMessage: string;
  errorMessage: string;
  spamBlockedMessage: string;
};
