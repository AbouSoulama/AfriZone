import type { ConfigContext, ExpoConfig } from 'expo/config';

export default ({ config }: ConfigContext): ExpoConfig => {
  const next: ExpoConfig = {
    ...config,
    name: 'AfriZone Livraison',
    slug: 'afrizone-driver',
    version: '1.2.0',
    orientation: 'portrait',
    icon: './assets/icon.png',
    userInterfaceStyle: 'light',
    scheme: 'afrizone-driver',
    ios: {
      supportsTablet: false,
      bundleIdentifier: 'com.afrizone.driver',
      infoPlist: {
        NSLocationWhenInUseUsageDescription:
          'AfriZone utilise votre position pour partager le suivi GPS pendant les courses.',
        NSLocationAlwaysAndWhenInUseUsageDescription:
          'AfriZone utilise votre position pour le suivi des livraisons en cours.',
        NSCameraUsageDescription:
          'AfriZone a besoin de la caméra pour votre photo de profil livreur.',
        NSPhotoLibraryUsageDescription:
          'AfriZone a besoin d’accéder à vos photos pour votre profil livreur.',
        UIBackgroundModes: ['location'],
      },
    },
    android: {
      package: 'com.afrizone.driver',
      adaptiveIcon: {
        backgroundColor: '#1FAE4B',
        foregroundImage: './assets/adaptive-icon.png',
      },
      permissions: [
        'ACCESS_COARSE_LOCATION',
        'ACCESS_FINE_LOCATION',
        'CAMERA',
        'READ_MEDIA_IMAGES',
        'FOREGROUND_SERVICE',
        'FOREGROUND_SERVICE_LOCATION',
      ],
    },
    web: {
      favicon: './assets/favicon.png',
    },
    plugins: [
      'expo-image',
      'expo-screen-capture',
      [
        'expo-image-picker',
        {
          photosPermission:
            'AfriZone utilise vos photos pour la photo de profil livreur.',
          cameraPermission:
            'AfriZone utilise la caméra pour la photo de profil livreur et la preuve de livraison.',
        },
      ],
      [
        'expo-location',
        {
          locationAlwaysAndWhenInUsePermission:
            'Autoriser AfriZone à utiliser votre position pendant les courses.',
          isAndroidBackgroundLocationEnabled: false,
          isIosBackgroundLocationEnabled: false,
        },
      ],
    ],
    extra: {
      supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL ?? '',
      supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '',
      eas: {
        projectId: '62b1ac4d-403c-4c14-a285-c917d9c31d10',
      },
    },
  };

  (next as ExpoConfig & { splash?: Record<string, string> }).splash = {
    image: './assets/splash-icon.png',
    resizeMode: 'contain',
    backgroundColor: '#1FAE4B',
  };

  return next;
};
