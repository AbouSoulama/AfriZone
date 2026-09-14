import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useAdminCountry } from '../../context/AdminCountryContext';
import { formatPrice } from '../../services/catalog';
import {
  assignParcelToDriver,
  createDeliveryBatch,
  fetchAllDeliveriesAdmin,
  fetchApprovedDrivers,
  fetchAssignableOrders,
  fetchAssignableParcels,
  isDeliveryOverdue,
  reclaimDelivery,
} from '../../services/admin-drivers';
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
  const [selectedDriver, setSelectedDriver] = useState('');
  const [selectedOrders, setSelectedOrders] = useState<string[]>([]);
  const [offeredFee, setOfferedFee] = useState('3000');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const [d, o, p, all] = await Promise.all([
        fetchApprovedDrivers(adminCountry),
        fetchAssignableOrders(adminCountry),
        fetchAssignableParcels(),
        fetchAllDeliveriesAdmin(),
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
    if (!selectedDriver || selectedOrders.length === 0) {
      setError('Choisissez un livreur et au moins une commande.');
      return;
    }
    const fee = Math.round(Number(offeredFee));
    if (!Number.isFinite(fee) || fee < 0) {
      setError('Prix de livraison invalide.');
      return;
    }
    setBusy(true);
    try {
      await createDeliveryBatch(selectedDriver, selectedOrders, fee, notes.trim() || undefined);
      setSelectedOrders([]);
      setNotes('');
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

  const onReclaim = async (deliveryId: string) => {
    if (!confirm('Retirer cette course au livreur pour la réassigner ?')) return;
    setBusy(true);
    try {
      await reclaimDelivery(deliveryId);
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
        isDeliveryOverdue({
          status: d.status,
          assignedAt: d.assignedAt,
          acceptedAt: d.acceptedAt,
          acceptDeadlineAt: d.acceptDeadlineAt,
          startDeadlineAt: d.startDeadlineAt,
        })
      ),
    [deliveries]
  );

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-extrabold mb-2">Assignation des courses</h1>
        <p className="text-sm text-gray-500 mb-1">{adminCountryName}</p>
        <p className="text-sm text-gray-500">
          Groupe plusieurs commandes, fixe le prix de livraison, le livreur accepte ou refuse (délai
          2 h).
        </p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-4 text-sm">
          {error}
        </div>
      )}

      <div className="bg-white border rounded-2xl p-4 space-y-4">
        <div>
          <label className="block text-sm font-bold mb-2">Livreur cible</label>
          <select
            value={selectedDriver}
            onChange={(e) => setSelectedDriver(e.target.value)}
            className="w-full max-w-md px-4 py-3 border-2 border-gray-200 rounded-xl bg-white"
          >
            {drivers.length === 0 && <option value="">Aucun livreur approuvé</option>}
            {drivers.map((d) => (
              <option key={d.id} value={d.id}>
                {d.driverCode} — {d.city} ({d.vehicleType})
              </option>
            ))}
          </select>
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-bold mb-2">Prix livraison lot (FCFA) *</label>
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
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ex. zone Ouaga centre"
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl"
            />
          </div>
        </div>
        <button
          type="button"
          disabled={busy || !selectedDriver || selectedOrders.length === 0}
          onClick={() => void onCreateBatch()}
          className="px-4 py-3 bg-[#FF6B00] text-white rounded-xl text-sm font-bold disabled:opacity-50"
        >
          Assigner le lot ({selectedOrders.length} cmd) — {formatPrice(Number(offeredFee) || 0)}
        </button>
      </div>

      {loading ? (
        <div className="h-32 bg-white rounded-2xl border animate-pulse" />
      ) : (
        <>
          <section>
            <h2 className="font-extrabold mb-3">
              Commandes à grouper ({orders.length}) — cochez puis assignez
            </h2>
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
                        className="w-4 h-4"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="font-mono font-bold text-[#FF6B00] text-sm">{o.order_number}</p>
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
            <h2 className="font-extrabold mb-3">Colis à assigner ({parcels.length})</h2>
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

          {overdue.length > 0 && (
            <section>
              <h2 className="font-extrabold mb-3 text-red-700">
                Retards SLA 2 h ({overdue.length})
              </h2>
              <div className="space-y-2">
                {overdue.map((d) => (
                  <div
                    key={d.id}
                    className="bg-red-50 border border-red-100 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-sm"
                  >
                    <div>
                      <p className="font-mono font-bold text-[#FF6B00]">
                        {d.kind === 'order' ? d.orderNumber : d.parcelTracking}
                      </p>
                      <p className="text-xs text-gray-600">
                        {DELIVERY_STATUS_LABELS[d.status]} · {d.driverCode || '—'} · dépassé 2 h
                      </p>
                    </div>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void onReclaim(d.id)}
                      className="px-3 py-2 bg-red-600 text-white rounded-xl text-xs font-bold disabled:opacity-50"
                    >
                      Retirer & libérer
                    </button>
                  </div>
                ))}
              </div>
            </section>
          )}

          <section>
            <h2 className="font-extrabold mb-3">Courses récentes</h2>
            <div className="space-y-2">
              {deliveries.slice(0, 30).map((d) => {
                const late = isDeliveryOverdue({
                  status: d.status,
                  assignedAt: d.assignedAt,
                  acceptedAt: d.acceptedAt,
                  acceptDeadlineAt: d.acceptDeadlineAt,
                  startDeadlineAt: d.startDeadlineAt,
                });
                return (
                  <div key={d.id} className="bg-white border rounded-xl p-4 text-sm">
                    <div className="flex justify-between gap-2">
                      <p className="font-mono font-bold text-[#FF6B00]">
                        {d.kind === 'order' ? d.orderNumber : d.parcelTracking}
                      </p>
                      <span className="text-xs font-bold text-gray-600">
                        {DELIVERY_STATUS_LABELS[d.status]}
                        {late ? ' · RETARD' : ''}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      Livreur {d.driverCode || '—'} · {d.pickupCity} → {d.deliveryCity}
                      {d.offeredFee != null ? ` · ${formatPrice(d.offeredFee)}` : ''}
                      {d.batchId ? ' · lot' : ''}
                    </p>
                    {(d.status === 'assigned' || d.status === 'accepted') && (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void onReclaim(d.id)}
                        className="mt-2 text-xs font-bold text-red-600"
                      >
                        Retirer au livreur
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
