interface Props {
    configs: any[];
    selectedCategory: string | null;
    onSelect: (productCategory: string) => void;
    onNew: () => void;
}

export function KeywordConfigSidebar({ configs, selectedCategory, onSelect, onNew }: Props) {
    return (
        <aside className="w-44 bg-surface-container-lowest rounded-xl border border-outline-variant/30 p-2 self-start">
            <ul className="space-y-0.5">
                {configs.map((c) => (
                    <li key={c.productCategory}>
                        <button
                            onClick={() => onSelect(c.productCategory)}
                            className={`w-full text-left px-2 py-1.5 rounded text-xs font-medium ${selectedCategory === c.productCategory ? 'bg-secondary-container text-on-secondary-container' : 'text-on-surface hover:bg-surface-container-low'} ${!c.isActive ? 'italic text-on-surface-variant' : ''}`}
                        >
                            {c.productCategory}
                            {c.productSlugs?.length > 0 && <span className="float-right text-[10px] opacity-70">{c.productSlugs.length}</span>}
                        </button>
                    </li>
                ))}
            </ul>
            <button onClick={onNew} className="w-full mt-2 px-2 py-1.5 text-xs text-primary border border-primary/30 rounded hover:bg-primary/10">+ New category</button>
        </aside>
    );
}
