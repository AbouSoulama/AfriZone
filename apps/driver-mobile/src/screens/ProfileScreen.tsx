import React, { useCallback, useState } from 'react';
import {
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '../context/AuthContext';
import { Button, Card, Pill, Screen } from '../components/ui';
import { colors, radii, spacing } from '../lib/theme';
import { VEHICLE_LABELS } from '../services/drivers';
import { uploadDriverAvatar } from '../services/profile';
import {
  fetchDriverPayoutAccount,
  PAYOUT_PROVIDER_LABELS,
  upsertDriverPayoutAccount,
  type PayoutProvider,
} from '../services/wallet';

const PROVIDERS = Object.keys(PAYOUT_PROVIDER_LABELS) as PayoutProvider[];

export default function ProfileScreen() {
  const { driver, signOut, user, avatarUrl, setAvatarUrl, fullName } = useAuth();
  const [provider, setProvider] = useState<PayoutProvider>('orange_money');
  const [phone, setPhone] = useState('');
  const [accountName, setAccountName] = useState('');
  const [busy, setBusy] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedHint, setSavedHint] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!driver) return;
    setError(null);
    try {
      const account = await fetchDriverPayoutAccount(driver.id);
      if (account) {
        setProvider(account.provider);
        setPhone(account.phone);
        setAccountName(account.accountName || '');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur profil');
    }
  }, [driver]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const pickAndUpload = async (fromCamera: boolean) => {
    if (!user?.id) return;
    setError(null);

    if (fromCamera) {
      const cam = await ImagePicker.requestCameraPermissionsAsync();
      if (!cam.granted) {
        setError('Permission caméra refusée.');
        return;
      }
    } else {
      const lib = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!lib.granted) {
        setError('Permission galerie refusée.');
        return;
      }
    }

    const result = fromCamera
      ? await ImagePicker.launchCameraAsync({
          mediaTypes: ['images'],
          allowsEditing: true,
          aspect: [1, 1],
          quality: 0.75,
        })
      : await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ['images'],
          allowsEditing: true,
          aspect: [1, 1],
          quality: 0.75,
        });

    if (result.canceled || !result.assets[0]) return;

    const asset = result.assets[0];
    setPhotoBusy(true);
    try {
      const url = await uploadDriverAvatar(
        user.id,
        asset.uri,
        asset.mimeType || 'image/jpeg'
      );
      setAvatarUrl(url);
      Alert.alert('Photo enregistrée', 'Votre photo de profil a été mise à jour.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload impossible');
    } finally {
      setPhotoBusy(false);
    }
  };

  const choosePhotoSource = () => {
    Alert.alert('Photo de profil', 'Choisissez une source', [
      { text: 'Caméra', onPress: () => void pickAndUpload(true) },
      { text: 'Galerie', onPress: () => void pickAndUpload(false) },
      { text: 'Annuler', style: 'cancel' },
    ]);
  };

  const save = async () => {
    if (!phone.trim()) {
      setError('Numéro Mobile Money / Wave requis.');
      return;
    }
    setBusy(true);
    setError(null);
    setSavedHint(null);
    try {
      await upsertDriverPayoutAccount({
        provider,
        phone: phone.trim(),
        accountName: accountName.trim() || undefined,
      });
      setSavedHint('Compte de retrait enregistré.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Enregistrement impossible');
    } finally {
      setBusy(false);
    }
  };

  if (!driver) {
    return (
      <Screen>
        <Text style={{ padding: spacing.lg }}>Aucun profil livreur.</Text>
      </Screen>
    );
  }

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Mon profil</Text>

        <Card style={styles.photoCard}>
          <Pressable onPress={choosePhotoSource} disabled={photoBusy}>
            <View style={styles.photoWrap}>
              <Image
                source={
                  avatarUrl
                    ? { uri: avatarUrl }
                    : require('../../assets/icon.jpg')
                }
                style={styles.photo}
              />
              <View style={styles.photoBadge}>
                <Text style={styles.photoBadgeText}>{photoBusy ? '…' : '✎'}</Text>
              </View>
            </View>
          </Pressable>
          <Text style={styles.photoHint}>
            {avatarUrl
              ? 'Appuyez pour changer votre photo'
              : 'Ajoutez votre photo de profil livreur'}
          </Text>
          <View style={styles.photoActions}>
            <Button
              title="Caméra"
              variant="ghost"
              loading={photoBusy}
              onPress={() => void pickAndUpload(true)}
              style={styles.photoBtn}
            />
            <Button
              title="Galerie"
              variant="accent"
              loading={photoBusy}
              onPress={() => void pickAndUpload(false)}
              style={styles.photoBtn}
            />
          </View>
        </Card>

        <Card style={{ marginTop: spacing.md }}>
          {fullName ? <Text style={styles.name}>{fullName}</Text> : null}
          <Text style={styles.code}>{driver.driverCode}</Text>
          <Pill label="LIVREUR" />
          <Text style={styles.meta}>
            {VEHICLE_LABELS[driver.vehicleType] || driver.vehicleType}
            {driver.vehiclePlate ? ` · ${driver.vehiclePlate}` : ''}
          </Text>
          <Text style={styles.meta}>
            {driver.city} ({driver.country})
          </Text>
          <Text style={styles.meta}>Zones : {driver.zones.join(', ') || '—'}</Text>
          <Text style={styles.meta}>
            Note {driver.rating.toFixed(1)} · {driver.totalDeliveries} livraisons
          </Text>
        </Card>

        <Text style={styles.section}>Compte de retrait</Text>
        <Card>
          <Text style={styles.label}>Opérateur</Text>
          <View style={styles.providers}>
            {PROVIDERS.map((p) => (
              <Pressable
                key={p}
                onPress={() => setProvider(p)}
                style={[styles.chip, provider === p && styles.chipOn]}
              >
                <Text style={[styles.chipText, provider === p && styles.chipTextOn]}>
                  {PAYOUT_PROVIDER_LABELS[p]}
                </Text>
              </Pressable>
            ))}
          </View>

          <Text style={styles.label}>Numéro</Text>
          <TextInput
            keyboardType="phone-pad"
            placeholder="ex. 70 00 00 00"
            placeholderTextColor={colors.muted}
            style={styles.input}
            value={phone}
            onChangeText={setPhone}
          />

          <Text style={styles.label}>Nom du titulaire</Text>
          <TextInput
            placeholder="Nom sur le compte"
            placeholderTextColor={colors.muted}
            style={styles.input}
            value={accountName}
            onChangeText={setAccountName}
          />

          {error ? <Text style={styles.error}>{error}</Text> : null}
          {savedHint ? <Text style={styles.ok}>{savedHint}</Text> : null}

          <Button
            title="Enregistrer le retrait"
            loading={busy}
            onPress={() => void save()}
            style={{ marginTop: 14 }}
          />
        </Card>

        <Button
          title="Se déconnecter"
          variant="ghost"
          onPress={() => void signOut()}
          style={{ marginTop: spacing.xl }}
        />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, paddingBottom: 48 },
  title: { fontSize: 28, fontWeight: '900', color: colors.ink, marginBottom: spacing.md },
  photoCard: { alignItems: 'center', backgroundColor: colors.brandSoft, borderColor: '#B7E7C8' },
  photoWrap: { position: 'relative' },
  photo: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 4,
    borderColor: colors.accent,
    backgroundColor: colors.card,
  },
  photoBadge: {
    position: 'absolute',
    right: 2,
    bottom: 2,
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.white,
  },
  photoBadgeText: { color: colors.white, fontWeight: '900', fontSize: 14 },
  photoHint: {
    marginTop: 12,
    color: colors.muted,
    fontWeight: '600',
    textAlign: 'center',
  },
  photoActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
    width: '100%',
  },
  photoBtn: { flex: 1 },
  name: { fontSize: 18, fontWeight: '800', color: colors.ink, marginBottom: 4 },
  code: { fontSize: 20, fontWeight: '900', color: colors.ink, marginBottom: 8 },
  meta: { color: colors.muted, marginTop: 6, fontWeight: '600' },
  section: {
    marginTop: spacing.lg,
    marginBottom: 8,
    fontSize: 18,
    fontWeight: '800',
    color: colors.ink,
  },
  label: { fontWeight: '800', color: colors.ink, marginTop: 12, marginBottom: 6 },
  providers: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radii.pill,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: colors.bg,
  },
  chipOn: { backgroundColor: colors.brand, borderColor: colors.brand },
  chipText: { fontWeight: '800', color: colors.ink, fontSize: 12 },
  chipTextOn: { color: colors.white },
  input: {
    backgroundColor: colors.bg,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: colors.ink,
  },
  error: { color: colors.danger, marginTop: 10, fontWeight: '700' },
  ok: { color: colors.success, marginTop: 10, fontWeight: '700' },
});
