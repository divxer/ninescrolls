import { useNavigate } from 'react-router-dom';
import type { InsightsPost } from '../../types';
import { buildRfqUrl, relatedProductsToSlugs } from '../../utils/rfqAttribution';
import { useCombinedAnalytics } from '../../hooks/useCombinedAnalytics';

interface RfqCtaCardProps {
  post: InsightsPost;
  ctaPosition: 'article-footer';
}

export function RfqCtaCard({ post, ctaPosition }: RfqCtaCardProps) {
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

  let title: string;
  let subcopy: string;
  let buttonText: string;

  if (count === 0) {
    title = 'Need help with this process?';
    subcopy = 'Talk to our application engineers about equipment options for your project.';
    buttonText = 'Get a quote';
  } else if (count === 1) {
    title = `Looking to deploy ${products[0].label}?`;
    subcopy = `Get pricing and lead time for ${products[0].label}, customized to your application.`;
    buttonText = 'Request a quote';
  } else {
    title = 'Compare and request quotes';
    subcopy = 'Get pricing for the systems referenced in this article.';
    buttonText = 'Get quotes for these systems';
  }

  return (
    <section className="my-10 bg-surface-container-lowest rounded-2xl p-6 sm:p-8 shadow-sm border border-outline-variant/15">
      <h3 className="text-xl font-semibold text-on-surface mb-2">{title}</h3>
      <p className="text-on-surface-variant text-sm sm:text-base mb-5">{subcopy}</p>
      {count >= 1 && (
        <ul className="flex flex-wrap gap-2 mb-5 list-none p-0">
          {products.slice(0, 5).map((p) => (
            <li
              key={p.href}
              className="px-3 py-1 rounded-full bg-surface-container text-on-surface-variant text-xs"
            >
              {p.label}
            </li>
          ))}
        </ul>
      )}
      <a
        href={url}
        onClick={onClick}
        className="inline-flex items-center justify-center px-6 py-3 bg-primary text-on-primary rounded-lg font-medium text-sm hover:bg-primary-container transition-colors no-underline"
      >
        {buttonText} →
      </a>
    </section>
  );
}
