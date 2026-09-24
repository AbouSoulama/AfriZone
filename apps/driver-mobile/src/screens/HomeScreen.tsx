import React, { useCallback, useState } from 'react';
import {
  Alert,
  Image,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { useAuth } from '../context/AuthContext';
import { BrandWordmark, Button, Card, Pill, Screen } from '../components/ui';
import { colors, spacing } from '../lib/theme';
import { formatXof } from '../lib/geo';
import {
  driverRespondBatch,
  fetchDriverStats,
  fetchOpenBatchesForDriver,
  formatDriverHandle,
  VEHICLE_LABELS,
} from '../services/drivers';
import { fetchDriverWalletBalance } from '../services/wallet';
import type { MainTabParamList } from '../navigation/types';

export default function HomeScreen() {
  const { driver, online, setOnline, signOut, avatarUrl, fullName } = useAuth();
  const navigation = useNavigation<BottomTabNavigationProp<MainTabParamList>>();
  const [stats, setStats] = useState({
    active: 0,
    assigned: 0,
    deliveredToday: 0,
    delivered: 0,
  });
  const [balance, setBalance] = useState(0);
  const [batches, setBatches] = useState<
    Awaited<ReturnType<typeof fetchOpenBatchesForDriver>>
  >([]);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [batchBusy, setBatchBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!driver) return;
    setError(null);
    try {
      const [s, b, open] = await Promise.all([
        fetchDriverStats(driver.id),
        fetchDriverWalletBalance(driver.id),
        fetchOpenBatchesForDriver(driver.id),
      ]);
      setStats(s);
      setBalance(b);
      setBatches(open);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur de chargement');
    }
  }, [driver]);

  const onBatch = (batchId: string, accept: boolean) => {
    setBatchBusy(batchId);
    void (async () => {
      try {
        await driverRespondBatch(batchId, accept);
        Alert.alert(
          accept ? 'Lot accepté' : 'Lot refusé',
          accept
            ? 'Les courses sont acceptées. Commencez sous 2 h.'
            : 'AfriZone pourra réassigner ces commandes.'
        );
        await load();
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Erreur lot');
      } finally {
        setBatchBusy(null);
      }
    })();
  };

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  if (!driver) {
    return (
      <Screen>
        <View style={styles.center}>
          <Text style={styles.title}>Profil livreur introuvable</Text>
          <Text style={styles.muted}>
            Votre compte n’est pas lié à un profil livreur validé.
          </Text>
          <Button title="Se déconnecter" variant="ghost" onPress={() => void signOut()} />
        </View>
      </Screen>
    );
  }

  if (driver.status !== 'approved') {
    return (
      <Screen>
        <View style={styles.center}>
          <Text style={styles.title}>Compte en attente</Text>
          <Text style={styles.muted}>
            Statut : {driver.status}
            {driver.rejectionReason ? `\n${driver.rejectionReason}` : ''}
          </Text>
          <Button title="Se déconnecter" variant="ghost" onPress={() => void signOut()} />
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            tintColor={colors.brand}
            onRefresh={async () => {
              setRefreshing(true);
              await load();
              setRefreshing(false);
            }}
          />
        }
      >
        <View style={styles.topBar}>
          <View>
            <BrandWordmark />
            <Pill label="LIVRAISON" />
          </View>
          <Image
            source={
              avatarUrl
                ? { uri: avatarUrl }
                : require('../../assets/icon.png')
            }
            style={styles.avatar}
          />
        </View>

        <Text style={styles.hello}>
          Bonjour{fullName ? `, ${fullName.split(' ')[0]}` : ''}
        </Text>
        <Text style={styles.code}>{driver.driverCode}</Text>
        <Text style={styles.city}>
          {driver.city} · {VEHICLE_LABELS[driver.vehicleType] || driver.vehicleType}
        </Text>

        <Card style={styles.handleCard}>
          <Text style={styles.handleLabel}>Identifiant à présenter à la remise</Text>
          <Text style={styles.handleValue} selectable>
            {formatDriverHandle(fullName, driver.driverCode)}
          </Text>
        </Card>

        <Card style={styles.onlineCard}>
          <View style={styles.onlineRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.onlineLabel}>{online ? 'En ligne' : 'Hors ligne'}</Text>
              <Text style={styles.mutedSmall}>
                {online ? 'Prêt à recevoir des courses' : 'Passez en ligne pour démarrer'}
              </Text>
            </View>
            <Switch
              value={online}
              onValueChange={(v) => void setOnline(v)}
              trackColor={{ true: colors.brand, false: colors.border }}
              thumbColor={online ? colors.accent : '#f4f4f4'}
            />
          </View>
        </Card>

        <Card style={{ marginTop: spacing.md, backgroundColor: colors.brand }}>
          <Text style={styles.balanceLabel}>Solde portefeuille</Text>
          <Text style={styles.balance}>{formatXof(balance)}</Text>
          <Button
            title="Voir le portefeuille"
            variant="accent"
            onPress={() => navigation.navigate('Wallet')}
            style={{ marginTop: 14 }}
          />
        </Card>

        <View style={styles.kpiRow}>
          <Card style={styles.kpi}>
            <Text style={styles.kpiValue}>{stats.assigned}</Text>
            <Text style={styles.kpiLabel}>Nouvelles</Text>
          </Card>
          <Card style={styles.kpi}>
            <Text style={[styles.kpiValue, { color: colors.accentDark }]}>{stats.active}</Text>
            <Text style={styles.kpiLabel}>En cours</Text>
          </Card>
          <Card style={styles.kpi}>
            <Text style={[styles.kpiValue, { color: colors.brand }]}>
              {stats.deliveredToday}
            </Text>
            <Text style={styles.kpiLabel}>Livrées (j)</Text>
          </Card>
        </View>

        {batches.length > 0 ? (
          <View style={{ marginTop: spacing.lg }}>
            <Text style={styles.sectionTitle}>Lots proposés (accepter / refuser)</Text>
            {batches.map((batch) => (
              <Card key={batch.id} style={{ marginBottom: 10 }}>
                <Text style={styles.batchFee}>{formatXof(batch.offeredFee)}</Text>
                <Text style={styles.mutedSmall}>
                  À accepter avant {new Date(batch.acceptDeadlineAt).toLocaleString('fr-FR')}
                </Text>
                {batch.notes ? <Text style={styles.mutedSmall}>{batch.notes}</Text> : null}
                <View style={styles.batchActions}>
                  <Button
                    title="Accepter"
                    variant="accent"
                    loading={batchBusy === batch.id}
                    onPress={() => onBatch(batch.id, true)}
                    style={{ flex: 1 }}
                  />
                  <Button
                    title="Refuser"
                    variant="danger"
                    loading={batchBusy === batch.id}
                    onPress={() => onBatch(batch.id, false)}
                    style={{ flex: 1 }}
                  />
                </View>
              </Card>
            ))}
          </View>
        ) : null}

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Button
          title="Mes courses"
          onPress={() => navigation.navigate('Deliveries')}
          style={{ marginTop: spacing.lg }}
        />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, paddingBottom: 48 },
  center: { flex: 1, justifyContent: 'center', padding: spacing.lg, gap: 12 },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.md,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 3,
    borderColor: colors.accent,
    backgroundColor: colors.brandSoft,
  },
  hello: { color: colors.muted, fontWeight: '700', fontSize: 14 },
  code: { fontSize: 26, fontWeight: '900', color: colors.ink, marginTop: 2 },
  city: { color: colors.muted, marginTop: 4, marginBottom: spacing.md, fontWeight: '600' },
  title: { fontSize: 20, fontWeight: '800', color: colors.ink, textAlign: 'center' },
  muted: { color: colors.muted, textAlign: 'center', lineHeight: 20 },
  mutedSmall: { color: colors.muted, fontSize: 12, marginTop: 2 },
  handleCard: { marginBottom: spacing.md, backgroundColor: colors.ink },
  handleLabel: { color: 'rgba(255,255,255,0.75)', fontSize: 11, fontWeight: '700' },
  handleValue: {
    color: colors.white,
    fontSize: 15,
    fontWeight: '900',
    marginTop: 4,
    letterSpacing: 0.3,
  },
  onlineCard: { backgroundColor: colors.brandSoft, borderColor: '#B7E7C8' },
  onlineRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  onlineLabel: { fontWeight: '900', fontSize: 16, color: colors.ink },
  balanceLabel: { color: 'rgba(255,255,255,0.85)', fontSize: 13, fontWeight: '700' },
  balance: { fontSize: 30, fontWeight: '900', color: colors.white, marginTop: 4 },
  kpiRow: { flexDirection: 'row', gap: 10, marginTop: spacing.md },
  kpi: { flex: 1, alignItems: 'center', paddingVertical: 14 },
  kpiValue: { fontSize: 22, fontWeight: '900', color: colors.ink },
  kpiLabel: { color: colors.muted, fontSize: 11, fontWeight: '700', marginTop: 2 },
  sectionTitle: { fontWeight: '900', fontSize: 16, color: colors.ink, marginBottom: 10 },
  batchFee: { fontSize: 22, fontWeight: '900', color: colors.brand },
  batchActions: { flexDirection: 'row', gap: 8, marginTop: 12 },
  error: { color: colors.danger, marginTop: 12, fontWeight: '700' },
});
