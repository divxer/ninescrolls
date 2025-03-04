import { BrowserRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom'
import { useState, useRef } from 'react'
import config from './config'

function Layout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  
  return (
    <>
      <header className="main-header">
        <nav className="nav-container">
          <div className="logo">
            <Link to="/">
              <img src="/assets/images/logo.svg" alt="NineScrolls LLC" className="logo-img" />
              <span className="logo-text">NineScrolls LLC</span>
            </Link>
          </div>
          <ul className="nav-links">
            <li><Link to="/" className={`nav-link ${location.pathname === '/' ? 'active' : ''}`}>Home</Link></li>
            <li><Link to="/about" className={`nav-link ${location.pathname === '/about' ? 'active' : ''}`}>About Us</Link></li>
            <li><Link to="/products" className={`nav-link ${location.pathname === '/products' ? 'active' : ''}`}>Products</Link></li>
            <li><a href="#research" className="nav-link">Research & Development</a></li>
            <li><a href="#contact" className="nav-link">Contact Us</a></li>
          </ul>
        </nav>
      </header>
      <main>
        {children}
      </main>
      <footer className="main-footer" id="contact">
        <div className="container">
          <div className="footer-content">
            <div className="footer-section">
              <h4>Contact Us</h4>
              <p>Email: info@ninescrolls.com</p>
              <p>Phone: +1 (858) 537-7743</p>
            </div>
            <div className="footer-section">
              <h4>Follow Us</h4>
              <div className="social-links">
                <a href="https://linkedin.com/company/ninescrolls" className="social-link" target="_blank" rel="noopener noreferrer">LinkedIn</a>
                <a href="https://twitter.com/ninescrolls" className="social-link" target="_blank" rel="noopener noreferrer">Twitter</a>
              </div>
            </div>
          </div>
          <div className="footer-bottom">
            <p>&copy; 2025 NineScrolls LLC. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </>
  )
}

function HomePage() {
  return (
    <>
      <section className="hero">
        <div className="hero-content">
          <h1>Innovating the Future of Scientific Research</h1>
          <p>Advanced scientific equipment for the next generation of discovery</p>
          <div className="cta-buttons">
            <Link to="/products" className="btn btn-primary">Explore Our Products</Link>
            <Link to="/about" className="btn btn-secondary">Learn More About Us</Link>
          </div>
        </div>
      </section>

      <section className="products" id="products">
        <div className="container">
          <h2>Our Products</h2>
          <h3>Precision Instruments for Every Research Need</h3>
          <div className="product-grid">
            <div className="product-card">
              <Link to="/products/rie-etcher">
                <img src="/assets/images/products/rie-etcher/main.jpg" alt="RIE Etcher Series" />
                <h4>RIE Etcher Series</h4>
                <p>High-precision reactive ion etching systems for semiconductor processing</p>
              </Link>
            </div>
            <div className="product-card">
              <Link to="/products/icp-etcher">
                <img src="/assets/images/products/icp-etcher/main.jpg" alt="ICP Etcher Series" />
                <h4>ICP Etcher Series</h4>
                <p>Advanced inductively coupled plasma etching solutions</p>
              </Link>
            </div>
          </div>
          <Link to="/products" className="btn btn-primary">View All Products</Link>
        </div>
      </section>

      <section className="technologies" id="technologies">
        <div className="container">
          <h2>Cutting-Edge Technologies</h2>
          <div className="tech-grid">
            <div className="tech-card">
              <img src="/assets/images/icons/precision.svg" alt="Precision Engineering" className="tech-icon" />
              <h4>Precision Engineering</h4>
              <p>Advanced manufacturing techniques ensuring nanometer-scale accuracy</p>
            </div>
            <div className="tech-card">
              <img src="/assets/images/icons/automation.svg" alt="Automation Systems" className="tech-icon" />
              <h4>Automation Systems</h4>
              <p>Intelligent control systems for reproducible results</p>
            </div>
            <div className="tech-card">
              <img src="/assets/images/icons/plasma.svg" alt="Plasma Technology" className="tech-icon" />
              <h4>Plasma Technology</h4>
              <p>State-of-the-art plasma processing solutions</p>
            </div>
          </div>
        </div>
      </section>

      <section className="research" id="research">
        <div className="container">
          <h2>Driving Innovation Through R&D</h2>
          <div className="research-content">
            <p>At NineScrolls, our commitment to research and development drives everything we do. We continuously push the boundaries of what's possible in semiconductor processing technology, investing heavily in innovative solutions that address the most challenging requirements in the industry.</p>
            <p>Our dedicated R&D team works closely with leading research institutions to develop next-generation equipment that sets new standards in precision, reliability, and performance.</p>
            <a href="#research" className="btn btn-primary">Discover Our R&D</a>
          </div>
        </div>
      </section>

      <section className="testimonials" id="testimonials">
        <div className="container">
          <h2>Trusted by Leading Institutions</h2>
          <div className="partner-logos">
            <img src="/assets/images/partners/university.svg" alt="University Partner" className="partner-logo" />
            <img src="/assets/images/partners/research-lab.svg" alt="Research Lab Partner" className="partner-logo" />
            <img src="/assets/images/partners/institute.svg" alt="Institute Partner" className="partner-logo" />
          </div>
          <div className="testimonial-carousel">
            <div className="testimonial-card">
              <p>"NineScrolls' etching systems have significantly advanced our research capabilities in semiconductor device fabrication."</p>
              <div className="testimonial-author">
                <h4>Dr. Sarah Chen</h4>
                <p>Principal Investigator, Advanced Materials Research</p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  )
}

