/**
 * Auto-test de la décision du scanner CNI / passeport (texte OCR → verdict).
 *
 *   npx tsx scripts/id-scan-selftest.ts
 *
 * Textes 100 % fictifs (aucune donnée personnelle). Vérifie que :
 *  - les pièces réelles attendues (CNIB BF, CNI SN/ML/GN, passeports) sont ACCEPTÉES ;
 *  - tout le reste (permis, attestation, carte d'électeur, document étranger,
 *    pièce expirée, mauvais type, visa, texte quelconque…) est REFUSÉ.
 */
import { decideIdDocumentFromOcr } from '../src/lib/id-document-scan';
import type { IdDocKind } from '../src/lib/id-doc-profiles';
import { mrzCheckDigit } from '../src/lib/id-mrz';

const NOW = new Date('2026-11-17T12:00:00Z');

function td3Line1(country: string, type = 'P<') {
  return `${type}${country}DUPONT<<JEAN<PAUL`.padEnd(44, '<');
}

function td3Line2(country: string, dob: string, exp: string, doc = 'A1234567') {
  const d = doc.padEnd(9, '<');
  return `${d}${mrzCheckDigit(d)}${country}${dob}${mrzCheckDigit(dob)}M${exp}${mrzCheckDigit(exp)}`.padEnd(
    42,
    '<'
  ) + '00';
}

/** MRZ TD1 (verso CNIB) : 3 lignes de 30 caractères, chiffres de contrôle valides. */
function td1Lines(country: string, dob: string, exp: string, doc = 'B12345678') {
  const l1 = `I<${country}${doc}${mrzCheckDigit(doc)}`.padEnd(30, '<');
  const l2 = `${dob}${mrzCheckDigit(dob)}M${exp}${mrzCheckDigit(exp)}${country}`.padEnd(29, '<') + '8';
  const l3 = 'DUPONT<<JEAN'.padEnd(30, '<');
  return `${l1}\n${l2}\n${l3}`;
}

const CNIB_OK = `
CARTE NATIONALE D'IDENTITE BURKINABE | BURKINA FASO
09010200121056627
Nom: TRAORE
Prénoms: ABDOUL KARIM
Né(e) le: 21/02/1990 A OUAGADOUGOU
Sexe: M Taille: 175 cm
Profession: COMMERCANT
Délivréele: | 06/05/2022
Expire le: 05/05/2032 B17091884
Signature du titulaire Signature de l'autorité
`;

interface Case {
  name: string;
  kind: IdDocKind;
  text: string;
  expect: 'accept' | 'reject';
}

const FIELDS_SN = `
REPUBLIQUE DU SENEGAL
CARTE NATIONALE D'IDENTITE CEDEAO
Nom: DIOP
Prénoms: MAMADOU
Né(e) le: 12/03/1991 A DAKAR
Sexe: M Taille: 178
Profession: ELEVE
Délivrée le: 10/01/2021
Expire le: 09/01/2031
`;

