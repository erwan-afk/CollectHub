# ADR 0019 — Hand-written business rules vs Schematron engine

**Date:** 2026-05-23  
**Status:** Accepted

## Context

EN 16931 adds ~150 Schematron rules on top of XSD validation. Example:

> **BR-CO-10**: Sum of Invoice line net amounts (BT-106) = Σ Invoice line net amounts (BT-131).

Schematron engines in Node are rare and heavy:

- **node-schematron**: Abandoned, depends on libxslt (native, Windows-unfriendly)
- **schematron-runner**: Java-based, 20 MB+ overhead
- **XSLT-based**: Requires `saxon-js` or `xslt-processor` — both are multi-MB deps with poor TypeScript support

## Decision

We implement **25 critical business rules as TypeScript functions** in
`validators/business-rules.ts`. Each rule follows the pattern:

```ts
{
  id: 'BR-CO-10',
  description: 'Sum of Invoice line net amounts = Σ BT-131',
  check: (inv: EInvoiceDto) => string | null  // null = OK, string = error message
}
```

## Rationale

- **Type safety**: TypeScript validates that every rule accesses real fields on `EInvoiceDto`.
  A Schematron XML rule referencing a non-existent XPath silently fails.
- **Testable**: Each rule is a pure function — trivial to unit test.
  Schematron rules require an XML document + engine setup.
- **Debuggable**: Error messages embed the actual computed values
  (`"sumOfLines (123.45) ≠ computed (130.00)"`), which is impossible with XPath-based rules.
- **Minimal deps**: 0 extra dependencies. The Schematron approach requires 2+ native deps.

## Trade-offs

- We cover ~25 of ~150 rules. The selected rules cover:
  - All monetary total coherence rules (BR-CO-10 to BR-CO-15)
  - Mandatory field presence (BR-1 to BR-9)
  - VAT computation (BR-CO-17)
  - Line-level correctness (BR-16, BR-21, BR-25, BR-26, BR-27, BR-CO-25)
  - French-specific identifiers (BR-FR-01 to BR-FR-04)

- For production PDP use, a full Schematron engine would be needed.
  This is documented in LEARNINGS.md as a known gap.
