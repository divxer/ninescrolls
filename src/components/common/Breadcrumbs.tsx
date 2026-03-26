import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';

interface BreadcrumbItem {
  name: string;
  path: string;
}

interface BreadcrumbsProps {
  items: BreadcrumbItem[];
  variant?: 'light' | 'dark';
}

export function Breadcrumbs({ items, variant = 'light' }: BreadcrumbsProps) {
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": items.map((item, index) => ({
      "@type": "ListItem",
      "position": index + 1,
      "item": {
        "@id": `https://ninescrolls.com${item.path}`,
        "name": item.name
      }
    }))
  };

  const isDark = variant === 'dark';

  return (
    <>
      <Helmet>
        <script type="application/ld+json">
          {JSON.stringify(structuredData)}
        </script>
      </Helmet>
      <nav
        className={`w-full py-3 px-8 ${
          isDark
            ? 'bg-white/5 border-b border-white/10'
            : 'bg-surface-container-lowest/80 backdrop-blur-sm border-b border-outline-variant/30'
        }`}
        aria-label="Breadcrumb"
      >
        <ol className="flex flex-wrap items-center list-none m-0 p-0 max-w-screen-2xl mx-auto">
          <li className="flex items-center text-sm">
            <Link
              to="/"
              className={`no-underline transition-colors duration-200 hover:underline ${
                isDark ? 'text-white/70 hover:text-white' : 'text-primary hover:text-primary/80'
              }`}
            >
              Home
            </Link>
          </li>
          {items.map((item, index) => (
            <li key={item.path} className="flex items-center text-sm">
              <span className={`mx-2 material-symbols-outlined text-[18px] ${isDark ? 'text-white/40' : 'text-on-surface-variant'}`}>
                chevron_right
              </span>
              {index === items.length - 1 ? (
                <span
                  className={`font-medium ${isDark ? 'text-white' : 'text-on-surface-variant'}`}
                  aria-current="page"
                >
                  {item.name}
                </span>
              ) : (
                <Link
                  to={item.path}
                  className={`no-underline transition-colors duration-200 hover:underline ${
                    isDark ? 'text-white/70 hover:text-white' : 'text-primary hover:text-primary/80'
                  }`}
                >
                  {item.name}
                </Link>
              )}
            </li>
          ))}
        </ol>
      </nav>
    </>
  );
}
