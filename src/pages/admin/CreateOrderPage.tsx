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
    <div className="admin-detail-page">
      <div className="admin-detail-header">
        <Link to="/admin/orders" className="admin-btn-sm admin-btn-outline">&larr; Back</Link>
        <h1 style={{ margin: 0 }}>Create New Order</h1>
      </div>

      {error && <div className="admin-error">{error}</div>}

      <form onSubmit={handleSubmit}>
        {/* Section 1: Equipment */}
        <div className="admin-panel">
          <h3>Equipment</h3>
          <div className="admin-form-row">
            <div className="form-field">
              <label>Product Model *</label>
              <select value={productModel} onChange={(e) => setProductModel(e.target.value)} className="admin-filter-select" style={{ width: '100%' }}>
                <option value="">Select...</option>
                {PRODUCT_MODELS.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            <div className="form-field">
              <label>Product Name</label>
              <input type="text" value={productName} onChange={(e) => setProductName(e.target.value)}
                placeholder="Auto-fill based on model" className="admin-search-input" style={{ width: '100%' }} />
            </div>
          </div>
          <div className="form-field">
            <label>Configuration</label>
            <textarea value={configuration} onChange={(e) => setConfiguration(e.target.value)}
              rows={2} style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }} />
          </div>
          <div className="form-field">
            <label>Quote Amount ($)</label>
            <input type="number" value={quoteAmount} onChange={(e) => setQuoteAmount(e.target.value)}
              placeholder="Optional" className="admin-search-input" style={{ width: '200px' }} />
          </div>
        </div>

        {/* Section 2: Customer */}
        <div className="admin-panel">
          <h3>Customer</h3>
          <div className="admin-form-row">
            <div className="form-field">
              <label>Institution *</label>
              <input type="text" value={institution} onChange={(e) => setInstitution(e.target.value)}
                className="admin-search-input" style={{ width: '100%' }} required />
            </div>
            <div className="form-field">
              <label>Department</label>
              <input type="text" value={department} onChange={(e) => setDepartment(e.target.value)}
                className="admin-search-input" style={{ width: '100%' }} />
            </div>
          </div>
        </div>

        {/* Section 3: Primary Contact */}
        <div className="admin-panel">
          <h3>Primary Contact</h3>
          <div className="admin-form-row">
            <div className="form-field">
              <label>Name *</label>
              <input type="text" value={contactName} onChange={(e) => setContactName(e.target.value)}
                className="admin-search-input" style={{ width: '100%' }} required />
            </div>
            <div className="form-field">
              <label>Email *</label>
              <input type="email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)}
                className="admin-search-input" style={{ width: '100%' }} required />
            </div>
          </div>
          <div className="admin-form-row">
            <div className="form-field">
              <label>Phone</label>
              <input type="tel" value={contactPhone} onChange={(e) => setContactPhone(e.target.value)}
                className="admin-search-input" style={{ width: '100%' }} />
            </div>
            <div className="form-field">
              <label>Role *</label>
              <select value={contactRole} onChange={(e) => setContactRole(e.target.value as ContactRole)}
                className="admin-filter-select" style={{ width: '100%' }}>
                {CONTACT_ROLES.map(r => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
              </select>
            </div>
            <div className="form-field">
              <label>Department</label>
              <input type="text" value={contactDept} onChange={(e) => setContactDept(e.target.value)}
                className="admin-search-input" style={{ width: '100%' }} />
            </div>
          </div>
        </div>

        {/* Section 4: Dates */}
        <div className="admin-panel">
          <h3>Dates</h3>
          <div className="admin-form-row">
            <div className="form-field">
              <label>Quote Date</label>
              <input type="date" value={quoteDate} onChange={(e) => setQuoteDate(e.target.value)}
                className="admin-search-input" style={{ width: '200px' }} />
            </div>
            <div className="form-field">
              <label>Estimated Delivery</label>
              <input type="date" value={estimatedDelivery} onChange={(e) => setEstimatedDelivery(e.target.value)}
                className="admin-search-input" style={{ width: '200px' }} />
            </div>
          </div>
        </div>

        {/* Section 5: Reference */}
        <div className="admin-panel">
          <h3>Reference</h3>
          <div className="form-field">
            <label>Quote Number</label>
            <input type="text" value={quoteNumber} onChange={(e) => setQuoteNumber(e.target.value)}
              placeholder="e.g. NS-Q-2026-003" className="admin-search-input" style={{ width: '300px' }} />
          </div>
          <div className="form-field">
            <label>Internal Notes</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)}
              rows={3} style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }} />
          </div>
        </div>

        <div style={{ marginTop: '16px' }}>
          <button type="submit" className="admin-btn-primary" disabled={submitting}>
            {submitting ? 'Creating...' : 'Create Order'}
          </button>
        </div>
      </form>
    </div>
  );
}
