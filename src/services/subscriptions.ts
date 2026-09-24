import { supabase } from '../lib/supabase';
import { countryCodeFromLabelOrCity } from '../types/catalog';
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
  /** Quota total de crédits livraison sur la durée écoulée de l'abonnement. */
  shippingCreditsQuota: number;
  /** Durée souscrite : 1, 6, 12, 24 ou 48 mois. */
  termMonths: number;
  discountPct: number;
  amountPaidXof: number | null;
  planCode: string;
  planName: string;
  audience: PlanAudience;
  priceXof: number;
  features: PlanFeatures;
}

/** Durée d'engagement proposée, avec sa remise. */
export interface SubscriptionTerm {
  id: string;
  months: number;
  label: string;
  discountPct: number;
  sortOrder: number;
}

export interface SubscriptionQuote {
  months: number;
  monthlyPriceXof: number;
  baseXof: number;
  discountPct: number;
  discountXof: number;
  totalXof: number;
  effectiveMonthlyXof: number;
}

/** Barème de repli si la migration 028 n'est pas encore appliquée. */
export const FALLBACK_SUBSCRIPTION_TERMS: SubscriptionTerm[] = [
  { id: 'm1', months: 1, label: '1 mois', discountPct: 0, sortOrder: 1 },
  { id: 'm6', months: 6, label: '6 mois', discountPct: 0, sortOrder: 2 },
  { id: 'm12', months: 12, label: '12 mois', discountPct: 0.1, sortOrder: 3 },
  { id: 'm24', months: 24, label: '24 mois', discountPct: 0.15, sortOrder: 4 },
  { id: 'm48', months: 48, label: '48 mois', discountPct: 0.25, sortOrder: 5 },
];

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

export async function fetchSubscriptionTerms(): Promise<SubscriptionTerm[]> {
  const { data, error } = await supabase
    .from('subscription_terms')
    .select('*')
    .eq('is_active', true)
    .order('sort_order', { ascending: true });

  // Migration 028 pas encore appliquée : on reste utilisable avec le barème local.
  if (error || !data?.length) return FALLBACK_SUBSCRIPTION_TERMS;

  return data.map((row) => ({
    id: row.id as string,
    months: Number(row.months),
    label: row.label as string,
    discountPct: Number(row.discount_pct ?? 0),
    sortOrder: Number(row.sort_order ?? 0),
  }));
}

/** Calcul local du devis (même formule que la RPC `subscription_quote`). */
export function quoteSubscription(
  monthlyPriceXof: number,
  term: Pick<SubscriptionTerm, 'months' | 'discountPct'>
): SubscriptionQuote {
  const months = Math.max(1, term.months);
  const base = monthlyPriceXof * months;
  const discountXof = Math.round(base * term.discountPct);
  const totalXof = base - discountXof;
  return {
    months,
    monthlyPriceXof,
    baseXof: base,
    discountPct: term.discountPct,
    discountXof,
    totalXof,
    effectiveMonthlyXof: Math.round(totalXof / months),
  };
}

