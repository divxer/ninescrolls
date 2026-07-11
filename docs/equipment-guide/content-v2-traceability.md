# Equipment Guide Content v2 — Traceability

Every `content.lead` and rewritten bullet in `src/data/equipmentGuide/products.ts` traced to its source:
the matching website config `hero.description`, the product's original guide bullets, or its `specs`/`subTable` rows.
No number appears that is not present in that product's own entry in `products.ts` (specs, subTable, footprint, or original bullets).
`content.applications` are always the first 4 of the website config `applications.items`, verbatim and ordered
(plasma-cleaner uses the pinned family list; it has no website config).

## rie
- lead ← rieEtcherConfig.hero.description
- bullet "Broad material range" ← specs row "Etching Materials"
- bullet "Wide, repeatable process window" ← specs rows RF Power ("Full Range 300-1000W") / Gas System ("4 lines") / Wafer Stage Temperature Range ("-70℃ to 200℃") / Non-Uniformity ("Less than ±5% (Edge Exclusion)")
- bullet "Tunable by design" ← original bullets "Showerhead Gas Feed-in" + "Configurable Plasma Discharge Gap"
- bullet "Lab-ready and configurable" ← original bullets "Uni-body Design Concept (ref 1.0m × 1.0m)" + "Sample Handling Options" + "Cost or Performance Orientation"

## icp-rie
- lead ← icpEtcherConfig.hero.description ("independent plasma density and ion energy control")
- bullet "Independent plasma control" ← specs row "RF Power" ("Source 1000-3000W, Bias 300-1000W") + icpEtcherConfig.hero.description (independent density/energy control)
- bullet "Hard-to-etch materials" ← specs row "Etching Materials" (Si, InP/GaN/GaAs, 2D Materials, Metals W/Ta/Mo, Diamond)
- bullet "Gentle when needed" ← original bullet "Plasma Specialization" ("Low power plasma technology, ion damage-free optional")
- bullet "Wide process window" ← specs rows Gas System ("5 lines (Standard) and He backside cooling") / Wafer Stage Temperature Range ("-70℃ to 200℃") / Non-Uniformity ("Less than ±5% (Edge Exclusion)")

## stripper
- lead ← striperSystemConfig.hero.description
- bullet "Thorough organic removal" ← specs row "Etching Materials" (PR/PMMA/PS nanosphere, 2D Materials MoS2/BN/Graphene, Failure Analysis)
- bullet "Uniform, repeatable ashing" ← original bullets "Uniform Chamber Center Pump-down" + "Uniform Gas Feed-in" + specs row Non-Uniformity ("Less than ±5% (Edge Exclusion)")
- bullet "Temperature to match the resist" ← specs rows Wafer Cooling ("Water cooling") / Wafer Stage Temperature Range ("From 5℃ to 200℃") / RF Power ("Full range 300-1000W") / Gas System ("2 lines")
- bullet "Compact and simple" ← original bullets "Uni-body Design Concept (ref 0.8m × 0.8m)" + "Sample Handling (Open-Load)" + "Cost or Performance Orientation"

## ibe-ribe
- lead ← ibeRibeSystemConfig.hero.description
- bullet "Swappable ion sources" ← original bullet "Flexible Ion Source Design" + specs row "Wafer Size Range" ("up to 6 inch" Kaufman / "up to 12 inch" RF, per specHeaders)
- bullet "Controlled beam geometry" ← specs row "Wafer Stage Motion" ("Tilt from 0° to 90°, Rotation from 1-10 rpm/min")
- bullet "Clean, high-vacuum process" ← specs rows Base Vacuum ("Better than 7E-7 Torr") / Wafer Stage Cooling ("From 5 to 20℃, Water cooling; He backside cooling optional")
- bullet "Easy to run and maintain" ← original bullets "Uni-body Design Concept (ref 1.0m × 0.8m)" + "Sample Handling Options" + "Maintenance and Sample-handling Friendly"

## ald
- lead ← aldSystemConfig.hero.description
- bullet "Conformal on high-AR structures" ← original bullets "Box-in-Box Process Chamber" + "High-AR Step Coverage" ("multiple gas inlets and vertical precursor throw")
- bullet "Broad material library" ← specs rows "Growth Materials" (Al2O3/HfO2/SiO2, TiN/AlN/SiNx, Pt/Pd/W) / "Number of Precursor" ("2-6 lines")
- bullet "Tight uniformity" ← specs rows Non-Uniformity ("Less than ±1% (Al2O3)") / Wafer Size Range ("4, 6, 8, 12 inch or Supersize optional")
- bullet "Thermal and plasma modes" ← specs rows Wafer Temperature Range ("From 20℃ to 400℃") / RF Power ("Remote Plasma 300-1000W, optional")

## pecvd
- lead ← pecvdSystemConfig.hero.description
- bullet "Dual-frequency RF for low stress" ← original bullet "Advanced RF System" ("Electrode RF driven (13.56MHz and/or 400KHz) ... low stress") — explicit frequency values deliberately omitted from the rewrite because they appear in no specs/subTable row (no-new-numbers rule)
- bullet "Core dielectric films" ← specs rows "Deposition Materials" (α-Si:H/SiO2/SiNx/SiC) / "Wafer Size Range" ("4, 6, 8, 12 inch")
- bullet "Wide process window" ← specs rows RF Power ("Full Range 500-2000W") / Gas System ("6 lines") / Wafer Stage Temperature Range ("From 20℃ to 400℃") / Non-Uniformity ("Less than ±5% (Edge Exclusion)")
- bullet "Tunable plasma geometry" ← original bullets "Variable Plasma Discharge Gap" + "Temperature Control" ("Chamber liner, electrode temperature control")

