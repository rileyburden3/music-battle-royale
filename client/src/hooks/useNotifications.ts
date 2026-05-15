import { useState, useEffect } from 'react';
import { getNotifications, markAllRead, markRead } from '../services/api';
import { useAuthStore } from '../store/useAuthStore';

interface Notification {
  id: string;
  type: string;
  title: string;
  body: string;
  data: Record<string, string>;
  read: boolean;
  created_at: string;
}

export function useNotifications() {
  const { appUser } = useAuthStore();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unread, setUnread] = useState(0);

  const fetchNotifications = async () => {
    if (!appUser) return;
    try {
      const res = await getNotifications();
      setNotifications(res.data.data || []);
      setUnread(res.data.unread || 0);
    } catch {
      // silently ignore
    }
  };

  useEffect(() => {
    if (!appUser) return;
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, [appUser]);

  const markAllAsRead = async () => {
    await markAllRead();
    setNotifications((n) => n.map((x) => ({ ...x, read: true })));
    setUnread(0);
  };

  const markOneRead = async (id: string) => {
    await markRead(id);
    setNotifications((n) => n.map((x) => (x.id === id ? { ...x, read: true } : x)));
    setUnread((u) => Math.max(0, u - 1));
  };

  return { notifications, unread, markAllAsRead, markOneRead, refresh: fetchNotifications };
}
