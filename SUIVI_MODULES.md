# AfriZone — Suivi des modules

> Fichier de suivi du développement MVP.  
> Dernière mise à jour : **24 juillet 2026**

---

## Vue d’ensemble

| Bloc | Nombre | Statut |
|---|---|---|
| Phases préparatoires | **2** | ✅ Terminées |
| Modules fonctionnels MVP | **11** | **9/11** faits |
| **Total du début à la fin** | **13 étapes** | **11/13** |

**Progression MVP :** ▓▓▓▓▓▓▓▓▓▓▓░ ~**82 %** (modules 1→9 terminés)

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
- [ ] (Optionnel) emails Supabase / Resend

---

### ⬜ Module 10 — Avis & confiance
**Objectif CDC :** notation produits / vendeurs.

| Tâche | Statut |
|---|---|
| Table `reviews` (produit + vendeur) | ⬜ |
| Noter après commande livrée | ⬜ |
| Affichage notes sur fiche produit / boutique | ⬜ |
| Recalcul rating vendeur / produit | ⬜ |

---

### ⬜ Module 11 — Admin complet + paiements réels + polish MVP
**Objectif :** clôturer le MVP « production-ready ».

| Tâche | Statut |
|---|---|
| Dashboard admin (stats commandes, colis, livreurs, CA, users) | ⬜ |
| Gestion admin des commandes marketplace | ⬜ |
| Intégration API Mobile Money réelle (Orange / Wave) | ⬜ |
| Pages légales (CGU, confidentialité, FAQ, contact) | ⬜ |
| QA globale, perf (code-splitting), correctifs | ⬜ |

> Le module 11 peut être découpé en 11a / 11b / 11c si besoin.

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

---

## Prochaine étape recommandée

→ **Module 10 — Avis & confiance**

Puis 11 (admin + paiements réels + polish).

---

## Légende

| Symbole | Sens |
|---|---|
| ✅ / `[x]` | Terminé |
| ⬜ / `[ ]` | À faire |
| MVP | Minimum viable pour lancer AfriZone |

---

*Tu peux cocher les cases directement dans ce fichier au fur et à mesure.*
