/**
 * Seed the model-specific Tailong-citation papers (from the internal catalog
 * 泰龙电子产品Google_Scholar引用文献统计.md, 2026-02-13) as publication-type
 * Evidence records, status:draft. DOIs resolved + verified via Crossref
 * (2026-07-13). EXCLUDES §2.7 gas/polymer papers and the vague §2.5
 * "Plasma/RFG-500" attributions (no specific NineScrolls SKU), and the ALD
 * 光子学报 paper (Chinese journal, DOI to be resolved manually).
 *
 * Verification tier (honest): sourced from the internal catalog's classification
 * + user confirmation that all are Scholar-discoverable via "Tailong Electronics";
 * DOI is Crossref-verified. A verbatim full-text instrument-string re-quote is
 * recommended before PUBLISH (Phase 2). NO dynamic citation counts stored.
 *
 * Usage:  set -a; source .env; set +a; npx tsx scripts/seed-evidence-catalog.ts --apply
 * Raw GraphQL (local amplify_outputs.json introspection lacks Evidence).
 * Duplicate-safe by slug: existing records are left untouched.
 */
import { Amplify } from 'aws-amplify';
import { generateClient } from 'aws-amplify/data';
import { authenticate } from './lib/auth';
import { createEvidenceIfMissing, requireApply } from './lib/evidenceSeedOperations';
import amplifyOutputs from '../amplify_outputs.json';

Amplify.configure(amplifyOutputs as any);
const client: any = generateClient();

const DISCLOSURE =
  'NineScrolls is the authorized distributor of this platform (Tailong Electronics / Beijing Zhongke Tailong Electronic Technology).';
const toolType = (products: string[]) =>
  products.includes('icp-etcher') && products.includes('pecvd') ? 'ICP etching + PECVD'
  : products.includes('icp-etcher') ? 'ICP etcher'
  : products.includes('rie-etcher') ? 'RIE etcher'
  : products.includes('pecvd') ? 'PECVD system'
  : products.includes('sputter') ? 'magnetron sputter'
  : 'plasma tool';

