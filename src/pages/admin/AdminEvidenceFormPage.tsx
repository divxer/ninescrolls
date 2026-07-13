import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { EvidenceForm, EvidenceFormValue } from '../../components/admin/EvidenceForm';
import { createEvidence, updateEvidence, getEvidence } from '../../services/evidenceAdminService';
import type { EvidenceInput, EvidenceUpdateInput } from '../../services/evidenceAdminService';

export function AdminEvidenceFormPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [initial, setInitial] = useState<EvidenceFormValue | undefined>();
  const [loading, setLoading] = useState(Boolean(id));
  const [loadError, setLoadError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    getEvidence(id)
      .then((data) => setInitial((data ?? undefined) as EvidenceFormValue | undefined))
      .catch((e) => setLoadError(e instanceof Error ? e.message : 'Failed to load evidence'))
      .finally(() => setLoading(false));
  }, [id]);

  async function handleSubmit(value: EvidenceInput | EvidenceUpdateInput) {
    setSubmitting(true);
    setSaveError(null);
    try {
      if ('id' in value && value.id) await updateEvidence(value as EvidenceUpdateInput);
      else await createEvidence(value as EvidenceInput);
      navigate('/admin/evidence');
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <p className="p-6">Loading…</p>;
  if (loadError) return <div className="p-6"><p role="alert" className="text-red-600">{loadError}</p></div>;

  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold">{id ? 'Edit evidence' : 'New evidence'}</h1>
      {saveError && <p role="alert" className="mt-2 text-red-600">{saveError}</p>}
      <div className="mt-6">
        <EvidenceForm initial={initial} submitting={submitting} onSubmit={handleSubmit} onCancel={() => navigate('/admin/evidence')} />
      </div>
    </div>
  );
}
