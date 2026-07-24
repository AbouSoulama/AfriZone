import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import { useAuth } from './AuthContext';
import {
  fetchMyNotifications,
  fetchUnreadCount,
  markAllNotificationsRead,
  markNotificationRead,
  type AppNotification,
} from '../services/notifications';

interface NotificationsContextType {
  items: AppNotification[];
  unreadCount: number;
  isLoading: boolean;
  refresh: () => Promise<void>;
  markRead: (id: string) => Promise<void>;
  markAllRead: () => Promise<void>;
}

const NotificationsContext = createContext<NotificationsContextType | undefined>(undefined);

export function NotificationsProvider({ children }: { children: ReactNode }) {
  const { user, isAuthenticated } = useAuth();
  const [items, setItems] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!isAuthenticated || !user) {
      setItems([]);
      setUnreadCount(0);
      return;
    }
    setIsLoading(true);
    try {
      const [list, count] = await Promise.all([
        fetchMyNotifications(user.id, 40),
        fetchUnreadCount(user.id),
      ]);
      setItems(list);
      setUnreadCount(count);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated, user]);

  useEffect(() => {
    refresh();
    if (!isAuthenticated || !user) return;
    const timer = setInterval(refresh, 30000);
    return () => clearInterval(timer);
  }, [refresh, isAuthenticated, user]);

  const markRead = async (id: string) => {
    if (!user) return;
    await markNotificationRead(user.id, id);
    setItems((prev) =>
      prev.map((n) => (n.id === id ? { ...n, readAt: n.readAt || new Date().toISOString() } : n))
    );
    setUnreadCount((c) => Math.max(0, c - 1));
  };

  const markAllRead = async () => {
    if (!user) return;
    await markAllNotificationsRead(user.id);
    const now = new Date().toISOString();
    setItems((prev) => prev.map((n) => ({ ...n, readAt: n.readAt || now })));
    setUnreadCount(0);
  };

  return (
    <NotificationsContext.Provider
      value={{ items, unreadCount, isLoading, refresh, markRead, markAllRead }}
    >
      {children}
    </NotificationsContext.Provider>
  );
}

export function useNotifications() {
  const ctx = useContext(NotificationsContext);
  if (!ctx) throw new Error('useNotifications must be used within NotificationsProvider');
  return ctx;
}
