import { useEffect, useMemo, useState } from 'react';
import { Clock, Eye, MapPin, Navigation, Package, Truck, User } from 'lucide-react';
import AdminModal from '../../components/admin/AdminModal';
import { useAuth } from '../../context/AuthContext';
import { useAdminCountry } from '../../context/AdminCountryContext';
import { formatPrice } from '../../services/catalog';
import {
  assignParcelToDriver,
  fetchAllDeliveriesAdmin,
  fetchApprovedDrivers,
  fetchAssignableOrderDetail,
  fetchAssignableOrders,
  fetchAssignableParcels,
  type AdminDeliveryView,
  type AssignableOrderDetail,
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
  formatDriverHandle,
  VEHICLE_LABELS,
  type DriverProfile,
  type VehicleType,
} from '../../services/drivers';
import {
  coordsForCity,
  estimateEtaMinutes,
  googleMapsDirectionsUrl,
  haversineKm,
  osmEmbedUrl,
  type LatLng,
} from '../../lib/geo';
import { countryCodeFromLabelOrCity, countryLabel } from '../../types/catalog';

type AssignableOrder = Awaited<ReturnType<typeof fetchAssignableOrders>>[number];
type OrderSort = 'distance' | 'recent' | 'city';

const ORDER_SORTS: { id: OrderSort; label: string }[] = [
  { id: 'distance', label: 'Distance croissante' },
  { id: 'recent', label: 'Plus récentes' },
  { id: 'city', label: 'Ville' },
];

