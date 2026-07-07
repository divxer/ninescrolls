import { useLocation } from 'react-router-dom';
import { ProductDetailPage } from './ProductDetailPage';
import { hy20lConfig } from './productDetailConfigs/hy20lConfig';

export function HY20L() {
  const location = useLocation();
  const selectedSku = new URLSearchParams(location.search).get('config') === 'mf'
    ? 'hy-20l-mf'
    : 'hy-20l-rf';

  return (
    <ProductDetailPage
      config={{
        ...hy20lConfig,
        commerce: hy20lConfig.commerce ? { ...hy20lConfig.commerce, defaultSku: selectedSku } : undefined,
      }}
    />
  );
}
