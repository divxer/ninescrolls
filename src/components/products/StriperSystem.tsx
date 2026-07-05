import { ProductDetailPage } from './ProductDetailPage';
import { striperSystemConfig } from './productDetailConfigs/striperSystemConfig';

export function StriperSystem() {
  return <ProductDetailPage config={striperSystemConfig} />;
}
