import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

export const RedirectHandler: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const pathname = location.pathname;
    const search = location.search;
    
    // Check if it's a product page ending with slash
    if (pathname.startsWith('/products/') && pathname.endsWith('/')) {
      // Remove trailing slash and redirect, preserving query parameters
      const cleanPath = pathname.slice(0, -1);
      console.log(`RedirectHandler: Redirecting from ${pathname} to ${cleanPath}`);
      navigate(`${cleanPath}${search}`, { replace: true });
      return;
    }

    // Check if it's another page ending with slash (except root path)
    if (pathname !== '/' && pathname.endsWith('/')) {
      const cleanPath = pathname.slice(0, -1);
      console.log(`RedirectHandler: Redirecting from ${pathname} to ${cleanPath}`);
      // Preserve query parameters when redirecting
      navigate(`${cleanPath}${search}`, { replace: true });
    }
  }, [location.pathname, location.search, navigate]);

  return null; // This component doesn't render anything
}; 