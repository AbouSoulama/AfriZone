# Edge Function `order-emails`

Emails transactionnels AfriZone via Resend :

- **Commandes** : client + vendeur + admin (achat payé, changements de statut)
- **Plateforme** : colis, validation boutique/livreur/produit, courses, retraits, abonnements

## Déploiement

```bash
supabase functions deploy order-emails --no-verify-jwt
supabase secrets set RESEND_API_KEY=re_xxx EMAIL_HOOK_SECRET=un-secret-long APP_URL=https://votre-domaine
# recommandé en prod (domaine vérifié chez Resend) :
# supabase secrets set EMAIL_FROM="AfriZone <noreply@votredomaine.com>"
```

## Config SQL (après migrations `014` + `030`)

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

| Événement | Destinataires |
|---|---|
| Commande payée | Client, vendeur, admin |
| Statut commande | Client, vendeur, admin |
| Colis créé / statut | Client (+ admin à la création) |
| Boutique / livreur en attente | Admin |
| Boutique / livreur validé / refusé | Vendeur / livreur |
| Produit à valider / revue | Admin / vendeur |
| Course / lot assigné | Livreur |
| Retrait demandé / traité | Admin / livreur |
| Abonnement activé | Client ou vendeur |

Appels SQL : `dispatch_order_email` (commandes) ou `dispatch_platform_email` (générique) → `pg_net` → cette fonction → Resend.

## Auth

Seuls `x-email-hook-secret` (= `EMAIL_HOOK_SECRET`) ou la service role key sont acceptés.
