import * as ScreenCapture from 'expo-screen-capture';
import React, { Component, useEffect, type ErrorInfo, type ReactNode } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AppState, Image, StyleSheet, Text, View } from 'react-native';
import { AuthProvider } from './src/context/AuthContext';
import RootNavigator from './src/navigation/RootNavigator';
import { colors } from './src/lib/theme';

/** Autorise le partage d’écran (Meet / Zoom / WhatsApp) — retire FLAG_SECURE. */
function AllowScreenShare() {
  useEffect(() => {
    void ScreenCapture.allowScreenCaptureAsync().catch((e) =>
      console.warn('[AfriZone] allowScreenCapture', e)
    );
  }, []);
  return null;
}

class ErrorBoundary extends Component<
  { children: ReactNode },
  { error: Error | null }
> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[AfriZone] crash', error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <View style={styles.crash}>
          <Image
            source={require('./assets/logo-livraison.jpg')}
            style={styles.crashLogo}
          />
          <Text style={styles.crashTitle}>AfriZone Livraison</Text>
          <Text style={styles.crashMsg}>
            L’application a rencontré une erreur au démarrage.
          </Text>
          <Text style={styles.crashDetail}>{this.state.error.message}</Text>
        </View>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  return (
    <SafeAreaProvider>
      <ErrorBoundary>
        <AuthProvider>
          <AllowScreenShare />
          <StatusBar style="dark" />
          <RootNavigator />
        </AuthProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  crash: {
    flex: 1,
    backgroundColor: colors.bg,
    justifyContent: 'center',
    padding: 24,
    alignItems: 'center',
  },
  crashLogo: { width: 96, height: 96, borderRadius: 22, marginBottom: 16 },
  crashTitle: { fontSize: 22, fontWeight: '900', color: colors.brand, marginBottom: 12 },
  crashMsg: { fontSize: 16, color: colors.ink, marginBottom: 8, textAlign: 'center' },
  crashDetail: { fontSize: 13, color: colors.muted, textAlign: 'center' },
});
