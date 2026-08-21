# Paiement CinetPay — nouveau panel (panel.cinetpay.net)

Le Sandbox actuel **n’utilise plus de Site ID**.
Il faut uniquement :

1. **API Key** (`sk_test_…`)
2. **Mot de passe API** (à définir dans le panel)

## 1. Récupérer les identifiants

1. Ouvrez [panel.cinetpay.net](https://panel.cinetpay.net) (Sandbox).
2. Menu **Ressources → API & sécurité**.
3. Copiez l’**API Key** (icône œil).
4. Cliquez sur **Définir un mot de passe API**, choisissez un mot de passe fort, enregistrez-le.

Le menu **Solution → Paiements** n’est que l’historique : il n’affiche pas les clés.

## 2. SQL

Exécutez `supabase/migrations/019_cinetpay.sql` dans le SQL Editor Supabase.

## 3. Déployer

```bash
supabase functions deploy cinetpay-checkout
supabase functions deploy cinetpay-webhook --no-verify-jwt
```

## 4. Secrets

```bash
supabase secrets set CINETPAY_API_KEY=sk_test_VOTRE_CLE
supabase secrets set CINETPAY_API_PASSWORD=votre_mot_de_passe_api
supabase secrets set CINETPAY_COUNTRY=BF
supabase secrets set APP_URL=http://localhost:5173
```

`CINETPAY_COUNTRY` = pays du compte marchand (`BF`, `SN` ou `ML`).

## 5. Front

Dans `.env.local` :

```
VITE_PAYMENT_MODE=live
```

Puis `npm run dev`. Au checkout, redirection vers CinetPay Sandbox (sans vrai argent).

## Ancienne API (Site ID)

L’ancienne doc (`site_id` + `api-checkout.cinetpay.com`) ne correspond **pas** au panel Sandbox actuel. AfriZone utilise désormais :

- Auth : `POST /v1/oauth/login`
- Paiement : `POST /v1/payment`
- Statut : `GET /v1/payment/{merchant_transaction_id}`
- Sandbox : `https://api.cinetpay.net`
