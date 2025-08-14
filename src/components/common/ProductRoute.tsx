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
    
    // Check if it's a product page ending with slash
    if (pathname.startsWith('/products/') && pathname.endsWith('/')) {
              // Remove trailing slash and redirect
      const cleanPath = pathname.slice(0, -1);
      console.log(`ProductRoute: Redirecting from ${pathname} to ${cleanPath}`);
      navigate(cleanPath, { replace: true });
    }
  }, [location.pathname, navigate]);

  return <>{children}</>;
}; 