## hdp-cvd
- lead ← hdpCvdSystemConfig.hero.description ("dense dielectric films, void-free trench fill, STI, IMD, PMD")
- bullet "Built for gap-fill" ← original bullet "Step Coverage" ("step covering capability, tuned as a parameter") + hdpCvdSystemConfig.hero.description (trench fill)
- bullet "Independent source and bias" ← specs row "RF Power" ("Source 1000-3000W, Bias 300-1000W")
- bullet "Dielectric film set" ← specs rows "Deposition Materials" (Si/SiO2/SiNx/SiON/SiC) / Gas System ("6 lines") / Wafer Stage Temperature Range ("From 20℃ to 200℃")
- bullet "Lab-ready platform" ← original bullets "Uni-body Design Concept (ref 1.0m × 1.5m)" + "Process Design Kits" + "Sample Handling Options"

## sputter
- lead ← sputterSystemConfig.hero.description
- bullet "Multi-target flexibility" ← specs row "Magnetron Sputtering Source" ("2-6 optional") + original bullet "Flexible Target Configuration" ("face-down or face-up, angle tiltable and deposition distance tunable")
- bullet "DC and RF in one system" ← specs row "Power" ("DC or RF customized, automatic switcher") + original bullet "RF Bias Capability" ("Substrate can be RF biased for in-situ clean")
- bullet "Cold to high-temperature substrates" ← specs row "Substrate Temperature" ("Water-cooling, 400℃, 800℃, 1200℃") + original bullet "Advanced Electrode Control" ("Electrode rotational and temperature controllable")
- bullet "Clean, repeatable films" ← specs rows Base Pressure ("Better than 5E-7 Torr") / Pre-Cleaning ("Independent chamber or in-situ, RF plasma") / Non-Uniformity ("Less than ±5%")

## coater-developer
- lead ← coaterDeveloperConfig.hero.description
- bullet "Precise spin control" ← specs row "Max. Spin Speed" ("8000 rpm ±1rpm" coater / "5000 rpm ±1rpm" developer, per specHeaders)
- bullet "Broad substrate range" ← specs row "Wafer Size Range" ("Small-piece, 2, 4, 6, 8, 12 inch or Square optional") + subTable row "Wafer Size Range"
- bullet "Modular by design" ← original bullets "Flexible Configuration" + "Modular Options" ("dispense systems, temperature for developers")
- bullet "Integrated bake" ← subTable rows "Max. Temperature" ("Up to 200℃, Higher Temperature optional") / "Lift-Pins" ("3 lift-pins, minimum compatible 2 inch")

## plasma-cleaner
(no website config — lead and bullets authored from the guide's own specs rows and original bullets)
- lead ← specs row "Main Functions" (surface cleaning; surface activation; hydrophilic / hydrophobic treatment); "benchtop" ← original bullet "Tabletop / Bench-top Design" (shortened to hold one page)
- applications ← pinned family list (Surface activation / Surface cleaning / Failure analysis / Optical & biomedical device prep), derived from specs rows "Main Functions" + "Typical Applications"
- (bullet "Fits on a bench" removed to hold one page — its facts remain in specs rows "Footprint" ("630 mm × 600 mm") and "Operation" ("Touchscreen control, fully automated"))
- bullet "Multi-gas plasma processing" ← specs rows "Process Gases" (O₂, N₂, Ar) / "RF Power" ("0 ~ 300 W / 500 W, automatic matching") / "Gas System" ("2 ~ 3 gas lines")
- bullet "Gentle on diverse materials" ← specs rows "Main Functions" ("contact-free plasma processing") / "Compatible Materials" (PR; PMMA; PDMS; organic films; semiconductor / optical / biomedical materials)
- bullet "Batch-friendly" ← specs rows "Wafer Size Range" ("≤ 6 inch, multi-wafer batch processing") / "Flow Control" ("MFC or manual control") / "Flow Control Range" ("0 ~ 300 sccm")

## e-beam
- lead ← eBeamEvaporatorConfig.hero.description (hero's "research-grade" qualifier intentionally omitted per the guide's banned-content policy — unverifiable grade claim)
- bullet "Two evaporation sources" ← specs rows "Sources" ("E-beam + thermal resistance") / "Materials" ("Metals, oxides, fluorides, IR films")
- bullet "Precise thickness control" ← specs rows "Thickness Control" ("In-situ QCM endpoint") / "Uniformity" ("≤±5% within Φ6 in")
- bullet "Optical and IR stacks ready" ← original bullet "Optical and IR Stack Ready" (photonic crystals, optical multilayers, IR sensors)
- bullet "Flexible operation" ← specs row "Operating Modes" ("Manual / semi-auto / full-auto") + original bullet "Directional Lift-off Deposition" ("suited to lift-off metallization and patterning")
