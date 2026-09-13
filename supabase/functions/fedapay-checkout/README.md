# FedaPay — AfriZone

Remplace CinetPay pour les encaissements Mobile Money / Wave.

## 1. Compte sandbox

1. Créez un compte sur [https://fedapay.com](https://fedapay.com) (mode **Sandbox / Test**).
2. Dashboard → **API** / **Développeurs** → copiez la **Secret Key** (`sk_sandbox_…`).
3. (Optionnel) Public Key (`pk_sandbox_…`) — non requise pour ce flux serveur.

## 2. Secrets Supabase

```bash
supabase secrets set FEDAPAY_SECRET_KEY=sk_sandbox_XXXXXXXX
supabase secrets set FEDAPAY_ENV=sandbox
supabase secrets set APP_URL=https://votredomaine.com
# en local :
# supabase secrets set APP_URL=http://localhost:5173
```

## 3. Déployer les Edge Functions

```bash
supabase functions deploy fedapay-checkout
supabase functions deploy fedapay-webhook --no-verify-jwt
```

## 4. Webhook FedaPay

Dans le dashboard FedaPay → **Webhooks** → Créer :

| Champ | Valeur |
|-------|--------|
| URL | `https://<PROJECT_REF>.supabase.co/functions/v1/fedapay-webhook` |
| Events | `transaction.approved`, `transaction.transferred` (ou tous) |

`<PROJECT_REF>` = l’id de votre projet Supabase (dans l’URL du dashboard).

## 5. Front (`.env.local`)

```env
VITE_PAYMENT_MODE=live
VITE_APP_URL=http://localhost:5173
# ou l’URL de prod
```

Puis redémarrez Vite (`npm run dev`).

## 6. Tester (sandbox)

1. Checkout → redirection FedaPay sandbox.
2. Choisissez **Momo Test** (pas Orange/Moov « Côte d’Ivoire » : libellés de démo).
3. Indicatif téléphone : **Bénin (+229)** — pas Burkina (+226).  
   Les numéros de succès sont des numéros **test Bénin**.
4. Numéro succès : `64000001` (Moov) ou `66000001` (MTN).
5. Alternative fiable : **Carte** Visa `4111111111111111`, expiration future, CVC `123`.
6. Retour sur `/paiement/retour?tx=…` → statut **payé**.

> Si le widget garde +226, le paiement échoue même avec 64000001.  
> L’Edge Function n’envoie plus le téléphone en sandbox pour éviter ce piège.

### Opérateurs BF / SN / ML absents ?

En **sandbox**, FedaPay n’affiche souvent que *Momo Test* + opérateurs CI de démo.  
En **live**, activez les méthodes (Orange BF, Moov BF, Wave SN…) dans le dashboard FedaPay → **Moyens de paiement**, et vérifiez que le compte marchand est bien ouvert pour ces pays.

## Flux

```
Checkout → placeOrders(markPaid:false)
  → fedapay-checkout (init) → crée transaction + token
  → redirect paymentUrl
  → FedaPay webhook → complete_cinetpay_payment (RPC existante)
  → /paiement/retour → fedapay-checkout (check)
```

## Production

1. Activez le compte **Live** FedaPay.
2. `FEDAPAY_SECRET_KEY=sk_live_…`
3. `FEDAPAY_ENV=live`
4. Recréez le webhook avec la même URL (secret live).
5. `APP_URL` / `VITE_APP_URL` = domaine HTTPS public.

## Dépannage

| Symptôme | Cause probable |
|----------|----------------|
| `unavailable` | Secret `FEDAPAY_SECRET_KEY` manquant |
| Pas de redirection | `paymentUrl` absent — voir logs `fedapay-checkout` |
| Payé chez FedaPay, commande pending | Webhook non configuré ou URL incorrecte ; le `check` au retour rattrape souvent |
| Téléphone refusé | Format international + code pays (SN/BF/ML) |
