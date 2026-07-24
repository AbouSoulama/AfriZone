import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Check } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import {
  DELIVERY_STATUS_LABELS,
  DELIVERY_TIMELINE,
  fetchDriverDeliveryById,
  getDriverForUser,
  nextDeliveryStatus,
  updateDeliveryStatusByDriver,
  type DeliveryJobStatus,
  type DeliveryView,
} from '../../services/drivers';

const NEXT_LABEL: Partial<Record<DeliveryJobStatus, string>> = {
  assigned: 'Accepter la course',
  accepted: 'Marquer collectée',
  picked_up: 'En route',
  in_transit: 'Marquer livrée',
};

export default function DriverDeliveryDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const [driverId, setDriverId] = useState<string | null>(null);
  const [delivery, setDelivery] = useState<DeliveryView | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async (dId: string, deliveryId: string) => {
    setLoading(true);
    try {
      setDelivery(await fetchDriverDeliveryById(dId, deliveryId));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!user || !id) return;
    (async () => {
      try {
        const dId = user.driver?.id || (await getDriverForUser(user.id))?.id;
        if (!dId) {
          setError('Profil livreur introuvable.');
          setLoading(false);
          return;
        }
        setDriverId(dId);
        await load(dId, id);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Erreur');
        setLoading(false);
      }
    })();
  }, [user, id]);

  const currentIdx = delivery
    ? DELIVERY_TIMELINE.indexOf(delivery.status)
    : -1;
  const next = delivery ? nextDeliveryStatus(delivery.status) : null;

  const onAdvance = async () => {
    if (!driverId || !delivery || !next) return;
    setBusy(true);
    try {
      await updateDeliveryStatusByDriver(driverId, delivery.id, next);
      await load(driverId, delivery.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur');
    } finally {
      setBusy(false);
    }
  };

  const onRefuse = async () => {
    if (!driverId || !delivery) return;
    if (!confirm('Refuser cette course ?')) return;
    setBusy(true);
    try {
      await updateDeliveryStatusByDriver(driverId, delivery.id, 'refused');
      await load(driverId, delivery.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <Link
        to="/livreur/courses"
        className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-[#FF6B00] mb-6"
      >
        <ArrowLeft size={16} /> Mes courses
      </Link>

      {loading && <div className="h-40 bg-white rounded-2xl border animate-pulse" />}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-4 mb-4 text-sm">
          {error}
        </div>
      )}

      {delivery && (
        <div className="space-y-6 max-w-3xl">
          <div className="bg-white border border-gray-100 rounded-2xl p-6">
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 mb-4">
              <div>
                <p className="font-mono font-bold text-[#FF6B00] text-lg">
                  {delivery.kind === 'order'
                    ? delivery.orderNumber
                    : delivery.parcelTracking}
                </p>
                <p className="text-sm text-gray-500">
                  {delivery.kind === 'order' ? 'Commande marketplace' : 'Envoi de colis'}
                </p>
              </div>
              <span className="inline-block text-xs font-bold px-3 py-1 rounded-full bg-orange-50 text-[#FF6B00]">
                {DELIVERY_STATUS_LABELS[delivery.status]}
              </span>
            </div>

            {!['refused', 'cancelled'].includes(delivery.status) && (
              <div className="flex items-center justify-between gap-1 overflow-x-auto py-4">
                {DELIVERY_TIMELINE.map((step, idx) => {
                  const done = currentIdx >= idx;
                  return (
                    <div key={step} className="flex-1 min-w-[64px] text-center">
                      <div
                        className={`w-8 h-8 mx-auto rounded-full flex items-center justify-center mb-1 ${
                          done ? 'bg-[#00A651] text-white' : 'bg-gray-200 text-gray-400'
                        }`}
                      >
                        {done ? <Check size={14} /> : idx + 1}
                      </div>
                      <p className="text-[9px] font-semibold text-gray-600">
                        {DELIVERY_STATUS_LABELS[step]}
                      </p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="bg-white border border-gray-100 rounded-2xl p-6 text-sm space-y-2">
            <h2 className="font-extrabold mb-2">Itinéraire</h2>
            <p>
              <span className="text-gray-500">Enlèvement :</span> {delivery.pickupAddress},{' '}
              {delivery.pickupCity}
            </p>
            <p>
              <span className="text-gray-500">Livraison :</span> {delivery.deliveryAddress},{' '}
              {delivery.deliveryCity}
            </p>
            {delivery.recipientName && (
              <p>
                <span className="text-gray-500">Destinataire :</span> {delivery.recipientName}
              </p>
            )}
            {delivery.recipientPhone && (
              <p>
                <span className="text-gray-500">Tél. :</span> {delivery.recipientPhone}
              </p>
            )}
          </div>

          {next && (
            <button
              type="button"
              onClick={onAdvance}
              disabled={busy}
              className="w-full py-3 bg-[#00A651] hover:bg-[#008A43] disabled:opacity-50 text-white rounded-xl font-bold"
            >
              {busy ? 'Mise à jour...' : NEXT_LABEL[delivery.status] || DELIVERY_STATUS_LABELS[next]}
            </button>
          )}

          {delivery.status === 'assigned' && (
            <button
              type="button"
              onClick={onRefuse}
              disabled={busy}
              className="w-full py-3 border-2 border-red-200 text-red-600 rounded-xl font-bold hover:bg-red-50 disabled:opacity-50"
            >
              Refuser la course
            </button>
          )}
        </div>
      )}
    </div>
  );
}
