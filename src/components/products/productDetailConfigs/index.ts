// Canonical registry of product detail configs. The single source for the
// admin product multi-select (Evidence.products), so no separate hand-kept
// slug list can drift. Add a line here whenever a product config is added.
import type { ProductDetailConfig } from '../ProductDetailPage.types';

import { aldSystemConfig } from './aldSystemConfig';
import { coaterDeveloperConfig } from './coaterDeveloperConfig';
import { compactRieConfig } from './compactRieConfig';
import { eBeamEvaporatorConfig } from './eBeamEvaporatorConfig';
import { hdpCvdSystemConfig } from './hdpCvdSystemConfig';
import { hy20lConfig } from './hy20lConfig';
import { hy20lrfConfig } from './hy20lrfConfig';
import { hy4lConfig } from './hy4lConfig';
import { ibeRibeSystemConfig } from './ibeRibeSystemConfig';
import { icpEtcherConfig } from './icpEtcherConfig';
import { pecvdSystemConfig } from './pecvdSystemConfig';
import { pluto30Config } from './pluto30Config';
import { plutoFConfig } from './plutoFConfig';
import { plutoMConfig } from './plutoMConfig';
import { plutoTConfig } from './plutoTConfig';
import { rieEtcherConfig } from './rieEtcherConfig';
import { sputterSystemConfig } from './sputterSystemConfig';
import { striperSystemConfig } from './striperSystemConfig';

export const productConfigs: ProductDetailConfig[] = [
  aldSystemConfig, pecvdSystemConfig, hdpCvdSystemConfig, rieEtcherConfig,
  compactRieConfig, icpEtcherConfig, ibeRibeSystemConfig, sputterSystemConfig,
  eBeamEvaporatorConfig, striperSystemConfig, coaterDeveloperConfig, hy4lConfig,
  hy20lConfig, hy20lrfConfig, plutoTConfig, plutoMConfig, plutoFConfig, pluto30Config,
];

export interface ProductOption { slug: string; label: string; }

export const productOptions: ProductOption[] = productConfigs.map((config) => ({
  slug: config.slug,
  label: config.schema.name,
}));
