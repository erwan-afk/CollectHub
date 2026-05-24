# XSD Schemas for Factur-X / UBL Validation

This directory must contain the official XSD schemas for CII and UBL validation.

These files are **NOT committed** (they are ~4 MB of XML). Download them manually.

## CII (Cross Industry Invoice)

**Source:** UN/CEFACT XML Schemas
**URL:** https://unece.org/trade/uncefact/xml-schemas
**File needed:** `CrossIndustryInvoice_100pD22B.xsd`

Also required (dependencies, downloaded from the same page):

- `QualifiedDataType_100pD22B.xsd`
- `UnqualifiedDataType_100pD22B.xsd`
- `ReusableAggregateBusinessInformationEntity_100pD22B.xsd`
- `CrossIndustryInvoice_100pD22B.xsd`

**Download steps:**

1. Go to https://unece.org/trade/uncefact/xml-schemas
2. Download the "Cross Industry Invoice D22B" package
3. Extract into this directory

## UBL 2.1

**Source:** OASIS UBL 2.1
**URL:** https://docs.oasis-open.org/ubl/UBL-2.1.html
**File needed:** `UBL-Invoice-2.1.xsd`

**Download steps:**

1. Go to https://docs.oasis-open.org/ubl/os-UBL-2.1/
2. Download `UBL-2.1.zip`
3. Extract `xsdrt/maindoc/UBL-Invoice-2.1.xsd` into this directory
4. Also extract the `xsdrt/common/` directory for the imported modules

## Without XSD files

The XSD validator (`validators/xsd-validator.ts`) has a graceful fallback:
if the XSD files are absent, validation falls back to XML well-formedness
checking only. This is acceptable for development but insufficient for
production PDP compliance.
