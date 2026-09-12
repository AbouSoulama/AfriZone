import React from 'react';
import { ActivityIndicator, Image, Text, View } from 'react-native';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useAuth } from '../context/AuthContext';
import LoginScreen from '../screens/LoginScreen';
import HomeScreen from '../screens/HomeScreen';
import DeliveriesScreen from '../screens/DeliveriesScreen';
import DeliveryDetailScreen from '../screens/DeliveryDetailScreen';
import WalletScreen from '../screens/WalletScreen';
import ProfileScreen from '../screens/ProfileScreen';
import { colors } from '../lib/theme';
import type { MainTabParamList, RootStackParamList } from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tabs = createBottomTabNavigator<MainTabParamList>();

const navTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: colors.brand,
    background: colors.bg,
    card: colors.card,
    text: colors.ink,
    border: colors.border,
    notification: colors.accent,
  },
};

function TabIcon({ label, focused }: { label: string; focused: boolean }) {
  const map: Record<string, string> = {
    Home: '🏠',
    Deliveries: '📦',
    Wallet: '💰',
    Profile: '👤',
  };
  return (
    <Text style={{ fontSize: 18, opacity: focused ? 1 : 0.55 }}>{map[label] || '•'}</Text>
  );
}

function MainTabs() {
  const { avatarUrl } = useAuth();

  return (
    <Tabs.Navigator
      screenOptions={({ route }) => ({
        headerShown: true,
        headerTitleStyle: { fontWeight: '800', color: colors.ink },
        headerStyle: { backgroundColor: colors.card },
        headerShadowVisible: false,
        tabBarActiveTintColor: colors.brand,
        tabBarInactiveTintColor: colors.muted,
        tabBarLabelStyle: { fontWeight: '800', fontSize: 11 },
        tabBarStyle: {
          backgroundColor: colors.card,
          borderTopColor: colors.border,
          height: 64,
          paddingBottom: 8,
          paddingTop: 6,
        },
        tabBarIcon: ({ focused }) =>
          route.name === 'Profile' && avatarUrl ? (
            <Image
              source={{ uri: avatarUrl }}
              style={{
                width: 24,
                height: 24,
                borderRadius: 12,
                borderWidth: focused ? 2 : 0,
                borderColor: colors.accent,
              }}
            />
          ) : (
            <TabIcon label={route.name} focused={focused} />
          ),
      })}
    >
      <Tabs.Screen name="Home" component={HomeScreen} options={{ title: 'Accueil', tabBarLabel: 'Accueil' }} />
      <Tabs.Screen
        name="Deliveries"
        component={DeliveriesScreen}
        options={{ title: 'Courses', tabBarLabel: 'Courses' }}
      />
      <Tabs.Screen
        name="Wallet"
        component={WalletScreen}
        options={{ title: 'Portefeuille', tabBarLabel: 'Portefeuille' }}
      />
      <Tabs.Screen
        name="Profile"
        component={ProfileScreen}
        options={{ title: 'Profil', tabBarLabel: 'Profil' }}
      />
    </Tabs.Navigator>
  );
}

export default function RootNavigator() {
  const { session, loading } = useAuth();

  if (loading) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: colors.brand,
        }}
      >
        <Image
          source={require('../../assets/logo-livraison.jpg')}
          style={{ width: 120, height: 120, borderRadius: 28, marginBottom: 20 }}
        />
        <ActivityIndicator color={colors.accent} size="large" />
      </View>
    );
  }

  return (
    <NavigationContainer theme={navTheme}>
      <Stack.Navigator>
        {!session ? (
          <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
        ) : (
          <>
            <Stack.Screen
              name="MainTabs"
              component={MainTabs}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="DeliveryDetail"
              component={DeliveryDetailScreen}
              options={{
                title: 'Détail course',
                headerTintColor: colors.brand,
                headerTitleStyle: { fontWeight: '800', color: colors.ink },
              }}
            />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
