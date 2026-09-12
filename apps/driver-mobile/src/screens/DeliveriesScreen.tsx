import React, { useCallback, useMemo, useState } from 'react';
import {
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuth } from '../context/AuthContext';
import { Card, EmptyState, Screen } from '../components/ui';
import { colors, spacing } from '../lib/theme';
import {
  DELIVERY_STATUS_LABELS,
  fetchDriverDeliveries,
  type DeliveryView,
} from '../services/drivers';
import type { RootStackParamList } from '../navigation/types';

const ACTIVE = new Set(['assigned', 'accepted', 'picked_up', 'in_transit']);

export default function DeliveriesScreen() {
  const { driver } = useAuth();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [rows, setRows] = useState<DeliveryView[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<'active' | 'all'>('active');

  const load = useCallback(async () => {
    if (!driver) return;
    setError(null);
    try {
      setRows(await fetchDriverDeliveries(driver.id));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur');
    }
  }, [driver]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const filtered = useMemo(
    () => (tab === 'active' ? rows.filter((r) => ACTIVE.has(r.status)) : rows),
    [rows, tab]
  );

  return (
    <Screen>
      <View style={styles.tabs}>
        <Pressable
          onPress={() => setTab('active')}
          style={[styles.tab, tab === 'active' && styles.tabOn]}
        >
          <Text style={[styles.tabText, tab === 'active' && styles.tabTextOn]}>En cours</Text>
        </Pressable>
        <Pressable
          onPress={() => setTab('all')}
          style={[styles.tab, tab === 'all' && styles.tabOn]}
        >
          <Text style={[styles.tabText, tab === 'all' && styles.tabTextOn]}>Toutes</Text>
        </Pressable>
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={async () => {
              setRefreshing(true);
              await load();
              setRefreshing(false);
            }}
          />
        }
        ListEmptyComponent={
          <EmptyState
            title="Aucune course"
            subtitle={
              tab === 'active'
                ? 'Les courses assignées apparaîtront ici.'
                : 'Historique vide pour le moment.'
            }
          />
        }
        renderItem={({ item }) => (
          <Pressable onPress={() => navigation.navigate('DeliveryDetail', { deliveryId: item.id })}>
            <Card style={styles.card}>
              <View style={styles.row}>
                <Text style={styles.badge}>{DELIVERY_STATUS_LABELS[item.status]}</Text>
                <Text style={styles.kind}>{item.kind === 'order' ? 'Commande' : 'Colis'}</Text>
              </View>
              <Text style={styles.ref}>
                {item.orderNumber || item.parcelTracking || item.id.slice(0, 8)}
              </Text>
              <Text style={styles.addr} numberOfLines={2}>
                {item.pickupCity} → {item.deliveryCity}
              </Text>
              <Text style={styles.sub} numberOfLines={1}>
                {item.deliveryAddress}
              </Text>
            </Card>
          </Pressable>
        )}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  tabs: {
    flexDirection: 'row',
    margin: spacing.md,
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 4,
    borderWidth: 1,
    borderColor: colors.border,
  },
  tab: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 10 },
  tabOn: { backgroundColor: colors.brand },
  tabText: { fontWeight: '800', color: colors.muted },
  tabTextOn: { color: '#fff' },
  list: { paddingHorizontal: spacing.md, paddingBottom: 40, gap: 10 },
  card: { marginBottom: 10 },
  row: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  badge: {
    backgroundColor: colors.brandSoft,
    color: colors.brandDark,
    fontWeight: '800',
    fontSize: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    overflow: 'hidden',
  },
  kind: { color: colors.muted, fontSize: 12, fontWeight: '600' },
  ref: { fontSize: 16, fontWeight: '800', color: colors.ink },
  addr: { marginTop: 4, color: colors.ink, fontWeight: '600' },
  sub: { marginTop: 2, color: colors.muted, fontSize: 13 },
  error: { color: colors.danger, paddingHorizontal: spacing.md },
});