// [slug, title, products, doi, instrumentAsNamed, journal, year]
type Row = [string, string, string[], string, string, string, number];
const ROWS: Row[] = [
  // ICP -> icp-etcher
  ['pub-tailong-icp100a-compound-eyes-adfm-2019', 'Rapid engraving of artificial compound eyes from curved sapphire substrate', ['icp-etcher'], '10.1002/adfm.201900037', 'ICP-100A', 'Advanced Functional Materials', 2019],
  ['pub-tailong-icp100a-sapphire-microlens-lpt-2019', 'Sapphire concave microlens arrays for high-fluence pulsed laser homogenization', ['icp-etcher'], '10.1109/LPT.2019.2939349', 'ICP-100A', 'IEEE Photonics Technology Letters', 2019],
  ['pub-tailong-icp200-metalens-lpor-2024', 'Neural-Optic Co-Designed Polarization-Multiplexed Metalens for Compact Computational Spectral Imaging', ['icp-etcher'], '10.1002/lpor.202400187', 'ICP-200', 'Laser & Photonics Reviews', 2024],
  ['pub-tailong-icp100a-microoptics-ol-2019', 'Ultra-smooth micro-optical components of various geometries', ['icp-etcher'], '10.1364/OL.44.002454', 'ICP-100A', 'Optics Letters', 2019],
  ['pub-tailong-icp-si3d-ao-2017', 'Silicon three-dimensional structures fabricated by femtosecond laser modification with dry etching', ['icp-etcher'], '10.1364/AO.56.002157', 'ICP (Tailong)', 'Applied Optics', 2017],
  ['pub-tailong-icp-multifocal-microlens-mi-2022', 'Integration of multifocal microlens array on silicon microcantilever via femtosecond-laser-assisted etching technology', ['icp-etcher'], '10.3390/mi13020218', 'ICP (Tailong)', 'Micromachines', 2022],
  ['pub-tailong-icp100a-sic-microlens-lpt-2023', 'Femtosecond laser fabrication of SiC microlens arrays as integrated light homogenizer and splitter', ['icp-etcher'], '10.1109/LPT.2023.3274353', 'ICP-100A', 'IEEE Photonics Technology Letters', 2023],
  ['pub-tailong-icp-diamond-etch-srep-2025', 'Experimental study of inductively coupled plasma etching of patterned single crystal diamonds', ['icp-etcher'], '10.1038/s41598-025-08066-3', 'ICP (Tailong)', 'Scientific Reports', 2025],
  ['pub-tailong-icp100a-antireflection-metasurface-adma-2026', 'Diffraction-Free Omnidirectional Antireflection Binary Metasurface via Femtosecond Laser Hybrid Etching', ['icp-etcher'], '10.1002/adma.202519943', 'ICP-100A', 'Advanced Materials', 2026],
  ['pub-tailong-icp-bite-thermoelectric-jalcom-2026', 'Cooperative Control of High Aspect Ratio Anisotropic Dry Etching and Composition for Bi2Te2.7Se0.3 Thermoelectric Film', ['icp-etcher'], '10.1016/j.jallcom.2026.186411', 'ICP (Tailong)', 'Journal of Alloys and Compounds', 2026],
  // ICP + PECVD (dual-tool)
  ['pub-tailong-icp100-pecvd150ll-ptse2-selenization-acsami-2025', 'Selenization Mechanism of Nearly 4 in. Single-Oriented PtSe2 and PtSe2/n-Si/n+-Si 2D-3D PIN Wide-Spectrum Polarization Detectors', ['icp-etcher', 'pecvd'], '10.1021/acsami.5c04354', 'ICP-100; PECVD-150LL', 'ACS Applied Materials & Interfaces', 2025],
  // RIE -> rie-etcher
  ['pub-tailong-rie100-vdw-rectifier-natcommun-2021', 'Near-ideal van der Waals rectifiers based on all-two-dimensional Schottky junctions', ['rie-etcher'], '10.1038/s41467-021-21861-6', 'RIE-100', 'Nature Communications', 2021],
  ['pub-tailong-rie-hydrogel-generator-natcommun-2024', 'A high-current hydrogel generator with engineered mechanoionic asymmetry', ['rie-etcher'], '10.1038/s41467-024-45931-7', 'RIE (Tailong)', 'Nature Communications', 2024],
  ['pub-tailong-rie150-sidewall-trench-mre-2019', 'Extremely vertical sidewall trench etching on silicon substrate and modelling etching using artificial neural network', ['rie-etcher'], '10.1088/2053-1591/ab55b4', 'RIE-150', 'Materials Research Express', 2019],
  ['pub-tailong-rie-mos2-satcurrent-nanores-2022', 'Record-high saturation current in end-bond contacted monolayer MoS2 transistors', ['rie-etcher'], '10.1007/s12274-021-3504-y', 'RIE (Tailong)', 'Nano Research', 2022],
  ['pub-tailong-rie150-graphene-mre-2019', 'Metal-free synthesis of few-layer graphene films on insulating SiO2 and SiC substrates by chemical vapor deposition', ['rie-etcher'], '10.1088/2053-1591/ab36fb', 'RIE-150', 'Materials Research Express', 2019],
  ['pub-tailong-rie-zns-antireflection-oe-2021', 'High performance ZnS antireflection sub-wavelength structures with HfO2 protective film for infrared optical windows', ['rie-etcher'], '10.1364/OE.439405', 'RIE (Tailong)', 'Optics Express', 2021],
  ['pub-tailong-rie-2d-logic-acsami-2024', 'A 2D Optoelectronic Logic Device with Ultralow Supply Voltage', ['rie-etcher'], '10.1021/acsami.4c08525', 'RIE (Tailong)', 'ACS Applied Materials & Interfaces', 2024],
  // PECVD -> pecvd
  ['pub-tailong-pecvd150ll-selenization-small-2025', 'In Situ Selenization Engineered Dual Schottky Heterojunctions: A Novel Architecture for High-Speed Broadband Photonic Communication Detector Arrays', ['pecvd'], '10.1002/smll.202507077', 'PECVD-150LL', 'Small', 2025],
  ['pub-tailong-pecvd-synaptic-transistor-apl-2025', 'A synaptic transistor with a stacked layer of SiNx and SiO2 deposited from hexamethyldisiloxane/O2', ['pecvd'], '10.1063/5.0232721', 'PECVD (Tailong)', 'Applied Physics Letters', 2025],
  ['pub-tailong-pecvd-encapsulation-apex-2020', 'High-performance multilayer thin-film encapsulation for organic micro-displays', ['pecvd'], '10.35848/1882-0786/ab92ef', 'PECVD (Tailong)', 'Applied Physics Express', 2020],
  ['pub-tailong-pecvd-sio2-tft-tsf-2024', 'Low temperature plasma deposited SiO2/organosilicon stacked film for transparent gate dielectric of InGaZnO thin film transistor', ['pecvd'], '10.1016/j.tsf.2023.140174', 'PECVD (Tailong)', 'Thin Solid Films', 2024],
  ['pub-tailong-icpm100-pecvd-ga2o3-uv-mattod-2026', 'Solar-blind deep UV photodetector based on beta-Ga2O3/AlN/p-Si nBp tunneling photodiode for extreme temperature applications', ['icp-etcher', 'pecvd'], '10.1016/j.mattod.2026.103220', 'ICP-M-100; PECVD', 'Materials Today', 2026],
  // Sputter -> sputter
  ['pub-tailong-sputter100-cu-catalysis-acsami-2024', 'Tuning the Catalytic Selectivity Toward C2+ Oxygenate Products by Manipulating Cu Oxidation States in CO Electroreduction', ['sputter'], '10.1021/acsami.3c18238', 'Sputter 100', 'ACS Applied Materials & Interfaces', 2024],
];

