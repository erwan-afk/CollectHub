# Sprint 5 — Factur-X / e-invoicing (conformité PDP)

**Durée cible :** 2 semaines
**Skills travaillés :** PDF/A-3, XML CII, UBL, XSD, Schematron, normes ISO, conformité réglementaire

> **Le sprint le plus Yooz-aligné de toute la roadmap.** Yooz est candidat / agréé **PDP (Plateforme de Dématérialisation Partenaire)**. À partir de **septembre 2026**, toutes les factures B2B émises en France doivent transiter par une PDP ou le PPF (Portail Public de Facturation) dans un format structuré (Factur-X, UBL, ou CII pur). Faire ce sprint = parler **leur langue** en entretien, mentionner les bons sigles, et prouver que tu as compris leur positionnement marché — pas juste fait du Node.js générique.
>
> **Zéro IA** dans ce sprint. C'est de l'ingénierie pure : manipulation binaire PDF, génération/parsing XML avec namespaces, validation contre schémas officiels, conformité légale.

## Objectif

Transformer le backend en mini-PDP : capable de **générer** une facture Factur-X conforme depuis la DB, de **parser** une facture Factur-X / UBL entrante et de l'hydrater en `Invoice` typée, et de **valider** les deux contre les schémas officiels DGFiP / EN 16931.

## Contexte réglementaire (à connaître par cœur pour l'entretien)

- **Réforme française** : généralisation de la facturation électronique B2B + e-reporting (B2C / international). Calendrier en vigueur :
  - **1er septembre 2026** : obligation de **réception** pour toutes les entreprises FR.
  - **1er septembre 2026** : obligation d'**émission** pour grandes entreprises + ETI.
  - **1er septembre 2027** : obligation d'émission pour PME + microentreprises.
- **3 acteurs** :
  - **PPF** (Portail Public de Facturation) — hub gratuit de l'État (rôle réduit depuis le pivot 2024, désormais annuaire + concentrateur).
  - **PDP** (Plateforme de Dématérialisation Partenaire) — opérateurs privés agréés DGFiP. **Yooz en est une.**
  - **OD** (Opérateur de Dématérialisation) — non agréé, doit passer par une PDP.
- **Formats obligatoires** dits du « socle » :
  - **Factur-X** — PDF/A-3 + XML CII embarqué (hybride lisible humain + machine).
  - **UBL 2.1** — XML pur (utilisé dans Peppol).
  - **CII** (UN/CEFACT Cross Industry Invoice) — XML pur.
- **Norme européenne** : **EN 16931** — sémantique commune que les 3 formats doivent respecter.
- **4 profils Factur-X** par richesse croissante : MINIMUM, BASIC WL, BASIC, EN 16931 (alias COMFORT), EXTENDED. **EN 16931 est la cible** : c'est le niveau qui satisfait l'obligation légale FR.

## Livrables

