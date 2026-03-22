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

/** Dropdown menu anchored to a more_vert trigger button. */
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
    <div ref={ref} className="relative">
      <button
        className="hover:bg-surface-container-low rounded-full p-1 transition-colors"
        onClick={() => setOpen(!open)}
        aria-label="Contact actions"
      >
        <span className="material-symbols-outlined text-on-surface-variant text-lg">more_vert</span>
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 bg-surface-container-lowest rounded-lg shadow-elevated border border-outline-variant/10 py-1 z-20 min-w-[120px]">
          <button
            className="w-full text-left px-4 py-2 text-xs font-medium text-on-surface hover:bg-surface-container-low transition-colors"
            onClick={() => { setOpen(false); onEdit(); }}
          >
            Edit
          </button>
          <button
            className="w-full text-left px-4 py-2 text-xs font-medium text-error hover:bg-error-container/30 transition-colors"
            onClick={() => { setOpen(false); onRemove(); }}
          >
            Remove
          </button>
        </div>
      )}
    </div>
  );
}

function getInitials(name: string): string {
  return name
    .split(/[\s,]+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() || '')
    .join('');
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
    <div className="bg-surface-container-lowest rounded-xl p-6 shadow-card">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-on-surface-variant text-lg">groups</span>
          <h3 className="text-sm font-bold text-on-surface-variant uppercase tracking-wider">
            Contacts ({contacts.length})
          </h3>
        </div>
        <button
          className="text-xs font-medium text-secondary hover:underline"
          onClick={() => setShowAdd(true)}
        >
          + Add Contact
        </button>
      </div>

      {contacts.length === 0 ? (
        <p className="text-sm text-on-surface-variant">No contacts.</p>
      ) : (
        <div className="space-y-4">
          {contacts.map(contact => (
            <div key={contact.contactId} className="flex items-center gap-4">
              {/* Avatar */}
              <div className="w-10 h-10 rounded-full bg-primary-fixed/30 flex items-center justify-center text-[11px] font-bold text-primary flex-shrink-0">
                {getInitials(contact.contactName)}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-on-surface truncate">
                    {contact.contactName}
                  </span>
                  {contact.isPrimary && (
                    <span className="text-[9px] font-bold uppercase tracking-wider bg-secondary/10 text-secondary px-1.5 py-0.5 rounded">
                      Primary
                    </span>
                  )}
                  <StatusBadge status={contact.role} />
                </div>
                <div className="text-[11px] text-on-surface-variant mt-0.5 space-x-2">
                  <span>{contact.contactEmail}</span>
                  {contact.contactPhone && <span>{contact.contactPhone}</span>}
                  {contact.department && <span>{contact.department}</span>}
                </div>
              </div>

              {/* Menu */}
              <ContactMenu
                onEdit={() => setEditingId(contact.contactId)}
                onRemove={() => handleRemove(contact.contactId, contact.contactName)}
              />
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
      {error && (
        <div className="bg-error-container text-on-error-container p-3 rounded-lg text-sm mb-4">
          {error}
        </div>
      )}

      <div className="space-y-4">
        <div>
          <label className="block text-[10px] font-bold text-on-surface-variant uppercase tracking-widest mb-1">
            Name *
          </label>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            className="w-full bg-surface-container-low border-none rounded-lg py-2.5 px-3 text-sm focus:ring-1 focus:ring-secondary outline-none"
          />
        </div>

        <div>
          <label className="block text-[10px] font-bold text-on-surface-variant uppercase tracking-widest mb-1">
            Email *
          </label>
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            className="w-full bg-surface-container-low border-none rounded-lg py-2.5 px-3 text-sm focus:ring-1 focus:ring-secondary outline-none"
          />
        </div>

        <div>
          <label className="block text-[10px] font-bold text-on-surface-variant uppercase tracking-widest mb-1">
            Phone
          </label>
          <input
            type="tel"
            value={phone}
            onChange={e => setPhone(e.target.value)}
            className="w-full bg-surface-container-low border-none rounded-lg py-2.5 px-3 text-sm focus:ring-1 focus:ring-secondary outline-none"
          />
        </div>

        <div>
          <label className="block text-[10px] font-bold text-on-surface-variant uppercase tracking-widest mb-1">
            Role *
          </label>
          <select
            value={role}
            onChange={e => setRole(e.target.value as ContactRole)}
            className="w-full bg-surface-container-low border-none rounded-lg py-2.5 px-3 text-sm focus:ring-1 focus:ring-secondary outline-none"
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
            value={dept}
            onChange={e => setDept(e.target.value)}
            className="w-full bg-surface-container-low border-none rounded-lg py-2.5 px-3 text-sm focus:ring-1 focus:ring-secondary outline-none"
          />
        </div>

        <div className="flex gap-6">
          <label className="flex items-center gap-2 text-sm text-on-surface cursor-pointer">
            <input
              type="checkbox"
              checked={isPrimary}
              onChange={e => setIsPrimary(e.target.checked)}
              className="rounded border-outline-variant text-secondary focus:ring-secondary"
            />
            Primary Contact
          </label>
          <label className="flex items-center gap-2 text-sm text-on-surface cursor-pointer">
            <input
              type="checkbox"
              checked={feedbackInvite}
              onChange={e => setFeedbackInvite(e.target.checked)}
              className="rounded border-outline-variant text-secondary focus:ring-secondary"
            />
            Feedback Invite
          </label>
        </div>

        <div>
          <label className="block text-[10px] font-bold text-on-surface-variant uppercase tracking-widest mb-1">
            Notes
          </label>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            rows={2}
            className="w-full bg-surface-container-low border-none rounded-lg py-2.5 px-3 text-sm focus:ring-1 focus:ring-secondary outline-none resize-none"
          />
        </div>
      </div>

      <div className="flex gap-3 justify-end mt-6">
        <button
          className="border border-outline-variant text-on-surface px-4 py-2 rounded-lg text-sm font-semibold hover:bg-surface-container-low transition-colors"
          onClick={onClose}
          disabled={submitting}
        >
          Cancel
        </button>
        <button
          className="bg-secondary text-white px-4 py-2 rounded-lg font-semibold text-sm hover:bg-secondary/90 transition-colors disabled:opacity-50"
          onClick={handleSubmit}
          disabled={submitting}
        >
          {submitting ? 'Saving...' : isEdit ? 'Update' : 'Add Contact'}
        </button>
      </div>
    </Modal>
  );
}
