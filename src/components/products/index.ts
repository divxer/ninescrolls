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
import { HY4L } from './HY4L';
import { HY20L } from './HY20L';
import { HY20LRF } from './HY20LRF';
import { PlutoT } from './PlutoT';
import { PlutoM } from './PlutoM';
import { PlutoF } from './PlutoF';

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
  'hy-4l': HY4L,
  'hy-20l': HY20L,
  'hy-20lrf': HY20LRF,
  'pluto-t': PlutoT,
  'pluto-m': PlutoM,
  'pluto-f': PlutoF,
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
  HY4L,
  HY20L,
  HY20LRF,
  PlutoT,
  PlutoM,
  PlutoF,
};