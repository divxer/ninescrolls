import {
  ATTESTATION_CONFIRMED,
  PARTNER_BADGE_ASSETS,
  getPartnerBannerText,
} from '../../data/probeStations/semishare';

export function PartnerAttestationBanner() {
  return (
    <div className="rounded-xl border border-sky-200 bg-sky-50 px-6 py-4">
      <p className="m-0 text-sm font-semibold text-slate-900">
        {getPartnerBannerText(ATTESTATION_CONFIRMED)}
      </p>
      {ATTESTATION_CONFIRMED && PARTNER_BADGE_ASSETS.length > 0 && (
        <div className="mt-3 flex items-center gap-4">
          {PARTNER_BADGE_ASSETS.map((badge) => (
            <img key={badge.src} src={badge.src} alt={badge.alt} className="h-10 w-auto" />
          ))}
        </div>
      )}
    </div>
  );
}
