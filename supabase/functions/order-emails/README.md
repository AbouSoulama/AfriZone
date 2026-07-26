# Edge Function `order-emails`

Emails automatiques client + admin à chaque étape commande (payé → livré).

## Déploiement

```bash
supabase functions deploy order-emails --no-verify-jwt
supabase secrets set RESEND_API_KEY=re_xxx EMAIL_HOOK_SECRET=un-secret-long APP_URL=https://votre-domaine
# optionnel :
# supabase secrets set EMAIL_FROM="AfriZone <noreply@votredomaine.com>"
```

## Config SQL (après migration `014_order_emails.sql`)

```sql
insert into public.app_settings (key, value) values
  ('supabase_url', 'https://VOTRE_REF.supabase.co'),
  ('email_hook_secret', 'un-secret-long')
on conflict (key) do update
  set value = excluded.value, updated_at = now();
```

`email_hook_secret` doit être **identique** au secret Edge Function.

## Mode simulate

Sans `RESEND_API_KEY`, les emails sont journalisés (`email_logs`, mode `simulate`) sans envoi réel.

## Flux

`orders` INSERT/UPDATE status → trigger → `dispatch_order_email` (pg_net) → Edge Function → Resend.
