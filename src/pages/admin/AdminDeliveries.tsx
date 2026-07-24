import { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { formatPrice } from '../../services/catalog';
import {
  assignOrderToDriver,
  assignParcelToDriver,
  fetchAllDeliveriesAdmin,
  fetchApprovedDrivers,
  fetchAssignableOrders,
  fetchAssignableParcels,
} from '../../services/admin-drivers';
import {
  DELIVERY_STATUS_LABELS,
  type DeliveryView,
  type DriverProfile,
} from '../../services/drivers';

export default function AdminDeliveriesPage() {
  const { user } = useAuth();
  const [drivers, setDrivers] = useState<DriverProfile[]>([]);
  const [orders, setOrders] = useState<Awaited<ReturnType<typeof fetchAssignableOrders>>>([]);
  const [parcels, setParcels] = useState<Awaited<ReturnType<typeof fetchAssignableParcels>>>([]);
  const [deliveries, setDeliveries] = useState<(DeliveryView & { driverCode?: string | null })[]>(
    []
  );
  const [selectedDriver, setSelectedDriver] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const [d, o, p, all] = await Promise.all([
        fetchApprovedDrivers(),
        fetchAssignableOrders(),
        fetchAssignableParcels(),
        fetchAllDeliveriesAdmin(),
      ]);
      setDrivers(d);
      setOrders(o);
      setParcels(p);
      setDeliveries(all);
      if (!selectedDriver && d[0]) setSelectedDriver(d[0].id);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const onAssignOrder = async (orderId: string) => {
    if (!user || !selectedDriver) return;
    setBusy(true);
    try {
      await assignOrderToDriver(user.id, orderId, selectedDriver);
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

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-extrabold mb-2">Assignation des courses</h1>
        <p className="text-sm text-gray-500">
          Assignez commandes marketplace ou colis à un livreur approuvé.
        </p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-4 text-sm">
          {error}
        </div>
      )}

      <div className="bg-white border rounded-2xl p-4">
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

      {loading ? (
        <div className="h-32 bg-white rounded-2xl border animate-pulse" />
      ) : (
        <>
          <section>
            <h2 className="font-extrabold mb-3">Commandes à assigner ({orders.length})</h2>
            {orders.length === 0 ? (
              <p className="text-sm text-gray-500">Aucune commande disponible.</p>
            ) : (
              <div className="space-y-2">
                {orders.map((o) => (
                  <div
                    key={o.id}
                    className="bg-white border rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div>
                      <p className="font-mono font-bold text-[#FF6B00] text-sm">{o.order_number}</p>
                      <p className="text-xs text-gray-500">
                        {o.shipping_city} · {formatPrice(Number(o.total))} · {o.status}
                      </p>
                    </div>
                    <button
                      type="button"
                      disabled={busy || !selectedDriver}
                      onClick={() => onAssignOrder(o.id)}
                      className="px-3 py-2 bg-[#FF6B00] text-white rounded-xl text-xs font-bold disabled:opacity-50"
                    >
                      Assigner
                    </button>
                  </div>
                ))}
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
                      onClick={() => onAssignParcel(p.id)}
                      className="px-3 py-2 bg-[#00A651] text-white rounded-xl text-xs font-bold disabled:opacity-50"
                    >
                      Assigner
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section>
            <h2 className="font-extrabold mb-3">Courses récentes</h2>
            <div className="space-y-2">
              {deliveries.slice(0, 20).map((d) => (
                <div key={d.id} className="bg-white border rounded-xl p-4 text-sm">
                  <div className="flex justify-between gap-2">
                    <p className="font-mono font-bold text-[#FF6B00]">
                      {d.kind === 'order' ? d.orderNumber : d.parcelTracking}
                    </p>
                    <span className="text-xs font-bold text-gray-600">
                      {DELIVERY_STATUS_LABELS[d.status]}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    Livreur {d.driverCode || '—'} · {d.pickupCity} → {d.deliveryCity}
                  </p>
                </div>
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
