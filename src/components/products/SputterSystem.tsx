import { ProductDetailPage } from './ProductDetailPage';
import { sputterSystemConfig } from './productDetailConfigs/sputterSystemConfig';

export function SputterSystem() {
  return <ProductDetailPage config={sputterSystemConfig} />;
}
