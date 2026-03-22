import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { PRODUCT_MODELS, CONTACT_ROLES, ROLE_LABELS, type ContactRole } from '../../types/admin';
import * as svc from '../../services/orderAdminService';

export function CreateOrderPage() {
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Equipment
  const [productModel, setProductModel] = useState('');
  const [productName, setProductName] = useState('');
  const [configuration, setConfiguration] = useState('');
  const [quoteAmount, setQuoteAmount] = useState('');

  // Customer
  const [institution, setInstitution] = useState('');
  const [department, setDepartment] = useState('');

  // Primary Contact
  const [contactName, setContactName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [contactRole, setContactRole] = useState<ContactRole>('PI');
  const [contactDept, setContactDept] = useState('');

  // Dates
  const [quoteDate, setQuoteDate] = useState(new Date().toISOString().split('T')[0]);
  const [estimatedDelivery, setEstimatedDelivery] = useState('');

  // Reference
  const [quoteNumber, setQuoteNumber] = useState('');
  const [notes, setNotes] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!productModel || !institution || !contactName || !contactEmail || !contactRole) {
      setError('Please fill in all required fields.');
      return;
    }

    setSubmitting(true);
    setError('');
    try {
      const result = await svc.createOrder({
        institution,
        department: department || undefined,
        productModel,
        productName: productName || undefined,
        configuration: configuration || undefined,
        quoteAmount: quoteAmount ? parseFloat(quoteAmount) : undefined,
        quoteNumber: quoteNumber || undefined,
        quoteDate: quoteDate || undefined,
        estimatedDelivery: estimatedDelivery || undefined,
        notes: notes || undefined,
        primaryContact: {
          contactName,
          contactEmail,
          contactPhone: contactPhone || undefined,
          role: contactRole,
          department: contactDept || undefined,
        },
      });
      const orderId = (result as any)?.orderId;
      navigate(orderId ? `/admin/orders/${orderId}` : '/admin/orders');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create order');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-4xl">
      {/* Back button */}
      <Link
        to="/admin/orders"
        className="flex items-center gap-2 text-sm text-on-surface-variant hover:text-on-surface mb-4 transition-colors"
      >
        <span className="material-symbols-outlined text-[18px]">arrow_back</span>
        Back to Orders
      </Link>

      {/* Page title */}
      <h1 className="font-headline text-3xl font-bold tracking-tight text-primary mb-8">
        Create New Order
      </h1>

      {error && (
        <div className="bg-error-container text-on-error-container p-4 rounded-lg text-sm mb-4 flex items-center gap-2">
          <span className="material-symbols-outlined text-[18px]">error</span>
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Section 1: Equipment */}
        <div className="bg-surface-container-lowest rounded-xl p-6 shadow-card">
          <h3 className="text-sm font-bold text-on-surface-variant uppercase tracking-wider flex items-center gap-2 mb-6">
            <span className="material-symbols-outlined text-[18px]">precision_manufacturing</span>
            Equipment
          </h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-bold text-on-surface-variant uppercase tracking-widest mb-1">
                Product Model<span className="text-error ml-0.5">*</span>
              </label>
              <select
                value={productModel}
                onChange={(e) => setProductModel(e.target.value)}
                className="w-full bg-surface-container-low border-none rounded-lg py-2.5 px-3 text-sm focus:ring-1 focus:ring-secondary focus:outline-none"
              >
                <option value="">Select...</option>
                {PRODUCT_MODELS.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-bold text-on-surface-variant uppercase tracking-widest mb-1">
                Product Name
              </label>
              <input
                type="text"
                value={productName}
                onChange={(e) => setProductName(e.target.value)}
                placeholder="Auto-fill based on model"
                className="w-full bg-surface-container-low border-none rounded-lg py-2.5 px-3 text-sm focus:ring-1 focus:ring-secondary focus:outline-none"
              />
            </div>
          </div>
          <div className="mt-4">
            <label className="block text-[10px] font-bold text-on-surface-variant uppercase tracking-widest mb-1">
              Configuration
            </label>
            <textarea
              value={configuration}
              onChange={(e) => setConfiguration(e.target.value)}
              className="w-full bg-surface-container-low border-none rounded-lg py-2.5 px-3 text-sm focus:ring-1 focus:ring-secondary focus:outline-none min-h-[80px] resize-none"
              rows={2}
            />
          </div>
          <div className="mt-4 max-w-[200px]">
            <label className="block text-[10px] font-bold text-on-surface-variant uppercase tracking-widest mb-1">
              Quote Amount ($)
            </label>
            <input
              type="number"
              value={quoteAmount}
              onChange={(e) => setQuoteAmount(e.target.value)}
              placeholder="Optional"
              className="w-full bg-surface-container-low border-none rounded-lg py-2.5 px-3 text-sm focus:ring-1 focus:ring-secondary focus:outline-none"
            />
          </div>
        </div>

        {/* Section 2: Customer */}
        <div className="bg-surface-container-lowest rounded-xl p-6 shadow-card">
          <h3 className="text-sm font-bold text-on-surface-variant uppercase tracking-wider flex items-center gap-2 mb-6">
            <span className="material-symbols-outlined text-[18px]">apartment</span>
            Customer
          </h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-bold text-on-surface-variant uppercase tracking-widest mb-1">
                Institution<span className="text-error ml-0.5">*</span>
              </label>
              <input
                type="text"
                value={institution}
                onChange={(e) => setInstitution(e.target.value)}
                className="w-full bg-surface-container-low border-none rounded-lg py-2.5 px-3 text-sm focus:ring-1 focus:ring-secondary focus:outline-none"
                required
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-on-surface-variant uppercase tracking-widest mb-1">
                Department
              </label>
              <input
                type="text"
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                className="w-full bg-surface-container-low border-none rounded-lg py-2.5 px-3 text-sm focus:ring-1 focus:ring-secondary focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* Section 3: Primary Contact */}
        <div className="bg-surface-container-lowest rounded-xl p-6 shadow-card">
          <h3 className="text-sm font-bold text-on-surface-variant uppercase tracking-wider flex items-center gap-2 mb-6">
            <span className="material-symbols-outlined text-[18px]">person</span>
            Primary Contact
          </h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-bold text-on-surface-variant uppercase tracking-widest mb-1">
                Name<span className="text-error ml-0.5">*</span>
              </label>
              <input
                type="text"
                value={contactName}
                onChange={(e) => setContactName(e.target.value)}
                className="w-full bg-surface-container-low border-none rounded-lg py-2.5 px-3 text-sm focus:ring-1 focus:ring-secondary focus:outline-none"
                required
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-on-surface-variant uppercase tracking-widest mb-1">
                Email<span className="text-error ml-0.5">*</span>
              </label>
              <input
                type="email"
                value={contactEmail}
                onChange={(e) => setContactEmail(e.target.value)}
                className="w-full bg-surface-container-low border-none rounded-lg py-2.5 px-3 text-sm focus:ring-1 focus:ring-secondary focus:outline-none"
                required
              />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4 mt-4">
            <div>
              <label className="block text-[10px] font-bold text-on-surface-variant uppercase tracking-widest mb-1">
                Phone
              </label>
              <input
                type="tel"
                value={contactPhone}
                onChange={(e) => setContactPhone(e.target.value)}
                className="w-full bg-surface-container-low border-none rounded-lg py-2.5 px-3 text-sm focus:ring-1 focus:ring-secondary focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-on-surface-variant uppercase tracking-widest mb-1">
                Role<span className="text-error ml-0.5">*</span>
              </label>
              <select
                value={contactRole}
                onChange={(e) => setContactRole(e.target.value as ContactRole)}
                className="w-full bg-surface-container-low border-none rounded-lg py-2.5 px-3 text-sm focus:ring-1 focus:ring-secondary focus:outline-none"
              >
                {CONTACT_ROLES.map(r => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-bold text-on-surface-variant uppercase tracking-widest mb-1">
                Department
              </label>
              <input
                type="text"
                value={contactDept}
                onChange={(e) => setContactDept(e.target.value)}
                className="w-full bg-surface-container-low border-none rounded-lg py-2.5 px-3 text-sm focus:ring-1 focus:ring-secondary focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* Section 4: Dates */}
        <div className="bg-surface-container-lowest rounded-xl p-6 shadow-card">
          <h3 className="text-sm font-bold text-on-surface-variant uppercase tracking-wider flex items-center gap-2 mb-6">
            <span className="material-symbols-outlined text-[18px]">calendar_month</span>
            Dates
          </h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-bold text-on-surface-variant uppercase tracking-widest mb-1">
                Quote Date
              </label>
              <input
                type="date"
                value={quoteDate}
                onChange={(e) => setQuoteDate(e.target.value)}
                className="w-full bg-surface-container-low border-none rounded-lg py-2.5 px-3 text-sm focus:ring-1 focus:ring-secondary focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-on-surface-variant uppercase tracking-widest mb-1">
                Estimated Delivery
              </label>
              <input
                type="date"
                value={estimatedDelivery}
                onChange={(e) => setEstimatedDelivery(e.target.value)}
                className="w-full bg-surface-container-low border-none rounded-lg py-2.5 px-3 text-sm focus:ring-1 focus:ring-secondary focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* Section 5: Reference */}
        <div className="bg-surface-container-lowest rounded-xl p-6 shadow-card">
          <h3 className="text-sm font-bold text-on-surface-variant uppercase tracking-wider flex items-center gap-2 mb-6">
            <span className="material-symbols-outlined text-[18px]">tag</span>
            Reference
          </h3>
          <div className="max-w-[300px]">
            <label className="block text-[10px] font-bold text-on-surface-variant uppercase tracking-widest mb-1">
              Quote Number
            </label>
            <input
              type="text"
              value={quoteNumber}
              onChange={(e) => setQuoteNumber(e.target.value)}
              placeholder="e.g. NS-Q-2026-003"
              className="w-full bg-surface-container-low border-none rounded-lg py-2.5 px-3 text-sm focus:ring-1 focus:ring-secondary focus:outline-none"
            />
          </div>
          <div className="mt-4">
            <label className="block text-[10px] font-bold text-on-surface-variant uppercase tracking-widest mb-1">
              Internal Notes
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="w-full bg-surface-container-low border-none rounded-lg py-2.5 px-3 text-sm focus:ring-1 focus:ring-secondary focus:outline-none min-h-[80px] resize-none"
            />
          </div>
        </div>

        {/* Submit */}
        <div className="pt-2">
          <button
            type="submit"
            className="bg-secondary text-white px-8 py-3 rounded-xl font-semibold flex items-center gap-2 shadow-lg shadow-secondary/20 disabled:opacity-50"
            disabled={submitting}
          >
            <span className="material-symbols-outlined text-[18px]">add_circle</span>
            {submitting ? 'Creating...' : 'Create Order'}
          </button>
        </div>
      </form>
    </div>
  );
}
