import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ContactFormModalProps } from '../../types';
import { useCombinedAnalytics } from '../../hooks/useCombinedAnalytics';
import { DownloadGateModal } from './DownloadGateModal';

// Product name to PDF filename mapping
const productToPdfMap: Record<string, string> = {
  'ALD System': 'ald-system-datasheet.pdf',
  'ALD System Series': 'ald-system-datasheet.pdf',
  'Coater/Developer System': 'coater-developer-system-datasheet.pdf',
  'Coater/Developer System Series': 'coater-developer-system-datasheet.pdf',
  'HDP-CVD System': 'hdp-cvd-system-datasheet.pdf',
  'HDP-CVD System Series': 'hdp-cvd-system-datasheet.pdf',
  'IBE/RIBE System': 'ibe-ribe-system-datasheet.pdf',
  'IBE/RIBE System Series': 'ibe-ribe-system-datasheet.pdf',
  'ICP Etcher': 'icp-etcher-datasheet.pdf',
  'ICP Etcher Series': 'icp-etcher-datasheet.pdf',
  'PECVD System': 'pecvd-system-datasheet.pdf',
  'PECVD System Series': 'pecvd-system-datasheet.pdf',
  'RIE Etcher': 'rie-etcher-datasheet.pdf',
  'RIE Etcher Series': 'rie-etcher-datasheet.pdf',
  'Sputter System': 'sputter-system-datasheet.pdf',
  'Sputter System Series': 'sputter-system-datasheet.pdf',
  'Striper System': 'striper-system-datasheet.pdf',
  'Stripping System Series': 'striper-system-datasheet.pdf'
};

