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
    <div className="admin-stats-bar">
      {stats.map((stat) => (
        <div key={stat.label} className="admin-stat-card">
          <div className="admin-stat-value" style={stat.color ? { color: stat.color } : undefined}>
            {stat.value}
          </div>
          <div className="admin-stat-label">{stat.label}</div>
        </div>
      ))}
    </div>
  );
}
