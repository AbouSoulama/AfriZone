import React, { useCallback, useState } from 'react';
import {
  Alert,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import { Button, Card, Screen } from '../components/ui';
import { colors, spacing } from '../lib/theme';
import { formatXof } from '../lib/geo';
import {
  fetchDriverEarnings,
  fetchDriverWalletBalance,
  fetchDriverWithdrawals,
  fetchWithdrawnTotal,
  isWithdrawWindowOpen,
  requestDriverWithdrawal,
  WITHDRAWAL_STATUS_LABELS,
  type DriverEarning,
  type WithdrawalRequest,
} from '../services/wallet';

export default function WalletScreen() {
  const { driver } = useAuth();
  const [balance, setBalance] = useState(0);
  const [withdrawn, setWithdrawn] = useState(0);
  const [windowOpen, setWindowOpen] = useState(false);
  const [earnings, setEarnings] = useState<DriverEarning[]>([]);
  const [withdrawals, setWithdrawals] = useState<WithdrawalRequest[]>([]);
  const [amount, setAmount] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!driver) return;
    setError(null);
    try {
      const [b, open, earn, wds, paid] = await Promise.all([
        fetchDriverWalletBalance(driver.id),
        isWithdrawWindowOpen(),
        fetchDriverEarnings(driver.id),
        fetchDriverWithdrawals(driver.id),
        fetchWithdrawnTotal(driver.id),
      ]);
      setBalance(b);
      setWindowOpen(open);
      setEarnings(earn);
      setWithdrawals(wds);
      setWithdrawn(paid);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur portefeuille');
    }
  }, [driver]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const onWithdraw = async () => {
    const value = Math.round(Number(amount.replace(/\s/g, '').replace(',', '.')));
    if (!Number.isFinite(value) || value <= 0) {
      setError('Montant invalide.');
      return;
    }
    if (!windowOpen) {
      setError('Retrait disponible uniquement du vendredi au dimanche.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await requestDriverWithdrawal(value);
      setAmount('');
      Alert.alert('Demande envoyée', 'Un admin AfriZone traitera votre retrait.');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Retrait impossible');
    } finally {
      setBusy(false);
    }
  };

  if (!driver) {
    return (
      <Screen>
        <Text style={styles.pad}>Connectez-vous pour voir le portefeuille.</Text>
      </Screen>
    );
  }

  const pendingHold = withdrawals
    .filter((w) => w.status === 'pending' || w.status === 'approved')
    .reduce((s, w) => s + w.amount, 0);

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={styles.content}
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
      >
        <Text style={styles.title}>Portefeuille</Text>
        <Card>
          <Text style={styles.label}>Solde disponible</Text>
          <Text style={styles.balance}>{formatXof(balance)}</Text>
          <View style={styles.metaRow}>
            <Text style={styles.meta}>En attente retrait : {formatXof(pendingHold)}</Text>
            <Text style={styles.meta}>Déjà retiré : {formatXof(withdrawn)}</Text>
          </View>
          <View
            style={[
              styles.windowBanner,
              { backgroundColor: windowOpen ? '#ECFDF5' : '#FEF3C7' },
            ]}
          >
            <Text style={{ fontWeight: '700', color: windowOpen ? colors.success : colors.warning }}>
              {windowOpen
                ? 'Fenêtre de retrait ouverte (ven–dim)'
                : 'Retrait fermé — réouverture vendredi'}
            </Text>
          </View>
        </Card>

        <Card style={{ marginTop: spacing.md }}>
          <Text style={styles.section}>Demander un retrait</Text>
          <TextInput
            keyboardType="numeric"
            placeholder="Montant (F CFA)"
            placeholderTextColor={colors.muted}
            style={styles.input}
            value={amount}
            onChangeText={setAmount}
            editable={windowOpen}
          />
          <Button
            title="Retirer"
            variant="accent"
            loading={busy}
            disabled={!windowOpen}
            onPress={() => void onWithdraw()}
            style={{ marginTop: 10 }}
          />
          <Text style={styles.hint}>
            Minimum configurable côté admin (défaut 2 000 F). Compte Mobile Money requis dans Profil.
          </Text>
        </Card>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Text style={styles.sectionTitle}>Gains récents</Text>
        {earnings.length === 0 ? (
          <Text style={styles.empty}>Aucun gain crédité pour l’instant.</Text>
        ) : (
          earnings.map((e) => (
            <Card key={e.id} style={styles.line}>
              <View style={styles.lineRow}>
                <Text style={styles.lineTitle}>+{formatXof(e.netAmount)}</Text>
                <Text style={styles.lineDate}>
                  {new Date(e.createdAt).toLocaleDateString('fr-FR')}
                </Text>
              </View>
              {e.bonusAmount > 0 ? (
                <Text style={styles.meta}>dont bonus {formatXof(e.bonusAmount)}</Text>
              ) : null}
              {e.note ? <Text style={styles.meta}>{e.note}</Text> : null}
            </Card>
          ))
        )}

        <Text style={styles.sectionTitle}>Demandes de retrait</Text>
        {withdrawals.length === 0 ? (
          <Text style={styles.empty}>Aucune demande.</Text>
        ) : (
          withdrawals.map((w) => (
            <Card key={w.id} style={styles.line}>
              <View style={styles.lineRow}>
                <Text style={styles.lineTitle}>{formatXof(w.amount)}</Text>
                <Text style={styles.badge}>{WITHDRAWAL_STATUS_LABELS[w.status]}</Text>
              </View>
              <Text style={styles.meta}>
                Semaine {w.weekKey} · {new Date(w.createdAt).toLocaleString('fr-FR')}
              </Text>
            </Card>
          ))
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, paddingBottom: 48 },
  pad: { padding: spacing.lg },
  title: { fontSize: 28, fontWeight: '900', color: colors.ink, marginBottom: spacing.md },
  label: { color: colors.muted, fontWeight: '600' },
  balance: { fontSize: 32, fontWeight: '900', color: colors.brand, marginTop: 4 },
  metaRow: { marginTop: 10, gap: 4 },
  meta: { color: colors.muted, fontSize: 13 },
  windowBanner: { marginTop: 14, padding: 12, borderRadius: 10 },
  section: { fontWeight: '800', marginBottom: 8, color: colors.ink },
  sectionTitle: {
    marginTop: spacing.lg,
    marginBottom: 8,
    fontSize: 18,
    fontWeight: '800',
    color: colors.ink,
  },
  input: {
    backgroundColor: colors.bg,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: colors.ink,
  },
  hint: { marginTop: 8, color: colors.muted, fontSize: 12, lineHeight: 16 },
  error: { color: colors.danger, marginTop: 12, fontWeight: '600' },
  empty: { color: colors.muted },
  line: { marginBottom: 8 },
  lineRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  lineTitle: { fontWeight: '800', color: colors.ink, fontSize: 15 },
  lineDate: { color: colors.muted, fontSize: 12 },
  badge: {
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    overflow: 'hidden',
    fontSize: 12,
    fontWeight: '700',
    color: colors.ink,
  },
});