function dateTime(value?: string | null): string {
  if (!value) return '—';
  return new Date(value).toLocaleString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function hourOnly(value?: string | null): string {
  if (!value) return '—';
  return new Date(value).toLocaleTimeString('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function orderPoint(order: AssignableOrder): LatLng | null {
  const o = order as unknown as Record<string, unknown>;
  if (o.shipping_lat != null && o.shipping_lng != null) {
    return { lat: Number(o.shipping_lat), lng: Number(o.shipping_lng) };
  }
  return coordsForCity(o.shipping_city as string);
}

function formatKm(km: number | null): string {
  if (km == null) return 'distance inconnue';
  return `${km.toFixed(1)} km`;
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 py-1.5 border-b border-gray-100 last:border-0">
      <span className="text-xs text-gray-500 shrink-0">{label}</span>
      <span className="text-sm font-semibold text-right break-words">{value || '—'}</span>
    </div>
  );
}

export default function AdminDeliveriesPage() {
  const { user } = useAuth();
  const { adminCountry, adminCountryName } = useAdminCountry();
  const [drivers, setDrivers] = useState<DriverProfile[]>([]);
  const [orders, setOrders] = useState<AssignableOrder[]>([]);
  const [parcels, setParcels] = useState<Awaited<ReturnType<typeof fetchAssignableParcels>>>([]);
  const [deliveries, setDeliveries] = useState<AdminDeliveryView[]>([]);
  const [batches, setBatches] = useState<DeliveryBatchView[]>([]);
  const [selectedDriver, setSelectedDriver] = useState('');
  const [selectedOrders, setSelectedOrders] = useState<string[]>([]);
  const [offeredFee, setOfferedFee] = useState('3000');
  const [batchNotes, setBatchNotes] = useState('');
  const [orderSort, setOrderSort] = useState<OrderSort>('distance');
  const [detail, setDetail] = useState<AssignableOrderDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
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

  const driver = drivers.find((d) => d.id === selectedDriver);

  /** Point de départ des distances : GPS du livreur, sinon sa ville de rattachement. */
  const reference = useMemo(() => {
    if (!driver) return null;
    if (driver.lastLat != null && driver.lastLng != null) {
      return {
        point: { lat: driver.lastLat, lng: driver.lastLng } as LatLng,
        label: `position GPS de ${formatDriverHandle(driver.ownerName, driver.driverCode)}`,
        live: true,
      };
    }
    const cityPoint = coordsForCity(driver.city);
    if (!cityPoint) return null;
    return {
      point: cityPoint,
      label: `ville de rattachement (${driver.city})`,
      live: false,
    };
  }, [driver]);

  /** Distance + ETA de chaque commande depuis le point de référence. */
  const ordersWithDistance = useMemo(() => {
    const rows = orders.map((o) => {
      const point = orderPoint(o);
      const distanceKm =
        reference && point ? Math.round(haversineKm(reference.point, point) * 10) / 10 : null;
      return {
        order: o,
        point,
        distanceKm,
        etaMinutes:
          distanceKm != null ? estimateEtaMinutes(distanceKm, driver?.vehicleType) : null,
        hasGps: point != null && (o as unknown as Record<string, unknown>).shipping_lat != null,
      };
    });

    const sorted = [...rows];
    if (orderSort === 'distance') {
      sorted.sort((a, b) => {
        if (a.distanceKm == null) return 1;
        if (b.distanceKm == null) return -1;
        return a.distanceKm - b.distanceKm;
      });
    } else if (orderSort === 'city') {
      sorted.sort((a, b) =>
        String(a.order.shipping_city || '').localeCompare(String(b.order.shipping_city || ''))
      );
    } else {
      sorted.sort(
        (a, b) =>
          new Date(b.order.created_at as string).getTime() -
          new Date(a.order.created_at as string).getTime()
      );
    }
    return sorted;
  }, [orders, reference, orderSort, driver?.vehicleType]);

  /** Kilométrage cumulé de la sélection (aide au calibrage du prix du lot). */
  const selectionKm = useMemo(
    () =>
      ordersWithDistance
        .filter((r) => selectedOrders.includes(r.order.id))
        .reduce((sum, r) => sum + (r.distanceKm ?? 0), 0),
    [ordersWithDistance, selectedOrders]
  );

  const toggleOrder = (id: string) => {
    setSelectedOrders((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const openDetail = async (orderId: string) => {
    setDetailLoading(true);
    setError(null);
    try {
      const found = await fetchAssignableOrderDetail(orderId);
      if (!found) {
        setError('Commande introuvable.');
        return;
      }
      setDetail(found);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur');
    } finally {
      setDetailLoading(false);
    }
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
          acceptDeadlineAt: d.acceptDeadlineAt,
          startDeadlineAt: d.startDeadlineAt,
        })
      ),
    [deliveries]
  );

  const detailPoint: LatLng | null = detail
    ? detail.shippingLat != null && detail.shippingLng != null
      ? { lat: detail.shippingLat, lng: detail.shippingLng }
      : coordsForCity(detail.shippingCity)
    : null;
  const detailDistanceKm =
    reference && detailPoint
      ? Math.round(haversineKm(reference.point, detailPoint) * 10) / 10
      : null;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-extrabold mb-2">Courses groupées</h1>
        <p className="text-sm text-gray-500 mb-1">{adminCountryName}</p>
        <p className="text-sm text-gray-500">
          Cliquez une commande pour voir toute sa fiche (distance, position, dates, heures,
          articles) avant d’assigner. Le livreur peut accepter ou refuser. Délai : 2 h pour
          accepter / démarrer.
        </p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-4 text-sm">
          {error}
        </div>
      )}

      <div className="bg-white border rounded-2xl p-4 space-y-4">
        <div className="grid md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-bold mb-2">Livreur (remise des courses)</label>
            <select
              value={selectedDriver}
              onChange={(e) => setSelectedDriver(e.target.value)}
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl bg-white font-mono text-sm"
            >
              {drivers.length === 0 && <option value="">Aucun livreur approuvé</option>}
              {drivers.map((d) => (
                <option key={d.id} value={d.id}>
                  {formatDriverHandle(d.ownerName, d.driverCode)}
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

        {driver && (
          <div className="rounded-xl bg-[#1F2937] text-white px-4 py-3 text-sm">
            <p className="flex flex-wrap items-center gap-2">
              <User size={15} className="text-[#FF6B00]" />
              <span className="font-mono font-extrabold tracking-tight">
                {formatDriverHandle(driver.ownerName, driver.driverCode)}
              </span>
              <span className="text-gray-300">
                · {VEHICLE_LABELS[driver.vehicleType as VehicleType] || driver.vehicleType} ·{' '}
                {driver.city} ({countryLabel(driver.country)})
              </span>
              <span
                className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
                  driver.isOnline ? 'bg-[#00A651]' : 'bg-gray-600'
                }`}
              >
                {driver.isOnline ? 'En ligne' : 'Hors ligne'}
              </span>
            </p>
            <p className="text-xs text-gray-400 mt-1">
              Identifiant à annoncer au vendeur / à l’entrepôt lors de la remise des courses.
              {reference
                ? ` Distances calculées depuis la ${reference.label}.`
                : ' Position du livreur inconnue : distances indisponibles.'}
            </p>
          </div>
        )}
      </div>

      {loading ? (
        <div className="h-32 bg-white rounded-2xl border animate-pulse" />
      ) : (
        <>
          <section>
            <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
              <h2 className="font-extrabold">
                Commandes ({selectedOrders.length}/{orders.length} sélectionnées)
                {selectedOrders.length > 0 && selectionKm > 0 && (
                  <span className="ml-2 text-xs font-semibold text-gray-500">
                    ≈ {selectionKm.toFixed(1)} km cumulés
                  </span>
                )}
              </h2>
              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={orderSort}
                  onChange={(e) => setOrderSort(e.target.value as OrderSort)}
                  className="px-3 py-2 border-2 border-gray-200 rounded-xl text-sm font-semibold bg-white"
                >
                  {ORDER_SORTS.map((s) => (
                    <option key={s.id} value={s.id}>
                      Trier : {s.label}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  disabled={busy || !selectedDriver || selectedOrders.length === 0}
                  onClick={() => void onCreateBatch()}
                  className="px-4 py-2.5 bg-[#FF6B00] text-white rounded-xl text-sm font-bold disabled:opacity-50"
                >
                  Proposer le lot ({formatPrice(Number(offeredFee) || 0)})
                </button>
              </div>
            </div>

            {orders.length === 0 ? (
              <p className="text-sm text-gray-500">Aucune commande disponible.</p>
            ) : (
              <div className="space-y-2">
                {ordersWithDistance.map(({ order: o, distanceKm, etaMinutes, hasGps }) => {
                  const checked = selectedOrders.includes(o.id);
                  return (
                    <div
                      key={o.id}
                      className={`bg-white border rounded-xl p-4 flex flex-col sm:flex-row sm:items-center gap-3 ${
                        checked ? 'border-[#FF6B00] bg-orange-50/40' : ''
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleOrder(o.id)}
                        className="w-4 h-4 accent-[#FF6B00] shrink-0"
                        aria-label={`Sélectionner ${o.order_number}`}
                      />
                      <button
                        type="button"
                        onClick={() => void openDetail(o.id)}
                        className="flex-1 min-w-0 text-left"
                      >
                        <p className="font-mono font-bold text-[#FF6B00] text-sm">
                          {o.order_number}
                        </p>
                        <p className="text-xs text-gray-500">
                          {o.shipping_city} · {formatPrice(Number(o.total))} · {o.status}
                        </p>
                        <p className="text-xs text-gray-500 flex flex-wrap items-center gap-x-3 gap-y-1 mt-1">
                          <span className="inline-flex items-center gap-1 font-semibold text-[#1F2937]">
                            <Navigation size={12} /> {formatKm(distanceKm)}
                          </span>
                          {etaMinutes != null && (
                            <span className="inline-flex items-center gap-1">
                              <Clock size={12} /> ~{etaMinutes} min
                            </span>
                          )}
                          <span className="inline-flex items-center gap-1">
                            <Clock size={12} /> {dateTime(o.created_at as string)}
                          </span>
                          <span
                            className={`inline-flex items-center gap-1 ${
                              hasGps ? 'text-[#00A651] font-semibold' : 'text-amber-600'
                            }`}
                          >
                            <MapPin size={12} /> {hasGps ? 'GPS client' : 'Position ville'}
                          </span>
                        </p>
                      </button>
                      <button
                        type="button"
                        disabled={detailLoading}
                        onClick={() => void openDetail(o.id)}
                        className="inline-flex items-center gap-1.5 px-3 py-2 border rounded-xl text-xs font-bold shrink-0 disabled:opacity-50"
                      >
                        <Eye size={14} /> Détails
                      </button>
                    </div>
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
                    <div className="min-w-0">
                      <p className="font-bold">
                        {formatPrice(b.offeredFee)} · {b.deliveryCount ?? 0} course(s) ·{' '}
                        <span className="text-[#FF6B00]">{b.status}</span>
                      </p>
                      <p className="text-xs font-mono font-bold text-[#1F2937] mt-1 inline-flex items-center gap-1.5">
                        <Truck size={12} className="text-[#00A651]" />
                        {formatDriverHandle(b.driverName, b.driverCode)}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        {(b.orderNumbers || []).join(', ') || '—'} · deadline{' '}
                        {dateTime(b.acceptDeadlineAt)}
                      </p>
                    </div>
                    {['offered', 'accepted'].includes(b.status) && (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void onReclaim(undefined, b.id)}
                        className="px-3 py-2 border border-red-200 text-red-600 rounded-xl text-xs font-bold shrink-0"
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
                        {DELIVERY_STATUS_LABELS[d.status]} ·{' '}
                        <span className="font-mono font-bold">
                          {formatDriverHandle(d.driverName, d.driverCode)}
                        </span>
                      </p>
                      <p className="text-xs text-gray-500">
                        Assignée le {dateTime(d.assignedAt)}
                      </p>
                    </div>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void onReclaim(d.id)}
                      className="px-3 py-2 bg-white border border-red-200 text-red-600 rounded-xl text-xs font-bold shrink-0"
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

      {detail && (
        <AdminModal wide title={`Commande ${detail.orderNumber}`} onClose={() => setDetail(null)}>
          <div className="space-y-5">
            <div className="grid sm:grid-cols-3 gap-3">
              <div className="rounded-xl border-2 border-[#FF6B00]/30 bg-orange-50 p-3">
                <p className="text-xs text-gray-500 font-semibold">Distance</p>
                <p className="text-lg font-extrabold text-[#1F2937]">
                  {formatKm(detailDistanceKm)}
                </p>
                <p className="text-[11px] text-gray-500">
                  {reference ? `depuis la ${reference.label}` : 'point de départ inconnu'}
                </p>
              </div>
              <div className="rounded-xl border-2 border-[#00A651]/30 bg-green-50 p-3">
                <p className="text-xs text-gray-500 font-semibold">Temps estimé</p>
                <p className="text-lg font-extrabold text-[#1F2937]">
                  {detailDistanceKm != null
                    ? `~${estimateEtaMinutes(detailDistanceKm, driver?.vehicleType)} min`
                    : '—'}
                </p>
                <p className="text-[11px] text-gray-500">
                  {driver
                    ? VEHICLE_LABELS[driver.vehicleType as VehicleType] || driver.vehicleType
                    : 'aucun livreur sélectionné'}
                </p>
              </div>
              <div className="rounded-xl border-2 border-gray-200 bg-gray-50 p-3">
                <p className="text-xs text-gray-500 font-semibold">Poids total</p>
                <p className="text-lg font-extrabold text-[#1F2937]">
                  {detail.totalWeightKg > 0 ? `${detail.totalWeightKg.toFixed(1)} kg` : '—'}
                </p>
                <p className="text-[11px] text-gray-500">
                  {detail.items.length} article(s)
                </p>
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-5">
              <div>
                <p className="text-sm font-extrabold mb-2 flex items-center gap-2">
                  <MapPin size={15} className="text-[#FF6B00]" /> Livraison
                </p>
                <div className="rounded-xl border border-gray-100 px-4 py-2">
                  <Row label="Adresse" value={detail.shippingAddress} />
                  <Row label="Ville" value={detail.shippingCity} />
                  <Row label="Pays" value={countryLabel(detail.shippingCountry)} />
                  <Row label="Téléphone" value={detail.shippingPhone} />
                  <Row
                    label="Coordonnées GPS"
                    value={
                      detail.shippingLat != null && detail.shippingLng != null
                        ? `${detail.shippingLat.toFixed(5)}, ${detail.shippingLng.toFixed(5)}`
                        : 'non partagées (position ville utilisée)'
                    }
                  />
                  <Row label="Consignes client" value={detail.notes} />
                </div>
              </div>

              <div>
                <p className="text-sm font-extrabold mb-2 flex items-center gap-2">
                  <Clock size={15} className="text-[#FF6B00]" /> Dates & heures
                </p>
                <div className="rounded-xl border border-gray-100 px-4 py-2">
                  <Row label="Commandée le" value={dateTime(detail.createdAt)} />
                  <Row label="Heure de commande" value={hourOnly(detail.createdAt)} />
                  <Row label="Dernière mise à jour" value={dateTime(detail.updatedAt)} />
                  <Row label="Statut commande" value={detail.status} />
                  <Row
                    label="Paiement"
                    value={`${detail.paymentStatus || '—'}${
                      detail.paymentMethod ? ` · ${detail.paymentMethod}` : ''
                    }`}
                  />
                </div>
              </div>

              <div>
                <p className="text-sm font-extrabold mb-2 flex items-center gap-2">
                  <User size={15} className="text-[#FF6B00]" /> Client
                </p>
                <div className="rounded-xl border border-gray-100 px-4 py-2">
                  <Row label="Nom" value={detail.customerName} />
                  <Row label="Téléphone" value={detail.customerPhone || detail.shippingPhone} />
                  <Row label="Email" value={detail.customerEmail} />
                </div>
              </div>

              <div>
                <p className="text-sm font-extrabold mb-2 flex items-center gap-2">
                  <Package size={15} className="text-[#FF6B00]" /> Enlèvement / vendeur
                </p>
                <div className="rounded-xl border border-gray-100 px-4 py-2">
                  <Row
                    label="Boutique"
                    value={
                      detail.vendorName
                        ? `${detail.vendorName}${detail.vendorCode ? ` (${detail.vendorCode})` : ''}`
                        : '—'
                    }
                  />
                  <Row
                    label="Ville"
                    value={`${detail.vendorCity || '—'} · ${countryLabel(detail.vendorCountry)}`}
                  />
                  <Row label="Adresse" value={detail.vendorAddress} />
                  <Row label="Sous-total" value={formatPrice(detail.subtotal)} />
                  <Row label="Frais livraison" value={formatPrice(detail.shippingCost)} />
                  <Row label="Total" value={formatPrice(detail.total)} />
                </div>
              </div>
            </div>

            <div>
              <p className="text-sm font-extrabold mb-2">Articles</p>
              <div className="space-y-2">
                {detail.items.map((it, i) => (
                  <div
                    key={`${it.productName}-${i}`}
                    className="flex items-center gap-3 border border-gray-100 rounded-xl p-2"
                  >
                    {it.mainImage && (
                      <img
                        src={it.mainImage}
                        alt=""
                        className="w-10 h-10 rounded-lg object-cover"
                      />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate">{it.productName}</p>
                      <p className="text-xs text-gray-500">
                        ×{it.quantity} · {formatPrice(it.price)}
                        {it.weightKg != null ? ` · ${it.weightKg} kg/u` : ''}
                        {it.deliveryMode ? ` · ${it.deliveryMode}` : ''}
                      </p>
                    </div>
                    <p className="text-sm font-bold text-[#FF6B00]">{formatPrice(it.total)}</p>
                  </div>
                ))}
              </div>
            </div>

            {detailPoint && (
              <div>
                <p className="text-sm font-extrabold mb-2">Position sur la carte</p>
                <iframe
                  title={`Carte ${detail.orderNumber}`}
                  src={osmEmbedUrl(detailPoint)}
                  className="w-full h-56 rounded-xl border"
                />
                {reference && (
                  <a
                    href={googleMapsDirectionsUrl(reference.point, detailPoint)}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 mt-2 text-sm font-bold text-[#00A651]"
                  >
                    <Navigation size={14} /> Itinéraire depuis le livreur
                  </a>
                )}
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-3 pt-1">
              <button
                type="button"
                onClick={() => {
                  toggleOrder(detail.id);
                  setDetail(null);
                }}
                className="flex-1 py-3 bg-[#FF6B00] text-white rounded-xl font-bold"
              >
                {selectedOrders.includes(detail.id)
                  ? 'Retirer de la sélection'
                  : 'Ajouter à la sélection du lot'}
              </button>
              <button
                type="button"
                onClick={() => setDetail(null)}
                className="sm:w-auto px-5 py-3 border-2 border-gray-200 rounded-xl font-bold"
              >
                Fermer
              </button>
            </div>
          </div>
        </AdminModal>
      )}
    </div>
  );
}
