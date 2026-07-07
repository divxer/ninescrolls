import { ProductDetailPage } from './ProductDetailPage';
import { eBeamEvaporatorConfig } from './productDetailConfigs/eBeamEvaporatorConfig';

export function EBeamEvaporator() {
  return <ProductDetailPage config={eBeamEvaporatorConfig} />;
}
