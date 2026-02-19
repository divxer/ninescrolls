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

export interface InsightsPost {
  id: string;
  title: string;
  content?: string;
  excerpt?: string;
  author: string;
  publishDate: string;
  category: string;
  readTime: number;
  imageUrl: string;
  slug: string;
  tags: string[];
  relatedProducts?: RelatedProduct[];
  heroImages?: HeroImageConfig;
  isStandaloneComponent?: boolean;
}

export const categories = [
  'All',
  'Materials Science',
  'Photonics',
  'Nanotechnology',
  'Energy'
];
