# ADR 0018 — EN 16931 as default profile (vs BASIC)

**Date:** 2026-05-23  
**Status:** Accepted

## Context

Factur-X defines 5 profiles: MINIMUM, BASIC WL, BASIC, EN 16931 (COMFORT), EXTENDED.

The French DGFiP B2B mandate starting September 2026 requires **at least EN 16931**
(sometimes called "COMFORT"). BASIC and below are insufficient:

- **BASIC**: Missing key B2B fields like `BuyerReference` (BT-10) and VAT breakdowns (BT-116+)
- **BASIC WL**: Missing `Seller VAT` (BT-31) — illegal in B2B EU transactions
- **MINIMUM**: Barely a structured invoice — not legal for any FR B2B flow

## Decision

All generated invoices default to **EN 16931 profile**.
The parser detects any profile from the incoming file but the generator always
produces EN 16931.

## Rationale

- **Default = legal**: Generating EN 16931 guarantees the output is compliant.
  Letting the caller choose a lower profile risks accidental non-compliance.
- **Yooz positioning**: Yooz is a PDP agréé — they deal primarily with EN 16931
  and EXTENDED invoices. Demonstrating that we default to the required profile
  shows regulatory awareness.
- **Optional override**: The `profile` parameter in `generateFacturX()` accepts
  any profile for testing, but the routes default to EN 16931.
