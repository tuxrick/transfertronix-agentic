export type RootStackParamList = {
  Login: undefined;
  VerifyOTP: {
    email: string;
  };
  Chat: undefined;
  Profile: undefined;
  PaymentMethods: undefined;
  Contacts: undefined;
  AddContact: {contactId?: string} | undefined;
  PurchaseRequests: undefined;
};
