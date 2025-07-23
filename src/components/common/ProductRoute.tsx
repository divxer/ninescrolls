import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ReactNode } from 'react';

interface ProductRouteProps {
  children: ReactNode;
}

export const ProductRoute: React.FC<ProductRouteProps> = ({ children }) => {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const pathname = location.pathname;
    
    // 检查是否是产品页面且以斜杠结尾
    if (pathname.startsWith('/products/') && pathname.endsWith('/')) {
      // 移除尾部斜杠并重定向
      const cleanPath = pathname.slice(0, -1);
      console.log(`ProductRoute: Redirecting from ${pathname} to ${cleanPath}`);
      navigate(cleanPath, { replace: true });
    }
  }, [location.pathname, navigate]);

  return <>{children}</>;
}; 