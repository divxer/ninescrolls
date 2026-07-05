import { ProductDetailPage } from './ProductDetailPage';
import { hdpCvdSystemConfig } from './productDetailConfigs/hdpCvdSystemConfig';

export function HDPCVDSystem() {
  return <ProductDetailPage config={hdpCvdSystemConfig} />;
}
