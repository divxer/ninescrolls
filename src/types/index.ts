export interface ContactFormData {
  name: string;
  email: string;
  phone: string;
  organization: string;
  message: string;
}

export interface ContactFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  productName: string;
  formData: ContactFormData;
  onFormDataChange: (data: ContactFormData) => void;
  onSuccess?: () => void;
} 