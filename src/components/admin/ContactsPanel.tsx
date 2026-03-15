import { useState, useRef, useEffect } from 'react';
import { Modal } from './Modal';
import { StatusBadge } from './StatusBadge';
import { CONTACT_ROLES, ROLE_LABELS, type OrderContact, type ContactRole } from '../../types/admin';
import * as svc from '../../services/orderAdminService';

interface ContactsPanelProps {
  orderId: string;
  contacts: OrderContact[];
  onRefresh: () => void;
}

/** Dropdown menu anchored to a ⋯ trigger button. */
function ContactMenu({ onEdit, onRemove }: { onEdit: () => void; onRemove: () => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  return (
    <div ref={ref} className="contact-menu-wrapper">
      <button
        className="contact-menu-trigger"
        onClick={() => setOpen(!open)}
        aria-label="Contact actions"
      >⋯</button>
      {open && (
        <div className="contact-menu-dropdown">
          <button className="contact-menu-item" onClick={() => { setOpen(false); onEdit(); }}>
            Edit
          </button>
          <button className="contact-menu-item contact-menu-item-danger" onClick={() => { setOpen(false); onRemove(); }}>
            Remove
          </button>
        </div>
      )}
    </div>
  );
}

export function ContactsPanel({ orderId, contacts, onRefresh }: ContactsPanelProps) {
  const [showAdd, setShowAdd] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  async function handleRemove(contactId: string, name: string) {
    if (!window.confirm(`Remove contact "${name}"?`)) return;
    try {
      await svc.removeContact(orderId, contactId);
      onRefresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to remove contact');
    }
  }

  return (
    <div className="admin-panel">
      <div className="admin-panel-header">
        <h3>Contacts ({contacts.length})</h3>
        <button className="admin-btn-sm" onClick={() => setShowAdd(true)}>+ Add Contact</button>
      </div>

      {contacts.length === 0 ? (
        <p className="admin-empty">No contacts.</p>
      ) : (
        <div className="admin-contacts-grid">
          {contacts.map(contact => (
            <div key={contact.contactId} className="admin-contact-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <strong>{contact.contactName}</strong>
                  {contact.isPrimary && <span className="admin-badge-primary">Primary</span>}
                  <StatusBadge status={contact.role} />
                </div>
                <ContactMenu
                  onEdit={() => setEditingId(contact.contactId)}
                  onRemove={() => handleRemove(contact.contactId, contact.contactName)}
                />
              </div>
              <div style={{ marginTop: '8px', fontSize: '0.9em', color: '#555' }}>
                <div>{contact.contactEmail}</div>
                {contact.contactPhone && <div>{contact.contactPhone}</div>}
                {contact.department && <div>{contact.department}</div>}
                <div style={{ marginTop: '4px' }}>
                  Feedback invite: {contact.feedbackInvite ? 'Yes' : 'No'}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showAdd && (
        <ContactFormModal
          orderId={orderId}
          onClose={() => setShowAdd(false)}
          onSuccess={() => { setShowAdd(false); onRefresh(); }}
        />
      )}

      {editingId && (
        <ContactFormModal
          orderId={orderId}
          contact={contacts.find(c => c.contactId === editingId)}
          onClose={() => setEditingId(null)}
          onSuccess={() => { setEditingId(null); onRefresh(); }}
        />
      )}
    </div>
  );
}

// --- Contact Form Modal ---

function ContactFormModal({ orderId, contact, onClose, onSuccess }: {
  orderId: string;
  contact?: OrderContact;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const isEdit = !!contact;
  const [name, setName] = useState(contact?.contactName || '');
  const [email, setEmail] = useState(contact?.contactEmail || '');
  const [phone, setPhone] = useState(contact?.contactPhone || '');
  const [role, setRole] = useState<ContactRole>(contact?.role || 'PI');
  const [dept, setDept] = useState(contact?.department || '');
  const [isPrimary, setIsPrimary] = useState(contact?.isPrimary || false);
  const [feedbackInvite, setFeedbackInvite] = useState(contact?.feedbackInvite ?? true);
  const [notes, setNotes] = useState(contact?.notes || '');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit() {
    if (!name || !email || !role) { setError('Name, email, and role are required.'); return; }
    setSubmitting(true);
    setError('');
    try {
      const input = {
        contactName: name,
        contactEmail: email,
        contactPhone: phone || undefined,
        role,
        department: dept || undefined,
        isPrimary,
        feedbackInvite,
        notes: notes || undefined,
      };
      if (isEdit) {
        await svc.updateContact(orderId, contact!.contactId, input);
      } else {
        await svc.addContact(orderId, input);
      }
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save contact');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal open onClose={onClose} title={isEdit ? 'Edit Contact' : 'Add Contact'}>
      {error && <div className="admin-error">{error}</div>}
      <div className="form-field">
        <label>Name *</label>
        <input type="text" value={name} onChange={e => setName(e.target.value)}
          className="admin-search-input" style={{ width: '100%' }} />
      </div>
      <div className="form-field">
        <label>Email *</label>
        <input type="email" value={email} onChange={e => setEmail(e.target.value)}
          className="admin-search-input" style={{ width: '100%' }} />
      </div>
      <div className="form-field">
        <label>Phone</label>
        <input type="tel" value={phone} onChange={e => setPhone(e.target.value)}
          className="admin-search-input" style={{ width: '100%' }} />
      </div>
      <div className="form-field">
        <label>Role *</label>
        <select value={role} onChange={e => setRole(e.target.value as ContactRole)}
          className="admin-filter-select" style={{ width: '100%' }}>
          {CONTACT_ROLES.map(r => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
        </select>
      </div>
      <div className="form-field">
        <label>Department</label>
        <input type="text" value={dept} onChange={e => setDept(e.target.value)}
          className="admin-search-input" style={{ width: '100%' }} />
      </div>
      <div className="form-field" style={{ display: 'flex', gap: '16px' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <input type="checkbox" checked={isPrimary} onChange={e => setIsPrimary(e.target.checked)} />
          Primary Contact
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <input type="checkbox" checked={feedbackInvite} onChange={e => setFeedbackInvite(e.target.checked)} />
          Feedback Invite
        </label>
      </div>
      <div className="form-field">
        <label>Notes</label>
        <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
          style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }} />
      </div>
      <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '16px' }}>
        <button className="admin-btn-sm admin-btn-outline" onClick={onClose} disabled={submitting}>Cancel</button>
        <button className="admin-btn-primary" onClick={handleSubmit} disabled={submitting}>
          {submitting ? 'Saving...' : isEdit ? 'Update' : 'Add Contact'}
        </button>
      </div>
    </Modal>
  );
}
