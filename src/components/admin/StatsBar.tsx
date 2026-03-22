interface StatCard {
  label: string;
  value: number | string;
  color?: string;
}

interface StatsBarProps {
  stats: StatCard[];
}

export function StatsBar({ stats }: StatsBarProps) {
  return (
    <div className={`grid grid-cols-2 md:grid-cols-4 lg:grid-cols-${stats.length} gap-4`}>
      {stats.map((stat) => (
        <div
          key={stat.label}
          className="bg-surface-container-lowest p-5 rounded-xl border border-outline-variant/5 shadow-card"
        >
          <p className="text-on-surface-variant text-[10px] font-bold uppercase tracking-widest mb-1">
            {stat.label}
          </p>
          <h3
            className="font-headline text-2xl font-bold text-on-surface"
            style={stat.color ? { color: stat.color } : undefined}
          >
            {stat.value}
          </h3>
        </div>
      ))}
    </div>
  );
}
