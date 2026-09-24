# AfriZone — Suivi des modules

> Fichier de suivi du développement MVP.  
> Dernière mise à jour : **24 septembre 2026**

---

## Vue d’ensemble

| Bloc | Nombre | Statut |
|---|---|---|
| Phases préparatoires | **2** | ✅ Terminées |
| Modules fonctionnels MVP | **13** | **13/13** faits |
| **Total du début à la fin** | **15 étapes** | **15/15** |

**Progression MVP :** ▓▓▓▓▓▓▓▓▓▓▓▓ **~100 %** (+ géoloc & badges CDC)

> **Note CDC :** le rôle `livreur` existe déjà en base (`user_role`), mais l’espace livreur n’était pas dans le plan initial — **ajouté en Module 8** pour coller au cahier des charges.

---

## Phases préparatoires (hors numérotation modules)

| # | Phase | Contenu | Statut |
|---|---|---|---|
| P1 | Analyse CDC | Audit dépôt + cahiers des charges, écarts, priorités | ✅ Fait |
| P2 | Infra | Supabase, Vercel, schéma SQL `001`, client JS, `.env`, déploiement | ✅ Fait |

---

## Modules fonctionnels (1 → 11)

Coche `[x]` quand c’est validé de ton côté (tests + migrations SQL).

### ✅ Module 1 — Authentification
- [x] Inscription client / vendeur (Supabase Auth)
- [x] Connexion, déconnexion, mot de passe oublié
- [x] Routes protégées par rôle
- [x] Migration `002_auth_trigger_and_storage.sql`

### ✅ Module 2 — Catalogue public
- [x] `/catalogue`, `/produit/:slug`, `/boutique/:slug`
- [x] Filtres, recherche, accueil branché Supabase
- [x] Seed démo `003_seed_demo_catalog.sql`

### ✅ Module 3 — Espace vendeur + validation admin
- [x] CRUD produits vendeur + mode livraison
- [x] Admin : approuver / refuser / suspendre vendeurs
- [x] Migration `004_admin_policies.sql`

### ✅ Module 4 — Panier & commandes client
- [x] `/panier`, `/checkout`, `/commandes`, `/commandes/:id`
- [x] Paiement Mobile Money (simulation MVP)
- [x] Migration `005_orders_rls.sql`

### ✅ Module 5 — Commandes côté vendeur
- [x] `/vendeur/commandes` + détail
- [x] Workflow statut (préparation → livraison → livré)
- [x] Stats dashboard vendeur

### ✅ Module 6 — Envoi de colis
- [x] `/colis`, `/colis/mes-envois`, `/suivi`
- [x] Admin colis `/admin/colis`
- [x] Migration `006_parcels.sql`

### ✅ Module 7 — Profil client & adresses
- [x] `/compte` — profil (nom, téléphone, email, ville, avatar)
- [x] `/compte/adresses` — CRUD + adresse par défaut
- [x] Préremplissage checkout + envoi colis
- [x] Migration `007_addresses.sql`

---

### ✅ Module 8 — Livreurs *(CDC)*
- [x] Inscription `/auth/register/driver`
- [x] Validation admin `/admin/livreurs`
- [x] Assignation courses `/admin/livraisons`
- [x] Espace livreur `/livreur` + courses + statuts
- [x] Migration `008_drivers.sql`

---

### ✅ Module 9 — Notifications
- [x] Table `notifications` + RLS + triggers
- [x] Cloche Header + badge non lus
- [x] Centre `/notifications`
- [x] Événements : commande, colis, course livreur, validation vendeur/livreur
- [x] Migration `009_notifications.sql`
- [x] Emails transactionnels commandes (client + admin, payé → livré) — migration `014` + Edge Function `order-emails`
- [ ] Configurer Resend + `app_settings` (voir README `order-emails`)

---

### ✅ Module 10 — Avis & confiance
- [x] Table `reviews` + RPC `submit_review`
- [x] Noter après commande livrée
- [x] Affichage avis produit / boutique
- [x] Recalcul rating
- [x] Migration `010_reviews.sql`

---

### ✅ Module 11 — Admin complet + paiements + polish MVP
| Tâche | Statut |
|---|---|
| Dashboard admin (stats CA, commandes, colis, users…) | ✅ |
| Gestion admin des commandes marketplace | ✅ |
| Couche paiement (Mobile Money opérateurs + Wave + mode live Edge Function) | ✅ |
| Pages légales (CGU, confidentialité, FAQ, contact) | ✅ |
| Footer branché + polish MVP | ✅ |

> **Paiement live :** `VITE_PAYMENT_MODE=live` + déployer `supabase/functions/mobile-money` + secrets opérateurs.

---

### ✅ Module 12 — Géolocalisation *(CDC)*
- [x] Position GPS livreur en temps réel (RPC + logs)
- [x] Page client `/suivi-livraison/:id` + lien depuis commande
- [x] Partage GPS côté livreur + carte OSM
- [x] Optimisation d’itinéraire (plus proche voisin) sur courses actives
- [x] Migration `012_geolocation_badges.sql`