### 1. Génération Factur-X (profil EN 16931)
- Service `backend/src/services/einvoicing/facturx-generator.service.ts`.
- Input : un `Invoice` typé depuis la DB (avec lignes, fournisseur, acheteur).
- Étapes :
  1. **Générer le PDF visuel** de la facture via `pdfkit` ou `puppeteer` (HTML → PDF, plus flexible pour le style). PDF de base classique.
  2. **Convertir en PDF/A-3** : ajouter les métadonnées XMP, la déclaration `OutputIntent`, intégrer les polices, marquer comme PDF/A-3b. Lib : `pdf-lib` + injection manuelle des objets PDF/A nécessaires (pas de lib Node clé-en-main mûre — c'est précisément ce qui rend l'exercice formateur).
  3. **Générer le XML CII** correspondant via templating (Mustache ou template literals stricts). Respecter les namespaces UN/CEFACT (`rsm:`, `ram:`, `udt:`, `qdt:`). Mapper chaque champ DB → BT-XX (Business Term de l'EN 16931).
  4. **Embarquer le XML** dans le PDF/A-3 comme `EmbeddedFile` avec le nom obligatoire `factur-x.xml` et la relation `AFRelationship: Source`.
  5. **Valider** le XML produit contre le XSD officiel CII (cf. livrable 4) avant de finaliser le PDF.
- Endpoint : `GET /invoices/:id/facturx.pdf` → renvoie le PDF/A-3 Factur-X.

### 2. Parsing Factur-X entrant
- Service `backend/src/services/einvoicing/facturx-parser.service.ts`.
- Étapes :
  1. Lire le PDF, lister les fichiers embarqués via `pdf-lib`.
  2. Extraire `factur-x.xml` (ou `xrechnung.xml` pour la variante allemande).
  3. Parser le XML avec `fast-xml-parser` (gestion correcte des namespaces).
  4. Mapper chaque BT vers le schéma Zod `EInvoiceDto`.
  5. Valider sémantiquement (TVA cohérente, totaux qui matchent les lignes, etc. — règles Schematron simplifiées).
  6. Détecter le **profil** (MINIMUM → EXTENDED) depuis `GuidelineSpecifiedDocumentContextParameter`.
- Endpoint : `POST /invoices/import/facturx` (multipart upload) → crée une `Invoice` en DB en statut `IMPORTED`, retourne le profil détecté et les éventuels warnings de validation.

### 3. Parsing UBL 2.1
- Service `backend/src/services/einvoicing/ubl-parser.service.ts`.
- Même contrat de sortie (`EInvoiceDto`), mapping différent (UBL utilise `cbc:` et `cac:` au lieu de `ram:`).
- Endpoint : `POST /invoices/import/ubl` (multipart XML pur).
- Utilité : **Peppol** transporte du UBL, pas du Factur-X. Une vraie PDP doit gérer les deux.

### 4. Validation contre XSD officiels
- Télécharger les XSD officiels et les versionner dans `backend/src/services/einvoicing/schemas/` :
  - CII : `CrossIndustryInvoice_100pD22B.xsd` + dépendances (sur le site UN/CEFACT).
  - UBL : `UBL-Invoice-2.1.xsd` + dépendances (OASIS).
- Lib : **`libxmljs2`** (binding natif libxml2, le seul à supporter correctement la validation XSD complexe avec imports). Fallback `xsd-schema-validator` (lance java, à éviter mais robuste).
- Wrapper `validators/xsd-validator.ts` : `validateCII(xml) → { valid, errors: [{ line, column, message }] }`.

### 5. Règles métier (Schematron simplifié)
- L'EN 16931 ajoute ~150 règles métier au-dessus du XSD (ex : `BR-CO-10` — la somme des montants HT des lignes doit égaler le sous-total HT).
- Plutôt que d'embarquer un moteur Schematron complet (lourd en Node), **implémenter à la main les 20-30 règles critiques** dans `validators/business-rules.ts`. Format : `{ id: "BR-CO-10", description, check(invoice) → string | null }`.
- Le seuil de 20-30 règles est négociable mais doit **couvrir au moins les totaux, la TVA, les identifiants** (SIREN, numéro de TVA intracom).

### 6. Round-trip test
Test d'intégration crucial : `Invoice DB → générer Factur-X → reparser le XML → vérifier que le DTO obtenu est égal à l'original` (modulo formatage des nombres et dates). Si ça échoue, le mapping est cassé. **C'est le test que tout candidat sérieux montre en entretien.**

### 7. Conformité PDF/A-3 vérifiable
- Ajouter un script `npm run check:facturx -- path/to/file.pdf` qui :
  - Vérifie la présence des marqueurs PDF/A (`pdfaid:part`, `pdfaid:conformance`).
  - Vérifie la présence et le nom de l'`EmbeddedFile`.
  - Valide le XML embarqué contre le XSD CII.
  - Sort un rapport human-readable.
- Bonus : croiser avec le validateur public **Mustang** (CLI Java, FNFE-MPE) en CI pour validation externe.

### 8. Statuts de cycle de vie (4 obligatoires)
La réglementation impose le suivi de 4 statuts minimum entre PDP émettrice et réceptrice :
1. **Déposée** (envoyée sur le réseau)
2. **Refusée** (rejetée par le destinataire)
3. **Mise à disposition** (reçue par le destinataire)
4. **Encaissée** (paiement confirmé)

Étendre la state machine du sprint 1 avec ces 4 statuts en plus des statuts internes. Endpoint `POST /invoices/:id/lifecycle-event` pour les déclencher manuellement (en vrai ils viendraient de l'annuaire PPF / d'une PDP partenaire).

## Fichiers clés

**Nouveaux :**
- `backend/src/services/einvoicing/facturx-generator.service.ts`
- `backend/src/services/einvoicing/facturx-parser.service.ts`
- `backend/src/services/einvoicing/ubl-parser.service.ts`
- `backend/src/services/einvoicing/pdf-a3-builder.ts` — helper bas niveau pour la conformité PDF/A-3
- `backend/src/services/einvoicing/cii-mapper.ts` — `Invoice ↔ XML CII`
- `backend/src/services/einvoicing/ubl-mapper.ts` — `UBL XML → EInvoiceDto`
- `backend/src/services/einvoicing/validators/xsd-validator.ts`
- `backend/src/services/einvoicing/validators/business-rules.ts`
- `backend/src/services/einvoicing/schemas/` — XSD officiels versionnés (CII, UBL, dépendances)
- `backend/src/services/einvoicing/templates/cii-en16931.xml.hbs` — template Mustache du XML CII
- `backend/src/types/einvoice.ts` — `EInvoiceDto`, `FacturXProfile`, `LifecycleStatus`
- `backend/src/routes/einvoicing.ts` — endpoints export/import/lifecycle
- `backend/scripts/check-facturx.ts` — CLI de vérification
- `backend/src/db/migrations/00XX_lifecycle_statuses.sql`
- `src/app/pages/invoice-detail/` — bouton « Télécharger Factur-X » + badge profil détecté à l'import

**À refactorer :**
- `backend/src/services/state-machine/` (sprint 1) — ajouter les 4 statuts de cycle de vie réglementaires.
- `backend/src/services/ai/extractor.service.ts` (sprint 3) — si une facture entrante est déjà Factur-X, **shortcut total** : on parse le XML, l'IA n'est jamais appelée. À documenter dans `LEARNINGS.md`, c'est exactement le futur du métier (l'IA devient un fallback pour les factures non-structurées).

## Setup

```bash
# Dépendances natives nécessaires pour libxmljs2 sur Windows
npm install --global windows-build-tools  # une fois pour toutes
npm install libxmljs2 pdf-lib fast-xml-parser pdfkit

# XSD officiels à télécharger
# CII : https://unece.org/trade/uncefact/xml-schemas (CrossIndustryInvoice 100.D22B)
# UBL : https://docs.oasis-open.org/ubl/UBL-2.1.html (UBL-2.1 official schemas)

# Validateur externe pour comparaison
# Mustang CLI : https://www.mustangproject.org/
```

## Validation de fin de sprint

1. Une facture générée via `GET /invoices/:id/facturx.pdf` passe la validation **Mustang** sans erreur (profil EN 16931).
2. Une facture Factur-X tierce (échantillons FNFE-MPE disponibles publiquement) est parsée correctement, le profil est bien détecté, les totaux matchent.
3. Round-trip test : générer puis reparser, le DTO est égal à l'input (tests Vitest).
4. Une facture UBL Peppol (échantillons disponibles sur le wiki Peppol) est parsée correctement.
5. Le PDF généré est ouvrable dans Acrobat Reader, le panneau « Pièces jointes » montre `factur-x.xml`, et Acrobat affiche la mention « Ce fichier est conforme à PDF/A ».
6. Une facture corrompue (montants incohérents) est rejetée à l'import avec un message explicite citant la règle (`BR-CO-10: sum of line net amounts (123.45) does not match document net total (130.00)`).
7. Les 4 statuts réglementaires sont traçables dans `lifecycle_events`.

## ADR à rédiger

- `docs/adr/0016-pdf-a3-build-from-scratch-vs-lib.md` — pourquoi on assemble le PDF/A-3 nous-mêmes plutôt que d'utiliser une SaaS de conversion (apprentissage + zéro vendor lock-in).
- `docs/adr/0017-libxmljs2-vs-xsd-schema-validator.md` — choix du validateur XSD (perf, robustesse, dépendance Java).
- `docs/adr/0018-en16931-profile-default.md` — pourquoi viser EN 16931 et pas BASIC (le BASIC est inférieur aux exigences DGFiP pour le B2B FR).
- `docs/adr/0019-schematron-handwritten-subset.md` — choix d'implémenter 20-30 règles métier à la main plutôt qu'un moteur Schematron complet.

## Pièges connus (à mettre dans `LEARNINGS.md`)

- **Namespaces XML** : oublier un seul namespace dans le CII fait planter la validation XSD avec un message cryptique. Utiliser un parser strict dès le début.
- **PDF/A-3 vs PDF/A-3b** : trois sous-niveaux (a, b, u), Factur-X exige **3b** au minimum. La distinction passe par les métadonnées XMP, pas par le contenu PDF.
- **Encodage des montants** : EN 16931 exige 2 décimales pour les montants, 4 pour les quantités, mais le format est `xs:decimal` (pas de séparateur de milliers, point décimal). Une `Intl.NumberFormat` française casse tout.
- **SIREN vs SIRET** : `Seller.SpecifiedLegalOrganization.ID@schemeID="0002"` = SIREN (9 chiffres), `@schemeID="0009"` = SIRET (14 chiffres). Erreur classique.

## Pitch entretien (à préparer)

> « J'ai implémenté la génération et le parsing Factur-X profil EN 16931 from scratch en Node — PDF/A-3 avec XML CII embarqué côté émission, parsing + validation XSD + 25 règles métier EN 16931 à la main côté réception. UBL Peppol géré aussi. J'ai un round-trip test qui me garantit que mon mapping est non-destructif, et la sortie passe Mustang. Le piège principal a été *[à remplir dans LEARNINGS.md]*. J'ai compris pourquoi votre agrément PDP est central : sans gestion des 4 statuts de cycle de vie réglementaires et de l'interop avec le PPF, on n'est qu'un OD. »
