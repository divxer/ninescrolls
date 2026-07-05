import { ProductDetailPage } from './ProductDetailPage';
import { pecvdSystemConfig } from './productDetailConfigs/pecvdSystemConfig';

export function PECVDSystem() {
  return <ProductDetailPage config={pecvdSystemConfig} />;
}