### ✅ Module 13 — Badges vendeurs *(CDC)*
- [x] Badges **Vérifié**, **Gold Seller**, **Top Rated**
- [x] Affichage boutique / accueil / fiche produit
- [x] Attribution auto + bascule manuelle admin
- [x] Inclus dans migration `012_geolocation_badges.sql`

### ✅ Module 14 — Assistant IA « Zoni »
- [x] Base de connaissances complète de la plateforme (`src/lib/assistant-knowledge.ts`)
- [x] Moteur de réponse local — fonctionne sans clé API ni migration
- [x] Widget de chat flottant sur toutes les pages, adapté au rôle et à la page courante
- [x] Raccourcis de navigation cliquables dans les réponses + historique conservé
- [x] Edge Function `ai-assistant` (optionnelle) vers un fournisseur compatible OpenAI
- [x] Repli automatique sur le mode local si la fonction ou la clé IA est absente

### ✅ Module 15 — Validation produits, assignation éclairée, abonnements longue durée
- [x] **Produits validés par l’admin** avant affichage accueil / catalogue (`approval_status`)
- [x] Formulaire vendeur en **2 étapes** : étape 1 produit + photo générique, étape 2 réception entrepôt + photo réelle
- [x] Page admin `/admin/produits-a-valider` (comparaison des 2 photos, infos réception, approuver / refuser avec motif)
- [x] Badge de validation + motif de refus côté vendeur (`/vendeur/produits`, dashboard)
- [x] **Assignation des courses** : fiche complète de la commande avant d’assigner (distance, GPS, dates, heures, articles, poids) + tri par distance
- [x] **Identifiant livreur à la remise** : `Prenom_NOM_CODE` (ex. `Issouf_KONE_LV-BF-OUA-6987`) côté admin, espace livreur et app mobile
- [x] **Abonnements 1 / 6 / 12 / 24 / 48 mois** avec remises d’engagement à partir de 1 an (−10 %, −15 %, −25 %)
- [x] Migrations `027_product_approval_reception.sql` et `028_subscription_terms.sql`

---

## Migrations SQL à cocher

| Fichier | Module | Exécuté sur Supabase ? |
|---|---|---|
| `001_initial_schema.sql` | P2 | [ ] |
| `002_auth_trigger_and_storage.sql` | 1 | [ ] |
| `003_seed_demo_catalog.sql` | 2 | [ ] |
| `004_admin_policies.sql` | 3 | [ ] |
| `005_orders_rls.sql` | 4 | [ ] |
| `006_parcels.sql` | 6 | [ ] |
| `007_addresses.sql` | 7 | [ ] |
| `008_drivers.sql` | 8 | [ ] |
| `009_notifications.sql` | 9 | [ ] |
| `010_reviews.sql` | 10 | [ ] |
| `011_admin_management.sql` | 11+ | [ ] |
| `012_geolocation_badges.sql` | 12–13 | [ ] |
| `013_fix_rls_recursion.sql` | fix | [ ] |
| `014_order_emails.sql` | 9+ emails | [ ] |
| `015_fix_admin_deletes.sql` | fix admin | [ ] |
| `016_vendor_self_delivery.sql` | vendeur livreur | [ ] |
| `017_seed_rich_catalog.sql` | seed démo | [ ] |
| `018_seed_drivers.sql` | seed livreurs | [ ] |
| `019_cinetpay.sql` | paiements CinetPay | [ ] |
| `020_driver_wallet.sql` → `026_newsletter.sql` | portefeuille, lots, abonnements, newsletter | [ ] |
| `027_product_approval_reception.sql` | validation produits + réception entrepôt | [ ] |
| `028_subscription_terms.sql` | durées d’abonnement 1–48 mois + remises | [ ] |

---

## Prochaine étape recommandée

1. **Exécuter `027_product_approval_reception.sql`** — obligatoire : le catalogue filtre désormais sur `approval_status`
2. **Exécuter `028_subscription_terms.sql`** — obligatoire pour souscrire sur plusieurs mois
3. Tester : ajout produit vendeur (2 étapes) → `/admin/produits-a-valider` → approbation → visible sur l’accueil
4. Exécuter `015_fix_admin_deletes.sql` (suppressions admin users / boutiques / produits)  
5. Exécuter `014_order_emails.sql` + config Resend si pas encore fait  
6. Tester suppressions depuis `/admin`  
7. *(optionnel)* Déployer `ai-assistant` + `AI_API_KEY` pour passer l’assistant en mode IA  
8. Paiements réels : compte CinetPay (pas PayDunya) + migration `019_cinetpay.sql` + `VITE_PAYMENT_MODE=live`

---

## Légende

| Symbole | Sens |
|---|---|
| ✅ / `[x]` | Terminé |
| ⬜ / `[ ]` | À faire |
| MVP | Minimum viable pour lancer AfriZone |

---

*Tu peux cocher les cases directement dans ce fichier au fur et à mesure.*
