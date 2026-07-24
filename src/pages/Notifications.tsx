import { Link, Navigate } from 'react-router-dom';
import { Bell, CheckCheck } from 'lucide-react';
import Header from '../components/Header';
import Footer from '../components/Footer';
import { useAuth } from '../context/AuthContext';
import { useNotifications } from '../context/NotificationsContext';

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('fr-FR');
}

export default function NotificationsPage() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const { items, unreadCount, isLoading, markRead, markAllRead, refresh } = useNotifications();

  if (!authLoading && !isAuthenticated) {
    return <Navigate to="/auth/login" replace state={{ from: '/notifications' }} />;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <main className="max-w-3xl mx-auto px-4 py-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
          <div>
            <h1 className="text-2xl md:text-3xl font-extrabold flex items-center gap-2">
              <Bell size={28} className="text-[#FF6B00]" /> Notifications
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              {unreadCount > 0 ? `${unreadCount} non lue${unreadCount > 1 ? 's' : ''}` : 'Tout est à jour'}
            </p>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => refresh()}
              className="px-4 py-2 border-2 border-gray-200 rounded-xl text-sm font-semibold"
            >
              Actualiser
            </button>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={() => markAllRead()}
                className="inline-flex items-center gap-2 px-4 py-2 bg-[#FF6B00] text-white rounded-xl text-sm font-bold"
              >
                <CheckCheck size={16} /> Tout marquer lu
              </button>
            )}
          </div>
        </div>

        {isLoading && items.length === 0 ? (
          <div className="h-40 bg-white rounded-2xl border animate-pulse" />
        ) : items.length === 0 ? (
          <div className="bg-white border rounded-2xl p-10 text-center text-gray-500">
            Aucune notification pour le moment.
          </div>
        ) : (
          <div className="space-y-2">
            {items.map((n) => (
              <div
                key={n.id}
                className={`bg-white border rounded-2xl p-4 ${
                  !n.readAt ? 'border-orange-200 bg-orange-50/40' : 'border-gray-100'
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                  <div>
                    <p className="font-bold text-[#1F2937]">{n.title}</p>
                    <p className="text-sm text-gray-600 mt-1">{n.body}</p>
                    <p className="text-xs text-gray-400 mt-2">{formatDate(n.createdAt)}</p>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    {!n.readAt && (
                      <button
                        type="button"
                        onClick={() => markRead(n.id)}
                        className="px-3 py-1.5 text-xs font-semibold border rounded-lg"
                      >
                        Marquer lu
                      </button>
                    )}
                    {n.link && (
                      <Link
                        to={n.link}
                        onClick={() => {
                          if (!n.readAt) markRead(n.id);
                        }}
                        className="px-3 py-1.5 text-xs font-bold bg-[#FF6B00] text-white rounded-lg"
                      >
                        Ouvrir
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}
