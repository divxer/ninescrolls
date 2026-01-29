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
  logoImagePath = '/assets/images/partners/university-logos.png',
  logoImageAlt = 'Trusted by leading universities and research institutions'
}: TrustSectionProps) {
  return (
    <>
      {/* Trusted in Academic & Industrial Research Section */}
      <section className="trust-quantified-section" style={{ padding: '5rem 0', backgroundColor: '#ffffff' }}>
        <div className="container">
          <h2 className="section-title" style={{ textAlign: 'center', marginBottom: '1.5rem', fontSize: '2rem', fontWeight: '700', color: '#1f2937' }}>
            Trusted in Academic & Industrial Research
          </h2>
          
          <p style={{ 
            textAlign: 'center', 
            maxWidth: '900px', 
            margin: '0 auto', 
            fontSize: '1.2rem', 
            color: '#1f2937', 
            lineHeight: '1.8',
            fontWeight: '500'
          }}>
            Our plasma systems have been deployed in{' '}
            <strong style={{ color: '#2563eb', fontSize: '1.3rem', fontWeight: '700' }}>
              {deploymentCount}+
            </strong>{' '}
            {deploymentText},
            supporting materials science, microelectronics, and advanced surface engineering research.
          </p>
        </div>
      </section>

      {/* Why Research Teams Choose Our Plasma Systems */}
      <section className="research-trust-section" style={{ padding: '5rem 0', backgroundColor: '#f8f9fa' }}>
        <div className="container">
          <h2 className="section-title" style={{ textAlign: 'center', marginBottom: '3rem', fontSize: '2rem', fontWeight: '700', color: '#1f2937' }}>
            Why Research Teams Choose Our Plasma Systems
          </h2>
          
          <div style={{ 
            maxWidth: '1000px', 
            margin: '0 auto',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: '2rem'
          }}>
            <div style={{ 
              padding: '2rem', 
              backgroundColor: '#ffffff', 
              borderRadius: '12px',
              boxShadow: '0 2px 8px rgba(0,0,0,0.08)'
            }}>
              <div style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>🔬</div>
              <h3 style={{ margin: '0 0 1rem 0', fontSize: '1.3rem', fontWeight: '700', color: '#1f2937' }}>
                Research-Oriented Design
              </h3>
              <p style={{ margin: 0, fontSize: '1rem', color: '#4b5563', lineHeight: '1.6' }}>
                Designed specifically for laboratory and R&D use, with stable plasma generation, repeatable processes, and flexible parameter control.
              </p>
            </div>

            <div style={{ 
              padding: '2rem', 
              backgroundColor: '#ffffff', 
              borderRadius: '12px',
              boxShadow: '0 2px 8px rgba(0,0,0,0.08)'
            }}>
              <div style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>⚙️</div>
              <h3 style={{ margin: '0 0 1rem 0', fontSize: '1.3rem', fontWeight: '700', color: '#1f2937' }}>
                Proven System Architecture
              </h3>
              <p style={{ margin: 0, fontSize: '1rem', color: '#4b5563', lineHeight: '1.6' }}>
                RF plasma systems built on mature vacuum, RF power, and gas control platforms, ensuring long-term operational reliability.
              </p>
            </div>

            <div style={{ 
              padding: '2rem', 
              backgroundColor: '#ffffff', 
              borderRadius: '12px',
              boxShadow: '0 2px 8px rgba(0,0,0,0.08)'
            }}>
              <div style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>🧪</div>
              <h3 style={{ margin: '0 0 1rem 0', fontSize: '1.3rem', fontWeight: '700', color: '#1f2937' }}>
                Application Versatility
              </h3>
              <p style={{ margin: 0, fontSize: '1rem', color: '#4b5563', lineHeight: '1.6' }}>
                Suitable for plasma cleaning, surface activation, polymer treatment, and sample preparation prior to coating or bonding.
              </p>
            </div>

            <div style={{ 
              padding: '2rem', 
              backgroundColor: '#ffffff', 
              borderRadius: '12px',
              boxShadow: '0 2px 8px rgba(0,0,0,0.08)'
            }}>
              <div style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>🌍</div>
              <h3 style={{ margin: '0 0 1rem 0', fontSize: '1.3rem', fontWeight: '700', color: '#1f2937' }}>
                Global Research Adoption
              </h3>
              <p style={{ margin: 0, fontSize: '1rem', color: '#4b5563', lineHeight: '1.6' }}>
                Used across universities, national laboratories, and industrial R&D facilities, supporting both fundamental research and applied development.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Need Help Selecting the Right Configuration */}
      <section className="configuration-help-section" style={{ padding: '4rem 0', backgroundColor: '#ffffff' }}>
        <div className="container">
          <div style={{ maxWidth: '800px', margin: '0 auto', textAlign: 'center' }}>
            <h2 className="section-title" style={{ marginBottom: '1.5rem', fontSize: '1.8rem', fontWeight: '700', color: '#1f2937' }}>
              Need Help Selecting the Right Configuration?
            </h2>
            
            <p style={{ 
              marginBottom: '2rem', 
              fontSize: '1.1rem', 
              color: '#4b5563', 
              lineHeight: '1.7' 
            }}>
              Every research application is different.
              If you are unsure about chamber size, RF power, or gas configuration,
              our team can help evaluate suitability based on your materials and process goals.
            </p>

            <div style={{ 
              display: 'flex', 
              gap: '1rem', 
              justifyContent: 'center',
              flexWrap: 'wrap'
            }}>
              <a 
                href="/contact" 
                className="btn btn-primary"
                style={{ 
                  padding: '0.875rem 2rem',
                  fontSize: '1rem',
                  fontWeight: '600',
                  textDecoration: 'none',
                  display: 'inline-block'
                }}
              >
                Contact Us
              </a>
              <a 
                href="/contact?topic=application" 
                className="btn btn-secondary"
                style={{ 
                  padding: '0.875rem 2rem',
                  fontSize: '1rem',
                  fontWeight: '600',
                  textDecoration: 'none',
                  display: 'inline-block'
                }}
              >
                Discuss Your Application
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Designed for Research, Not Mass Production (Optional) */}
      <section className="research-focus-section" style={{ padding: '4rem 0', backgroundColor: '#f8f9fa' }}>
        <div className="container">
          <div style={{ maxWidth: '800px', margin: '0 auto', textAlign: 'center' }}>
            <h3 style={{ marginBottom: '1.5rem', fontSize: '1.5rem', fontWeight: '700', color: '#1f2937' }}>
              Designed for Research, Not Mass Production
            </h3>
            
            <p style={{ 
              margin: 0, 
              fontSize: '1.1rem', 
              color: '#4b5563', 
              lineHeight: '1.7' 
            }}>
              Our systems are engineered for precision, flexibility, and experimental repeatability,
              making them ideal for academic laboratories and R&D environments rather than high-volume manufacturing.
            </p>
          </div>
        </div>
      </section>
    </>
  );
}
