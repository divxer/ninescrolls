import { ProductDetailPage } from './ProductDetailPage';
import { icpEtcherConfig } from './productDetailConfigs/icpEtcherConfig';

export function ICPEtcher() {
  return <ProductDetailPage config={icpEtcherConfig} />;
}
