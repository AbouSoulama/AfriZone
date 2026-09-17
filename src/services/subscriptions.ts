import { supabase } from '../lib/supabase';
import { isLivePayment, startCheckout } from './payments';

export type PlanAudience = 'client' | 'vendor';
export type AdSlot = 'hero' | 'home_banner' | 'featured_vendor';

export interface PlanFeatures {
  shippingDiscount?: number;
  shippingCreditsPerMonth?: number;
  badge?: boolean | string | null;
  priorityPromos?: boolean;
  featuredProducts?: number;
  adSlots?: number;
  commissionPct?: number;
  vendorBoost?: boolean;
}

export interface SubscriptionPlan {
  id: string;
  code: string;
  audience: PlanAudience;
  name: string;
  priceXof: number;
  durationDays: number;
  features: PlanFeatures;
  sortOrder: number;
}

export interface ActiveSubscription {
  id: string;
  status: string;
  startsAt: string | null;
  endsAt: string | null;
  shippingCreditsUsed: number;
  planCode: string;
  planName: string;
  audience: PlanAudience;
  priceXof: number;
  features: PlanFeatures;
}

export interface AdPlacement {
  id: string;
  subscriberUserId: string;
  vendorId: string | null;
  subscriptionId: string | null;
  slot: AdSlot;
  title: string;
  subtitle: string | null;
  imageUrl: string | null;
  linkUrl: string | null;
  status: 'draft' | 'active' | 'ended';
  startsAt: string | null;
  endsAt: string | null;
}

function mapPlan(row: Record<string, unknown>): SubscriptionPlan {
  return {
    id: row.id as string,
    code: row.code as string,
    audience: row.audience as PlanAudience,
    name: row.name as string,
    priceXof: Number(row.price_xof),
    durationDays: Number(row.duration_days ?? 30),
    features: (row.features as PlanFeatures) || {},
    sortOrder: Number(row.sort_order ?? 0),
  };
}

function mapAd(row: Record<string, unknown>): AdPlacement {
  return {
    id: row.id as string,
    subscriberUserId: row.subscriber_user_id as string,
    vendorId: (row.vendor_id as string) ?? null,
    subscriptionId: (row.subscription_id as string) ?? null,
    slot: row.slot as AdSlot,
    title: row.title as string,
    subtitle: (row.subtitle as string) ?? null,
    imageUrl: (row.image_url as string) ?? null,
    linkUrl: (row.link_url as string) ?? null,
    status: row.status as AdPlacement['status'],
    startsAt: (row.starts_at as string) ?? null,
    endsAt: (row.ends_at as string) ?? null,
  };
}

export async function fetchPlans(audience: PlanAudience): Promise<SubscriptionPlan[]> {
  await supabase.rpc('expire_due_subscriptions');
  const { data, error } = await supabase
    .from('subscription_plans')
    .select('*')
    .eq('audience', audience)
    .eq('is_active', true)
    .order('sort_order', { ascending: true });
  if (error) throw new Error(error.message);
  return (data || []).map((r) => mapPlan(r as Record<string, unknown>));
}

export async function fetchActiveSubscription(): Promise<ActiveSubscription | null> {
  const { data, error } = await supabase.rpc('get_active_subscription');
  if (error) throw new Error(error.message);
  if (!data) return null;
  const row = data as Record<string, unknown>;
  return {
    id: row.id as string,
    status: row.status as string,
    startsAt: (row.starts_at as string) ?? null,
    endsAt: (row.ends_at as string) ?? null,
    shippingCreditsUsed: Number(row.shipping_credits_used ?? 0),
    planCode: row.plan_code as string,
    planName: row.plan_name as string,
    audience: row.audience as PlanAudience,
    priceXof: Number(row.price_xof ?? 0),
    features: (row.features as PlanFeatures) || {},
  };
}

export async function previewClubShippingDiscount(): Promise<number> {
  const { data, error } = await supabase.rpc('preview_club_shipping_discount');
  if (error) return 0;
  return Number(data ?? 0);
}

