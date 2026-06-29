import { useState, useMemo, useCallback } from 'react';
import {
  ComposableMap,
  Geographies,
  Geography,
  Marker,
  ZoomableGroup,
} from 'react-simple-maps';
import type { OrganizationRecord } from '../types';
import { GEO_URL } from '../constants';
import { tierColor } from '../format';

export function VisitorMap({
  organizations,
  onSelectOrg,
  resetKey,
}: {
  organizations: OrganizationRecord[];
  onSelectOrg: (org: OrganizationRecord) => void;
  resetKey: string;
}) {
  const [tooltip, setTooltip] = useState<OrganizationRecord | null>(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });

  const markers = useMemo(
    () => organizations.filter((o) => o.latitude != null && o.longitude != null),
    [organizations]
  );

  const handleMouseEnter = useCallback((org: OrganizationRecord, e: React.MouseEvent) => {
    setTooltip(org);
    setTooltipPos({ x: e.clientX, y: e.clientY });
  }, []);

  const handleMouseLeave = useCallback(() => {
    setTooltip(null);
  }, []);

  if (markers.length === 0) {
    return (
      <section className="bg-surface-container-lowest p-8 rounded-xl border border-outline-variant/10">
        <div className="flex justify-between items-center mb-6">
          <h4 className="font-headline font-bold">Visitor Map</h4>
          <span className="text-xs font-medium text-on-surface-variant uppercase tracking-widest">Geographic Density</span>
        </div>
        <div className="text-center py-12 text-on-surface-variant">
          No geo-coordinates available yet. New events will appear on the map.
        </div>
      </section>
    );
  }

  return (
    <section className="bg-surface-container-lowest p-8 rounded-xl border border-outline-variant/10">
      <div className="flex justify-between items-center mb-6">
        <h4 className="font-headline font-bold">Visitor Map</h4>
        <span className="text-xs font-medium text-on-surface-variant uppercase tracking-widest">Geographic Density</span>
      </div>
      <ComposableMap
        projectionConfig={{ rotate: [-10, 0, 0], scale: 147 }}
        style={{ width: '100%', height: 'auto' }}
      >
        <ZoomableGroup key={resetKey}>
          <Geographies geography={GEO_URL}>
            {({ geographies }) =>
              geographies.map((geo) => (
                <Geography
                  key={geo.rsmKey}
                  geography={geo}
                  fill="#e8eaed"
                  stroke="#fff"
                  strokeWidth={0.5}
                  style={{
                    default: { outline: 'none' },
                    hover: { fill: '#d5d8dc', outline: 'none' },
                    pressed: { outline: 'none' },
                  }}
                />
              ))
            }
          </Geographies>
          {markers.map((org) => (
            <Marker
              key={org.key}
              coordinates={[org.longitude!, org.latitude!]}
              onMouseEnter={(e) => handleMouseEnter(org, e as unknown as React.MouseEvent)}
              onMouseLeave={handleMouseLeave}
              onClick={() => onSelectOrg(org)}
            >
              <circle
                r={Math.max(4, Math.min(12, org.totalEvents * 1.5))}
                fill={tierColor(org.leadTier)}
                fillOpacity={0.7}
                stroke="#fff"
                strokeWidth={1}
                style={{ cursor: 'pointer' }}
              />
            </Marker>
          ))}
        </ZoomableGroup>
      </ComposableMap>
      {tooltip && (
        <div
          className="bg-surface-container-lowest rounded-lg shadow-lg p-3 text-xs fixed z-50 pointer-events-none"
          style={{ left: tooltipPos.x + 12, top: tooltipPos.y - 40 }}
        >
          <strong>{tooltip.orgName}</strong>
          <div>
            {[tooltip.city, tooltip.region, tooltip.country].filter(Boolean).join(', ')}
          </div>
          {tooltip.leadTier && <div>Lead Tier: {tooltip.leadTier}</div>}
          <div>{tooltip.totalEvents} events</div>
          {tooltip.isTargetCustomer && <div className="text-secondary font-bold text-[10px] uppercase mt-1">Target Customer</div>}
        </div>
      )}
    </section>
  );
}
