import { HDPCVDSystem } from './HDPCVDSystem';
import { PECVDSystem } from './PECVDSystem';
import { ALDSystem } from './ALDSystem';
import { SputterSystem } from './SputterSystem';
import { IBERIBESystem } from './IBERIBESystem';
import { StriperSystem } from './StriperSystem';
import { CoaterDeveloper } from './CoaterDeveloper';
import { RIEEtcher } from './RIEEtcher';
import { ICPEtcher } from './ICPEtcher';
import { CompactRIE } from './CompactRIE';
import { PlasmaCleaner } from './PlasmaCleaner';
import { NSPlasma20R } from './NSPlasma20R';
import { NSPlasma4R } from './NSPlasma4R';
import { NSPlasma20RI } from './NSPlasma20RI';

const productComponents = {
  'hdp-cvd': HDPCVDSystem,
  'pecvd': PECVDSystem,
  'ald': ALDSystem,
  'sputter': SputterSystem,
  'ibe-ribe': IBERIBESystem,
  'striper': StriperSystem,
  'coater-developer': CoaterDeveloper,
  'rie-etcher': RIEEtcher,
  'icp-etcher': ICPEtcher,
  'compact-rie': CompactRIE,
  'plasma-cleaner': PlasmaCleaner,
  'ns-plasma-20r': NSPlasma20R,
  'ns-plasma-4r': NSPlasma4R,
  'ns-plasma-20r-i': NSPlasma20RI,
};

export function getProductComponent(productId: string) {
  return productComponents[productId as keyof typeof productComponents];
}

export {
  HDPCVDSystem,
  PECVDSystem,
  ALDSystem,
  SputterSystem,
  IBERIBESystem,
  StriperSystem,
  CoaterDeveloper,
  RIEEtcher,
  ICPEtcher,
  CompactRIE,
  PlasmaCleaner,
  NSPlasma20R,
  NSPlasma4R,
  NSPlasma20RI,
};