# AfriZone Livreur — App mobile

Application Android / iOS pour les livreurs AfriZone (hors stores).  
Même backend Supabase que le site web.

## Prérequis

1. Appliquer la migration `supabase/migrations/020_driver_wallet.sql` sur le projet Supabase.
2. Compte livreur avec statut `approved` dans la table `drivers`.
3. Node.js 20+ et compte Expo (pour les builds cloud EAS).

## Configuration

```bash
cd apps/driver-mobile
cp .env.example .env
# Renseigner EXPO_PUBLIC_SUPABASE_URL et EXPO_PUBLIC_SUPABASE_ANON_KEY
# (mêmes valeurs que VITE_SUPABASE_* du site)
npm install
npx expo start
```

> **Build EAS :** le fichier `.env` n’est **pas** uploadé. Les clés publiques sont dans `eas.json` (`build.*.env`). Sans ça, l’APK plantait au démarrage (`supabaseUrl is required`).

## Fonctionnalités MVP

- Connexion email / mot de passe Supabase
- Accueil : en ligne / hors ligne, KPI du jour, solde
- Courses groupées : prix fixé par l’admin, accepter / refuser (délai 2 h)
- Workflow : accepter → collecter → en route → **photo preuve** → livrée (+ GPS)
- Portefeuille : solde, gains (tarif du lot), retrait **vendredi → dimanche**
- Profil : véhicule, zones, compte OM / Wave / Moov / MTN
- Partage d’écran autorisé (Meet / Zoom / WhatsApp) — pas d’écran noir

## Build Android (APK sideload)

Distribution interne, **pas** Play Store.

```bash
# IMPORTANT : lancer depuis apps/driver-mobile (pas la racine du site Vite)
cd apps/driver-mobile
npm install -g eas-cli   # une fois
eas login
eas build -p android --profile preview
```

Le profil `preview` dans `eas.json` produit un **APK**.  
Télécharger le fichier depuis le dashboard Expo, puis :

1. Transférer l’APK sur le téléphone (Drive, WhatsApp, USB…).
2. Autoriser « sources inconnues » / installation d’apps externes.
3. Ouvrir l’APK et installer.

### Build local (sans EAS cloud)

```bash
npx expo prebuild -p android
cd android && ./gradlew assembleRelease
# APK : android/app/build/outputs/apk/release/app-release.apk
```

## iOS (TestFlight privé ou Ad Hoc)

Sans App Store public :

| Mode | Besoin |
|------|--------|
| **TestFlight** (recommandé) | Compte Apple Developer, build EAS `preview-ios` ou `production`, upload TestFlight, invitez les livreurs par email |
| **Ad Hoc** | UDID de chaque iPhone, profil de provisioning Ad Hoc, redistribution à chaque nouvel appareil |

```bash
eas build -p ios --profile preview-ios
```

Priorité terrain : **Android APK** pour les premiers livreurs ; iOS dès que les UDID / emails TestFlight sont recensés.

## Admin web

Les retraits se gèrent sur le site : `/admin/retraits` (valider / marquer payé / refuser).

## Notes

- Le crédit portefeuille se déclenche quand une course passe à `delivered` (trigger SQL).
- Le site `/livreur` reste utilisable en parallèle ; cette app est le client mobile dédié.
