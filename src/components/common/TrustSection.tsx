import { cdnUrl } from '../../config/imageConfig';
import { OptimizedImage } from './OptimizedImage';

interface TrustSectionProps {
  deploymentCount?: number;
  deploymentText?: string;
  showLogos?: boolean;
  logoImagePath?: string;
  logoImageAlt?: string;
}

export function TrustSection({
  deploymentCount = 300,
  deploymentText = 'laboratories across universities, national research institutes, and industrial R&D centers',
  showLogos = false,
  logoImagePath = cdnUrl('/assets/images/partners/university-logos.png'),
  logoImageAlt = 'Trusted by leading universities and research institutions'
}: TrustSectionProps) {
  return (
    <>
      {/* Trusted in Academic & Industrial Research Section */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-6">
          <h2 className="text-center mb-6 text-3xl font-bold text-on-surface">
            Trusted in Academic & Industrial Research
          </h2>

          <p className="text-center max-w-[900px] mx-auto mb-12 text-lg text-on-surface-variant leading-relaxed">
            Our plasma surface treatment systems are widely adopted by
            leading universities, national research institutes, and industrial R&D centers
            for materials science, microelectronics, and advanced surface engineering research.
          </p>

          {/* Quantified Trust */}
          <p className="text-center max-w-[900px] mx-auto text-xl text-on-surface leading-relaxed font-medium">
            Our plasma systems have been deployed in{' '}
            <strong className="text-primary text-2xl font-bold">
              {deploymentCount}+
            </strong>{' '}
            {deploymentText},
            supporting materials science, microelectronics, and advanced surface engineering research.
          </p>

          {/* Optional Logo Display */}
          {showLogos && logoImagePath && (
            <>
              <div className="max-w-[1200px] mx-auto my-8 p-8 bg-white rounded-lg">
                <div className="w-full block mx-auto">
                  <OptimizedImage
                    src={logoImagePath}
                    alt={logoImageAlt || 'Trusted by leading universities and research institutions'}
                    width={1200}
                    height={800}
                    className="trust-logos-image"
                  />
                </div>
              </div>
              <p className="text-center text-sm text-on-surface-variant italic max-w-[800px] mx-auto">
                Logos are shown for reference only and represent institutions where similar systems have been used.
                No endorsement or formal affiliation is implied.
              </p>
            </>
          )}
        </div>
      </section>

      {/* Why Research Teams Choose Our Plasma Systems */}
      <section className="py-20 bg-surface-container-low">
        <div className="max-w-7xl mx-auto px-6">
          <h2 className="text-center mb-12 text-3xl font-bold text-on-surface">
            Why Research Teams Choose Our Plasma Systems
          </h2>

          <div className="max-w-[1000px] mx-auto grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="p-8 bg-white rounded-xl shadow-sm">
              <div className="text-4xl mb-4">
                <span className="material-symbols-outlined text-[2.5rem]">science</span>
              </div>
              <h3 className="text-xl font-bold text-on-surface mb-4">
                Research-Oriented Design
              </h3>
              <p className="text-base text-on-surface-variant leading-relaxed">
                Designed specifically for laboratory and R&D use, with stable plasma generation, repeatable processes, and flexible parameter control.
              </p>
            </div>

            <div className="p-8 bg-white rounded-xl shadow-sm">
              <div className="text-4xl mb-4">
                <span className="material-symbols-outlined text-[2.5rem]">settings</span>
              </div>
              <h3 className="text-xl font-bold text-on-surface mb-4">
                Proven System Architecture
              </h3>
              <p className="text-base text-on-surface-variant leading-relaxed">
                RF plasma systems built on mature vacuum, RF power, and gas control platforms, ensuring long-term operational reliability.
              </p>
            </div>

            <div className="p-8 bg-white rounded-xl shadow-sm">
              <div className="text-4xl mb-4">
                <span className="material-symbols-outlined text-[2.5rem]">biotech</span>
              </div>
              <h3 className="text-xl font-bold text-on-surface mb-4">
                Application Versatility
              </h3>
              <p className="text-base text-on-surface-variant leading-relaxed">
                Suitable for plasma cleaning, surface activation, polymer treatment, and sample preparation prior to coating or bonding.
              </p>
            </div>

            <div className="p-8 bg-white rounded-xl shadow-sm">
              <div className="text-4xl mb-4">
                <span className="material-symbols-outlined text-[2.5rem]">public</span>
              </div>
              <h3 className="text-xl font-bold text-on-surface mb-4">
                Global Research Adoption
              </h3>
              <p className="text-base text-on-surface-variant leading-relaxed">
                Used across universities, national laboratories, and industrial R&D facilities, supporting both fundamental research and applied development.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Need Help Selecting the Right Configuration */}
      <section className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-6">
          <div className="max-w-[800px] mx-auto text-center">
            <h2 className="text-center mb-6 text-3xl font-bold text-on-surface">
              Need Help Selecting the Right Configuration?
            </h2>

            <p className="mb-8 text-lg text-on-surface-variant leading-relaxed">
              Every research application is different.
              If you are unsure about chamber size, RF power, or gas configuration,
              our team can help evaluate suitability based on your materials and process goals.
            </p>

            <div className="flex gap-4 justify-center flex-wrap">
              <a
                href="/contact"
                className="inline-flex items-center px-8 py-3.5 rounded-lg font-semibold bg-primary text-white hover:bg-primary-container transition-all no-underline"
              >
                Contact Us
              </a>
              <a
                href="/contact?topic=application"
                className="inline-flex items-center px-8 py-3.5 rounded-lg font-semibold bg-white text-slate-600 border border-slate-300 hover:bg-slate-50 transition-all no-underline"
              >
                Discuss Your Application
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Designed for Research, Not Mass Production (Optional) */}
      <section className="py-16 bg-surface-container-low">
        <div className="max-w-7xl mx-auto px-6">
          <div className="max-w-[800px] mx-auto text-center">
            <h3 className="mb-6 text-2xl font-bold text-on-surface">
              Designed for Research, Not Mass Production
            </h3>

            <p className="text-lg text-on-surface-variant leading-relaxed">
              Our systems are engineered for precision, flexibility, and experimental repeatability,
              making them ideal for academic laboratories and R&D environments rather than high-volume manufacturing.
            </p>
          </div>
        </div>
      </section>
    </>
  );
}
