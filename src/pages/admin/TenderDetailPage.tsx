import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useTender } from '../../hooks/useTender';
import { TenderHeaderPanel } from '../../components/admin/TenderHeaderPanel';
import { TenderMatchCard } from '../../components/admin/TenderMatchCard';
import { TenderAuditLog } from '../../components/admin/TenderAuditLog';
import * as svc from '../../services/tenderAdminService';
import { notify } from '../../lib/notify';

export function TenderDetailPage() {
    const { tenderId } = useParams<{ tenderId: string }>();
    const { data, loading, error, refresh } = useTender(tenderId);
    const [translating, setTranslating] = useState(false);
    const [showFullDesc, setShowFullDesc] = useState(false);

    if (loading) return <div className="text-sm text-on-surface-variant p-6">Loading tender…</div>;
    if (error) return <div className="bg-error-container text-on-error-container p-4 rounded-lg">{error.message}</div>;
    if (!data) return <div className="text-sm text-on-surface-variant p-6">Tender not found. <Link to="/admin/tenders" className="text-primary hover:underline">← Back</Link></div>;

    const t = data.tender;
    const description = t.description ?? '';
    const showCollapsedDesc = description.length > 500 && !showFullDesc;
    const langTag = t.language && t.language !== 'en' ? ` (original: ${t.language})` : '';

    async function translate() {
        if (!tenderId) return;
        setTranslating(true);
        try {
            await svc.translateTenderDescription(tenderId);
            notify.success('Translation cached');
            refresh();
        } catch (err: any) {
            notify.error(String(err?.message ?? err));
        } finally {
            setTranslating(false);
        }
    }

    return (
        <div>
            <Link to="/admin/tenders" className="text-xs text-primary hover:underline">← Back to tenders</Link>
            <div className="mt-4 grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-4">
                <TenderHeaderPanel tender={t} onUpdated={refresh} />
                <main className="space-y-4">
                    <section className="bg-surface-container-lowest rounded-xl border border-outline-variant/30 p-4">
                        <h3 className="font-headline text-base font-bold text-on-surface mb-2">Description{langTag}</h3>
                        <p className="text-sm text-on-surface whitespace-pre-wrap">
                            {showCollapsedDesc ? description.slice(0, 200) + '…' : description}
                        </p>
                        {description.length > 500 && (
                            <button onClick={() => setShowFullDesc(!showFullDesc)} className="mt-2 text-xs text-primary hover:underline">
                                {showFullDesc ? 'Show less' : 'Show more'}
                            </button>
                        )}
                        {t.language && t.language !== 'en' && (
                            <div className="mt-3 pt-3 border-t border-outline-variant/30">
                                <button onClick={translate} disabled={translating} className="text-xs text-primary hover:underline disabled:opacity-50">
                                    {translating ? 'Translating…' : t.descriptionEn ? 'Retranslate' : 'Translate to English'}
                                </button>
                                {t.descriptionEn && (
                                    <div className="mt-2 text-sm text-on-surface italic whitespace-pre-wrap">
                                        <p className="text-[10px] text-on-surface-variant mb-1">Translation (machine, may contain errors)</p>
                                        {t.descriptionEn}
                                    </div>
                                )}
                            </div>
                        )}
                    </section>

                    <section className="bg-surface-container-lowest rounded-xl border border-outline-variant/30 p-4">
                        <h3 className="font-headline text-base font-bold text-on-surface mb-2">Product matches ({data.matches.length})</h3>
                        {data.matches.length === 0
                            ? <p className="text-xs text-on-surface-variant">No product matches recorded.</p>
                            : data.matches.map((m: any) => <TenderMatchCard key={m.productSlug} match={m} />)}
                    </section>

                    <section className="bg-surface-container-lowest rounded-xl border border-outline-variant/30 p-4">
                        <h3 className="font-headline text-base font-bold text-on-surface mb-2">Audit log</h3>
                        <TenderAuditLog log={data.log ?? []} />
                    </section>
                </main>
            </div>
        </div>
    );
}
