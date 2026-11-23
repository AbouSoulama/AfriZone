# Edge Function `order-emails`

Emails transactionnels AfriZone avec **templates brandés** (logo) et envoi via :

1. **SMTP Hostinger** (`contact@afrizones.com`) à travers le relais VPS `MAIL_RELAY_URL`
2. **Resend** en secours si le relais échoue et qu’une clé est définie

## Déploiement

```bash
supabase functions deploy order-emails --no-verify-jwt

supabase secrets set ^
  EMAIL_HOOK_SECRET=un-secret-long ^
  APP_URL=https://afrizones.com ^
  EMAIL_FROM="AfriZone <contact@afrizones.com>" ^
  MAIL_RELAY_URL=https://afrizones.com/api/email/send
```

Le même `EMAIL_HOOK_SECRET` doit être dans `/var/www/afrizone-api/.env` sur le VPS.

## Config SQL

```sql
insert into public.app_settings (key, value) values
  ('supabase_url', 'https://VOTRE_REF.supabase.co'),
  ('email_hook_secret', 'un-secret-long')
on conflict (key) do update
  set value = excluded.value, updated_at = now();
```

Sans ces `app_settings`, les triggers SQL n’appellent pas la fonction.

## Flux

DB trigger → `dispatch_*` → Edge `order-emails` → VPS `/api/email/send` → SMTP Hostinger

| Événement | Destinataires |
|---|---|
| Commande payée / statut | Client, vendeur, admin |
| Colis créé / statut | Client (+ admin) |
| Boutique / livreur en attente | Admin |
| Boutique / livreur validé / refusé | Vendeur / livreur |
| Produit à valider / revue | Admin / vendeur |
| Course / lot assigné | Livreur |
| Retrait demandé / traité | Admin / livreur |
| Abonnement activé | Client ou vendeur |
