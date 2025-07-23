import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

export const RedirectHandler: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const pathname = location.pathname;
    
    // 检查是否是产品页面且以斜杠结尾
    if (pathname.startsWith('/products/') && pathname.endsWith('/')) {
      // 移除尾部斜杠并重定向
      const cleanPath = pathname.slice(0, -1);
      console.log(`RedirectHandler: Redirecting from ${pathname} to ${cleanPath}`);
      navigate(cleanPath, { replace: true });
      return;
    }

    // 检查是否是其他页面且以斜杠结尾（除了根路径）
    if (pathname !== '/' && pathname.endsWith('/')) {
      const cleanPath = pathname.slice(0, -1);
      console.log(`RedirectHandler: Redirecting from ${pathname} to ${cleanPath}`);
      navigate(cleanPath, { replace: true });
    }
  }, [location.pathname, navigate]);

  return null; // 这个组件不渲染任何内容
}; 