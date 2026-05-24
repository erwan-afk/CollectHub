# ADR 0016 — Build PDF/A-3 from scratch vs. SaaS library

**Date:** 2026-05-23  
**Status:** Accepted

## Context

Factur-X requires a PDF/A-3 file with an embedded XML attachment.
Several Node.js libraries provide PDF/A conversion but each has issues:

- **pdf-lib**: Full PDF object manipulation but no native PDF/A support
- **pdfkit**: Stream-based PDF creation, no PDF/A support
- **HummusJS**: Native PDF manipulation (C++) but unmaintained since 2020
- **SaaS APIs** (Adobe PDF Services, iText, etc.): vendor lock-in, cost, not a Node skill

## Decision

We build the PDF/A-3 layer ourselves using `pdf-lib` for low-level object injection
and `pdfkit` for the visual invoice rendering.

We inject 3 PDF/A-3b required objects manually:
1. XMP metadata (pdfaid:part=3, pdfaid:conformance=B)
2. OutputIntent with sRGB profile reference
3. EmbeddedFile with AFRelationship=Source

## Rationale

- **Apprentissage**: PDF spec manipulation is a rare and valuable skill.
  Building it from scratch demonstrates deep understanding of the format
  (cross-reference tables, object streams, XMP namespaces).
- **Zéro vendor lock-in**: We own the pipeline end-to-end.
  Can swap pdfkit for puppeteer or a React-PDF renderer later.
- **Minimal deps**: pdf-lib + pdfkit = 2 deps, vs 50+ for a SaaS SDK.

## Trade-offs

- PDF/A-3b conformance is **structural** only. We inject a placeholder ICC profile,
  which means validators like veraPDF/Mustang will flag it. A production-grade
  implementation would embed the actual sRGB IEC61966-2.1 ICC binary (~3 KB).
- Not a full PDF/A-3b validator. We verify markers presence, not semantic conformance.
  Mustang CLI is recommended for external validation.
