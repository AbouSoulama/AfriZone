import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useAdminCountry } from '../../context/AdminCountryContext';
import { formatPrice } from '../../services/catalog';
import {
  assignParcelToDriver,
  fetchAllDeliveriesAdmin,
  fetchApprovedDrivers,
  fetchAssignableOrders,
  fetchAssignableParcels,
} from '../../services/admin-drivers';
import {
  createDeliveryBatch,
  fetchAdminBatches,
  isOverdueDelivery,
  reclaimOverdueDeliveries,
  type DeliveryBatchView,
} from '../../services/delivery-batches';
import {
  DELIVERY_STATUS_LABELS,
  type DeliveryView,
  type DriverProfile,
} from '../../services/drivers';
import { countryCodeFromLabelOrCity } from '../../types/catalog';

export default function AdminDeliveriesPage() {
  const { user } = useAuth();
  const { adminCountry, adminCountryName } = useAdminCountry();
  const [drivers, setDrivers] = useState<DriverProfile[]>([]);
  const [orders, setOrders] = useState<Awaited<ReturnType<typeof fetchAssignableOrders>>>([]);
  const [parcels, setParcels] = useState<Awaited<ReturnType<typeof fetchAssignableParcels>>>([]);
  const [deliveries, setDeliveries] = useState<(DeliveryView & { driverCode?: string | null })[]>(
    []
  );
  const [batches, setBatches] = useState<DeliveryBatchView[]>([]);
  const [selectedDriver, setSelectedDriver] = useState('');
  const [selectedOrders, setSelectedOrders] = useState<string[]>([]);
  const [offeredFee, setOfferedFee] = useState('3000');
  const [batchNotes, setBatchNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const [d, o, p, all, b] = await Promise.all([
        fetchApprovedDrivers(adminCountry),
        fetchAssignableOrders(adminCountry),
        fetchAssignableParcels(),
        fetchAllDeliveriesAdmin(),
        fetchAdminBatches(),
      ]);
      const filteredParcels =
        adminCountry === 'ALL'
          ? p
          : p.filter((parcel) => {
              const from =
                countryCodeFromLabelOrCity(parcel.pickup_city) ||
                countryCodeFromLabelOrCity(parcel.delivery_city);
              return from === adminCountry;
            });
      const filteredDeliveries =
        adminCountry === 'ALL'
          ? all
          : all.filter((job) => {
              const from =
                countryCodeFromLabelOrCity(job.pickupCity) ||
                countryCodeFromLabelOrCity(job.deliveryCity);
              return from === adminCountry;
            });
      setDrivers(d);
      setOrders(o);
      setParcels(filteredParcels);
      setDeliveries(filteredDeliveries);
      setBatches(b);
      setSelectedDriver((prev) => (d.some((x) => x.id === prev) ? prev : d[0]?.id || ''));
      setSelectedOrders((prev) => prev.filter((id) => o.some((x) => x.id === id)));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [adminCountry]);

  const toggleOrder = (id: string) => {
    setSelectedOrders((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const onCreateBatch = async () => {
    if (!selectedDriver || selectedOrders.length === 0) return;
    const fee = Math.round(Number(offeredFee));
    if (!Number.isFinite(fee) || fee < 0) {
      setError('Prix de livraison invalide.');
      return;
    }
    setBusy(true);
    try {
      await createDeliveryBatch(selectedDriver, selectedOrders, fee, batchNotes);
      setSelectedOrders([]);
      setBatchNotes('');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur');
    } finally {
      setBusy(false);
    }
  };

  const onAssignParcel = async (parcelId: string) => {
    if (!user || !selectedDriver) return;
    setBusy(true);
    try {
      await assignParcelToDriver(user.id, parcelId, selectedDriver);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur');
    } finally {
      setBusy(false);
    }
  };

  const onReclaim = async (deliveryId?: string, batchId?: string) => {
    setBusy(true);
    try {
      const n = await reclaimOverdueDeliveries({ deliveryId, batchId });
      if (!n) setError('Aucune course retirée (délai non atteint ou déjà démarrée).');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur');
    } finally {
      setBusy(false);
    }
  };

  const overdue = useMemo(
    () =>
      deliveries.filter((d) =>
        isOverdueDelivery({
          status: d.status,
          assignedAt: d.assignedAt,
          acceptedAt: d.acceptedAt,
        })
      ),
    [deliveries]
  );

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-extrabold mb-2">Courses groupées</h1>
        <p className="text-sm text-gray-500 mb-1">{adminCountryName}</p>
        <p className="text-sm text-gray-500">
          Sélectionnez plusieurs commandes, fixez le prix de livraison, proposez au livreur.
          Il peut accepter ou refuser. Délai : 2 h pour accepter / démarrer.
        </p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-4 text-sm">
          {error}
        </div>
      )}

      <div className="bg-white border rounded-2xl p-4 grid md:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-bold mb-2">Livreur</label>
          <select
            value={selectedDriver}
            onChange={(e) => setSelectedDriver(e.target.value)}
            className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl bg-white"
          >
            {drivers.length === 0 && <option value="">Aucun livreur approuvé</option>}
            {drivers.map((d) => (
              <option key={d.id} value={d.id}>
                {d.driverCode} — {d.city} ({d.vehicleType})
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-bold mb-2">Prix lot (FCFA)</label>
          <input
            type="number"
            min={0}
            value={offeredFee}
            onChange={(e) => setOfferedFee(e.target.value)}
            className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl"
          />
        </div>
        <div>
          <label className="block text-sm font-bold mb-2">Note (optionnel)</label>
          <input
            value={batchNotes}
            onChange={(e) => setBatchNotes(e.target.value)}
            placeholder="Ex. zone Ouaga centre"
            className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl"
          />
        </div>
      </div>

      {loading ? (
        <div className="h-32 bg-white rounded-2xl border animate-pulse" />
      ) : (
        <>
          <section>
            <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
              <h2 className="font-extrabold">
                Commandes ({selectedOrders.length}/{orders.length} sélectionnées)
              </h2>
              <button
                type="button"
                disabled={busy || !selectedDriver || selectedOrders.length === 0}
                onClick={() => void onCreateBatch()}
                className="px-4 py-2.5 bg-[#FF6B00] text-white rounded-xl text-sm font-bold disabled:opacity-50"
              >
                Proposer le lot ({formatPrice(Number(offeredFee) || 0)})
              </button>
            </div>
            {orders.length === 0 ? (
              <p className="text-sm text-gray-500">Aucune commande disponible.</p>
            ) : (
              <div className="space-y-2">
                {orders.map((o) => {
                  const checked = selectedOrders.includes(o.id);
                  return (
                    <label
                      key={o.id}
                      className={`bg-white border rounded-xl p-4 flex items-center gap-3 cursor-pointer ${
                        checked ? 'border-[#FF6B00] bg-orange-50/40' : ''
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleOrder(o.id)}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="font-mono font-bold text-[#FF6B00] text-sm">
                          {o.order_number}
                        </p>
                        <p className="text-xs text-gray-500">
                          {o.shipping_city} · {formatPrice(Number(o.total))} · {o.status}
                        </p>
                      </div>
                    </label>
                  );
                })}
              </div>
            )}
          </section>

          <section>
            <h2 className="font-extrabold mb-3">Lots récents</h2>
            {batches.length === 0 ? (
              <p className="text-sm text-gray-500">Aucun lot.</p>
            ) : (
              <div className="space-y-2">
                {batches.slice(0, 15).map((b) => (
                  <div
                    key={b.id}
                    className="bg-white border rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div>
                      <p className="font-bold">
                        {formatPrice(b.offeredFee)} · {b.deliveryCount ?? 0} course(s) ·{' '}
                        <span className="text-[#FF6B00]">{b.status}</span>
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        {(b.orderNumbers || []).join(', ') || '—'} · deadline{' '}
                        {new Date(b.acceptDeadlineAt).toLocaleString('fr-FR')}
                      </p>
                    </div>
                    {['offered', 'accepted'].includes(b.status) && (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void onReclaim(undefined, b.id)}
                        className="px-3 py-2 border border-red-200 text-red-600 rounded-xl text-xs font-bold"
                      >
                        Retirer / réassigner
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>

          {overdue.length > 0 && (
            <section>
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-extrabold text-red-600">
                  Retards SLA 2 h ({overdue.length})
                </h2>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void onReclaim()}
                  className="px-3 py-2 bg-red-600 text-white rounded-xl text-xs font-bold"
                >
                  Retirer tous les retards
                </button>
              </div>
              <div className="space-y-2">
                {overdue.map((d) => (
                  <div
                    key={d.id}
                    className="bg-red-50 border border-red-100 rounded-xl p-4 flex justify-between gap-3"
                  >
                    <div>
                      <p className="font-mono font-bold text-sm">
                        {d.orderNumber || d.parcelTracking}
                      </p>
                      <p className="text-xs text-gray-600">
                        {DELIVERY_STATUS_LABELS[d.status]} · {d.driverCode || '—'}
                      </p>
                    </div>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void onReclaim(d.id)}
                      className="px-3 py-2 bg-white border border-red-200 text-red-600 rounded-xl text-xs font-bold"
                    >
                      Retirer
                    </button>
                  </div>
                ))}
              </div>
            </section>
          )}

          <section>
            <h2 className="font-extrabold mb-3">Colis (assignation unitaire)</h2>
            {parcels.length === 0 ? (
              <p className="text-sm text-gray-500">Aucun colis disponible.</p>
            ) : (
              <div className="space-y-2">
                {parcels.map((p) => (
                  <div
                    key={p.id}
                    className="bg-white border rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div>
                      <p className="font-mono font-bold text-[#FF6B00] text-sm">
                        {p.tracking_number}
                      </p>
                      <p className="text-xs text-gray-500">
                        {p.pickup_city} → {p.delivery_city} · {formatPrice(Number(p.price))}
                      </p>
                    </div>
                    <button
                      type="button"
                      disabled={busy || !selectedDriver}
                      onClick={() => void onAssignParcel(p.id)}
                      className="px-3 py-2 bg-[#00A651] text-white rounded-xl text-xs font-bold disabled:opacity-50"
                    >
                      Assigner
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