function AboutPage() {
  return (
    <>
      <section className="about-hero">
        <div className="container">
          <h1>About NineScrolls LLC</h1>
          <p>Leading Innovation in Scientific Research Equipment</p>
        </div>
      </section>

      <section className="story">
        <div className="container">
          <h2>Our Story</h2>
          <div className="story-content">
            <p>NineScrolls LLC is a dynamic start-up company dedicated to advancing innovation and integration in the scientific research equipment industry. Our primary focus is on establishing a comprehensive platform that connects manufacturers, researchers, and industry professionals across the United States.</p>
            <p>By fostering collaboration and streamlining access to cutting-edge laboratory equipment, we aim to empower scientific discovery and drive technological advancements. At NineScrolls LLC, we are committed to delivering tailored solutions and creating value for our partners and clients through expertise, efficiency, and innovation.</p>
          </div>
        </div>
      </section>

      <section className="values">
        <div className="container">
          <h2>Our Core Values and Mission</h2>
          <div className="values-grid">
            <div className="value-card">
              <h3>Integration</h3>
              <p>We create seamless connections between manufacturers, researchers, and industry professionals to advance scientific discovery.</p>
            </div>
            <div className="value-card">
              <h3>Innovation</h3>
              <p>We drive advancement in the scientific equipment industry through innovative solutions and platforms.</p>
            </div>
            <div className="value-card">
              <h3>Collaboration</h3>
              <p>We foster partnerships and facilitate connections across the scientific community to accelerate progress.</p>
            </div>
            <div className="value-card">
              <h3>Expertise</h3>
              <p>We leverage deep industry knowledge to deliver tailored solutions that create value for our partners and clients.</p>
            </div>
          </div>
        </div>
      </section>
    </>
  )
}

