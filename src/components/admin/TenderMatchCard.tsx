import { Link } from 'react-router-dom';

interface Props {
    match: any;
}

export function TenderMatchCard({ match }: Props) {
    return (
        <div className="bg-surface-container-lowest rounded-lg border border-outline-variant/30 p-3 mb-2">
            <div className="flex items-center justify-between">
                <Link to={`/products/${match.productSlug}`} target="_blank" className="text-sm font-medium text-primary hover:underline">
                    {match.productSlug}
                </Link>
                <span className="text-sm font-bold text-on-surface">{match.score}/100</span>
            </div>
            {match.reasoning && (
                <p className="mt-1 text-xs italic text-on-surface-variant">"{match.reasoning}"</p>
            )}
            {match.matchedKeywords?.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                    {match.matchedKeywords.map((k: string) => (
                        <span key={k} className="px-2 py-0.5 text-[10px] rounded-full bg-secondary-container text-on-secondary-container">{k}</span>
                    ))}
                </div>
            )}
        </div>
    );
}
