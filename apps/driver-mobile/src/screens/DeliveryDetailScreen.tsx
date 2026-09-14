import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  Image,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type { RouteProp } from '@react-navigation/native';
import { useRoute } from '@react-navigation/native';
import * as Location from 'expo-location';
import * as ImagePicker from 'expo-image-picker';
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
  in_transit: 'Marquer livrée',
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

  const takeProofPhoto = async () => {
    const cam = await ImagePicker.requestCameraPermissionsAsync();
    if (!cam.granted) {
      setError('Permission caméra refusée.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      quality: 0.7,
      allowsEditing: true,
      aspect: [4, 3],
    });
    if (!result.canceled && result.assets[0]?.uri) {
      setProofUri(result.assets[0].uri);
    }
  };

  const advance = async () => {
    if (!driver || !delivery || !user) return;
    const next = nextDeliveryStatus(delivery.status);
    if (!next) return;

    if (next === 'delivered') {
      if (!proofUri) {
        Alert.alert(
          'Photo obligatoire',
          'Prenez une photo de vous avec le colis pour prouver la livraison.'
        );
        return;
      }
    }

    setBusy(true);
    setError(null);
    try {
      let proofUrl: string | undefined;
      if (next === 'delivered' && proofUri && !proofUri.startsWith('http')) {
        proofUrl = await uploadDeliveryProof(user.id, delivery.id, proofUri);
      } else if (next === 'delivered' && proofUri?.startsWith('http')) {
        proofUrl = proofUri;
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
      if (next === 'delivered') {
        Alert.alert('Livraison validée', 'Le gain sera crédité selon le tarif du lot.');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur');
    } finally {
      setBusy(false);
    }
  };

  const refuse = () => {
    if (!driver || !delivery) return;
    Alert.alert('Refuser la course ?', 'Cette action est définitive pour ce lot.', [
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
          {delivery.batchId ? ' · Lot groupé' : ''}
        </Text>

        {delivery.offeredFee != null && delivery.offeredFee > 0 ? (
          <Card style={{ marginTop: spacing.md, backgroundColor: '#ECFDF5' }}>
            <Text style={styles.section}>Rémunération proposée</Text>
            <Text style={styles.fee}>{formatXof(delivery.offeredFee)}</Text>
            <Text style={styles.meta}>
              Fixée par AfriZone — acceptez ou refusez. Délai 2 h pour accepter, puis 2 h pour
              démarrer.
            </Text>
          </Card>
        ) : null}

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
          <Button
            title="Ouvrir Maps (livraison)"
            variant="ghost"
            onPress={() => void openMaps('dropoff')}
            style={{ marginTop: 10 }}
          />
        </Card>

        {delivery.status === 'in_transit' || next === 'delivered' ? (
          <Card style={{ marginTop: spacing.md }}>
            <Text style={styles.section}>Preuve de livraison</Text>
            <Text style={styles.meta}>
              Photo de vous avec le colis remis (état visible). Obligatoire pour valider.
            </Text>
            {proofUri ? (
              <Image source={{ uri: proofUri }} style={styles.proof} />
            ) : null}
            <Button
              title={proofUri ? 'Reprendre la photo' : 'Prendre la photo'}
              variant="secondary"
              onPress={() => void takeProofPhoto()}
              style={{ marginTop: 10 }}
            />
          </Card>
        ) : null}

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

        {error ? <Text style={styles.error}>{error}</Text> : null}

        {actionLabel && next ? (
          <Button
            title={actionLabel}
            variant="accent"
            loading={busy}
            onPress={() => void advance()}
            style={{ marginTop: spacing.lg }}
          />
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
  fee: { fontSize: 28, fontWeight: '900', color: colors.success },
  addr: { fontSize: 15, fontWeight: '600', color: colors.ink },
  city: { color: colors.muted, marginTop: 2 },
  meta: { color: colors.muted, marginTop: 6, fontSize: 13, lineHeight: 18 },
  proof: { width: '100%', height: 200, borderRadius: 12, marginTop: 10, backgroundColor: '#E5E7EB' },
  error: { color: colors.danger, marginTop: 12, fontWeight: '600' },
});