export async function fetchActiveSubscription(): Promise<ActiveSubscription | null> {
  const { data, error } = await supabase.rpc('get_active_subscription');
  if (error) throw new Error(error.message);
  if (!data) return null;
  const row = data as Record<string, unknown>;
  const features = (row.features as PlanFeatures) || {};
  const termMonths = Number(row.term_months ?? 1);
  return {
    id: row.id as string,
    status: row.status as string,
    startsAt: (row.starts_at as string) ?? null,
    endsAt: (row.ends_at as string) ?? null,
    shippingCreditsUsed: Number(row.shipping_credits_used ?? 0),
    shippingCreditsQuota: Number(
      row.shipping_credits_quota ?? features.shippingCreditsPerMonth ?? 0
    ),
    termMonths,
    discountPct: Number(row.discount_pct ?? 0),
    amountPaidXof: row.amount_paid_xof != null ? Number(row.amount_paid_xof) : null,
    planCode: row.plan_code as string,
    planName: row.plan_name as string,
    audience: row.audience as PlanAudience,
    priceXof: Number(row.price_xof ?? 0),
    features,
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
  /** Durée souscrite en mois (1, 6, 12, 24, 48). Défaut : 1. */
  months?: number;
  customerName?: string;
  customerEmail?: string | null;
  country?: string;
}): Promise<{
  paymentUrl?: string;
  subscriptionId: string;
  amountXof: number;
  months: number;
  mode: 'simulate' | 'live';
}> {
  const { data: plan, error: planErr } = await supabase
    .from('subscription_plans')
    .select('*')
    .eq('id', input.planId)
    .maybeSingle();
  if (planErr || !plan) throw new Error(planErr?.message || 'Plan introuvable.');
  if (Number(plan.price_xof) <= 0) throw new Error('Ce plan est gratuit.');

  const months = Math.max(1, input.months ?? 1);

  // Le montant est calculé côté serveur (barème `subscription_terms`).
  const { data: created, error: createErr } = await supabase.rpc('create_my_subscription', {
    p_plan_id: input.planId,
    p_months: months,
  });
  if (createErr) {
    throw new Error(
      createErr.message.includes('function') || createErr.message.includes('schema cache')
        ? 'Durées d’abonnement indisponibles : exécutez la migration 028_subscription_terms.sql'
        : createErr.message
    );
  }

  const quote = created as Record<string, unknown>;
  const subscriptionId = quote.subscription_id as string;
  const amountXof = Number(quote.total_xof ?? 0);

  if (!isLivePayment()) {
    const { error: actErr } = await supabase.rpc('activate_my_pending_subscription', {
      p_subscription_id: subscriptionId,
    });
    if (actErr) throw new Error(actErr.message);
    return { subscriptionId, amountXof, months, mode: 'simulate' };
  }

  const checkout = await startCheckout({
    amount: amountXof,
    phone: input.phone,
    provider: 'mobile_money',
    kind: 'subscription',
    subscriptionId,
    customerName: input.customerName,
    customerEmail: input.customerEmail,
    country: input.country,
  });

  return {
    subscriptionId,
    amountXof,
    months,
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

export interface AdminSubscriptionRow {
  id: string;
  status: string;
  starts_at: string | null;
  ends_at: string | null;
  shipping_credits_used: number;
  term_months: number;
  discount_pct: number;
  amount_paid_xof: number | null;
  user_id: string;
  userName: string | null;
  /** Pays résolu (vendeur → boutique ; client → ville du profil). */
  country: string | null;
  plan: {
    code?: string;
    name?: string;
    audience?: PlanAudience;
    price_xof?: number;
  } | null;
}

function resolveSubscriberCountry(
  audience: string | undefined,
  userId: string,
  profileCity: string | null | undefined,
  vendorCountryByUser: Map<string, string>
): string | null {
  if (audience === 'vendor') {
    return vendorCountryByUser.get(userId) || null;
  }
  return (
    countryCodeFromLabelOrCity(profileCity) ||
    vendorCountryByUser.get(userId) ||
    null
  );
}

async function fetchVendorCountryByUser(
  userIds: string[]
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  if (!userIds.length) return map;
  const { data, error } = await supabase
    .from('vendors')
    .select('user_id, country')
    .in('user_id', userIds);
  if (error) throw new Error(error.message);
  for (const row of data || []) {
    const code = String(row.country || '').toUpperCase();
    if (code) map.set(row.user_id as string, code);
  }
  return map;
}

async function fetchProfileMetaByUser(
  userIds: string[]
): Promise<Map<string, { fullName: string | null; city: string | null }>> {
  const map = new Map<string, { fullName: string | null; city: string | null }>();
  if (!userIds.length) return map;
  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name, city')
    .in('id', userIds);
  if (error) throw new Error(error.message);
  for (const row of data || []) {
    map.set(row.id as string, {
      fullName: (row.full_name as string) ?? null,
      city: (row.city as string) ?? null,
    });
  }
  return map;
}

export async function adminListSubscriptions(
  country?: string | 'ALL'
): Promise<AdminSubscriptionRow[]> {
  const { data, error } = await supabase
    .from('subscriptions')
    .select(
      `id, status, starts_at, ends_at, shipping_credits_used, term_months, discount_pct, amount_paid_xof, user_id,
       plan:subscription_plans(code, name, audience, price_xof)`
    )
    .order('created_at', { ascending: false })
    .limit(200);
  if (error) throw new Error(error.message);

  const rows = data || [];
  const userIds = [...new Set(rows.map((r) => r.user_id as string))];
  const [vendorCountryByUser, profilesByUser] = await Promise.all([
    fetchVendorCountryByUser(userIds),
    fetchProfileMetaByUser(userIds),
  ]);

  const mapped: AdminSubscriptionRow[] = rows.map((r) => {
    const planRaw = Array.isArray(r.plan) ? r.plan[0] : r.plan;
    const plan = (planRaw as AdminSubscriptionRow['plan']) ?? null;
    const userId = r.user_id as string;
    const profile = profilesByUser.get(userId);

    return {
      id: r.id as string,
      status: r.status as string,
      starts_at: (r.starts_at as string) ?? null,
      ends_at: (r.ends_at as string) ?? null,
      shipping_credits_used: Number(r.shipping_credits_used ?? 0),
      term_months: Number(r.term_months ?? 1),
      discount_pct: Number(r.discount_pct ?? 0),
      amount_paid_xof:
        r.amount_paid_xof != null ? Number(r.amount_paid_xof) : null,
      user_id: userId,
      userName: profile?.fullName ?? null,
      country: resolveSubscriberCountry(
        plan?.audience,
        userId,
        profile?.city,
        vendorCountryByUser
      ),
      plan,
    };
  });

  if (!country || country === 'ALL') return mapped;
  return mapped.filter((s) => s.country === country);
}

export async function adminListAds(
  country?: string | 'ALL'
): Promise<(AdPlacement & { country: string | null })[]> {
  const { data, error } = await supabase
    .from('ad_placements')
    .select('*, vendors(country)')
    .order('created_at', { ascending: false })
    .limit(200);
  if (error) throw new Error(error.message);

  const rows = data || [];
  const userIds = [
    ...new Set(rows.map((r) => r.subscriber_user_id as string).filter(Boolean)),
  ];
  const [vendorCountryByUser, profilesByUser] = await Promise.all([
    fetchVendorCountryByUser(userIds),
    fetchProfileMetaByUser(userIds),
  ]);

  const mapped = rows.map((r) => {
    const ad = mapAd(r as Record<string, unknown>);
    const vendorRaw = Array.isArray(r.vendors) ? r.vendors[0] : r.vendors;
    const vendorCountry = String(
      (vendorRaw as { country?: string } | null)?.country || ''
    ).toUpperCase();
    const profile = profilesByUser.get(ad.subscriberUserId);
    const countryCode =
      vendorCountry ||
      countryCodeFromLabelOrCity(profile?.city) ||
      vendorCountryByUser.get(ad.subscriberUserId) ||
      null;
    return { ...ad, country: countryCode };
  });

  if (!country || country === 'ALL') return mapped;
  return mapped.filter((a) => a.country === country);
}

export function formatPlanPrice(xof: number): string {
  if (xof <= 0) return 'Gratuit';
  return `${xof.toLocaleString('fr-FR')} FCFA / mois`;
}

export function formatXof(xof: number): string {
  return `${Math.round(xof).toLocaleString('fr-FR')} FCFA`;
}

/** Libellé d'une durée, ex. « 24 mois (2 ans) ». */
export function formatTermLabel(term: SubscriptionTerm): string {
  if (term.months < 12) return term.label;
  const years = term.months / 12;
  const suffix = years === 1 ? '1 an' : `${years} ans`;
  return `${term.label} (${suffix})`;
}