export function ContactFormModal({
  isOpen,
  onClose,
  productName,
  formData,
  onFormDataChange,
  onSuccess
}: ContactFormModalProps) {
  const analytics = useCombinedAnalytics();
  const [isSuccess, setIsSuccess] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [gateOpen, setGateOpen] = useState(false);
  const [isQuote, setIsQuote] = useState(false);
  const [addressData, setAddressData] = useState({
    address: '',
    city: '',
    state: '',
    zipCode: '',
    country: 'United States'
  });

  useEffect(() => {
    if (!isOpen) {
      setIsSuccess(false);
    }
  }, [isOpen]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    onFormDataChange({ ...formData, [name]: value });
  };

  const handleAddressChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setAddressData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);
    setError(null);

    const formDataToSubmit = {
      productName,
      ...formData,
      inquiryType: isQuote ? 'budgetary' : 'general',
      ...(isQuote ? { shippingAddress: addressData } : {})
    };

    if (!formDataToSubmit.message.trim()) {
      console.log('Validation failed: Message is empty');
      setError('Please provide a message');
      setIsSubmitting(false);
      return;
    }

    try {
      const response = await fetch('https://api.ninescrolls.com/sendEmail', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formDataToSubmit)
      });

      if (!response.ok) {
        const responseText = await response.text();
        throw new Error(`Failed to submit form: ${response.status} ${responseText}`);
      }
      setIsSuccess(true);
      setIsSubmitting(false);
      onFormDataChange({
        name: '',
        email: '',
        phone: '',
        organization: '',
        message: ''
      });
      onSuccess?.();

      // Always send form_submit event to Google Analytics, even if productName is empty
      const inquiryProduct = productName || 'General Inquiry';
      analytics.trackContactFormSubmit(inquiryProduct, inquiryProduct);
      // Send event with IP analysis to Segment
      analytics.segment.trackContactFormSubmitWithAnalysis(inquiryProduct, inquiryProduct);
    } catch (error) {
      console.error('Error in form submission:', error);
      if (error instanceof Error) {
        console.error('Error details:', {
          name: error.name,
          message: error.message,
          stack: error.stack
        });
      }
      setError(error instanceof Error ? error.message : 'Failed to submit form. Please try again later.');
      setIsSubmitting(false);
    }
  };

  const handleDatasheetDownload = () => {
    if (productName) {
      analytics.trackDatasheetDownload(productName, productName);
      // Send event with IP analysis to Segment
      analytics.segment.trackWithIPAnalysis('Datasheet Downloaded', {
        productId: productName,
        productName,
        fileType: 'datasheet'
      });
    }
  };

  if (!isOpen) return null;

  return (
    <>
    <div className="fixed inset-0 z-[1000] bg-black/50 overflow-auto flex items-start justify-center">
      <div className="bg-white my-[10vh] p-8 rounded-lg w-[90%] max-w-[600px] relative animate-in slide-in-from-bottom-4" role="dialog" aria-labelledby="modalTitle">
        {!isSuccess ? (
          <>
            <span className="absolute top-4 right-4 text-2xl cursor-pointer text-gray-400 hover:text-on-surface bg-transparent border-none p-2 leading-none transition-colors" aria-label="Close" onClick={onClose}>&times;</span>
            <h2 id="modalTitle">Request Product Information</h2>
            <p className="text-on-surface-variant text-sm mb-4">Please fill out the form below and we'll get back to you shortly.</p>
            {error && <div className="bg-red-50 text-red-800 p-3 rounded border border-red-200 mb-4 text-sm">{error}</div>}
            <form id="contactForm" onSubmit={handleSubmit}>
              <div className="mb-4">
                <label htmlFor="productName" className="block text-sm font-medium text-on-surface-variant mb-1">Product:</label>
                <input type="text" id="productName" name="productName" value={productName} readOnly className="w-full px-3 py-2.5 border border-gray-300 rounded-md text-base focus:outline-none focus:border-primary transition-colors bg-gray-100 cursor-not-allowed" />
              </div>
              <div className="mb-4">
                <label htmlFor="name" className="block text-sm font-medium text-on-surface-variant mb-1">Name</label>
                <input
                  type="text"
                  id="name"
                  name="name"
                  required
                  placeholder="Enter your full name"
                  autoComplete="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-md text-base focus:outline-none focus:border-primary transition-colors"
                />
              </div>
              <div className="mb-4">
                <label htmlFor="email" className="block text-sm font-medium text-on-surface-variant mb-1">Email</label>
                <input
                  type="email"
                  id="email"
                  name="email"
                  required
                  placeholder="Enter your email address"
                  autoComplete="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-md text-base focus:outline-none focus:border-primary transition-colors"
                />
              </div>
              <div className="mb-4">
                <label htmlFor="phone" className="block text-sm font-medium text-on-surface-variant mb-1">Phone:</label>
                <input
                  type="tel"
                  id="phone"
                  name="phone"
                  pattern="[0-9+\-\s()]*"
                  placeholder="Optional: Enter your phone number"
                  autoComplete="tel"
                  value={formData.phone}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-md text-base focus:outline-none focus:border-primary transition-colors"
                />
              </div>
              <div className="mb-4">
                <label htmlFor="organization" className="block text-sm font-medium text-on-surface-variant mb-1">Organization:</label>
                <input
                  type="text"
                  id="organization"
                  name="organization"
                  placeholder="Optional: Enter your organization name"
                  autoComplete="organization"
                  value={formData.organization}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-md text-base focus:outline-none focus:border-primary transition-colors"
                />
              </div>
              <div className="mb-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={isQuote} onChange={(e) => setIsQuote(e.target.checked)} className="w-auto m-0" />
                  I need a budgetary quote (requires shipping address for tax calculation)
                </label>
              </div>
              {isQuote && (
                <div className="bg-gray-50 p-4 rounded-lg mb-2">
                  <p className="text-[13px] text-gray-600 mb-3">Shipping address is required to calculate applicable taxes.</p>
                  <div className="mb-4">
                    <label htmlFor="address" className="block text-sm font-medium text-on-surface-variant mb-1">Address *</label>
                    <input type="text" id="address" name="address" placeholder="Street address" value={addressData.address} onChange={handleAddressChange} required autoComplete="street-address" className="w-full px-3 py-2.5 border border-gray-300 rounded-md text-base focus:outline-none focus:border-primary transition-colors" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="mb-4">
                      <label htmlFor="city" className="block text-sm font-medium text-on-surface-variant mb-1">City *</label>
                      <input type="text" id="city" name="city" placeholder="City" value={addressData.city} onChange={handleAddressChange} required autoComplete="address-level2" className="w-full px-3 py-2.5 border border-gray-300 rounded-md text-base focus:outline-none focus:border-primary transition-colors" />
                    </div>
                    <div className="mb-4">
                      <label htmlFor="state" className="block text-sm font-medium text-on-surface-variant mb-1">State/Province *</label>
                      <input type="text" id="state" name="state" placeholder="State" value={addressData.state} onChange={handleAddressChange} required autoComplete="address-level1" className="w-full px-3 py-2.5 border border-gray-300 rounded-md text-base focus:outline-none focus:border-primary transition-colors" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="mb-4">
                      <label htmlFor="zipCode" className="block text-sm font-medium text-on-surface-variant mb-1">ZIP/Postal Code *</label>
                      <input type="text" id="zipCode" name="zipCode" placeholder="ZIP Code" value={addressData.zipCode} onChange={handleAddressChange} required autoComplete="postal-code" className="w-full px-3 py-2.5 border border-gray-300 rounded-md text-base focus:outline-none focus:border-primary transition-colors" />
                    </div>
                    <div className="mb-4">
                      <label htmlFor="country" className="block text-sm font-medium text-on-surface-variant mb-1">Country *</label>
                      <select id="country" name="country" value={addressData.country} onChange={handleAddressChange} required autoComplete="country-name" className="w-full px-3 py-2.5 border border-gray-300 rounded-md text-base focus:outline-none focus:border-primary transition-colors">
                        <option value="United States">United States</option>
                        <option value="Canada">Canada</option>
                        <option value="United Kingdom">United Kingdom</option>
                        <option value="Australia">Australia</option>
                        <option value="Germany">Germany</option>
                        <option value="France">France</option>
                        <option value="Japan">Japan</option>
                        <option value="South Korea">South Korea</option>
                        <option value="Singapore">Singapore</option>
                        <option value="Netherlands">Netherlands</option>
                        <option value="Switzerland">Switzerland</option>
                        <option value="Sweden">Sweden</option>
                        <option value="Norway">Norway</option>
                        <option value="Denmark">Denmark</option>
                        <option value="Finland">Finland</option>
                        <option value="Belgium">Belgium</option>
                        <option value="Austria">Austria</option>
                        <option value="Italy">Italy</option>
                        <option value="Spain">Spain</option>
                        <option value="Ireland">Ireland</option>
                        <option value="New Zealand">New Zealand</option>
                        <option value="Israel">Israel</option>
                        <option value="Taiwan">Taiwan</option>
                        <option value="Hong Kong">Hong Kong</option>
                        <option value="China">China</option>
                        <option value="India">India</option>
                        <option value="Brazil">Brazil</option>
                        <option value="Mexico">Mexico</option>
                      </select>
                    </div>
                  </div>
                </div>
              )}
              <div className="mb-4">
                <label htmlFor="message" className="block text-sm font-medium text-on-surface-variant mb-1">Message</label>
                <textarea
                  id="message"
                  name="message"
                  rows={4}
                  required
                  placeholder="Please let us know your specific requirements or questions"
                  value={formData.message}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-md text-base focus:outline-none focus:border-primary transition-colors"
                ></textarea>
              </div>
              <div className="flex gap-4 justify-end mt-6">
                <button type="submit" className="inline-flex items-center gap-2 h-10 px-4 rounded-lg font-bold bg-primary text-white border border-primary hover:bg-primary-container hover:-translate-y-0.5 transition-all cursor-pointer text-base" disabled={isSubmitting}>
                  {isSubmitting ? 'Submitting...' : 'Submit Request'}
                </button>
              </div>
            </form>
          </>
        ) : (
          <div className="text-center p-8">
            <span className="absolute top-4 right-4 text-2xl cursor-pointer text-gray-400 hover:text-on-surface bg-transparent border-none p-2 leading-none transition-colors" aria-label="Close" onClick={onClose}>&times;</span>
            <div className="relative">
              <span className="block text-5xl text-green-500 mb-4">✓</span>
              <h3>Thank You for Your Interest!</h3>
              <p>Your request about the {productName} has been submitted successfully.</p>
              <div className="text-left my-6 p-6 bg-gray-100 rounded-lg">
                <p>What happens next:</p>
                <ul>
                  <li>You'll receive a confirmation email within the next few minutes</li>
                  <li>Our sales team will review your request</li>
                  <li>We'll respond with detailed information within 1–2 business days</li>
                </ul>
              </div>
              <div className="mt-6">
                <p>Meanwhile, you might be interested in:</p>
                <div className="flex gap-4 justify-center flex-wrap">
                  <a
                    href="#"
                    className="inline-flex items-center gap-2 h-10 px-4 rounded-lg font-bold bg-white text-slate-600 border border-slate-300 hover:bg-slate-50 hover:border-slate-400 hover:-translate-y-0.5 transition-all cursor-pointer text-base"
                    onClick={(e) => { e.preventDefault(); handleDatasheetDownload(); setGateOpen(true); }}
                  >
                    <span className="icon-download"></span> Download Product Datasheet
                  </a>
                  <Link to="/products" className="inline-flex items-center gap-2 h-10 px-4 rounded-lg font-bold bg-white text-slate-600 border border-slate-300 hover:bg-slate-50 hover:border-slate-400 hover:-translate-y-0.5 transition-all cursor-pointer text-base">
                    <span className="icon-browse"></span> Browse Other Products
                  </Link>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>

    <DownloadGateModal
      isOpen={gateOpen}
      onClose={() => setGateOpen(false)}
      fileUrl={`/docs/${productToPdfMap[productName] || 'equipment-guide.pdf'}`}
      fileName={`NineScrolls-${productName.replace(/\s+/g, '-').replace(/\//g, '-').replace(/-series$/i, '')}-Datasheet.pdf`}
      title={`Download ${productName} Datasheet`}
      turnstileSiteKey={import.meta.env.VITE_TURNSTILE_SITE_KEY as string}
    />
    </>
  );
}
