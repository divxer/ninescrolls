export interface ContactFormData {
  name: string;
  email: string;
  phone: string;
  organization: string;
  message: string;
  address?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  country?: string;
}

export interface ContactFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  productName: string;
  formData: ContactFormData;
  onFormDataChange: (data: ContactFormData) => void;
  onSuccess?: () => void;
}

export interface RelatedProduct {
  href: string;
  label: string;
  subtitle?: string;
}

export interface HeroImageConfig {
  prefix: string;
  fallbackExt: string;
}

export type ContentType = 'insight' | 'news';

export interface InsightsPost {
  id: string;
  title: string;
  content?: string;
  excerpt?: string;
  author: string;
  publishDate: string;
  lastModifiedDate?: string;
  category: string;
  readTime: number;
  imageUrl: string;
  slug: string;
  tags: string[];
  relatedProducts?: RelatedProduct[];
  heroImages?: HeroImageConfig;
  isStandaloneComponent?: boolean;
  isDraft?: boolean;
  contentType?: ContentType;
}

// Q&A types
export type QuestionStatus = 'pending' | 'approved' | 'rejected';

export interface ArticleQuestion {
  id: string;
  articleSlug: string;
  name: string;
  question: string;
  answer?: string;
  status: QuestionStatus;
  submittedAt: string;
  answeredAt?: string;
  answeredBy?: string;
}

export interface ArticleQuestionAdmin extends ArticleQuestion {
  email: string;
}

export const insightCategories = [
  'All',
  'Materials Science',
  'Photonics',
  'Nanotechnology',
  'Energy',
  'Equipment Maintenance',
  'Publication Spotlight'
];

export const newsCategories = [
  'All',
  'Industry',
  'Product',
  'Event',
  'Partnership'
];

// Backward compatibility alias
export const categories = insightCategories;