function ProductsPage() {
  return (
    <>
      <section className="products-hero">
        <div className="container">
          <h1>Our Products</h1>
          <p>Connecting You with Advanced Research Equipment Solutions</p>
        </div>
      </section>

      <section className="product-categories">
        <div className="container">
          <h2>Featured Equipment</h2>
          <p className="section-intro">We partner with leading manufacturers to provide cutting-edge research equipment for your specific needs.</p>
          <div className="category-grid">
            <div className="category-card">
              <Link to="/products/rie-etcher">
                <img src="/assets/images/products/rie-etcher/main.jpg" alt="RIE Etcher Series" />
                <h3>RIE Etcher Series</h3>
                <p>High-precision reactive ion etching systems for semiconductor processing, featuring advanced plasma control and process monitoring.</p>
                <ul className="product-features">
                  <li>Compact 1.0m × 1.0m footprint</li>
                  <li>4-12 inch wafer compatibility</li>
                  <li>Customizable configurations</li>
                  <li>Comprehensive process support</li>
                </ul>
              </Link>
            </div>

            <div className="category-card">
              <Link to="/products/icp-etcher">
                <img src="/assets/images/products/icp-etcher/main.jpg" alt="ICP Etcher Series" />
                <h3>ICP Etcher Series</h3>
                <p>Advanced inductively coupled plasma etching solutions designed for high-aspect-ratio etching and superior uniformity.</p>
                <ul className="product-features">
                  <li>High-power plasma source (1000-3000W)</li>
                  <li>Temperature-controlled components</li>
                  <li>Ion damage-free processing option</li>
                  <li>Specialized process design kits</li>
                </ul>
              </Link>
            </div>

            <div className="category-card">
              <Link to="/products/pecvd">
                <img src="/assets/images/products/pecvd/main.jpg" alt="PECVD Systems" />
                <h3>PECVD Systems</h3>
                <p>Plasma-enhanced chemical vapor deposition systems for high-quality thin film deposition.</p>
                <ul className="product-features">
                  <li>Uniform film deposition</li>
                  <li>Multi-layer capability</li>
                  <li>Temperature control</li>
                  <li>Process automation</li>
                </ul>
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="equipment-solutions">
        <div className="container">
          <h2>Our Equipment Solutions</h2>
          <div className="solutions-content">
            <p>At NineScrolls LLC, we understand that every research project has unique requirements. We work closely with manufacturers and researchers to:</p>
            <ul className="solutions-list">
              <li>Identify the most suitable equipment for your specific needs</li>
              <li>Facilitate equipment customization and integration</li>
              <li>Provide comprehensive technical support and documentation</li>
              <li>Ensure optimal performance and reliability</li>
            </ul>
          </div>
        </div>
      </section>

      <section className="product-contact">
        <div className="container">
          <h2>Need Equipment Consultation?</h2>
          <p>Our team of experts is ready to help you find the perfect research equipment solution.</p>
          <div className="contact-buttons">
            <a href="#contact" className="btn btn-primary">Contact Our Team</a>
            <a href="#" className="btn btn-secondary">Download Equipment Guide</a>
          </div>
        </div>
      </section>
    </>
  )
}

interface ContactFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  productName: string;
}

