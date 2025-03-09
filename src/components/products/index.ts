import { HDPCVDSystem } from './HDPCVDSystem';
import { PECVDSystem } from './PECVDSystem';
import { ALDSystem } from './ALDSystem';
import { SputterSystem } from './SputterSystem';
import { IBERIBESystem } from './IBERIBESystem';
import { StriperSystem } from './StriperSystem';
import { CoaterDeveloper } from './CoaterDeveloper';
import { RIEEtcher } from './RIEEtcher';
import { ICPEtcher } from './ICPEtcher';

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
};