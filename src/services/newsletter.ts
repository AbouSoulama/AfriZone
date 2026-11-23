import { supabase } from '../lib/supabase';

export type NewsletterSubscribeResult = {
  ok: boolean;
  email: string;
  status: 'pending' | 'already_confirmed' | 'confirmed' | 'unsubscribed' | 'already_unsubscribed';
};

export type NewsletterSubscriberRow = {
  id: string;
  email: string;
  country: string | null;
  source: string;
  status: 'pending' | 'confirmed' | 'unsubscribed';
  created_at: string;
  confirmed_at: string | null;
  unsubscribed_at: string | null;
};

export type NewsletterCampaignRow = {
  id: string;
  subject: string;
  title: string;
  body: string;
  cta_url: string | null;
  cta_label: string | null;
  status: 'draft' | 'sending' | 'sent' | 'failed';
  recipient_count: number;
  sent_count: number;
  failed_count: number;
  error: string | null;
  created_at: string;
  sent_at: string | null;
};

export async function subscribeNewsletter(email: string, country?: string | null) {
  const { data, error } = await supabase.rpc('subscribe_newsletter', {
    p_email: email.trim(),
    p_country: country || null,
    p_source: 'footer',
  });
  if (error) throw new Error(error.message);
  return data as NewsletterSubscribeResult;
}

export async function confirmNewsletter(token: string) {
  const { data, error } = await supabase.rpc('confirm_newsletter', {
    p_token: token.trim(),
  });
  if (error) throw new Error(error.message);
  return data as NewsletterSubscribeResult;
}

export async function unsubscribeNewsletter(token: string) {
  const { data, error } = await supabase.rpc('unsubscribe_newsletter', {
    p_token: token.trim(),
  });
  if (error) throw new Error(error.message);
  return data as NewsletterSubscribeResult;
}

export async function adminListNewsletterSubscribers() {
  const { data, error } = await supabase
    .from('newsletter_subscribers')
    .select(
      'id, email, country, source, status, created_at, confirmed_at, unsubscribed_at'
    )
    .order('created_at', { ascending: false })
    .limit(500);
  if (error) throw new Error(error.message);
  return (data || []) as NewsletterSubscriberRow[];
}

export async function adminListNewsletterCampaigns() {
  const { data, error } = await supabase
    .from('newsletter_campaigns')
    .select(
      'id, subject, title, body, cta_url, cta_label, status, recipient_count, sent_count, failed_count, error, created_at, sent_at'
    )
    .order('created_at', { ascending: false })
    .limit(50);
  if (error) throw new Error(error.message);
  return (data || []) as NewsletterCampaignRow[];
}

export async function adminSendNewsletterCampaign(input: {
  subject: string;
  title: string;
  body: string;
  ctaUrl?: string;
  ctaLabel?: string;
}) {
  const { data, error } = await supabase.rpc('admin_send_newsletter_campaign', {
    p_subject: input.subject.trim(),
    p_title: input.title.trim(),
    p_body: input.body.trim(),
    p_cta_url: input.ctaUrl?.trim() || null,
    p_cta_label: input.ctaLabel?.trim() || null,
  });
  if (error) throw new Error(error.message);
  return data as { ok: boolean; campaign_id: string; recipient_count: number };
}
