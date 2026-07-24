import { supabase } from '../lib/supabase';

export type NotificationType = 'order' | 'parcel' | 'delivery' | 'account' | 'info' | 'system';

export interface AppNotification {
  id: string;
  userId: string;
  title: string;
  body: string;
  type: NotificationType | string;
  link: string | null;
  readAt: string | null;
  createdAt: string;
  meta: Record<string, unknown>;
}

function mapNotification(row: Record<string, unknown>): AppNotification {
  return {
    id: row.id as string,
    userId: row.user_id as string,
    title: row.title as string,
    body: row.body as string,
    type: (row.type as string) || 'info',
    link: (row.link as string) ?? null,
    readAt: (row.read_at as string) ?? null,
    createdAt: row.created_at as string,
    meta: (row.meta as Record<string, unknown>) ?? {},
  };
}

export async function fetchMyNotifications(
  userId: string,
  limit = 30
): Promise<AppNotification[]> {
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => mapNotification(row));
}

export async function fetchUnreadCount(userId: string): Promise<number> {
  const { count, error } = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .is('read_at', null);

  if (error) throw new Error(error.message);
  return count ?? 0;
}

export async function markNotificationRead(userId: string, id: string): Promise<void> {
  const { error } = await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('id', id)
    .eq('user_id', userId)
    .is('read_at', null);

  if (error) throw new Error(error.message);
}

export async function markAllNotificationsRead(userId: string): Promise<void> {
  const { error } = await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('user_id', userId)
    .is('read_at', null);

  if (error) throw new Error(error.message);
}

export async function deleteNotification(userId: string, id: string): Promise<void> {
  const { error } = await supabase
    .from('notifications')
    .delete()
    .eq('id', id)
    .eq('user_id', userId);

  if (error) throw new Error(error.message);
}

/** Création manuelle via RPC (sécurité definer côté SQL) */
export async function createNotification(input: {
  userId: string;
  title: string;
  body: string;
  type?: string;
  link?: string | null;
}): Promise<void> {
  const { error } = await supabase.rpc('notify_user', {
    p_user_id: input.userId,
    p_title: input.title,
    p_body: input.body,
    p_type: input.type || 'info',
    p_link: input.link || null,
    p_meta: {},
  });
  if (error) throw new Error(error.message);
}