function ContactFormModal({ isOpen, onClose, productName }: ContactFormModalProps) {
  const [isSuccess, setIsSuccess] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);
    setIsSuccess(false);

    // Validate message field
    const messageInput = formRef.current?.querySelector('textarea[name="message"]') as HTMLTextAreaElement;
    const message = messageInput?.value || '';
    if (!message.trim()) {
        setError('Message is required');
        setIsSubmitting(false);
        return;
    }

    try {
        console.log('Starting form submission...');
        const formData = new FormData(e.target as HTMLFormElement);
        const data = {
            productName: formData.get('productName') || '',
            name: formData.get('name') || '',
            email: formData.get('email') || '',
            phone: formData.get('phone') || '',
            organization: formData.get('organization') || '',
            message: message || '',
        };
        console.log('Form data:', data);
        console.log('Using API URL:', config.apiUrl);
        
        const response = await fetch(config.apiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(data),
        });

        console.log('Response received:', {
            status: response.status,
            statusText: response.statusText,
            headers: Object.fromEntries(response.headers.entries()),
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('Error response:', errorText);
            throw new Error(errorText || 'Failed to send message');
        }

        const result = await response.json();
        console.log('Success response:', result);

        // Show success message but don't close the form
        setIsSuccess(true);
        // Reset form fields
        if (formRef.current) {
            formRef.current.reset();
        }
    } catch (err) {
        console.error('Error submitting form:', err);
        setError(err instanceof Error ? err.message : 'Failed to send message');
    } finally {
        setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setIsSuccess(false);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="modal" data-open={isOpen} onClick={handleClose}>
      <div className="modal-content" role="dialog" aria-labelledby="modalTitle" onClick={e => e.stopPropagation()}>
        <span className="close-button" aria-label="Close" onClick={handleClose}>&times;</span>
        {!isSuccess ? (
          <>
            <h2 id="modalTitle">Request Product Information</h2>
            <p className="modal-subtitle">Please fill out the form below and we'll get back to you shortly.</p>
            {error && <div className="error-message">{error}</div>}
            <form id="contactForm" onSubmit={handleSubmit} ref={formRef}>
              <div className="form-group">
                <label htmlFor="productName">Product:</label>
                <input type="text" id="productName" name="productName" value={productName} readOnly className="form-control-readonly" />
              </div>
              <div className="form-group">
                <label htmlFor="name">Name</label>
                <input type="text" id="name" name="name" required placeholder="Enter your full name" autoComplete="name" />
              </div>
              <div className="form-group">
                <label htmlFor="email">Email</label>
                <input type="email" id="email" name="email" required placeholder="Enter your email address" autoComplete="email" />
              </div>
              <div className="form-group">
                <label htmlFor="phone">Phone:</label>
                <input type="tel" id="phone" name="phone" pattern="[0-9+\-\s()]*" placeholder="Optional: Enter your phone number" autoComplete="tel" />
              </div>
              <div className="form-group">
                <label htmlFor="organization">Organization:</label>
                <input type="text" id="organization" name="organization" placeholder="Optional: Enter your organization name" autoComplete="organization" />
              </div>
              <div className="form-group">
                <label htmlFor="message">Message</label>
                <textarea id="message" name="message" rows={4} required placeholder="Please let us know your specific requirements or questions"></textarea>
              </div>
              <div className="form-actions">
                <button type="button" className="btn btn-secondary" onClick={handleClose}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
                  {isSubmitting ? 'Submitting...' : 'Submit Request'}
                </button>
              </div>
            </form>
          </>
        ) : (
          <div className="form-success" data-success={isSuccess}>
            <div className="success-content">
              <span className="success-icon">✓</span>
              <h3>Thank You for Your Interest!</h3>
              <p>Your request about the {productName} has been submitted successfully.</p>
              <div className="success-details">
                <p>What happens next:</p>
                <ul>
                  <li>You'll receive a confirmation email within the next few minutes</li>
                  <li>Our sales team will review your request</li>
                  <li>We'll respond with detailed information within 1 business day</li>
      </ul>
              </div>
              <div className="success-actions">
                <p>Meanwhile, you might be interested in:</p>
                <div className="action-buttons">
                  <a href="/docs/rie-2000-datasheet.pdf" className="btn btn-secondary" target="_blank" rel="noopener noreferrer">
                    <span className="icon-download"></span> Download Product Datasheet
                  </a>
                  <Link to="/products" className="btn btn-secondary">
                    <span className="icon-browse"></span> Browse Other Products
                  </Link>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function RIEEtcherPage() {
  const [isModalOpen, setIsModalOpen] = useState(false);

  const openContactForm = () => {
    setIsModalOpen(true);
    document.body.style.overflow = 'hidden';
  };

  const closeContactForm = () => {
    setIsModalOpen(false);
    document.body.style.overflow = 'auto';
  };

  return (
    <>
      <section className="product-detail-hero">
        <div className="container">
          <div className="product-header">
            <h1>RIE Etcher Series</h1>
            <p>Advanced Reactive Ion Etching System with Uni-body Design</p>
          </div>
        </div>
      </section>

      <section className="product-overview">
        <div className="container">
          <div className="product-content">
            <div className="product-images">
              <img src="/assets/images/products/rie-etcher/large.jpg" alt="RIE-2000 System" className="main-product-image" />
              <div className="image-gallery">
                <img src="/assets/images/products/rie-etcher/detail-1.jpg" alt="Chamber View" />
                <img src="/assets/images/products/rie-etcher/detail-2.jpg" alt="Control Interface" />
                <img src="/assets/images/products/rie-etcher/detail-3.jpg" alt="Process Results" />
              </div>
            </div>
            <div className="product-info">
              <h2>Product Description</h2>
              <p>The RIE-2000 Series features an innovative uni-body design with outstanding footprint efficiency (1.0m × 1.0m). The system's uniform chamber center pump-down ensures superior process performance, while the configurable showerhead gas feed-in and plasma discharge gap allow for precise parameter tuning.</p>
              
              <h3>Key Features</h3>
              <ul className="feature-list">
                <li>Uniform chamber center pump-down design</li>
                <li>Configurable showerhead gas feed-in system</li>
                <li>Adjustable plasma discharge gap</li>
                <li>Flexible cost/performance configurations</li>
                <li>Optional sample handling: Open-Load or Load-Lock</li>
                <li>Customizable RF, pump, and valve specifications</li>
              </ul>

              <h3>Applications</h3>
              <ul className="application-list">
                <li>Si-Based Materials (Si, SiO2, SiNx, SiC, Quartz)</li>
                <li>Compound Semiconductors (InP, GaN, GaAs, Ga2O3, ZnS)</li>
                <li>1D & 2D Materials (MoS2, BN, Graphene)</li>
                <li>Metals (Au, Pt, W, Ta, Mo)</li>
                <li>Failure Analysis Applications</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      <section className="detailed-specs">
        <div className="container">
          <h2>Technical Specifications</h2>
          <div className="specs-table-container">
            <table className="detailed-specs-table">
              <tbody>
                <tr>
                  <th colSpan={2}>System Specifications</th>
                </tr>
                <tr>
                  <td>Wafer Size Range</td>
                  <td>4", 6", 8", 12" or multi-wafers optional</td>
                </tr>
                <tr>
                  <td>RF Power</td>
                  <td>300-1000W, optional</td>
                </tr>
                <tr>
                  <td>Gas System</td>
                  <td>4 lines (Standard) or customized</td>
                </tr>
                <tr>
                  <td>Wafer Cooling</td>
                  <td>Water Cooling or He Backside Cooling optional</td>
                </tr>
                <tr>
                  <td>Temperature Range</td>
                  <td>-70°C to 200°C, optional</td>
                </tr>
                <tr>
                  <td>Non-Uniformity</td>
                  <td>Less than ±5% (Edge Exclusion)</td>
                </tr>
                <tr>
                  <td>Vacuum System</td>
                  <td>TMP & Mechanical Pump</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section className="process-capabilities">
        <div className="container">
          <h2>Process Capabilities</h2>
          <div className="capability-grid">
            <div className="capability-card">
              <h3>Etch Materials</h3>
              <ul>
                <li>Silicon</li>
                <li>Silicon Dioxide</li>
                <li>Silicon Nitride</li>
                <li>III-V Compounds</li>
                <li>Metals</li>
              </ul>
            </div>
            <div className="capability-card">
              <h3>Process Parameters</h3>
              <ul>
                <li>Etch Rate: 1-1000 nm/min</li>
                <li>Uniformity: ±3%</li>
                <li>Selectivity: Up to 50:1</li>
                <li>Anisotropy: &gt; 0.95</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      <section className="product-contact">
        <div className="container">
          <h2>Request Information</h2>
          <p>Contact our sales team for detailed specifications, pricing, and customization options.</p>
          <div className="contact-buttons">
            <button className="btn btn-primary" onClick={openContactForm}>Contact Sales Team</button>
            <a href="/docs/rie-2000-datasheet.pdf" className="btn btn-secondary" target="_blank" rel="noopener noreferrer">
              <span className="icon-download"></span> Download Product Datasheet
            </a>
          </div>
        </div>
      </section>

      <ContactFormModal
        isOpen={isModalOpen}
        onClose={closeContactForm}
        productName="RIE Etcher Series"
      />
    </>
  )
}

function ICPEtcherPage() {
  const [isModalOpen, setIsModalOpen] = useState(false);

  const openContactForm = () => {
    setIsModalOpen(true);
    document.body.style.overflow = 'hidden';
  };

  const closeContactForm = () => {
    setIsModalOpen(false);
    document.body.style.overflow = 'auto';
  };

  return (
    <>
      <section className="product-detail-hero">
        <div className="container">
          <div className="product-header">
            <h1>ICP Etcher Series</h1>
            <p>High-Density Plasma Etching System with Advanced Process Control</p>
          </div>
        </div>
      </section>

      <section className="product-overview">
        <div className="container">
          <div className="product-content">
            <div className="product-images">
              <img src="/assets/images/products/icp-etcher/large.jpg" alt="ICP-3000 System" className="main-product-image" />
              <div className="image-gallery">
                <img src="/assets/images/products/icp-etcher/detail-1.jpg" alt="ICP Source View" />
                <img src="/assets/images/products/icp-etcher/detail-2.jpg" alt="Process Chamber" />
                <img src="/assets/images/products/icp-etcher/detail-3.jpg" alt="Control System" />
              </div>
            </div>
            <div className="product-info">
              <h2>Product Description</h2>
              <p>The ICP-3000 Series represents the pinnacle of inductively coupled plasma etching technology. With its high-density plasma source and advanced process control system, it delivers superior etch performance for demanding applications in semiconductor and advanced materials processing.</p>
              
              <h3>Key Features</h3>
              <ul className="feature-list">
                <li>High-density ICP source (1000-3000W)</li>
                <li>Independent bias power control</li>
                <li>Advanced temperature control system</li>
                <li>Multi-zone gas distribution</li>
                <li>Real-time process monitoring</li>
                <li>Automated pressure control</li>
              </ul>

              <h3>Applications</h3>
              <ul className="application-list">
                <li>Deep Silicon Etching</li>
                <li>High-Aspect-Ratio Features</li>
                <li>III-V Compound Processing</li>
                <li>Advanced Packaging</li>
                <li>MEMS Device Fabrication</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      <section className="detailed-specs">
        <div className="container">
          <h2>Technical Specifications</h2>
          <div className="specs-table-container">
            <table className="detailed-specs-table">
              <tbody>
                <tr>
                  <th colSpan={2}>System Specifications</th>
                </tr>
                <tr>
                  <td>ICP Power</td>
                  <td>1000-3000W, 13.56 MHz</td>
                </tr>
                <tr>
                  <td>Bias Power</td>
                  <td>10-500W, 13.56 MHz</td>
                </tr>
                <tr>
                  <td>Process Chamber</td>
                  <td>Cylindrical, Al alloy with ceramic coating</td>
                </tr>
                <tr>
                  <td>Temperature Range</td>
                  <td>-20°C to 80°C</td>
                </tr>
                <tr>
                  <td>Gas Lines</td>
                  <td>Up to 8 process gas lines</td>
                </tr>
                <tr>
                  <td>Base Pressure</td>
                  <td>&lt; 5×10⁻⁶ Torr</td>
                </tr>
                <tr>
                  <td>Process Pressure</td>
                  <td>0.5-100 mTorr</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section className="process-capabilities">
        <div className="container">
          <h2>Process Capabilities</h2>
          <div className="capability-grid">
            <div className="capability-card">
              <h3>Process Performance</h3>
              <ul>
                <li>Etch Rate: Up to 10 μm/min</li>
                <li>Uniformity: ±2%</li>
                <li>Selectivity: Up to 150:1</li>
                <li>Aspect Ratio: Up to 30:1</li>
              </ul>
            </div>
            <div className="capability-card">
              <h3>Material Compatibility</h3>
              <ul>
                <li>Silicon and Silicon Compounds</li>
                <li>III-V Materials</li>
                <li>Dielectrics</li>
                <li>Metals and Metal Oxides</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      <section className="product-contact">
        <div className="container">
          <h2>Request Information</h2>
          <p>Contact our sales team for detailed specifications, pricing, and customization options.</p>
          <div className="contact-buttons">
            <button className="btn btn-primary" onClick={openContactForm}>Contact Sales Team</button>
            <a href="/docs/icp-3000-datasheet.pdf" className="btn btn-secondary" target="_blank" rel="noopener noreferrer">
              <span className="icon-download"></span> Download Product Datasheet
            </a>
          </div>
        </div>
      </section>

      <ContactFormModal
        isOpen={isModalOpen}
        onClose={closeContactForm}
        productName="ICP Etcher Series"
      />
    </>
  )
}

function App() {
  return (
    <Router>
      <Layout>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/about" element={<AboutPage />} />
          <Route path="/products" element={<ProductsPage />} />
          <Route path="/products/rie-etcher" element={<RIEEtcherPage />} />
          <Route path="/products/icp-etcher" element={<ICPEtcherPage />} />
        </Routes>
      </Layout>
    </Router>
  )
}

export default App
