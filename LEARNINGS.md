# LEARNINGS.md — Pièges, leçons et anecdotes par sprint

Fichier maintenu sprint par sprint. Chaque entrée = une anecdote concrète
utilisable en entretien STAR (Situation, Tâche, Action, Résultat).

---

## Sprint 1 — Fondations

- **Multi-tenant = discipline, pas fonctionnalité** : le `organization_id` doit
  apparaître dans **tous les WHERE** des queries métier.
  Un seul oubli = data leak silencieuse entre orgs.
  Le typage TypeScript (`orgId: number` en 1er paramètre) ne suffit pas :
  c'est la revue de code qui fait foi.
- **JWT refresh rotation** : le token est invalidé côté serveur via une table
  `refresh_tokens`. Sans ça, un refresh token volé peut être réutilisé
  indéfiniment. Le `iat` et `exp` sont gérés par la DB, pas par le JWT seul.

## Sprint 2 — Async Pipeline

- **Redis ≠ durable** : BullMQ met les jobs en file Redis (RAM).
  En cas de crash Redis, on perd la file. Pour du PDP (facturation),
  il faut un job persistence layer en PostgreSQL. Laissé en TODO.
- **Socket.io rooms et multi-tenant** : authentifier la WebSocket via un
  token passé en `auth` au `handshake`, puis joindre `org:${orgId}`.
  Sans ça, un client peut écouter les events d'une autre org.

## Sprint 3 — IA Extraction

- **L'IA comme fallback, pas comme primary** : si une facture entrante est
  déjà Factur-X / UBL, on **parse le XML** et on bypass le LLM.
  C'est le futur du métier en 2026-2027 : l'IA devient un filet de sécurité
  pour les factures non-structurées (PDF scanné, email libre, papier OCRisé).
  Mentionner ça en entretien montre qu'on comprend où va le marché.
- **Prompt caching (Anthropic)** : cache les 1024 premiers tokens du system
  prompt pour réduire la latence de 80% sur les appels répétés.
  Inutilisable si le system prompt change à chaque requête.
- **Détection de fraude en pipeline** : une facture est suspecte si SIREN
  inconnu, IBAN non-français pour un émetteur FR, ou montant > seuil.
  Ces règles sont codées en TypeScript pur dans `fraud/heuristics.ts`.

## Sprint 4 — Agent IA documentaire

- **Zod v4 breaking change** : `z.record(z.number())` devient
  `z.record(z.string(), z.number())` en Zod 4.
  Le premier argument (`keyType`) est obligatoire.
- **Rate limiting par IP** : `express-rate-limit` stocke les compteurs en RAM
  par défaut. Pour du multi-process, brancher sur Redis.

## Sprint 5 — Factur-X / e-invoicing (PDP)

- **`res.locals.orgId as number` ne suffit pas en strict** : TypeScript
  traite `res.locals` comme `Record<string, any>`, et le cast `as number`
  n'est pas toujours fiable selon la version d'Express types.
  Solution : `Number(res.locals.orgId)` — plus robuste, jamais ambigu.
- **`AppError(statusCode, message)` — pas l'inverse** : l'ordre des
  paramètres est `(number, string)`. Écrire `AppError('msg', 404)`
  donne une erreur TypeScript cryptique « Argument of type 'string'
  is not assignable to parameter of type 'number' » qui ne pointe pas
  vers le vrai problème.
- **fast-xml-parser et les attributs XML** : quand un élément XML a un
  attribut ET du texte (ex: `<Amount currencyID="EUR">100</Amount>`),
  fast-xml-parser le transforme en `{#text: "100", @_currencyID: "EUR"}`.
  Tous les `String(value)` ou `parseFloat(String(value))` cassent.
  **Toujours passer par un helper `getText(v)`** qui extrait `#text` si
  c'est un objet, sinon retourne la string.
- **Mustache = `module.exports = { render }`, pas `export default render`** :
  même avec `esModuleInterop`, `import Mustache from 'mustache'` donne
  l'objet, pas la fonction. On écrit `Mustache.render(...)` — c'est bien
  un appel de méthode, pas un appel de fonction.
- **pdfkit `.text()` overloads** : la méthode `.text()` a deux signatures :
  `text(str, options?)` et `text(str, x, y, options?)`.
  Pour que TypeScript accepte `text('FACTURE', { align: 'right' })`,
  il faut déclarer les deux overloads dans le `.d.ts`.
- **pdfkit en runtime** : pdfkit est utilisé par `pdf-a3-builder.ts` à
  l'exécution, pas seulement en dev → doit être dans `dependencies`,
  pas `devDependencies`. Si on le met dans devDeps, `npm install --prod`
  ne l'installe pas et l'import plante au runtime.
- **PDF/A-3 = injection manuelle** : aucune lib Node ne génère du PDF/A-3
  nativement. On injecte 3 objets : XMP metadata (pdfaid), OutputIntent
  (profil ICC), EmbeddedFile avec AFRelationship=Source. Le ICC profile est
  un placeholder — pour la conformité réelle, il faut embarquer le binaire
  sRGB IEC61966-2.1 (~3 Ko).
- **Le round-trip test est le garde-fou** : `Invoice DB → CII XML → parse →
  EInvoiceDto` — si ce test échoue, le mapping est cassé et la PDP est
  non-conforme. C'est le premier test à écrire et le dernier à faire passer.
- **SIREN vs SIRET** : `schemeID="0002"` = SIREN (9 chiffres),
  `schemeID="0009"` = SIRET (14 chiffres). Les règles BR-FR-03 et BR-FR-04
  valident la longueur exacte. Erreur classique en démo client.
- **EN 16931 §7.1 — format des montants** : 2 décimales pour les montants,
  4 pour les prix unitaires, séparateur décimal = point, pas de séparateur
  de milliers. `Intl.NumberFormat('fr-FR')` produit `1 000,00` → invalide
  en XML CII. Toujours utiliser `toFixed(2)` ou `toFixed(4)`.
- **Namespaces XML** : oublier `xmlns:qdt=...` = erreur XSD cryptique.
  Notre template Mustache contient les 5 namespaces obligatoires
  (rsm, ram, udt, qdt, xsi). Toute modification du template doit être
  vérifiée avec le round-trip test.

---

## Pièges à réutiliser en entretien STAR

| Sprint | Situation | Action | Résultat |
|---|---|---|---|
| 3 | Facture déjà Factur-X reçue → l'IA la traitait inutilement | Parsing XML prioritaire, IA en fallback | Latence ÷10, coût LLM ÷5 |
| 5 | `parseDecimal(String(value))` sur élément XML avec attribut → `NaN` | Helper `getText(v)` avec extraction `#text` | Round-trip test passe du premier coup |
| 5 | `AppError('msg', 404)` → erreur TypeScript incompréhensible | Ordre des paramètres `(code, msg)` documenté | Compilation 0 erreur |
| 5 | pdfkit dans devDependencies → crash en prod | Déplacé dans dependencies | `npm start` fonctionne |
