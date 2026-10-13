import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  Image,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import type { RouteProp } from '@react-navigation/native';
import { useRoute } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { useAuth } from '../context/AuthContext';
import { Button, Card, Screen } from '../components/ui';
import { colors, spacing } from '../lib/theme';
import {
  coordsForCity,
  formatXof,
  googleMapsDirectionsUrl,
  mapsQueryUrl,
  type LatLng,
} from '../lib/geo';
import {
  DELIVERY_STATUS_LABELS,
  fetchDriverDeliveryById,
  nextDeliveryStatus,
  prepareDeliveryRoute,
  pushDeliveryLocation,
  signalDriverArrival,
  confirmDeliveryWithCode,
  updateDeliveryStatusByDriver,
  uploadDeliveryProof,
  type DeliveryJobStatus,
  type DeliveryView,
} from '../services/drivers';
import type { RootStackParamList } from '../navigation/types';

const ACTION_LABELS: Partial<Record<DeliveryJobStatus, string>> = {
  assigned: 'Accepter la course',
  accepted: 'Marquer collectée',
  picked_up: 'Partir en livraison',
};

export default function DeliveryDetailScreen() {
  const { driver, user } = useAuth();
  const route = useRoute<RouteProp<RootStackParamList, 'DeliveryDetail'>>();
  const deliveryId = route.params.deliveryId;

  const [delivery, setDelivery] = useState<DeliveryView | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [gpsActive, setGpsActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [proofUri, setProofUri] = useState<string | null>(null);
  const [arrivalCode, setArrivalCode] = useState('');
  const watchRef = useRef<Location.LocationSubscription | null>(null);

  const load = useCallback(async () => {
    if (!driver) return;
    setError(null);
    try {
      const row = await fetchDriverDeliveryById(driver.id, deliveryId);
      setDelivery(row);
      if (row?.proofPhotoUrl) setProofUri(row.proofPhotoUrl);
      if (row && ['accepted', 'picked_up', 'in_transit'].includes(row.status)) {
        const preserve =
          row.deliveryLat != null && row.deliveryLng != null
            ? { lat: row.deliveryLat, lng: row.deliveryLng }
            : null;
        await prepareDeliveryRoute(
          row.id,
          row.pickupCity,
          row.deliveryCity,
          driver.vehicleType,
          preserve
        );
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur');
    } finally {
      setLoading(false);
    }
  }, [driver, deliveryId]);

  useEffect(() => {
    void load();
    return () => {
      watchRef.current?.remove();
      watchRef.current = null;
    };
  }, [load]);

  const stopGps = () => {
    watchRef.current?.remove();
    watchRef.current = null;
    setGpsActive(false);
  };

  const startGps = async () => {
    setError(null);
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      setError('Permission localisation refusée.');
      return;
    }
    stopGps();
    setGpsActive(true);
    watchRef.current = await Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.Balanced,
        timeInterval: 12000,
        distanceInterval: 40,
      },
      (pos) => {
        void pushDeliveryLocation(deliveryId, pos.coords.latitude, pos.coords.longitude).catch(
          (e) => console.warn('GPS push', e)
        );
      }
    );
  };

  useEffect(() => {
    if (!delivery) return;
    const shouldTrack = ['accepted', 'picked_up', 'in_transit'].includes(delivery.status);
    if (shouldTrack && !gpsActive) void startGps();
    if (!shouldTrack && gpsActive) stopGps();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [delivery?.status]);

  const takeProofPhoto = async (): Promise<string | null> => {
    if (!user?.id) return null;
    const cam = await ImagePicker.requestCameraPermissionsAsync();
    if (!cam.granted) {
      setError('Permission caméra refusée — requise pour la preuve de livraison.');
      return null;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      quality: 0.7,
      allowsEditing: false,
    });
    if (result.canceled || !result.assets[0]) return null;
    const asset = result.assets[0];
    setProofUri(asset.uri);
    const url = await uploadDeliveryProof(
      user.id,
      deliveryId,
      asset.uri,
      asset.mimeType || 'image/jpeg'
    );
    return url;
  };

  const advance = async () => {
    if (!driver || !delivery) return;
    const next = nextDeliveryStatus(delivery.status);
    if (!next) return;
    setBusy(true);
    setError(null);
    try {
      let proofUrl: string | undefined;
      if (next === 'delivered') {
        Alert.alert(
          'Preuve de livraison',
          'Prenez une photo de vous avec le colis pour prouver la remise en bon état.'
        );
        const url = await takeProofPhoto();
        if (!url) {
          setBusy(false);
          return;
        }
        proofUrl = url;
      }

      await updateDeliveryStatusByDriver(driver.id, delivery.id, next, {
        proofPhotoUrl: proofUrl,
      });
      if (next === 'accepted') {
        const preserve =
          delivery.deliveryLat != null && delivery.deliveryLng != null
            ? { lat: delivery.deliveryLat, lng: delivery.deliveryLng }
            : null;
        await prepareDeliveryRoute(
          delivery.id,
          delivery.pickupCity,
          delivery.deliveryCity,
          driver.vehicleType,
          preserve
        );
        await startGps();
      }
      if (next === 'delivered') stopGps();
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur');
    } finally {
      setBusy(false);
    }
  };

  const signalArrival = async () => {
    if (!delivery) return;
    setBusy(true);
    setError(null);
    try {
      await signalDriverArrival(delivery.id);
      await load();
      Alert.alert(
        'Code envoyé',
        'Le client a reçu un code à 6 chiffres par email et dans ses notifications. Demandez-le pour valider la remise.'
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur');
    } finally {
      setBusy(false);
    }
  };

  const confirmWithCode = async () => {
    if (!driver || !delivery) return;
    setBusy(true);
    setError(null);
    try {
      const url = await takeProofPhoto();
      if (!url) {
        setBusy(false);
        return;
      }
      await confirmDeliveryWithCode(delivery.id, arrivalCode, url);
      stopGps();
      setArrivalCode('');
      await load();
      Alert.alert('Livraison validée', 'Code confirmé. Preuve enregistrée.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur');
    } finally {
      setBusy(false);
    }
  };

  const refuse = () => {
    if (!driver || !delivery) return;
    Alert.alert('Refuser la course ?', 'Cette action est définitive.', [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Refuser',
        style: 'destructive',
        onPress: () => {
          void (async () => {
            setBusy(true);
            try {
              await updateDeliveryStatusByDriver(driver.id, delivery.id, 'refused');
              await load();
            } catch (e) {
              setError(e instanceof Error ? e.message : 'Erreur');
            } finally {
              setBusy(false);
            }
          })();
        },
      },
    ]);
  };

  const openMaps = async (target: 'pickup' | 'dropoff') => {
    if (!delivery) return;
    let dest: LatLng | null = null;
    if (target === 'pickup') {
      dest =
        delivery.pickupLat != null && delivery.pickupLng != null
          ? { lat: delivery.pickupLat, lng: delivery.pickupLng }
          : coordsForCity(delivery.pickupCity);
    } else {
      dest =
        delivery.deliveryLat != null && delivery.deliveryLng != null
          ? { lat: delivery.deliveryLat, lng: delivery.deliveryLng }
          : coordsForCity(delivery.deliveryCity);
    }

    let url: string;
    if (dest) {
      const pos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      }).catch(() => null);
      if (pos) {
        url = googleMapsDirectionsUrl(
          { lat: pos.coords.latitude, lng: pos.coords.longitude },
          dest
        );
      } else {
        url = mapsQueryUrl(
          target === 'pickup' ? delivery.pickupAddress : delivery.deliveryAddress,
          target === 'pickup' ? delivery.pickupCity : delivery.deliveryCity
        );
      }
    } else {
      url = mapsQueryUrl(
        target === 'pickup' ? delivery.pickupAddress : delivery.deliveryAddress,
        target === 'pickup' ? delivery.pickupCity : delivery.deliveryCity
      );
    }
    await Linking.openURL(url);
  };

  if (loading) {
    return (
      <Screen>
        <View style={styles.center}>
          <Text>Chargement…</Text>
        </View>
      </Screen>
    );
  }

  if (!delivery) {
    return (
      <Screen>
        <View style={styles.center}>
          <Text style={styles.error}>Course introuvable</Text>
        </View>
      </Screen>
    );
  }

  const next = nextDeliveryStatus(delivery.status);
  const actionLabel = ACTION_LABELS[delivery.status];

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.status}>{DELIVERY_STATUS_LABELS[delivery.status]}</Text>
        <Text style={styles.ref}>
          {delivery.orderNumber || delivery.parcelTracking || delivery.id.slice(0, 8)}
        </Text>
        <Text style={styles.kind}>
          {delivery.kind === 'order' ? 'Commande marketplace' : 'Colis'}
          {delivery.offeredFee != null ? ` · Gain lot ${formatXof(delivery.offeredFee)}` : ''}
        </Text>

        <Card style={{ marginTop: spacing.md }}>
          <Text style={styles.section}>Collecte</Text>
          <Text style={styles.addr}>{delivery.pickupAddress}</Text>
          <Text style={styles.city}>{delivery.pickupCity}</Text>
          <Button
            title="Ouvrir Maps (collecte)"
            variant="ghost"
            onPress={() => void openMaps('pickup')}
            style={{ marginTop: 10 }}
          />
        </Card>

        <Card style={{ marginTop: spacing.md }}>
          <Text style={styles.section}>Livraison</Text>
          <Text style={styles.addr}>{delivery.deliveryAddress}</Text>
          <Text style={styles.city}>{delivery.deliveryCity}</Text>
          {delivery.recipientName ? (
            <Text style={styles.meta}>Destinataire : {delivery.recipientName}</Text>
          ) : null}
          {delivery.recipientPhone ? (
            <Text style={styles.meta}>Tél. : {delivery.recipientPhone}</Text>
          ) : null}
          {delivery.notes ? <Text style={styles.meta}>Note : {delivery.notes}</Text> : null}
          <Button
            title="Ouvrir Maps (livraison)"
            variant="ghost"
            onPress={() => void openMaps('dropoff')}
            style={{ marginTop: 10 }}
          />
        </Card>

        <Card style={{ marginTop: spacing.md }}>
          <Text style={styles.section}>GPS course</Text>
          <Text style={styles.meta}>
            {gpsActive
              ? 'Partage de position actif (toutes les ~12 s).'
              : 'GPS inactif — démarrera après acceptation.'}
          </Text>
          {['accepted', 'picked_up', 'in_transit'].includes(delivery.status) ? (
            <Button
              title={gpsActive ? 'Relancer le GPS' : 'Activer le GPS'}
              variant="secondary"
              onPress={() => void startGps()}
              style={{ marginTop: 10 }}
            />
          ) : null}
        </Card>

        {(proofUri || delivery.proofPhotoUrl) && (
          <Card style={{ marginTop: spacing.md }}>
            <Text style={styles.section}>Preuve photo</Text>
            <Image
              source={{ uri: proofUri || delivery.proofPhotoUrl || undefined }}
              style={styles.proof}
            />
          </Card>
        )}

        {error ? <Text style={styles.error}>{error}</Text> : null}

        {actionLabel && next && next !== 'delivered' ? (
          <Button
            title={actionLabel}
            variant="accent"
            loading={busy}
            onPress={() => void advance()}
            style={{ marginTop: spacing.lg }}
          />
        ) : null}

        {delivery.status === 'in_transit' && !delivery.arrivedAt ? (
          <Button
            title="Je suis arrivé"
            variant="accent"
            loading={busy}
            onPress={() => void signalArrival()}
            style={{ marginTop: spacing.lg }}
          />
        ) : null}

        {delivery.status === 'in_transit' && delivery.arrivedAt ? (
          <Card style={{ marginTop: spacing.lg }}>
            <Text style={styles.section}>Code du client</Text>
            <Text style={styles.meta}>
              Un code à 6 chiffres a été envoyé au client. Saisissez-le, puis prenez la photo de
              preuve pour valider.
            </Text>
            <TextInput
              value={arrivalCode}
              onChangeText={(value) => setArrivalCode(value.replace(/\D/g, '').slice(0, 6))}
              keyboardType="number-pad"
              maxLength={6}
              placeholder="000000"
              placeholderTextColor={colors.muted}
              style={styles.codeInput}
            />
            <Button
              title="Photo + valider la livraison"
              variant="accent"
              loading={busy}
              disabled={arrivalCode.length !== 6}
              onPress={() => void confirmWithCode()}
              style={{ marginTop: 12 }}
            />
            <Button
              title="Renvoyer le code"
              variant="ghost"
              loading={busy}
              onPress={() => void signalArrival()}
              style={{ marginTop: 8 }}
            />
          </Card>
        ) : null}

        {delivery.status === 'assigned' ? (
          <Button
            title="Refuser"
            variant="danger"
            loading={busy}
            onPress={refuse}
            style={{ marginTop: 10 }}
          />
        ) : null}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, paddingBottom: 48 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  status: {
    alignSelf: 'flex-start',
    backgroundColor: colors.brandSoft,
    color: colors.brandDark,
    fontWeight: '800',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    overflow: 'hidden',
  },
  ref: { fontSize: 24, fontWeight: '900', color: colors.ink, marginTop: 12 },
  kind: { color: colors.muted, marginTop: 4 },
  section: { fontWeight: '800', color: colors.ink, marginBottom: 6 },
  addr: { fontSize: 15, fontWeight: '600', color: colors.ink },
  city: { color: colors.muted, marginTop: 2 },
  meta: { color: colors.muted, marginTop: 6, fontSize: 13 },
  error: { color: colors.danger, marginTop: 12, fontWeight: '600' },
  proof: { width: '100%', height: 220, borderRadius: 12, marginTop: 8, backgroundColor: '#E5E7EB' },
  codeInput: {
    marginTop: 12,
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: 12,
    paddingVertical: 14,
    textAlign: 'center',
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: 8,
    color: colors.ink,
    backgroundColor: colors.bg,
  },
});
