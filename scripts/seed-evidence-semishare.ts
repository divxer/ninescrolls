/**
 * Seed peer-reviewed `publication` Evidence for the SEMISHARE probe-station line.
 * Source: SEMISHARE Google Scholar citation report (2026-07-19, Scholar 直连 pass,
 * verbatim instrument quotes) + per-paper DOI resolution (Crossref, 2026-07-19).
 *
 * SEMISHARE is a PUBLICLY-named partner brand (NineScrolls resells SEMISHARE
 * probe stations in US & Canada), so this follows the e-beam / MEB-600 pattern,
 * NOT the hidden-OEM Tailong/PLUTOVAC pattern:
 *   - NO `manufacturerAsNamed` / `instrumentAsNamed` meta (those are harvested-as-
 *     sensitive by verify-evidence-no-oem). SEMISHARE + the probe-station model
 *     live in a non-sensitive `meta.platform` key + free-text `verification`.
 *   - SEMISHARE is NOT a banned token (it's public) — do not add it to bannedOem.
 *   - Relationship disclosure uses the ATTESTATION-GATE-OFF wording (the
 *     "authorized channel partner" phrasing is gated ON only after written L2
 *     confirmation — see src/data/probeStations/semishare.ts).
 *
 * All records status:draft. NO citation counts stored. Duplicate-safe by slug.
 * Preprints (arXiv/SSRN/Research Square) carry their preprint URL as sourceUrl.
 * Two doc rows (I4/I5, a Gomel State University sol-gel group) had NO resolvable
 * DOI or URL and are NOT seeded (documented in NOT_SEEDED below). The ~12 doc
 * rows marked ⚠️ "待全文确认" are also not seeded.
 *
 * Usage:  set -a; source .env; set +a; npx tsx scripts/seed-evidence-semishare.ts --apply
 */
import { Amplify } from 'aws-amplify';
import { generateClient } from 'aws-amplify/data';
import { authenticate } from './lib/auth';
import {
  assertUniqueSlugs,
  createEvidenceIfMissing,
  requireApply,
  type EvidenceGraphqlClient,
} from './lib/evidenceSeedOperations';
import amplifyOutputs from '../amplify_outputs.json';

Amplify.configure(amplifyOutputs as any);
const client = generateClient() as unknown as EvidenceGraphqlClient;

// Attestation gate OFF wording (see src/data/probeStations/semishare.ts jsonLdOff).
const DISCLOSURE =
  'NineScrolls LLC is a US-based supplier providing procurement, import, and after-sales support for SEMISHARE wafer probe stations in the United States and Canada.';

// [slug, title, source (bare DOI "10.x" OR full preprint URL), journal, year, model, quote?]
// quote is the verbatim methods sentence where the doc captured one; otherwise a
// standard Scholar-snippet verification note is generated.
type Row = [string, string, string, string, number, string, string?];

