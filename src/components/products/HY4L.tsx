import { useLocation } from 'react-router-dom';
import { ProductDetailPage } from './ProductDetailPage';
import { hy4lConfig } from './productDetailConfigs/hy4lConfig';

export function HY4L() {
  const location = useLocation();
  const selectedSku = location.pathname.includes('-mf') || new URLSearchParams(location.search).get('config') === 'mf'
    ? 'hy-4l-mf'
    : 'hy-4l-rf';

  return (
    <ProductDetailPage
      config={{
        ...hy4lConfig,
        commerce: hy4lConfig.commerce ? { ...hy4lConfig.commerce, defaultSku: selectedSku } : undefined,
      }}
    />
  );
}
