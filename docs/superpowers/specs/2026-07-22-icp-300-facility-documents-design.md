# ICP-300 Facility Documents Revision Design

## Objective

Regenerate and overwrite the two NineScrolls customer-facing ICP-300 PDFs while using the supplier PDFs as the only source of equipment and facility parameters.

## Source of Truth

- `ICP-300 Facility Requirements.pdf`
- `ICP-300 Layout.pdf`

No parameter may be inferred, calculated as a new requirement, or added from general engineering practice. Unit formatting may be normalized without changing values. The supplier's SI values remain authoritative.

## Output Files

- `NineScrolls-ICP-300-Facility-Requirements.pdf`
- `NineScrolls-ICP-300-Layout-Drawing.pdf`

The existing output files will be backed up before they are overwritten.

## Facility Requirements Content

The regenerated document will retain NineScrolls branding, the Diamond Foundry customer identification, Rev. A, and July 2026 date. Its technical content will be limited to:

1. Supplier layout dimensions: 2178 mm, 884 mm, 1259 mm, parenthetical 1740 mm, 800 mm service space, 2484 mm by 2859 mm total layout, pump 600 by 400 by 450 mm, and chiller 500 by 500 by 1000 mm.
2. Supplier power table: 10 kW, 380 V, 3Ph 5-wire, PE cable required, 50 A circuit breaker, earth-leakage protection, 5 m cable, and one 220 V 3-pin chiller socket.
3. Supplier gas table for O2, Ar, SF6, CF4, CHF3, Vent (GN2), and CDA, preserving all stated purity, pressure, flow, and connection values.
4. Supplier PCW/chiller table, preserving both supply-and-return rows and all stated connection, flow, and temperature values.
5. Supplier exhaust table: pump to customer-supplied scrubber, KF40, 40 m3/h maximum flow, and 400 sccm maximum process gas.

The document will not include the unsupported minimum ceiling height, operating temperature, humidity, floor-loading requirement, generic local-exhaust recommendation, alternate voltage/frequency configuration, EU example, or unverified descriptions of cooling-system function.

The parenthetical 1740 mm dimension will not be described as a lid-open dimension because the supplier does not label it that way.

## Layout Drawing Content

The supplier drawing geometry and labels will be retained as the technical source. NineScrolls branding and document identification may be placed around the drawing without altering its dimensions or connection labels. All four service-space dimensions will remain 800 mm, including the lower dimension. The total layout dimensions will remain 2484 mm by 2859 mm.

## Verification

1. Extract text from both final PDFs and compare every technical value against the supplier PDFs.
2. Render every final page to PNG.
3. Inspect for clipped text, overlap, unreadable labels, broken glyphs, incorrect page breaks, and altered drawing dimensions.
4. Confirm the two requested output paths contain the revised PDFs and that recoverable backups exist.

## Scope

Only the two requested customer-facing PDFs and the generation materials needed to produce them are in scope. Existing unrelated repository changes will not be modified or committed.
