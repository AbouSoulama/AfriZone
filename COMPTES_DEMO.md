# AfriZone — Comptes de démonstration

> Mot de passe commun (sauf admin) : **`DemoAfriZone2026!`**  
> Migration SQL : `supabase/migrations/017_seed_rich_catalog.sql`  
> À exécuter dans **Supabase → SQL Editor → Run**.

---

## Admin

| Rôle | Email | Mot de passe |
|------|--------|--------------|
| Admin | `admin@afrizone.app` | `AdminAfriZone2026!` |

---

## Vendeurs (boutiques approuvées)

| Boutique | Pays / Ville | Catégorie | Email | Mot de passe |
|----------|--------------|-----------|--------|--------------|
| TechDakar | SN · Dakar | Électronique | `demo.vendeur1@afrizone.app` | `DemoAfriZone2026!` |
| BeautéNaturelle BF | BF · Ouagadougou | Beauté | `demo.vendeur2@afrizone.app` | `DemoAfriZone2026!` |
| ModeAfrique Bamako | ML · Bamako | Mode | `demo.vendeur3@afrizone.app` | `DemoAfriZone2026!` |
| Maison Sahel | SN · Dakar | Maison | `demo.maison@afrizone.app` | `DemoAfriZone2026!` |
| Saveurs du Sahel | BF · Ouagadougou | Alimentation | `demo.alimentation@afrizone.app` | `DemoAfriZone2026!` |
| Sport Bamako Pro | ML · Bamako | Sport | `demo.sport@afrizone.app` | `DemoAfriZone2026!` |
| AutoExpress Sénégal | SN · Dakar | Auto | `demo.auto@afrizone.app` | `DemoAfriZone2026!` |
| Librairie Sahel | BF · Ouagadougou | Livres | `demo.livres@afrizone.app` | `DemoAfriZone2026!` |

---

## Clients

| Nom | Email | Mot de passe |
|-----|--------|--------------|
| Khadija Ba | `demo.client1@afrizone.app` | `DemoAfriZone2026!` |
| Abdoulaye Koné | `demo.client2@afrizone.app` | `DemoAfriZone2026!` |

---

## Livreurs (approuvés)

| Nom | Pays / Ville | Véhicule | Email | Mot de passe |
|-----|--------------|----------|--------|--------------|
| Ibrahima Sarr | SN · Dakar | Moto | `demo.livreur1@afrizone.app` | `DemoAfriZone2026!` |
| Aissatou Diallo | SN · Dakar | Voiture | `demo.livreur2@afrizone.app` | `DemoAfriZone2026!` |
| Boubacar Ouédraogo | BF · Ouagadougou | Moto | `demo.livreur3@afrizone.app` | `DemoAfriZone2026!` |
| Mariam Coulibaly | ML · Bamako | Moto | `demo.livreur4@afrizone.app` | `DemoAfriZone2026!` |
| Ousmane Camara | ML · Bamako | Camionnette | `demo.livreur5@afrizone.app` | `DemoAfriZone2026!` |

> Migration livreurs : `018_seed_drivers.sql` (à exécuter si pas déjà fait avec 017).

---

## Contenu catalogue (017)

- **8 boutiques** dans les 3 pays (SN / BF / ML)
- **~24 produits** répartis sur : Électronique, Beauté, Mode, Maison, Alimentation, Sport, Auto, Livres
- **5 livreurs** approuvés (SN / BF / ML) via `018_seed_drivers.sql`
- Textes et images Unsplash alignés sur chaque article

---

## Notes

1. Si la connexion échoue : vérifier que `017_seed_rich_catalog.sql` et `018_seed_drivers.sql` ont bien été exécutés.
2. Dans Supabase Auth, « Confirm email » peut être désactivé en dev pour tester plus vite.
3. Les anciens mots de passe `DemoVendor2026!` (seed 003) sont **remplacés** par `DemoAfriZone2026!` lors de l’exécution de 017.
