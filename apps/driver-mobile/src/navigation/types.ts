export type MainTabParamList = {
  Home: undefined;
  Deliveries: undefined;
  Wallet: undefined;
  Profile: undefined;
};

export type RootStackParamList = {
  Login: undefined;
  MainTabs: { screen?: keyof MainTabParamList } | undefined;
  DeliveryDetail: { deliveryId: string };
};