const cases: Case[] = [
  // ───── À ACCEPTER ─────
  { name: 'CNIB Burkina (recto réel, OCR propre)', kind: 'cni', text: CNIB_OK, expect: 'accept' },
  {
    name: 'CNIB Burkina (OCR bruité, sans « : »)',
    kind: 'cni',
    text: `Ç RT : d'est\nCARTE NATIONALE D'IDENTITE BURKINABE | | Bymana A\n09010200121056627 æ >"\nNom TRAORE\nPrénoms ABDOUL\nNé(e) le 21/02/1990 A BOBO\nSexe M Taille 175 cm\nProfession ELEVE\n- m Délivréele | 06/05/2022\nA Expire le 05/05/2032 B17091884\nSignature du titulaire`,
    expect: 'accept',
  },
  { name: 'CNI Sénégal', kind: 'cni', text: FIELDS_SN, expect: 'accept' },
  {
    name: 'CNI Mali',
    kind: 'cni',
    text: FIELDS_SN.replace('REPUBLIQUE DU SENEGAL', 'REPUBLIQUE DU MALI').replace('DAKAR', 'BAMAKO'),
    expect: 'accept',
  },
  {
    name: 'CNI Guinée',
    kind: 'cni',
    text: FIELDS_SN.replace('REPUBLIQUE DU SENEGAL', 'REPUBLIQUE DE GUINEE').replace('DAKAR', 'CONAKRY'),
    expect: 'accept',
  },
  {
    name: 'Passeport BF (MRZ valide, format PPBFA)',
    kind: 'passport',
    text: `BURKINA FASO\nPASSPORT BFA\n${td3Line1('BFA', 'PP')}\n${td3Line2('BFA', '900101', '300708')}\n`,
    expect: 'accept',
  },
  {
    name: 'Passeport SN (MRZ valide, P<SEN)',
    kind: 'passport',
    text: `REPUBLIQUE DU SENEGAL PASSEPORT\n${td3Line1('SEN')}\n${td3Line2('SEN', '850505', '310101')}`,
    expect: 'accept',
  },
  {
    name: 'Passeport BF (OCR confond 0→D dans la MRZ)',
    kind: 'passport',
    text: `PASSPORT\n${td3Line1('BFA', 'PP')}\n${td3Line2('BFA', '900101', '300708').replace(/0/g, 'D')}\n`,
    expect: 'accept',
  },
  {
    name: 'Passeport ML sans MRZ lisible mais page complète',
    kind: 'passport',
    text: `REPUBLIQUE DU MALI PASSEPORT / PASSPORT Type P Code du pays MLI Nom / Surname DIARRA Prénoms / Given names OUMAR Nationalité / Nationality MALIENNE Date de naissance / Date of birth 01 JAN 1990 Lieu de naissance BAMAKO Date d'expiration / Date of expiry 01 JAN 2031 N° de passeport`,
    expect: 'accept',
  },

  {
    name: 'CNIB verso (MRZ I<BFA authentifiée, texte du recto illisible)',
    kind: 'cni',
    text: `CARTE NATIONALE D'IDENTITE BURKINABE | pee\n${td1Lines('BFA', '961121', '290423')}`,
    expect: 'accept',
  },

  // ───── À REFUSER ─────
  {
    name: 'CNIB verso expirée (MRZ authentifiée)',
    kind: 'cni',
    text: `${td1Lines('BFA', '961121', '190423')}`,
    expect: 'reject',
  },
  {
    name: 'Verso de CNIB présenté comme passeport',
    kind: 'passport',
    text: `${td1Lines('BFA', '961121', '290423')}`,
    expect: 'reject',
  },
  {
    name: 'Permis de conduire burkinabè (mêmes champs que la CNIB)',
    kind: 'cni',
    text: `BURKINA FASO PERMIS DE CONDUIRE\nNom: TRAORE\nPrénoms: ABDOUL\nNé(e) le: 21/02/1990\nSexe: M\nProfession: COMMERCANT\nDélivré le: 06/05/2022\nExpire le: 05/05/2032`,
    expect: 'reject',
  },
  {
    name: 'Attestation de perte de CNIB (cite l’en-tête)',
    kind: 'cni',
    text: `BURKINA FASO ATTESTATION DE PERTE\nJe soussigné certifie que M. TRAORE Nom: TRAORE Prénoms: ABDOUL Né(e) le 21/02/1990 a perdu sa carte nationale d'identité burkinabè Profession: COMMERCANT`,
    expect: 'reject',
  },
  {
    name: 'Carte d’électeur',
    kind: 'cni',
    text: `BURKINA FASO CARTE D'ELECTEUR\nNom: TRAORE\nPrénoms: ABDOUL\nNé(e) le: 21/02/1990\nSexe: M\nProfession: COMMERCANT`,
    expect: 'reject',
  },
  {
    name: 'Carte scolaire',
    kind: 'cni',
    text: `BURKINA FASO CARTE SCOLAIRE\nNom: TRAORE\nPrénoms: ABDOUL\nNé(e) le: 21/02/1990\nSexe: M\nProfession: ELEVE\nExpire le: 05/05/2032`,
    expect: 'reject',
  },
  {
    name: 'Fiche avec les mots Nom / Prénoms / Né(e) le sans en-tête de carte',
    kind: 'cni',
    text: `BURKINA FASO\nNom: TRAORE\nPrénoms: ABDOUL\nNé(e) le: 21/02/1990\nSexe: M\nTaille: 175\nProfession: COMMERCANT\nDélivrée le: 06/05/2022\nExpire le: 05/05/2032`,
    expect: 'reject',
  },
  {
    name: 'CNI française',
    kind: 'cni',
    text: `REPUBLIQUE FRANCAISE CARTE NATIONALE D'IDENTITE\nNom: MARTIN\nPrénoms: PAUL\nNé(e) le: 12/03/1991 A PARIS\nSexe: M Taille: 178\nProfession: ETUDIANT\nExpire le: 09/01/2031`,
    expect: 'reject',
  },
  {
    name: 'CNI Côte d’Ivoire',
    kind: 'cni',
    text: `REPUBLIQUE DE COTE D'IVOIRE CARTE NATIONALE D'IDENTITE\nNom: KONE\nPrénoms: ADAMA\nNé(e) le: 12/03/1991 A ABIDJAN\nSexe: M Taille: 178\nProfession: ETUDIANT`,
    expect: 'reject',
  },
  {
    name: 'CNIB expirée',
    kind: 'cni',
    text: CNIB_OK.replace('06/05/2022', '06/05/2010').replace('05/05/2032', '05/05/2020'),
    expect: 'reject',
  },
  {
    name: 'Passeport ivoirien (MRZ P<CIV)',
    kind: 'passport',
    text: `PASSPORT\n${td3Line1('CIV')}\n${td3Line2('CIV', '900101', '300708')}`,
    expect: 'reject',
  },
  {
    name: 'Passeport BF expiré (MRZ valide)',
    kind: 'passport',
    text: `PASSPORT BURKINA FASO\n${td3Line1('BFA', 'PP')}\n${td3Line2('BFA', '900101', '190708')}`,
    expect: 'reject',
  },
  {
    name: 'Page de visa d’un passeport',
    kind: 'passport',
    text: `BURKINA FASO VISA\nV<BFADUPONT<<JEAN<PAUL<<<<<<<<<<<<<<<<<<<<<<<<\nN° de passeport A1234567 valable jusqu'au 2027`,
    expect: 'reject',
  },
  {
    name: 'CNIB présentée comme passeport',
    kind: 'passport',
    text: CNIB_OK,
    expect: 'reject',
  },
  {
    name: 'Passeport présenté comme CNI',
    kind: 'cni',
    text: `BURKINA FASO\nPASSPORT BFA\n${td3Line1('BFA', 'PP')}\n${td3Line2('BFA', '900101', '300708')}`,
    expect: 'reject',
  },
  {
    name: 'Formulaire de demande de passeport',
    kind: 'passport',
    text: `FORMULAIRE DE DEMANDE DE PASSEPORT BURKINA FASO\nNom Prénoms Date de naissance Lieu de naissance Nationalité Profession\nSignature du demandeur`,
    expect: 'reject',
  },
  {
    name: 'Facture quelconque',
    kind: 'cni',
    text: `FACTURE N° 2024-118 Burkina Faso Total à payer 45 000 FCFA Client: Société Sahel Merci de votre confiance Nom du client Date de livraison`,
    expect: 'reject',
  },
  { name: 'Texte vide / bruit', kind: 'cni', text: `~~ ;; xx  ..`, expect: 'reject' },
  {
    name: 'Page de garde sans MRZ ni champs',
    kind: 'passport',
    text: `BURKINA FASO REPUBLIQUE Unité Progrès Justice COMMUNICATION MINISTERE`,
    expect: 'reject',
  },
];

let failures = 0;
for (const c of cases) {
  const r = decideIdDocumentFromOcr({ ocrText: c.text, ocrConfidence: 80, expected: c.kind, now: NOW });
  const accepted = r.verdict === 'valid';
  const pass = c.expect === 'accept' ? accepted : !r.ok;
  if (!pass) failures += 1;
  console.log(
    `${pass ? '✅' : '❌'} [${c.expect === 'accept' ? 'ACCEPTER' : 'REFUSER '}] ${c.name}\n      → ${r.verdict}${
      r.error ? ` · ${r.error}` : ''
    }`
  );
}

console.log(`\n${cases.length - failures}/${cases.length} cas conformes.`);
process.exit(failures ? 1 : 0);
