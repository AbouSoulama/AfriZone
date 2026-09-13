import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { MapPin, Navigation, RefreshCw } from 'lucide-react';
import LiveTrackingMap from '../../components/geo/LiveTrackingMap';
import { useAdminCountry } from '../../context/AdminCountryContext';
import {
  fetchDriversForAdmin,
  type AdminDriverRow,
} from '../../services/admin-drivers';

const ONLINE_STALE_MS = 45 * 60 * 1000;

function isLive(d: AdminDriverRow): boolean {
  if (!d.isOnline || d.lastLat == null || d.lastLng == null) return false;
  if (!d.onlineUpdatedAt && !d.lastLocationAt) return true;
  const t = new Date(d.lastLocationAt || d.onlineUpdatedAt || 0).getTime();
  return Date.now() - t < ONLINE_STALE_MS;
}

export default function AdminDriversTrackPage() {
  const { adminCountry, adminCountryName } = useAdminCountry();
  const [rows, setRows] = useState<AdminDriverRow[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);

  const load = async () => {
    try {
      const list = await fetchDriversForAdmin('approved', adminCountry);
      setRows(list);
      setUpdatedAt(new Date());
      setError(null);
      setSelectedId((prev) => {
        if (prev && list.some((d) => d.id === prev && isLive(d))) return prev;
        const first = list.find(isLive);
        return first?.id ?? null;
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setLoading(true);
    void load();
    const t = window.setInterval(() => void load(), 10000);
    return () => window.clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adminCountry]);

  const live = useMemo(() => rows.filter(isLive), [rows]);
  const selected = live.find((d) => d.id === selectedId) || live[0] || null;
  const driverPos =
    selected?.lastLat != null && selected.lastLng != null
      ? { lat: selected.lastLat, lng: selected.lastLng }
      : null;

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-extrabold">Suivi GPS livreurs</h1>
          <p className="text-sm text-gray-500 mt-1">
            Positions live — {adminCountryName}
            {updatedAt ? ` · maj ${updatedAt.toLocaleTimeString('fr-FR')}` : ''}
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            to="/admin/livreurs"
            className="px-3 py-2 rounded-xl border text-sm font-semibold"
          >
            Liste livreurs
          </Link>
          <button
            type="button"
            onClick={() => void load()}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#FF6B00] text-white text-sm font-bold"
          >
            <RefreshCw size={14} /> Actualiser
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-4 mb-4 text-sm">
          {error}
        </div>
      )}

      {loading ? (
        <div className="h-64 bg-white rounded-2xl border animate-pulse" />
      ) : (
        <div className="grid lg:grid-cols-[280px_1fr] gap-4">
          <aside className="bg-white border rounded-2xl p-3 max-h-[70vh] overflow-y-auto space-y-2">
            <p className="text-xs font-bold text-gray-500 px-1 mb-1">
              En ligne avec GPS ({live.length})
            </p>
            {live.length === 0 ? (
              <p className="text-sm text-gray-500 p-3">
                Aucun livreur en ligne pour ce pays. Le GPS apparaît quand le livreur accepte une
                course et partage sa position dans l’app.
              </p>
            ) : (
              live.map((d) => (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => setSelectedId(d.id)}
                  className={`w-full text-left rounded-xl px-3 py-2.5 border transition-colors ${
                    selected?.id === d.id
                      ? 'border-[#FF6B00] bg-orange-50'
                      : 'border-gray-100 hover:border-gray-200'
                  }`}
                >
                  <p className="font-bold text-sm">{d.driverCode}</p>
                  <p className="text-xs text-gray-500 truncate">
                    {d.ownerName || 'Livreur'} · {d.city}
                  </p>
                  <p className="text-[11px] text-[#00A651] mt-0.5 flex items-center gap-1">
                    <MapPin size={10} />
                    {d.lastLat?.toFixed(4)}, {d.lastLng?.toFixed(4)}
                  </p>
                </button>
              ))
            )}
          </aside>

          <div className="space-y-4">
            {driverPos ? (
              <>
                <LiveTrackingMap
                  driver={driverPos}
                  updatedAt={selected?.lastLocationAt || selected?.onlineUpdatedAt}
                />
                <div className="bg-white border rounded-2xl p-4 flex flex-wrap items-center gap-3">
                  <div className="flex-1 min-w-[200px]">
                    <p className="font-extrabold">{selected?.driverCode}</p>
                    <p className="text-sm text-gray-500">
                      {selected?.ownerName} · {selected?.ownerPhone || '—'}
                    </p>
                  </div>
                  <a
                    href={`https://www.openstreetmap.org/?mlat=${driverPos.lat}&mlon=${driverPos.lng}#map=16/${driverPos.lat}/${driverPos.lng}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#00A651] text-white text-xs font-bold"
                  >
                    <Navigation size={14} /> OpenStreetMap
                  </a>
                  <a
                    href={`https://www.google.com/maps?q=${driverPos.lat},${driverPos.lng}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-bold"
                  >
                    Google Maps
                  </a>
                </div>
              </>
            ) : (
              <div className="bg-white border rounded-2xl p-10 text-center text-gray-500 text-sm">
                Sélectionnez un livreur en ligne pour afficher sa position.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
