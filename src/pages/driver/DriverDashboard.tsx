import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle, Package, QrCode, Truck } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { fetchDriverStats, getDriverForUser, VEHICLE_LABELS, type VehicleType } from '../../services/drivers';

function driverApkUrl(): string {
  const fromEnv = (import.meta.env.VITE_DRIVER_APK_URL as string | undefined)?.trim();
  if (fromEnv) return fromEnv;
  // Fallback : page d’aide — remplacez par l’URL Expo / Drive de l’APK
  return 'https://expo.dev/accounts/afrizone002/projects/afrizone-driver/builds';
}

export default function DriverDashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState({ total: 0, active: 0, delivered: 0, assigned: 0 });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showQr, setShowQr] = useState(false);

  const apkUrl = useMemo(() => driverApkUrl(), []);
  const qrSrc = useMemo(
    () =>
      `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(apkUrl)}`,
    [apkUrl]
  );

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
            onClick={() => setShowQr((v) => !v)}
            className="inline-flex items-center gap-2 px-4 py-2.5 border-2 border-[#00A651] text-[#008A43] rounded-xl text-sm font-bold"
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

      {showQr && (
        <div className="mb-8 bg-white border border-green-100 rounded-2xl p-5 flex flex-col sm:flex-row items-center gap-5">
          <img
            src={qrSrc}
            alt="QR code installation app livreur"
            className="w-40 h-40 rounded-xl border"
          />
          <div className="text-sm space-y-2">
            <p className="font-extrabold text-[#1F2937]">Application AfriZone Livraison</p>
            <p className="text-gray-600 leading-relaxed">
              Scannez ce QR avec votre téléphone pour télécharger / installer l’APK livreur. Tout
              nouveau livreur doit installer l’app pour recevoir les courses groupées, le GPS et le
              portefeuille.
            </p>
            <a
              href={apkUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-block text-[#FF6B00] font-bold break-all"
            >
              Ouvrir le lien d’installation
            </a>
            <p className="text-xs text-gray-400">
              Configurez <code className="bg-gray-100 px-1 rounded">VITE_DRIVER_APK_URL</code> avec
              l’URL Expo / Drive de votre dernier APK.
            </p>
          </div>
        </div>
      )}

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
    </div>
  );
}