async function main() {
  requireApply(process.argv.slice(2), 'seed-evidence-catalog');
  await authenticate();
  let created = 0, skipped = 0;
  for (const [slug, title, products, doi, instrument, journal, year] of ROWS) {
    const meta = {
      manufacturerAsNamed: 'Tailong Electronics',
      manufacturerLegalName: 'Beijing Zhongke Tailong Electronic Technology Corporation (Nano-Promiso)',
      instrumentAsNamed: instrument,
      relationshipDisclosure: DISCLOSURE,
      journal, year, doi,
      verifiedAt: '2026-07-13',
      sourceCategory: 'Tailong citation catalog',
      verification:
        `Cataloged in NineScrolls internal Tailong citation library (泰龙电子产品Google_Scholar引用文献统计.md, 2026-02-13) as naming the Tailong ${instrument}; discoverable on Google Scholar via "Tailong Electronics". DOI Crossref-verified 2026-07-13. Verbatim full-text instrument-string re-quote recommended before publish.`,
    };
    const input = {
      slug, title, type: 'publication', status: 'draft', products,
      summary: `${journal} (${year}) — peer-reviewed research that used the Tailong Electronics ${instrument} (${toolType(products)}). NineScrolls is the authorized distributor of this platform.`,
      sourceUrl: `https://doi.org/${doi}`,
      meta: JSON.stringify(meta),
    };
    const outcome = await createEvidenceIfMissing(client, input);
    if (outcome === 'created') {
      console.log(`created: ${slug}  (${products.join('+')})`);
      created++;
    } else {
      console.log(`skip (exists): ${slug}`);
      skipped++;
    }
  }
  console.log(`\nDone. created=${created} skipped=${skipped} total=${ROWS.length}`);
}
main().catch((e) => { console.error(e); process.exit(1); });
