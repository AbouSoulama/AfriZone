import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle, Package, QrCode, Truck, X } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import {
  fetchDriverStats,
  getDriverForUser,
  VEHICLE_LABELS,
  type VehicleType,
} from '../../services/drivers';

const APK_URL =
  (import.meta.env.VITE_DRIVER_APK_URL as string | undefined)?.trim() ||
  'https://expo.dev/accounts/afrizone002/projects/afrizone-driver/builds';

export default function DriverDashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState({ total: 0, active: 0, delivered: 0, assigned: 0 });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showQr, setShowQr] = useState(false);

  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        const driverId = user.driver?.id || (await getDriverForUser(user.id))?.id;
        if (!driverId) {
          setError('Profil livreur introuvable.');
          return;
        }
        setStats(await fetchDriverStats(driverId));
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Erreur');
      } finally {
        setLoading(false);
      }
    })();
  }, [user]);

  const cards = [
    { label: 'Nouvelles assignations', value: stats.assigned, icon: Package, color: '#FF6B00' },
    { label: 'Courses actives', value: stats.active, icon: Truck, color: '#2563EB' },
    { label: 'Livrées', value: stats.delivered, icon: CheckCircle, color: '#00A651' },
    { label: 'Total courses', value: stats.total, icon: Package, color: '#1F2937' },
  ];

  const qrSrc = `https://api.qrserver.com/v1/create-qr-code/?size=280x280&data=${encodeURIComponent(APK_URL)}`;

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-extrabold">Tableau de bord</h1>
          <p className="text-sm text-gray-500 mt-1">
            {user?.fullName} ·{' '}
            {VEHICLE_LABELS[(user?.driver?.vehicleType as VehicleType) || 'moto'] ||
              user?.driver?.vehicleType}{' '}
            · {user?.driver?.city}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setShowQr(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 border-2 border-[#00A651] text-[#00A651] rounded-xl text-sm font-bold"
          >
            <QrCode size={16} /> Installer l’app
          </button>
          <Link
            to="/livreur/courses"
            className="px-4 py-2.5 bg-[#FF6B00] text-white rounded-xl text-sm font-bold"
          >
            Voir mes courses
          </Link>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-4 mb-6 text-sm">
          {error}
        </div>
      )}

      {loading ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-28 bg-white rounded-2xl border animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {cards.map((c) => {
            const Icon = c.icon;
            return (
              <div key={c.label} className="bg-white border border-gray-100 rounded-2xl p-5">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-semibold text-gray-500 uppercase">{c.label}</span>
                  <Icon size={18} style={{ color: c.color }} />
                </div>
                <p className="text-2xl font-extrabold">{c.value}</p>
              </div>
            );
          })}
        </div>
      )}

      <div className="mt-8 bg-green-50 border border-green-100 rounded-2xl p-5">
        <h2 className="font-extrabold mb-1">Application mobile AfriZone Livraison</h2>
        <p className="text-sm text-gray-600 leading-relaxed">
          Tout nouveau livreur doit installer l’application pour accepter les lots, partager le GPS
          et envoyer la photo de preuve à la livraison. Cliquez sur « Installer l’app » pour afficher
          le QR code à scanner.
        </p>
      </div>

      {showQr && (
        <div className="fixed inset-0 z-[100] bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-sm w-full relative shadow-2xl">
            <button
              type="button"
              onClick={() => setShowQr(false)}
              className="absolute top-3 right-3 p-2 rounded-full hover:bg-gray-100"
            >
              <X size={18} />
            </button>
            <h3 className="font-extrabold text-lg mb-1">Scanner pour installer</h3>
            <p className="text-xs text-gray-500 mb-4">
              Ouvrez l’appareil photo du téléphone et scannez ce code.
            </p>
            <img src={qrSrc} alt="QR installation app livreur" className="w-full rounded-2xl border" />
            <a
              href={APK_URL}
              target="_blank"
              rel="noreferrer"
              className="mt-4 block text-center text-sm font-bold text-[#00A651] break-all"
            >
              Ou ouvrir le lien
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
