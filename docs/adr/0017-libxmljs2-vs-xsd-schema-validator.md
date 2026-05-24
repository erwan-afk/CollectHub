# ADR 0017 — libxmljs2 vs xsd-schema-validator for XSD validation

**Date:** 2026-05-23  
**Status:** Accepted

## Context

EN 16931 requires XSD validation of CII and UBL XML against official schemas.
Two Node.js options exist:

| Library | Pros | Cons |
|---|---|---|
| **libxmljs2** | Native libxml2 (C), fast, accurate | Native compilation fails on Windows, needs build tools |
| **xsd-schema-validator** | Pure Java via child_process | Requires JRE, slower, 50+ MB overhead |
| **fast-xml-parser** | Pure JS, no native deps | Only well-formedness, no XSD support |

## Decision

We use **libxmljs2 as primary** with a **fast-xml-parser fallback**.

The `xsd-validator.ts` wrapper:
1. Tries `import('libxmljs2')` dynamically — if the native binding is available, uses it.
2. If not available, falls back to XML well-formedness checking via fast-xml-parser.
3. If XSD files aren't downloaded yet, returns a soft success with a warning.

## Rationale

- **Graceful degradation**: The code compiles and runs on any machine (Windows, macOS, CI)
  without native build failures blocking the pipeline.
- **Production path**: On a Linux server with libxml2-dev installed, libxmljs2 compiles
  cleanly and provides production-grade validation.
- **No JRE dependency**: xsd-schema-validator requires a Java runtime — unacceptable
  for a containerized Node.js deployment.

## Trade-offs

- On Windows dev machines, XSD validation is skipped (well-formedness only).
  Devs should validate externally via Mustang CLI during development.
- Dynamic import makes the module tree unstable for bundlers (not an issue for ts-node-dev).