const NEW: Row[] = [
  // A. Nature / Science / Cell — strongest evidence
  ['pub-semishare-tellurium-mir-polar-natcommun-2020', 'Stable mid-infrared polarization imaging based on quasi-2D tellurium at room temperature', '10.1038/s41467-020-16125-8', 'Nature Communications', 2020, 'SE-6', 'The unpolarized current data are measured by using a probe station system (SEMISHARE SE-6), a semiconductor characterization system (KEYSIGHT B1500A).'],
  ['pub-semishare-amorphous-chalcogenide-natmater-2025', 'Sub-2-nm-droplet-driven growth of amorphous metal chalcogenides approaching the single-layer limit', '10.1038/s41563-025-02273-z', 'Nature Materials', 2025, 'CG-O-4', 'The electrical characterizations of the devices were performed in a SEMISHARE CG-O-4 cryogenic probe station.'],
  ['pub-semishare-chain-ordered-pt-h2-natcommun-2025', 'Chain-ordered Pt atoms enable improved hydrogen production', '10.1038/s41467-025-66476-3', 'Nature Communications', 2025, 'CG-O-4', 'Electrical measurements were then carried out in a SEMISHARE CG-O-4 cryogenic probe station configured with two Keithley 2450.'],
  ['pub-semishare-pbzro3-antiferroelectric-natcommun-2025', 'Ideal antiferroelectricity with large recoverable energy in PbZrO3 epitaxial thin films', '10.1038/s41467-025-59598-1', 'Nature Communications', 2025, 'E4', 'Measured on a Semishare high-precision probe station (Semishare E4).'],
  ['pub-semishare-algan-deepuv-microled-natphoton-2025', 'High-power AlGaN deep-ultraviolet micro-LED displays for maskless photolithography', '10.1038/s41566-024-01551-7', 'Nature Photonics', 2025, 'model unspecified', 'The electrical characteristics were analysed using a SEMISHARE probe station with a Keysight B1500A.'],
  ['pub-semishare-perovskite-singlepixel-lsa-2023', 'Perovskite single-pixel detector for dual-color metasurface imaging', '10.1038/s41377-023-01311-2', 'Light: Science & Applications', 2023, 'model unspecified', 'Equipped with a probe station (Semishare) and a silver probe.'],
  ['pub-semishare-perovskite-dualband-lsa-2026', 'Optically programmable dual-band perovskite single-pixel detector for color image encryption', '10.1038/s41377-025-02126-z', 'Light: Science & Applications', 2026, 'model unspecified', 'Equipped with a probe station (Semishare, China) and a silver probe.'],
  ['pub-semishare-ferroelectric-nitrogen-sciadv-2025', 'Large enhancement of ferroelectric properties of perovskite oxides via nitrogen incorporation', '10.1126/sciadv.ads8830', 'Science Advances', 2025, 'E4', 'Using a Semishare high-precision probe station (Semishare E4).'],
  ['pub-semishare-kion-battery-sei-joule-2025', 'Energy band-engineered solid electrolyte interphase for stable potassium-ion batteries', '10.1016/j.joule.2025.101952', 'Joule', 2025, 'CG-O-4', 'The device was placed in the probe station (Semishare CG-O-4) with a vacuum chamber.'],

  // C. Ferroelectric / antiferroelectric / dielectric (E series)
  ['pub-semishare-antiferro-energy-storage-afm-2024', 'Superior energy storage performance in antiferroelectric epitaxial thin films via structural heterogeneity and orientation control', '10.1002/adfm.202311160', 'Advanced Functional Materials', 2024, 'E4', 'Using a high-precision probe station (Semishare E4).'],
  ['pub-semishare-pmnpt-nonlinear-dielectric-apxr-2023', 'Nonlinear dielectric response of relaxor ferroelectric PMN-PT thin films', '10.1002/apxr.202300002', 'Advanced Physics Research', 2023, 'E4', 'Using a Semishare high-precision probe station (Semishare E4).'],
  ['pub-semishare-freestanding-relaxor-harvester-afm-2026', 'Freestanding relaxor ferroelectric single-crystalline thin films enable flexible piezoelectric energy harvester with giant power density', '10.1002/adfm.202600016', 'Advanced Functional Materials', 2026, 'E4', 'Using a Semishare high-precision probe station (Semishare E4).'],
  ['pub-semishare-2d-ferroelectric-phototransistor-adma-2026', 'Tailorable polarity switching and optoelectronic transition in a gate-source integrated 2D ferroelectric phototransistor', '10.1002/adma.202512334', 'Advanced Materials', 2026, 'E series', 'Ferroelectric analyzer (aixACCT Systems) on a Semishare high-precision probe station.'],
  ['pub-semishare-cryogenic-dipole-glass-arxiv-2026', 'Unlocking cryogenic energy storage by constructing dipole glass with unit-cell-level polar disorder', 'https://arxiv.org/abs/2606.27887', 'arXiv preprint', 2026, 'E4', 'On a Semishare E4 high-precision probe station.'],

  // B. 2D materials / photodetectors (SE / SM / E)
  ['pub-semishare-snte-broadband-pd-adom-2017', 'Broadband high-responsivity photodetectors based on large-scale SnTe topological crystalline insulator ultrathin films', '10.1002/adom.201600727', 'Advanced Optical Materials', 2017, 'model unspecified'],
  ['pub-semishare-bi2s3-nanobelt-pd-jmcc-2020', 'Synthesis of bismuth sulfide nanobelts for high-performance broadband photodetectors', '10.1039/c9tc06780a', 'Journal of Materials Chemistry C', 2020, 'SE-6'],
  ['pub-semishare-graphene-in2se3-neuristor-acsnano-2023', 'Graphene–In2Se3 van der Waals heterojunction neuristor for optical in-memory bimodal operation', '10.1021/acsnano.3c03820', 'ACS Nano', 2023, 'SM-4'],
  ['pub-semishare-in2se3-in2o3-nvm-npj2d-2022', 'Monolithic In2Se3–In2O3 heterojunction for multibit non-volatile memory and logic operations', '10.1038/s41699-022-00309-5', 'npj 2D Materials and Applications', 2022, 'SM-4'],
  ['pub-semishare-mote2-mos2-polarization-acsami-2023', 'Polarization-sensitive, self-powered, and broadband semimetal MoTe2/MoS2 van der Waals heterojunction for photodetection', '10.1021/acsami.3c07709', 'ACS Applied Materials & Interfaces', 2023, 'SCG-O-2'],
  ['pub-semishare-ptse2-retinomorphic-adma-2022', 'A bioinspired retinomorphic device for spontaneous chromatic adaptation', '10.1002/adma.202206816', 'Advanced Materials', 2022, 'model unspecified'],
  ['pub-semishare-mggao-graphene-vuv-acsami-2018', 'Amorphous-MgGaO film combined with graphene for vacuum-ultraviolet photovoltaic detector', '10.1021/acsami.8b15450', 'ACS Applied Materials & Interfaces', 2018, 'SE-4'],
  ['pub-semishare-mos2-mote2-ir-photogating-aelm-2024', 'Infrared photodetector based on van der Waals MoS2/MoTe2 hetero-bilayer modulated by photogating', '10.1002/aelm.202400190', 'Advanced Electronic Materials', 2024, 'E-4', 'Transferred onto the 1L MoS2 by using a commercial probe station (Semishare, E-4).'],
  ['pub-semishare-bp-pentacene-ir-polar-aelm-2023', 'N-type doping and passivation of black phosphorus using pentacene for infrared polarization-sensitive photodetection', '10.1002/aelm.202300392', 'Advanced Electronic Materials', 2023, 'SCG-O-2'],
  ['pub-semishare-dual-schottky-aolp-nanores-2025', 'Bias-controlled vertical asymmetrical dual-Schottky junction photodetectors for AoLP imaging', '10.26599/nr.2025.94907392', 'Nano Research', 2025, 'SCG-O-2'],
  ['pub-semishare-mose2-gesn-swir-nanores-2025', 'High-responsivity n-MoSe2/p-GeSn/n-GOI phototransistor for short-wave infrared photodetection', '10.26599/nr.2025.94907335', 'Nano Research', 2025, 'model unspecified'],
  ['pub-semishare-mos2-electrolyte-gating-aelm-2020', 'Realizing wafer-scale and low-voltage operation MoS2 transistors via electrolyte gating', '10.1002/aelm.201900838', 'Advanced Electronic Materials', 2020, 'model unspecified'],
  ['pub-semishare-in2s3-thinfilm-pd-jmsme-2020', 'Growth of large-area two-dimensional non-layered β-In2S3 continuous thin films for photodetectors', '10.1007/s10854-020-04366-8', 'Journal of Materials Science: Materials in Electronics', 2020, 'SM-4'],
  ['pub-semishare-res2-transport-jmsme-2021', 'Layer-dependent electrical transport property of two-dimensional ReS2 thin films', '10.1007/s10854-021-06903-5', 'Journal of Materials Science: Materials in Electronics', 2021, 'SM-4'],

  // D. Memristors / neuromorphic (cryogenic-vacuum SCG series)
  ['pub-semishare-native-siox-memristor-acsami-2022', 'Reliable memristor based on ultrathin native silicon oxide', '10.1021/acsami.2c03266', 'ACS Applied Materials & Interfaces', 2022, 'SCG-O-4'],
  ['pub-semishare-analog-tunnel-memory-acsami-2022', 'Analog tunnel memory based on programmable metallization for passive neuromorphic circuits', '10.1021/acsami.2c14809', 'ACS Applied Materials & Interfaces', 2022, 'SCG-O-4'],
  ['pub-semishare-diffusive-memristor-reservoir-aelm-2025', 'Spiking reservoir computing based on stochastic diffusive memristors', '10.1002/aelm.202400469', 'Advanced Electronic Materials', 2025, 'SCG-O-4'],
  ['pub-semishare-interfacial-memristor-reservoir-acsanm-2024', 'Reservoir computing using interfacial memristors with plasma-oxidized native SiOx nanostructures', '10.1021/acsanm.3c05797', 'ACS Applied Nano Materials', 2024, 'SCG-O-4'],
  ['pub-semishare-hfs2-memristor-puf-acsami-2024', 'Memristor array based on wafer-scale 2D HfS2 for dual-mode physically unclonable function', '10.1021/acsami.4c11340', 'ACS Applied Materials & Interfaces', 2024, 'model unspecified'],
  ['pub-semishare-nb3cl8-memristor-raremetals-2022', 'Two-dimensional Nb3Cl8 memristor based on desorption and adsorption of O2 molecules', '10.1007/s12598-021-01794-1', 'Rare Metals', 2022, 'SCG-O-4'],
  ['pub-semishare-graded-perovskite-memristor-adma-2026', 'Self-rectifying memristors based on dimensionally graded halide perovskites', '10.1002/adma.202519675', 'Advanced Materials', 2026, 'cryogenic (model unspecified)'],
  ['pub-semishare-snox-siox-switching-ssrn-2025', 'Intrinsic resistive switching in SnOx/SiOx heterostructure for neuromorphic inference accelerators', 'https://ssrn.com/abstract=4343375', 'SSRN preprint', 2025, 'SCG-O-4'],

  // I. Amorphous carbon / MIM (Gomel State University group)
  ['pub-semishare-ac-transport-materials-2025', 'Charge carrier transport and localized states in graphite-like amorphous carbon films', '10.3390/ma18173977', 'Materials', 2025, 'M6'],
  ['pub-semishare-ac-thermofield-materials-2026', 'Thermofield effects in graphite-like amorphous carbon films with nanoscale structure', '10.3390/ma19101965', 'Materials', 2026, 'MG'],
  ['pub-semishare-mim-nb2o5-transport-applnano-2026', 'Influence of temperature on transport and capacitive properties of MIM Nb2O5 nanostructures', '10.3390/applnano7010008', 'Applied Nano', 2026, 'M6'],

  // E. SiC / GaN power & RF (X / SH / H / E6 / SE)
  ['pub-semishare-4hsic-jbs-tempsense-small-2026', 'Methodology for improving temperature sensing performance and thermal stability of 4H-SiC JBS diodes', '10.1002/smll.202509679', 'Small', 2026, 'X8', 'A high-precision KEYSIGHT B1505 semiconductor parameter analyzer and a SEMISHARE X8 semi-automatic probe station.'],
  ['pub-semishare-4hsic-pcss-tpel-2023', 'Low ON-resistance high-purity 4H-SiC photoconductive semiconductor switch', '10.1109/TPEL.2023.3320124', 'IEEE Transactions on Power Electronics', 2023, 'X-6'],
  ['pub-semishare-4hsic-mos-gateox-ted-2023', 'Comprehensive investigation of gate-oxide instability in 4H-SiC MOSFETs and MOS capacitors', '10.1109/TED.2023.3294458', 'IEEE Transactions on Electron Devices', 2023, 'SH-8'],
  ['pub-semishare-4hsic-carbon-cap-jem-2025', 'Comparative analysis of carbon-capping-layer annealing on 4H-SiC MOS electrical characteristics', '10.1007/s11664-025-12116-x', 'Journal of Electronic Materials', 2025, 'SH-8'],
  ['pub-semishare-4hsic-mos-no-anneal-ipfa-2025', 'Characterization of interface properties of 4H-SiC MOS grown by dry oxygen and NO annealing', '10.1109/IPFA65338.2025.11256659', '2025 IEEE IPFA (conference)', 2025, 'H8'],
  ['pub-semishare-algan-gan-mishemt-ted-2025', 'Defect diagnosis of AlGaN/GaN MIS-HEMTs with multiple field plates', '10.1109/TED.2025.3605141', 'IEEE Transactions on Electron Devices', 2025, 'E6'],
  ['pub-semishare-gan-mishemt-doublestep-iceda-2025', 'Origin of the peculiar double-step behavior in GaN MIS-HEMT transfer characteristics', '10.1109/ICEDA68428.2025.11376663', '2025 IEEE ICEDA (conference)', 2025, 'E6'],
  ['pub-semishare-gan-hemt-iv-model-msf-2018', 'An improved I-V model of GaN HEMT for high-temperature applications', '10.4028/www.scientific.net/MSF.924.980', 'Materials Science Forum', 2018, 'SE'],
  ['pub-semishare-sic-vco-extreme-temp-tcasii-2022', 'A 60-MHz silicon carbide voltage-controlled oscillator for extreme temperature applications', '10.1109/TCSII.2022.3207971', 'IEEE Transactions on Circuits and Systems II', 2022, 'model unspecified (hot chuck)'],
  ['pub-semishare-gan-driver-ht-buck-ietpe-2023', 'A monolithic GaN driver with a deadtime generator for high-temperature GaN DC-DC buck converters', '10.1049/pel2.12498', 'IET Power Electronics', 2023, 'SE-6'],
  ['pub-semishare-gete-rf-switch-jos-2025', 'Magnetron sputter and phase-change optimization of wafer-level GeTe films for RF switch', '10.1088/1674-4926/24120033', 'Journal of Semiconductors', 2025, 'H8'],
  ['pub-semishare-rf-rolledup-resonator-apl-2025', 'On-chip compact radio-frequency metal self-rolled-up nanomembrane resonator', '10.1063/5.0253261', 'Applied Physics Letters', 2025, 'H6'],
  ['pub-semishare-rf-mems-switch-mst-2022', 'A zero-static-power bi-stable RF MEMS switch based on inertial-generated timing sequence', '10.1007/s00542-021-05248-7', 'Microsystem Technologies', 2022, 'SH-12'],

  // F. Oxide TFT (Optem 70XL)
  ['pub-semishare-igzo-tft-onestep-nanomaterials-2022', 'One-step synergistic treatment for high-performance amorphous InGaZnO thin-film transistors', '10.3390/nano12193481', 'Nanomaterials', 2022, 'Optem 70XL'],
  ['pub-semishare-igzo-tft-cual-contacts-ted-2024', 'Evolution of enhanced performance of a-IGZO TFTs with Cu/Al-based contacts', '10.1109/TED.2024.3433836', 'IEEE Transactions on Electron Devices', 2024, 'Optem 70XL'],
  ['pub-semishare-igzo-tft-intermediate-sputter-eml-2023', 'A simple intermediate sputter approach for improving the stability of a-InGaZnO thin-film transistors', '10.1007/s13391-023-00416-5', 'Electronic Materials Letters', 2023, 'Optem 70XL'],
  ['pub-semishare-ito-framework-tft-ted-2026', 'Evolution of enhanced performance of ITO-framework-based TFTs', '10.1109/TED.2026.3663136', 'IEEE Transactions on Electron Devices', 2026, 'Optem 70XL'],
  ['pub-semishare-oxide-transistor-graded-afm-2026', 'Graded post-processing-assisted heterojunction interface for high-performance oxide transistors', '10.1002/adfm.74701', 'Advanced Functional Materials', 2026, 'Optem 70XL'],

  // J. Preprints
  ['pub-semishare-gainsno-fet-print-rs-2022', 'Liquid Ga-In-Sn alloy printing of GaInSnO ultra-thin semiconductor films and field-effect transistors', 'https://doi.org/10.21203/rs.3.rs-2030888/v1', 'Research Square preprint', 2022, 'X3'],
  ['pub-semishare-res2se-alloy-films-ssrn-2025', 'Growth of centimeter-scale 2D ReS2xSe2(1-x) alloy films and their optoelectronic devices', 'https://papers.ssrn.com/sol3/papers.cfm?abstract_id=5369687', 'SSRN preprint', 2025, 'SM-4'],
  ['pub-semishare-cr2o3-mistcvd-jallcom-2026', 'Acceptor-doped mist-CVD Cr2O3 films on sapphire and β-Ga2O3', '10.1016/j.jallcom.2026.187824', 'Journal of Alloys and Compounds', 2026, 'SX-8'],

  // G. Perovskite / VO2 microwire optoelectronics (SE / SM / M)
  ['pub-semishare-vo2-encryption-advsci-2023', 'Multiphysical field-modulated VO2 device for information encryption', '10.1002/advs.202300908', 'Advanced Science', 2023, 'four-probe (model unspecified)'],
  ['pub-semishare-vo2-gan-phase-transition-acsami-2021', 'Photoassisted electron–ion synergic doping induced phase transition of n-VO2/p-GaN heterojunction', '10.1021/acsami.1c10401', 'ACS Applied Materials & Interfaces', 2021, 'four-probe (model unspecified)'],
  ['pub-semishare-vo2-ir-limiter-lpor-2024', 'Self-excited free-standing VO2 film for infrared optical limiter', '10.1002/lpor.202400426', 'Laser & Photonics Reviews', 2024, 'four-probe (model unspecified)'],
  ['pub-semishare-cscu2i3-microrod-acsami-2022', 'Enhanced optoelectronic performance induced by ion migration in lead-free CsCu2I3 microrods', '10.1021/acsami.2c14974', 'ACS Applied Materials & Interfaces', 2022, 'model unspecified'],
  ['pub-semishare-cscu2i3-microwire-uv-acsami-2024', 'Air-stable self-driven UV photodetectors on lead-free CsCu2I3 microwire arrays', '10.1021/acsami.3c17881', 'ACS Applied Materials & Interfaces', 2024, 'model unspecified'],
  ['pub-semishare-1d-perovskite-radial-adom-2021', 'A high-performance photodetector based on a 1D perovskite radial heterostructure', '10.1002/adom.202101504', 'Advanced Optical Materials', 2021, 'SE-6'],
  ['pub-semishare-perovskite-gaas-nanowire-jmcc-2024', 'Van der Waals integration of 2D perovskite sheets and GaAs nanowires for self-driven photodetector', '10.1039/d4tc02994a', 'Journal of Materials Chemistry C', 2024, 'model unspecified'],
  ['pub-semishare-mapbbr3-microwire-jmcc-2021', 'Freestanding CH3NH3PbBr3 single-crystal microwires for optoelectronic applications', '10.1039/d1tc00316j', 'Journal of Materials Chemistry C', 2021, 'model unspecified'],
  ['pub-semishare-1d-perovskite-microbelt-jpcl-2024', 'Integration of 1D lead-free perovskite microbelts onto silicon for UV-vis-NIR photodetectors', '10.1021/acs.jpclett.4c00165', 'Journal of Physical Chemistry Letters', 2024, 'SM-4'],
  ['pub-semishare-rbcu2i3-mapbbr3-lateral-acsaelm-2024', 'Self-powered lateral heterojunction photodetectors via RbCu2I3 microwire and MAPbBr3 film', '10.1021/acsaelm.4c01543', 'ACS Applied Electronic Materials', 2024, 'M4'],
  ['pub-semishare-rbcu2i3-microwire-uv-nanotech-2023', 'Ultraviolet photodetector based on RbCu2I3 microwire', '10.1088/1361-6528/acb0d4', 'Nanotechnology', 2023, 'M4'],
  ['pub-semishare-ternary-organic-microwire-jmcc-2016', 'A novel ternary organic microwire radial heterojunction with high photoconductivity', '10.1039/c6tc00214e', 'Journal of Materials Chemistry C', 2016, 'SE-4'],
  ['pub-semishare-airstable-microwire-jmcc-2015', 'An air-stable microwire radial heterojunction with high photoconductivity based on a new building block', '10.1039/c5tc01050k', 'Journal of Materials Chemistry C', 2015, 'SE-4'],

  // H. Micro-LED / Ga2O3 / sensors / organic / other
  ['pub-semishare-rgb-microled-inpixel-acsaelm-2020', 'R/G/B micro-LEDs for in-pixel integrated arrays and temperature sensing', '10.1021/acsaelm.0c00757', 'ACS Applied Electronic Materials', 2020, 'SCG-O-4'],
  ['pub-semishare-algainp-microled-vf-sid-2020', 'Temperature-dependent forward voltage of AlGaInP-based red micro-LEDs', '10.1002/sdtp.14243', 'SID Symposium Digest of Technical Papers', 2020, 'SCG-O-4'],
  ['pub-semishare-algainp-microled-p63-sid-2021', 'Electro-optical properties investigation in AlGaInP-based red micro-LED devices (P-63)', '10.1002/sdtp.14940', 'SID Symposium Digest of Technical Papers', 2021, 'SCG-O-4'],
  ['pub-semishare-algainp-microled-p101-sid-2021', 'Electro-optical properties investigation in AlGaInP-based red micro-LED devices (P-10.1)', '10.1002/sdtp.15337', 'SID Symposium Digest of Technical Papers', 2021, 'SCG-O-4'],
  ['pub-semishare-ga2o3-solarblind-acsami-2025', 'Ultrahigh-performance Ga2O3 solar-blind UV detectors via 2D step-flow growth', '10.1021/acsami.5c12206', 'ACS Applied Materials & Interfaces', 2025, 'CG-C-2'],
  ['pub-semishare-mxene-ge-schottky-aelm-2022', 'MXene–germanium Schottky heterostructures for ultrafast broadband self-driven photodetectors', '10.1002/aelm.202200620', 'Advanced Electronic Materials', 2022, 'SCG-O-4'],
  ['pub-semishare-sb2s3-planar-solar-smtd-2025', 'Precursor engineering of chemical-bath-deposited Sb2S3 films for efficient planar solar cells', '10.1002/smtd.202502005', 'Small Methods', 2025, 'SCG-O-2'],
  ['pub-semishare-oect-tactile-sensing-acsaelm-2024', 'Self-powered intelligent tactile-sensing system based on organic electrochemical transistors', '10.1021/acsaelm.4c00242', 'ACS Applied Electronic Materials', 2024, 'M4'],
  ['pub-semishare-photonic-synaptic-transistor-edl-2021', 'Photonic synaptic transistor based on p-type organic semiconductor blended with n-type organic semiconductor', '10.1109/LED.2021.3090906', 'IEEE Electron Device Letters', 2021, 'model unspecified'],
  ['pub-semishare-pva-electret-synaptic-ted-2023', 'A self-assembled monolayer modification for PVA polymer-electret organic synaptic phototransistor', '10.1109/TED.2023.3274502', 'IEEE Transactions on Electron Devices', 2023, 'model unspecified'],
  ['pub-semishare-isfet-galactosidase-sensors-2024', 'Detection of α-galactosidase A in dried blood spots using ion-sensitive field-effect transistors', '10.3390/s24113681', 'Sensors', 2024, 'H8'],
  ['pub-semishare-extended-gate-isfet-microc-2026', 'CMOS monolithic integration of an extended-gate ISFET with signal-processing circuit', '10.1016/j.microc.2026.116972', 'Microchemical Journal', 2026, 'H8'],
  ['pub-semishare-graphene-fet-troponin-nanotech-2026', 'AFM-modified graphene field-effect transistor for sensitive detection of cardiac troponin I', '10.1088/1361-6528/ae8601', 'Nanotechnology', 2026, 'SS-80'],
  ['pub-semishare-mxene-soft-actuator-langmuir-2024', 'Fast-responsive high-strain electro-ionic soft actuator based on MXene-EGaIn/MXene bilayer electrode', '10.1021/acs.langmuir.4c01542', 'Langmuir', 2024, 'SM'],
  ['pub-semishare-perovskite-silicon-uv-array-afm-2025', 'Four-mask technique for a perovskite-on-silicon sensor array for ultraviolet light imaging', '10.1002/adfm.202423281', 'Advanced Functional Materials', 2025, 'SCG-O-2'],
  ['pub-semishare-sdoped-carbon-em-nanoscale-2021', 'Sulfur-doped wood-derived porous carbon for optimizing electromagnetic response performance', '10.1039/D1NR04232G', 'Nanoscale', 2021, 'SE-4'],
  ['pub-semishare-ta2o5-memristor-photothermal-acsami-2025', 'Photothermal engineering in Ta2O5 memristors: blue-laser-driven filament reorientation', '10.1021/acsami.5c12170', 'ACS Applied Materials & Interfaces', 2025, 'E4'],
];

