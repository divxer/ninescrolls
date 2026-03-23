import { useState, useRef, useEffect } from 'react';
import { Modal } from './Modal';
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
        className="p-2.5 rounded-lg hover:bg-surface-container-low transition-colors bg-transparent border-none cursor-pointer"
        onClick={() => setOpen(!open)}
        aria-label="Contact actions"
      >
        <span className="material-symbols-outlined text-on-surface-variant">more_vert</span>
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-1 bg-surface-container-lowest rounded-xl shadow-[0px_10px_30px_rgba(2,36,72,0.12)] py-1.5 z-50 min-w-[160px]">
            <button
              className="w-full text-left px-4 py-2.5 text-xs font-medium text-on-surface bg-transparent hover:bg-surface-container-low transition-colors flex items-center gap-3 border-none"
              onClick={() => { setOpen(false); onEdit(); }}
            >
              <span className="material-symbols-outlined text-sm">edit</span>
              Edit
            </button>
            <button
              className="w-full text-left px-4 py-2.5 text-xs font-medium text-error bg-transparent hover:bg-error-container/30 transition-colors flex items-center gap-3 border-none"
              onClick={() => { setOpen(false); onRemove(); }}
            >
              <span className="material-symbols-outlined text-sm">delete</span>
              Remove
            </button>
          </div>
        </>
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
    <div className="bg-surface-container-lowest rounded-xl border border-outline-variant/10">
      {/* Header bar */}
      <div className="p-6 bg-surface-container-low flex justify-between items-center">
        <h3 className="text-sm font-bold tracking-wider text-primary uppercase">Stakeholders</h3>
        <button
          className="text-primary hover:bg-white p-1.5 rounded-lg transition-colors bg-transparent border-none cursor-pointer"
          onClick={() => setShowAdd(true)}
        >
          <span className="material-symbols-outlined text-xl">add</span>
        </button>
      </div>

      {contacts.length === 0 ? (
        <p className="text-sm text-on-surface-variant p-6">No contacts.</p>
      ) : (
        <div className="divide-y divide-outline-variant/10">
          {contacts.map(contact => (
            <div key={contact.contactId} className="p-4 hover:bg-surface-container-low transition-colors group">
              <div className="flex items-center gap-3">
                {/* Avatar */}
                <div className="w-10 h-10 rounded bg-primary-fixed flex items-center justify-center text-primary font-bold flex-shrink-0">
                  {getInitials(contact.contactName)}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-on-surface truncate">{contact.contactName}</p>
                  <p className="text-[10px] font-bold uppercase tracking-tight mt-0.5">
                    {contact.isPrimary && <span className="text-secondary">Primary </span>}
                    <span className="text-on-tertiary-fixed-variant">{ROLE_LABELS[contact.role as ContactRole] || contact.role}</span>
                  </p>
                </div>

                {/* Actions */}
                <ContactMenu
                  onEdit={() => setEditingId(contact.contactId)}
                  onRemove={() => handleRemove(contact.contactId, contact.contactName)}
                />
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

  const inputClass = "w-full bg-surface-container-low border-transparent focus:border-primary focus:ring-0 rounded-lg text-sm px-4 py-2.5 text-on-surface placeholder:text-outline-variant transition-all";
  const labelClass = "text-[11px] font-semibold uppercase tracking-widest text-on-surface-variant font-label";

  return (
    <Modal
      open
      onClose={onClose}
      title={isEdit ? 'Edit Contact' : 'Add Contact'}
      subtitle={isEdit ? 'Update contact information.' : 'Register a new contact or department representative.'}
      footer={
        <>
          <button
            className="flex-1 sm:flex-none px-8 py-2.5 bg-secondary text-on-secondary font-semibold text-sm rounded-lg hover:bg-secondary-container transition-all active:scale-[0.98] disabled:opacity-50"
            onClick={handleSubmit}
            disabled={submitting}
          >
            {submitting ? 'Saving...' : isEdit ? 'Update Contact' : 'Add Contact'}
          </button>
          <button
            className="flex-1 sm:flex-none px-8 py-2.5 bg-transparent border border-outline-variant text-on-surface-variant font-semibold text-sm rounded-lg hover:bg-surface-variant/20 hover:text-on-surface transition-all active:scale-[0.98]"
            onClick={onClose}
            disabled={submitting}
          >
            Cancel
          </button>
        </>
      }
    >
      {error && (
        <div className="bg-error-container text-on-error-container p-3 rounded-lg text-sm mb-4">
          {error}
        </div>
      )}

      <form className="space-y-5">
        {/* Full Name */}
        <div className="space-y-1.5">
          <label className={labelClass}>Full Name *</label>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="e.g. Dr. Helena Richards"
            className={inputClass}
          />
        </div>

        {/* Email & Phone */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className={labelClass}>Email Address *</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="h.richards@lab.com"
              className={inputClass}
            />
          </div>
          <div className="space-y-1.5">
            <label className={labelClass}>Phone Number</label>
            <input
              type="tel"
              value={phone}
              onChange={e => setPhone(e.target.value)}
              placeholder="+1 (555) 000-0000"
              className={inputClass}
            />
          </div>
        </div>

        {/* Role & Department */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className={labelClass}>Role *</label>
            <select
              value={role}
              onChange={e => setRole(e.target.value as ContactRole)}
              className={`${inputClass} cursor-pointer`}
            >
              {CONTACT_ROLES.map(r => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
            </select>
          </div>
          <div className="space-y-1.5">
            <label className={labelClass}>Department</label>
            <input
              type="text"
              value={dept}
              onChange={e => setDept(e.target.value)}
              placeholder="e.g. Nanofabrication"
              className={inputClass}
            />
          </div>
        </div>

        {/* Notes */}
        <div className="space-y-1.5">
          <label className={labelClass}>Internal Notes</label>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            rows={3}
            placeholder="Additional context regarding contact authority..."
            className={`${inputClass} resize-none`}
          />
        </div>

        {/* Checkboxes */}
        <div className="flex items-center gap-6 pt-2">
          <label className="flex items-center gap-2 text-xs text-on-surface-variant cursor-pointer select-none">
            <input
              type="checkbox"
              checked={isPrimary}
              onChange={e => setIsPrimary(e.target.checked)}
              className="w-4 h-4 rounded-sm border-outline-variant bg-surface-container-low text-secondary focus:ring-secondary/20 transition-all cursor-pointer"
            />
            Primary Contact
          </label>
          <label className="flex items-center gap-2 text-xs text-on-surface-variant cursor-pointer select-none">
            <input
              type="checkbox"
              checked={feedbackInvite}
              onChange={e => setFeedbackInvite(e.target.checked)}
              className="w-4 h-4 rounded-sm border-outline-variant bg-surface-container-low text-secondary focus:ring-secondary/20 transition-all cursor-pointer"
            />
            Send feedback invitation email
          </label>
        </div>
      </form>
    </Modal>
  );
}