export async function startSubscriptionCheckout(input: {
  planId: string;
  userId: string;
  phone: string;
  customerName?: string;
  customerEmail?: string | null;
  country?: string;
}): Promise<{ paymentUrl?: string; subscriptionId: string; mode: 'simulate' | 'live' }> {
  const { data: plan, error: planErr } = await supabase
    .from('subscription_plans')
    .select('*')
    .eq('id', input.planId)
    .maybeSingle();
  if (planErr || !plan) throw new Error(planErr?.message || 'Plan introuvable.');
  if (Number(plan.price_xof) <= 0) throw new Error('Ce plan est gratuit.');

  const { data: sub, error: subErr } = await supabase
    .from('subscriptions')
    .insert({
      user_id: input.userId,
      plan_id: input.planId,
      status: 'pending',
    })
    .select('id')
    .single();
  if (subErr || !sub) throw new Error(subErr?.message || 'Impossible de créer l’abonnement.');

  if (!isLivePayment()) {
    const { error: actErr } = await supabase.rpc('activate_my_pending_subscription', {
      p_subscription_id: sub.id,
    });
    if (actErr) throw new Error(actErr.message);
    return { subscriptionId: sub.id, mode: 'simulate' };
  }

  const checkout = await startCheckout({
    amount: Number(plan.price_xof),
    phone: input.phone,
    provider: 'mobile_money',
    kind: 'subscription',
    subscriptionId: sub.id,
    customerName: input.customerName,
    customerEmail: input.customerEmail,
    country: input.country,
  });

  return {
    subscriptionId: sub.id,
    paymentUrl: checkout.paymentUrl,
    mode: 'live',
  };
}

export async function fetchActiveAds(slot?: AdSlot): Promise<AdPlacement[]> {
  let q = supabase
    .from('ad_placements')
    .select('*')
    .eq('status', 'active')
    .or(`ends_at.is.null,ends_at.gt.${new Date().toISOString()}`)
    .order('created_at', { ascending: false });
  if (slot) q = q.eq('slot', slot);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data || []).map((r) => mapAd(r as Record<string, unknown>));
}

export async function fetchMyAds(userId: string): Promise<AdPlacement[]> {
  const { data, error } = await supabase
    .from('ad_placements')
    .select('*')
    .eq('subscriber_user_id', userId)
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data || []).map((r) => mapAd(r as Record<string, unknown>));
}

export async function createAdPlacement(input: {
  userId: string;
  vendorId?: string | null;
  subscriptionId?: string | null;
  slot: AdSlot;
  title: string;
  subtitle?: string;
  imageUrl?: string;
  linkUrl?: string;
  days?: number;
}): Promise<AdPlacement> {
  const starts = new Date();
  const ends = new Date();
  ends.setDate(ends.getDate() + (input.days ?? 30));
  const { data, error } = await supabase
    .from('ad_placements')
    .insert({
      subscriber_user_id: input.userId,
      vendor_id: input.vendorId || null,
      subscription_id: input.subscriptionId || null,
      slot: input.slot,
      title: input.title.trim(),
      subtitle: input.subtitle?.trim() || null,
      image_url: input.imageUrl?.trim() || null,
      link_url: input.linkUrl?.trim() || null,
      status: 'draft',
      starts_at: starts.toISOString(),
      ends_at: ends.toISOString(),
    })
    .select('*')
    .single();
  if (error || !data) throw new Error(error?.message || 'Création pub impossible.');
  return mapAd(data as Record<string, unknown>);
}

export async function setAdStatus(id: string, status: 'draft' | 'active' | 'ended') {
  const { error } = await supabase
    .from('ad_placements')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw new Error(error.message);
}

export async function adminListSubscriptions() {
  const { data, error } = await supabase
    .from('subscriptions')
    .select(
      'id, status, starts_at, ends_at, shipping_credits_used, user_id, plan:subscription_plans(code, name, audience, price_xof)'
    )
    .order('created_at', { ascending: false })
    .limit(100);
  if (error) throw new Error(error.message);
  return data || [];
}

export async function adminListAds() {
  const { data, error } = await supabase
    .from('ad_placements')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(100);
  if (error) throw new Error(error.message);
  return (data || []).map((r) => mapAd(r as Record<string, unknown>));
}

export function formatPlanPrice(xof: number): string {
  if (xof <= 0) return 'Gratuit';
  return `${xof.toLocaleString('fr-FR')} FCFA / mois`;
}