const toSourceUrl = (source: string) => (source.startsWith('10.') ? `https://doi.org/${source}` : source);
const isDoi = (source: string) => source.startsWith('10.');

async function main() {
  requireApply(process.argv.slice(2), 'seed-evidence-semishare');
  assertUniqueSlugs(NEW.map(([slug]) => slug), 'seed-evidence-semishare');
  await authenticate();

  let created = 0, skipped = 0;
  for (const [slug, title, source, journal, year, model, quote] of NEW) {
    const platform = `SEMISHARE ${model}`;
    const meta: Record<string, unknown> = {
      platform, // non-sensitive provenance — never surfaced by the public projection
      relationshipDisclosure: DISCLOSURE,
      journal, year,
      verifiedAt: '2026-07-19',
      sourceCategory: 'SEMISHARE Google Scholar citation report (2026-07-19) + DOI resolution',
      verification: quote
        ? `SEMISHARE ${model} probe station named verbatim in the paper (Google Scholar methods snippet / full text, 2026-07-19): "${quote}" DOI/source Crossref-verified.`
        : `SEMISHARE ${model} probe station usage confirmed via Google Scholar methods snippet in the 2026-07-19 Scholar 直连 pass; DOI/source Crossref-verified.`,
    };
    if (isDoi(source)) meta.doi = source;
    const input = {
      slug, title, type: 'publication', status: 'draft',
      products: ['probe-station'],
      summary: `${journal} (${year}) — peer-reviewed research using a SEMISHARE ${model} wafer probe station as the device electrical/optoelectronic measurement platform. NineScrolls provides US & Canada procurement, import, and after-sales support for SEMISHARE wafer probe stations.`,
      sourceUrl: toSourceUrl(source), // public-safe: doi.org / arxiv / ssrn / researchsquare
      meta: JSON.stringify(meta),
    };
    const outcome = await createEvidenceIfMissing(client, input);
    if (outcome === 'created') { console.log(`created: ${slug}  (${platform})`); created++; }
    else { console.log(`skip (exists): ${slug}`); skipped++; }
  }
  console.log(`\nDone. created=${created} skipped=${skipped} (of ${NEW.length}).`);
}
main().catch((e) => { console.error(e); process.exit(1); });

/*
 * NOT SEEDED:
 * - ~12 doc rows marked ⚠️ "待全文确认" (SEMISHARE hit but no verbatim instrument
 *   sentence in the Scholar snippet): A10, B2, B16, B17, B18, D8, D9, E9, E10,
 *   E16, G9, G15, G16, H15, H19, J4–J12. Held until a full-text re-quote.
 * - I4 "Applying MOGA to optimize dielectric sol-gel coatings" and
 *   I5 "Optimization of dielectric sol-gel coating synthesis via genetic algorithm"
 *   (Gomel State University group): NO resolvable DOI / stable URL located
 *   (Crossref, IEEE Xplore, web all negative). Not seeded — no citable source.
 *
 * The static SEMISHARE_PUBLICATIONS list in src/data/probeStations/semishare.ts
 * (5 entries: A1, A2, E1, C3, B9) overlaps this seed and can be migrated + removed
 * once a ProductEvidence module is wired onto the probe-station pages (Phase 2,
 * mirrors the e-beam migration). All 5 DOIs cross-checked and match here.
 */
