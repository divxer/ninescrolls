import { useNavigate } from 'react-router-dom';
import type { InsightsPost } from '../../types';
import { buildRfqUrl, relatedProductsToSlugs } from '../../utils/rfqAttribution';
import { useCombinedAnalytics } from '../../hooks/useCombinedAnalytics';

interface RfqCtaSidebarProps {
  post: InsightsPost;
  ctaPosition: 'sidebar';
}

export function RfqCtaSidebar({ post, ctaPosition }: RfqCtaSidebarProps) {
  const navigate = useNavigate();
  const analytics = useCombinedAnalytics();
  const products = post.relatedProducts ?? [];
  const productSlugs = relatedProductsToSlugs(products);
  const count = products.length;

  const url = buildRfqUrl({
    products: productSlugs,
    sourceSlug: post.slug,
    sourceArea: 'insights',
  });

  const subcopy =
    count === 0 ? 'Talk to our application engineers.'
    : count === 1 ? `Get pricing for ${products[0].label}.`
    : 'Get pricing for the systems in this article.';

  const onClick = (e: React.MouseEvent) => {
    e.preventDefault();
    analytics.trackCustomEvent('insights_cta_click', {
      ctaPosition,
      articleSlug: post.slug,
      articleTitle: post.title,
      productCount: count,
      productSlugs: productSlugs.map((p) => p.slug).join(','),
    });
    navigate(url);
  };

  return (
    <aside className="hidden lg:block bg-white p-5 rounded-xl shadow-md sticky top-20">
      <h3 className="text-base font-semibold text-on-surface mb-1">Get a quote</h3>
      <p className="text-sm text-on-surface-variant mb-4">{subcopy}</p>
      <a
        href={url}
        onClick={onClick}
        className="block w-full text-center px-4 py-2.5 bg-primary text-on-primary rounded-lg font-medium text-sm hover:bg-primary-container transition-colors no-underline"
      >
        Request a quote →
      </a>
    </aside>
  );
}
