import { BrowserRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom'
import { useState, useEffect } from 'react'

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
            <li><Link to="/contact" className={`nav-link ${location.pathname === '/contact' ? 'active' : ''}`}>Contact Us</Link></li>
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
              <p>For urgent inquiries: +1 (858) 537-7743</p>
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

      <section className="tech-grid">
        <div className="container">
          <h2>Cutting-Edge Technologies</h2>
          <div className="tech-grid">
            <div className="tech-card">
              <div className="emoji-icon">⚙️</div>
              <h4>Precision Engineering</h4>
              <p>Advanced manufacturing techniques ensuring nanometer-scale accuracy</p>
            </div>
            <div className="tech-card">
              <div className="emoji-icon">🤖</div>
              <h4>Automation Systems</h4>
              <p>Intelligent control systems for reproducible results</p>
            </div>
            <div className="tech-card">
              <div className="emoji-icon">⚡</div>
              <h4>Plasma Technology</h4>
              <p>State-of-the-art plasma processing solutions</p>
            </div>
          </div>
        </div>
      </section>

      <section className="research" id="research">
        <div className="container">
          <div className="research-content">
            <h2>Driving Innovation Through R&D</h2>
            <p>Our commitment to research and development drives continuous improvement in our equipment solutions. We work closely with leading research institutions to push the boundaries of what's possible in semiconductor manufacturing.</p>
            <Link to="/about" className="btn btn-primary">Discover Our R&D</Link>
          </div>
        </div>
      </section>

      <section className="testimonials" id="testimonials">
        <div className="container">
          <h2>Trusted by Leading Institutions</h2>
          <div className="partner-logos">
            <div className="partner-logo">
              <span className="emoji-icon">🏛️</span>
              <span>Research Universities</span>
            </div>
            <div className="partner-logo">
              <span className="emoji-icon">🔬</span>
              <span>Research Institutes</span>
            </div>
            <div className="partner-logo">
              <span className="emoji-icon">🏢</span>
              <span>Corporate R&D</span>
            </div>
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
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState<ContactFormData>({
    name: '',
    email: '',
    phone: '',
    organization: '',
    message: ''
  });

  const openContactForm = () => {
    setIsModalOpen(true);
    document.body.style.overflow = 'hidden';
  };

  const closeContactForm = () => {
    setIsModalOpen(false);
    document.body.style.overflow = 'auto';
  };

  const handleFormSuccess = () => {
    // Additional success handling if needed
  };

  return (
    <>
      <section className="products-hero">
        <div className="container">
          <h1>Our Products</h1>
          <p>Advanced Semiconductor Manufacturing Equipment</p>
        </div>
      </section>

      <section className="manufacturer-intro">
        <div className="container">
          <div className="manufacturer-content">
            <h2>Our Trusted Manufacturer Partner</h2>
            <div className="manufacturer-info">
              <div className="manufacturer-text">
                <p>We are proud to partner with Tylon, a leading manufacturer of semiconductor processing equipment with over 30 years of experience in the industry. Their commitment to innovation and quality aligns perfectly with our mission to provide cutting-edge research equipment solutions.</p>
                <p>Key strengths of our manufacturer partner:</p>
                <ul className="manufacturer-strengths">
                  <li>Industry-leading R&D capabilities</li>
                  <li>Global technical support network</li>
                  <li>Proven track record in semiconductor manufacturing</li>
                  <li>Comprehensive training and documentation</li>
                  <li>Customizable solutions for specific research needs</li>
                </ul>
              </div>
              <div className="manufacturer-stats">
                <div className="stat-item">
                  <span className="stat-number">30+</span>
                  <span className="stat-label">Years of Experience</span>
                </div>
                <div className="stat-item">
                  <span className="stat-number">1000+</span>
                  <span className="stat-label">Global Installations</span>
                </div>
                <div className="stat-item">
                  <span className="stat-number">300+</span>
                  <span className="stat-label">Research Institutions Served</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="product-categories">
        <div className="container">
          <div className="section-intro">
            <p>Explore our comprehensive range of semiconductor manufacturing equipment, designed to meet the highest industry standards and deliver exceptional performance.</p>
          </div>
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
              <Link to="/products/ibe-ribe">
                <img src="/assets/images/products/ibe-ribe/main.jpg" alt="IBE/RIBE Series" />
                <h3>IBE/RIBE Series</h3>
                <p>Advanced ion beam etching systems with flexible configuration options and easy-to-use sample handling.</p>
                <ul className="product-features">
                  <li>Compact 1.0m × 0.8m footprint</li>
                  <li>Multiple ion source options</li>
                  <li>Flexible sample handling</li>
                  <li>Customizable configurations</li>
                </ul>
              </Link>
            </div>

            <div className="category-card">
              <Link to="/products/ald">
                <img src="/assets/images/products/ald/main.jpg" alt="ALD Series" />
                <h3>ALD Series</h3>
                <p>Advanced atomic layer deposition systems with box-in-box process chamber and excellent step coverage.</p>
                <ul className="product-features">
                  <li>Compact 0.8m × 1.0m footprint</li>
                  <li>Box-in-box process chamber</li>
                  <li>Multiple precursor lines</li>
                  <li>High-aspect-ratio capability</li>
                </ul>
              </Link>
            </div>

            <div className="category-card">
              <Link to="/products/striper">
                <img src="/assets/images/products/striper/main.jpg" alt="Striper Series" />
                <h3>Striper Series</h3>
                <p>Advanced plasma stripping systems with uniform chamber design and configurable process parameters.</p>
                <ul className="product-features">
                  <li>Compact 0.8m × 0.8m footprint</li>
                  <li>Uniform chamber design</li>
                  <li>Configurable gas feed-in</li>
                  <li>Adjustable plasma gap</li>
                </ul>
              </Link>
            </div>

            <div className="category-card">
              <Link to="/products/hdp-cvd">
                <img src="/assets/images/products/hdp-cvd/main.jpg" alt="HDP-CVD Series" />
                <h3>HDP-CVD Series</h3>
                <p>High-density plasma chemical vapor deposition systems with excellent step coverage and process flexibility.</p>
                <ul className="product-features">
                  <li>Compact 1.0m × 1.5m footprint</li>
                  <li>Chamber liner temperature control</li>
                  <li>Multiple gas lines</li>
                  <li>Flexible process design kits</li>
                </ul>
              </Link>
            </div>

            <div className="category-card">
              <Link to="/products/sputter">
                <img src="/assets/images/products/sputter/main.jpg" alt="Sputter Series" />
                <h3>Sputter Series</h3>
                <p>Advanced magnetron sputtering systems with flexible target configurations and temperature control.</p>
                <ul className="product-features">
                  <li>Compact 1.0m × 1.7m footprint</li>
                  <li>Flexible target orientation</li>
                  <li>Temperature-controlled electrode</li>
                  <li>RF bias capability</li>
                </ul>
              </Link>
            </div>

            <div className="category-card">
              <Link to="/products/pecvd">
                <img src="/assets/images/products/pecvd/main.jpg" alt="PECVD Series" />
                <h3>PECVD Series</h3>
                <p>Advanced Plasma Enhanced Chemical Vapor Deposition Systems with Superior Process Control</p>
                <ul className="product-features">
                  <li>Advanced RF power control</li>
                  <li>Precise temperature management</li>
                  <li>Multiple gas line configuration</li>
                  <li>Flexible chamber design</li>
                </ul>
              </Link>
            </div>

            <div className="category-card">
              <Link to="/products/coater-developer">
                <img src="/assets/images/products/coater-developer/main.jpg" alt="Coater/Developer & Hotplate Series" />
                <h3>Coater/Developer & Hotplate Series</h3>
                <p>Advanced photoresist processing systems with flexible configuration options and precise control.</p>
                <ul className="product-features">
                  <li>Compact 1.0m × 0.8m footprint</li>
                  <li>Flexible module configuration</li>
                  <li>High-speed spin coating</li>
                  <li>Temperature-controlled hotplates</li>
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
            <button className="btn btn-primary" onClick={openContactForm}>Contact Our Team</button>
            <a href="#" className="btn btn-secondary">Download Equipment Guide</a>
          </div>
        </div>
      </section>

      <ContactFormModal
        isOpen={isModalOpen}
        onClose={closeContactForm}
        productName="General Inquiry"
        formData={formData}
        onFormDataChange={setFormData}
        onSuccess={handleFormSuccess}
      />
    </>
  )
}

interface ContactFormData {
  name: string;
  email: string;
  phone: string;
  organization: string;
  message: string;
}

interface ContactFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  productName: string;
  formData: ContactFormData;
  onFormDataChange: (data: ContactFormData) => void;
  onSuccess?: () => void;
}

function ContactFormModal({ isOpen, onClose, productName, formData, onFormDataChange, onSuccess }: ContactFormModalProps) {
  const [isSuccess, setIsSuccess] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset success state when modal is closed
  useEffect(() => {
    if (!isOpen) {
      setIsSuccess(false);
    }
  }, [isOpen]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    onFormDataChange({ ...formData, [name]: value });
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);
    setError(null);

    const formDataToSubmit = {
      productName,
      ...formData
    };

    // Validate required fields before sending
    if (!formDataToSubmit.message.trim()) {
      console.log('Validation failed: Message is empty');
      setError('Please provide a message');
      setIsSubmitting(false);
      return;
    }

    try {
      console.log('Starting form submission...');
      console.log('Form data:', JSON.stringify(formDataToSubmit, null, 2));
      
      const response = await fetch('https://api.ninescrolls.us/sendEmail', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formDataToSubmit)
      });

      console.log('Response received:', {
        status: response.status,
        statusText: response.statusText,
        headers: Object.fromEntries(response.headers.entries())
      });

      const responseText = await response.text();
      console.log('Response body:', responseText);

      if (!response.ok) {
        console.error('Request failed:', {
          status: response.status,
          statusText: response.statusText,
          body: responseText
        });
        throw new Error(`Failed to submit form: ${response.status} ${responseText}`);
      }

      let result;
      try {
        result = JSON.parse(responseText);
        console.log('Parsed response:', result);
      } catch (e) {
        console.warn('Failed to parse response as JSON:', responseText);
        result = { message: 'Form submitted successfully' };
      }

      console.log('Form submission successful');
      setIsSuccess(true);
      setIsSubmitting(false);
      // Reset form data after successful submission
      onFormDataChange({
        name: '',
        email: '',
        phone: '',
        organization: '',
        message: ''
      });
      // Notify parent component of success
      onSuccess?.();
    } catch (error) {
      console.error('Error in form submission:', error);
      if (error instanceof Error) {
        console.error('Error details:', {
          name: error.name,
          message: error.message,
          stack: error.stack
        });
      }
      setError(error instanceof Error ? error.message : 'Failed to submit form. Please try again later.');
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal" data-open={isOpen}>
      <div className="modal-content" role="dialog" aria-labelledby="modalTitle">
        {!isSuccess ? (
          <>
            <span className="close-button" aria-label="Close" onClick={onClose}>&times;</span>
            <h2 id="modalTitle">Request Product Information</h2>
            <p className="modal-subtitle">Please fill out the form below and we'll get back to you shortly.</p>
            {error && <div className="error-message">{error}</div>}
            <form id="contactForm" onSubmit={handleSubmit}>
              <div className="form-group">
                <label htmlFor="productName">Product:</label>
                <input type="text" id="productName" name="productName" value={productName} readOnly className="form-control-readonly" />
              </div>
              <div className="form-group">
                <label htmlFor="name">Name</label>
                <input 
                  type="text" 
                  id="name" 
                  name="name" 
                  required 
                  placeholder="Enter your full name" 
                  autoComplete="name"
                  value={formData.name}
                  onChange={handleInputChange}
                />
              </div>
              <div className="form-group">
                <label htmlFor="email">Email</label>
                <input 
                  type="email" 
                  id="email" 
                  name="email" 
                  required 
                  placeholder="Enter your email address" 
                  autoComplete="email"
                  value={formData.email}
                  onChange={handleInputChange}
                />
              </div>
              <div className="form-group">
                <label htmlFor="phone">Phone:</label>
                <input 
                  type="tel" 
                  id="phone" 
                  name="phone" 
                  pattern="[0-9+\-\s()]*" 
                  placeholder="Optional: Enter your phone number" 
                  autoComplete="tel"
                  value={formData.phone}
                  onChange={handleInputChange}
                />
              </div>
              <div className="form-group">
                <label htmlFor="organization">Organization:</label>
                <input 
                  type="text" 
                  id="organization" 
                  name="organization" 
                  placeholder="Optional: Enter your organization name" 
                  autoComplete="organization"
                  value={formData.organization}
                  onChange={handleInputChange}
                />
              </div>
              <div className="form-group">
                <label htmlFor="message">Message</label>
                <textarea 
                  id="message" 
                  name="message" 
                  rows={4} 
                  required 
                  placeholder="Please let us know your specific requirements or questions"
                  value={formData.message}
                  onChange={handleInputChange}
                ></textarea>
              </div>
              <div className="form-actions">
                <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
                  {isSubmitting ? 'Submitting...' : 'Submit Request'}
                </button>
              </div>
            </form>
          </>
        ) : (
          <div className="form-success" data-success={isSuccess}>
            <span className="close-button" aria-label="Close" onClick={onClose}>&times;</span>
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
                  <a href="/docs/rie-etcher-datasheet.pdf" className="btn btn-secondary" target="_blank" rel="noopener noreferrer">
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
  const [showFloatingContact, setShowFloatingContact] = useState(false);
  const [formData, setFormData] = useState<ContactFormData>({
    name: '',
    email: '',
    phone: '',
    organization: '',
    message: ''
  });

  useEffect(() => {
    const handleScroll = () => {
      const scrollPosition = window.scrollY;
      setShowFloatingContact(scrollPosition > 500);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const openContactForm = () => {
    setIsModalOpen(true);
    document.body.style.overflow = 'hidden';
  };

  const closeContactForm = () => {
    setIsModalOpen(false);
    document.body.style.overflow = 'auto';
  };

  const handleFormSuccess = () => {
    // Additional success handling if needed
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
              <img src="/assets/images/products/rie-etcher/large.jpg" alt="RIE Etcher System" className="main-product-image" />
              <div className="image-gallery">
                <img src="/assets/images/products/rie-etcher/detail-1.jpg" alt="Chamber View" />
                <img src="/assets/images/products/rie-etcher/detail-2.jpg" alt="Control Interface" />
                <img src="/assets/images/products/rie-etcher/detail-3.jpg" alt="Process Results" />
              </div>
            </div>
            <div className="product-info">
              <h2>Product Description</h2>
              <p>The RIE Etcher Series features an innovative uni-body design with outstanding footprint efficiency (1.0m × 1.0m). The system's uniform chamber center pump-down ensures superior process performance, while the configurable showerhead gas feed-in and plasma discharge gap allow for precise parameter tuning.</p>
              
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
              <h3>Process Performance</h3>
              <ul>
                <li>High etch rates with excellent uniformity</li>
                <li>Superior aspect ratio control</li>
                <li>Precise temperature control (-70°C to 200°C)</li>
                <li>Advanced plasma source (1000-3000W)</li>
                <li>Flexible bias control (300-1000W)</li>
                <li>Multiple gas line configuration</li>
                <li>He backside cooling for thermal management</li>
              </ul>
            </div>
            <div className="capability-card">
              <h3>Technical Advantages</h3>
              <ul>
                <li>Low power plasma technology</li>
                <li>Ion damage-free processing option</li>
                <li>Parameter-dependent tuning capability</li>
                <li>Customizable process design kits</li>
                <li>Flexible sample handling options</li>
                <li>Advanced vacuum system (TMP & Mechanical)</li>
                <li>Non-uniformity &lt; ±5% (Edge Exclusion)</li>
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
            <a href="/docs/rie-etcher-datasheet.pdf" className="btn btn-secondary" target="_blank" rel="noopener noreferrer">
              <span className="icon-download"></span> Download Product Datasheet
            </a>
          </div>
        </div>
      </section>

      <div className={`floating-contact ${showFloatingContact ? 'visible' : ''}`}>
        <button className="btn btn-primary" onClick={openContactForm}>
          Contact Sales Team
        </button>
      </div>

      <ContactFormModal
        isOpen={isModalOpen}
        onClose={closeContactForm}
        productName="RIE Etcher Series"
        formData={formData}
        onFormDataChange={setFormData}
        onSuccess={handleFormSuccess}
      />
    </>
  )
}

function ICPEtcherPage() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [showFloatingContact, setShowFloatingContact] = useState(false);
  const [formData, setFormData] = useState<ContactFormData>({
    name: '',
    email: '',
    phone: '',
    organization: '',
    message: ''
  });

  useEffect(() => {
    const handleScroll = () => {
      const scrollPosition = window.scrollY;
      setShowFloatingContact(scrollPosition > 500);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const openContactForm = () => {
    setIsModalOpen(true);
    document.body.style.overflow = 'hidden';
  };

  const closeContactForm = () => {
    setIsModalOpen(false);
    document.body.style.overflow = 'auto';
  };

  const handleFormSuccess = () => {
    // Additional success handling if needed
  };

  return (
    <>
      <section className="product-detail-hero">
        <div className="container">
          <div className="product-header">
            <h1>ICP Etcher Series</h1>
            <p>Advanced Inductively Coupled Plasma Etching System with Uni-body Design</p>
          </div>
        </div>
      </section>

      <section className="product-overview">
        <div className="container">
          <div className="product-content">
            <div className="product-images">
              <img src="/assets/images/products/icp-etcher/large.jpg" alt="ICP Etcher System" className="main-product-image" />
              <div className="image-gallery">
                <img src="/assets/images/products/icp-etcher/detail-1.jpg" alt="ICP Source View" />
                <img src="/assets/images/products/icp-etcher/detail-2.jpg" alt="Process Chamber" />
                <img src="/assets/images/products/icp-etcher/detail-3.jpg" alt="Control System" />
              </div>
            </div>
            <div className="product-info">
              <h2>Product Description</h2>
              <p>The ICP Etcher Series features an innovative uni-body design with outstanding footprint efficiency (1.0m × 1.5m). The system's process design kits and chamber liner temperature control ensure superior process performance for various applications.</p>
              
              <h3>Key Features</h3>
              <ul className="feature-list">
                <li>Uni-body design concept with compact footprint</li>
                <li>Process design kits depending on requirements</li>
                <li>Chamber liner and electrode temperature control</li>
                <li>Plasma discharge gap tunable</li>
                <li>Cost or performance orientation optional</li>
                <li>RF, pump, and valve specifications customizable</li>
                <li>Low power plasma technology, ion damage-free optional</li>
                <li>Sample handling: Open-Load or Load-Lock optional</li>
              </ul>

              <h3>Applications</h3>
              <ul className="application-list">
                <li>Si-Based Materials (Si, SiO2, SiNx, SiC, Quartz)</li>
                <li>Compound Semiconductors (InP, GaN, GaAs, Ga2O3)</li>
                <li>2D Materials (MoS2, BN, Graphene)</li>
                <li>Metals (W, Ta, Mo)</li>
                <li>Diamond Processing</li>
                <li>Failure Analysis</li>
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
                  <td>Source: 1000-3000W, Bias: 300-1000W, optional</td>
                </tr>
                <tr>
                  <td>Gas System</td>
                  <td>5 lines (Standard) and He backside cooling, or customized</td>
                </tr>
                <tr>
                  <td>Wafer Stage Temperature Range</td>
                  <td>From -70℃ to 200℃, optional</td>
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
              <h3>System Features</h3>
              <ul>
                <li>Uni-body design concept with compact footprint (1.0m × 1.5m)</li>
                <li>Process design kits for different requirements</li>
                <li>Chamber liner and electrode temperature control</li>
                <li>Plasma discharge gap tunable</li>
                <li>Cost or performance orientation optional</li>
                <li>RF, pump, and valve specifications customizable</li>
                <li>Low power plasma technology, ion damage-free optional</li>
                <li>Sample handling: Open-Load or Load-Lock optional</li>
              </ul>
            </div>
            <div className="capability-card">
              <h3>Material Compatibility</h3>
              <ul>
                <li>Si-Based Materials (Si, SiO2, SiNx, SiC, Quartz)</li>
                <li>Compound Semiconductors (InP, GaN, GaAs, Ga2O3)</li>
                <li>2D Materials (MoS2, BN, Graphene)</li>
                <li>Metals (W, Ta, Mo)</li>
                <li>Diamond Processing</li>
                <li>Failure Analysis Applications</li>
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
            <a href="/docs/icp-etcher-datasheet.pdf" className="btn btn-secondary" target="_blank" rel="noopener noreferrer">
              <span className="icon-download"></span> Download Product Datasheet
            </a>
          </div>
        </div>
      </section>

      <div className={`floating-contact ${showFloatingContact ? 'visible' : ''}`}>
        <button className="btn btn-primary" onClick={openContactForm}>
          Contact Sales Team
        </button>
      </div>

      <ContactFormModal
        isOpen={isModalOpen}
        onClose={closeContactForm}
        productName="ICP Etcher Series"
        formData={formData}
        onFormDataChange={setFormData}
        onSuccess={handleFormSuccess}
      />
    </>
  )
}

function IBERIBEPage() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [showFloatingContact, setShowFloatingContact] = useState(false);
  const [formData, setFormData] = useState<ContactFormData>({
    name: '',
    email: '',
    phone: '',
    organization: '',
    message: ''
  });

  useEffect(() => {
    const handleScroll = () => {
      const scrollPosition = window.scrollY;
      setShowFloatingContact(scrollPosition > 500);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const openContactForm = () => {
    setIsModalOpen(true);
    document.body.style.overflow = 'hidden';
  };

  const closeContactForm = () => {
    setIsModalOpen(false);
    document.body.style.overflow = 'auto';
  };

  const handleFormSuccess = () => {
    // Additional success handling if needed
  };

  return (
    <>
      <section className="product-detail-hero">
        <div className="container">
          <div className="product-header">
            <h1>IBE/RIBE Series</h1>
            <p>Advanced Ion Beam Etching System with Flexible Configuration Options</p>
          </div>
        </div>
      </section>

      <section className="product-overview">
        <div className="container">
          <div className="product-content">
            <div className="product-images">
              <img src="/assets/images/products/ibe-ribe/large.jpg" alt="IBE/RIBE System" className="main-product-image" />
              <div className="image-gallery">
                <img src="/assets/images/products/ibe-ribe/detail-1.jpg" alt="Chamber View" />
                <img src="/assets/images/products/ibe-ribe/detail-2.jpg" alt="Ion Source" />
                <img src="/assets/images/products/ibe-ribe/detail-3.jpg" alt="Control Interface" />
              </div>
            </div>
            <div className="product-info">
              <h2>Product Description</h2>
              <p>The IBE/RIBE Series features an innovative uni-body design with outstanding footprint efficiency (1.0m × 0.8m). The system's flexible configuration options and easy-to-use sample handling make it ideal for various ion beam etching applications.</p>
              
              <h3>Key Features</h3>
              <ul className="feature-list">
                <li>Uni-body design concept with compact footprint</li>
                <li>Maintenance and sample-handling friendly design</li>
                <li>Easy-to-swap ion source options</li>
                <li>Cost or performance orientation options</li>
                <li>Flexible sample handling: Open-Load or Load-Lock</li>
                <li>Customizable ion source, pump, and valve specifications</li>
              </ul>

              <h3>Applications</h3>
              <ul className="application-list">
                <li>Magnetic Materials Processing</li>
                <li>Optical Components Fabrication</li>
                <li>MEMS Device Manufacturing</li>
                <li>Thin Film Deposition</li>
                <li>Surface Modification</li>
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
                  <td>Up to 6 inch (Kaufman) / Up to 12 inch (RF)</td>
                </tr>
                <tr>
                  <td>Gas System</td>
                  <td>1 line (Standard) or customized (Kaufman) / 3 line (Standard) or customized (RF)</td>
                </tr>
                <tr>
                  <td>Wafer Stage Motion</td>
                  <td>Tilt from 0° to 90°, Rotation from 1-10 rpm/min</td>
                </tr>
                <tr>
                  <td>Wafer Stage Cooling</td>
                  <td>From 5 to 20°C, Water cooling; He backside cooling optional</td>
                </tr>
                <tr>
                  <td>Vacuum System</td>
                  <td>TMP & Mechanical Pump</td>
                </tr>
                <tr>
                  <td>Base Vacuum</td>
                  <td>Better than 7E-7 Torr</td>
                </tr>
                <tr>
                  <td>Non-Uniformity</td>
                  <td>Less than ±5% (Edge Exclusion)</td>
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
              <h3>Ion Source Options</h3>
              <ul>
                <li>Kaufman Ion Source</li>
                <li>RF Ion Source</li>
                <li>Customizable configurations</li>
                <li>Easy source swapping capability</li>
              </ul>
            </div>
            <div className="capability-card">
              <h3>Process Parameters</h3>
              <ul>
                <li>Adjustable beam energy</li>
                <li>Variable beam current</li>
                <li>Controlled etch rate</li>
                <li>High uniformity</li>
              </ul>
            </div>
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
                <li>High etch rates with excellent uniformity</li>
                <li>Superior aspect ratio control</li>
                <li>Precise temperature control (-70°C to 200°C)</li>
                <li>Advanced plasma source (1000-3000W)</li>
                <li>Flexible bias control (300-1000W)</li>
                <li>Multiple gas line configuration</li>
                <li>He backside cooling for thermal management</li>
              </ul>
            </div>
            <div className="capability-card">
              <h3>Technical Advantages</h3>
              <ul>
                <li>Low power plasma technology</li>
                <li>Ion damage-free processing option</li>
                <li>Parameter-dependent tuning capability</li>
                <li>Customizable process design kits</li>
                <li>Flexible sample handling options</li>
                <li>Advanced vacuum system (TMP & Mechanical)</li>
                <li>Non-uniformity &lt; ±5% (Edge Exclusion)</li>
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
            <a href="/docs/ibe-ribe-datasheet.pdf" className="btn btn-secondary" target="_blank" rel="noopener noreferrer">
              <span className="icon-download"></span> Download Product Datasheet
            </a>
          </div>
        </div>
      </section>

      <div className={`floating-contact ${showFloatingContact ? 'visible' : ''}`}>
        <button className="btn btn-primary" onClick={openContactForm}>
          Contact Sales Team
        </button>
      </div>

      <ContactFormModal
        isOpen={isModalOpen}
        onClose={closeContactForm}
        productName="IBE/RIBE Series"
        formData={formData}
        onFormDataChange={setFormData}
        onSuccess={handleFormSuccess}
      />
    </>
  );
}

function ALDPage() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [showFloatingContact, setShowFloatingContact] = useState(false);
  const [formData, setFormData] = useState<ContactFormData>({
    name: '',
    email: '',
    phone: '',
    organization: '',
    message: ''
  });

  useEffect(() => {
    const handleScroll = () => {
      const scrollPosition = window.scrollY;
      setShowFloatingContact(scrollPosition > 500);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const openContactForm = () => {
    setIsModalOpen(true);
    document.body.style.overflow = 'hidden';
  };

  const closeContactForm = () => {
    setIsModalOpen(false);
    document.body.style.overflow = 'auto';
  };

  const handleFormSuccess = () => {
    // Additional success handling if needed
  };

  return (
    <>
      <section className="product-detail-hero">
        <div className="container">
          <div className="product-header">
            <h1>ALD Series</h1>
            <p>Advanced Atomic Layer Deposition System with Box-in-Box Process Chamber</p>
          </div>
        </div>
      </section>

      <section className="product-overview">
        <div className="container">
          <div className="product-content">
            <div className="product-images">
              <img src="/assets/images/products/ald/large.jpg" alt="ALD System" className="main-product-image" />
              <div className="image-gallery">
                <img src="/assets/images/products/ald/detail-1.jpg" alt="Process Chamber" />
                <img src="/assets/images/products/ald/detail-2.jpg" alt="Showerhead System" />
                <img src="/assets/images/products/ald/detail-3.jpg" alt="Control Interface" />
              </div>
            </div>
            <div className="product-info">
              <h2>Product Description</h2>
              <p>The ALD Series features an innovative uni-body design with outstanding footprint efficiency (0.8m × 1.0m). The system's box-in-box process chamber design ensures superior process performance, while the configurable showerhead gas feed-in system allows for precise parameter tuning.</p>
              
              <h3>Key Features</h3>
              <ul className="feature-list">
                <li>Uni-body design concept with compact footprint</li>
                <li>Box-in-box process chamber for better performance</li>
                <li>Configurable showerhead gas feed-in system</li>
                <li>Excellent high-aspect-ratio step coverage</li>
                <li>Multiple gas inlets and vertical precursor flow</li>
                <li>Flexible cost/performance configurations</li>
                <li>Optional sample handling: Open-Load or Load-Lock</li>
              </ul>

              <h3>Applications</h3>
              <ul className="application-list">
                <li>Oxides (Al2O3, HfO2, SiO2, TiO2, Ga2O3, ZnO)</li>
                <li>Nitrides (TiN, TaN, SiNx, AlN, GaN)</li>
                <li>Metals (Pt, Pd, W)</li>
                <li>High-k Dielectrics</li>
                <li>Barrier Layers</li>
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
                  <td>4", 6", 8", 12" or Supersize optional</td>
                </tr>
                <tr>
                  <td>Growth Materials</td>
                  <td>Oxides, Nitrides, Metals, etc.</td>
                </tr>
                <tr>
                  <td>Vacuum System</td>
                  <td>TMP & Mechanical Pump</td>
                </tr>
                <tr>
                  <td>Base Vacuum</td>
                  <td>Better than 5E-5 Torr</td>
                </tr>
                <tr>
                  <td>RF Power</td>
                  <td>Remote Plasma 300-1000W, optional</td>
                </tr>
                <tr>
                  <td>Number of Precursor</td>
                  <td>2-6 lines or customized</td>
                </tr>
                <tr>
                  <td>Temperature of Source</td>
                  <td>From 20℃ to 150℃ (Standard), 200℃ optional</td>
                </tr>
                <tr>
                  <td>Wafer Temperature Range</td>
                  <td>From 20℃ to 400℃, higher temperature optional</td>
                </tr>
                <tr>
                  <td>Non-Uniformity</td>
                  <td>Less than ±1% (Al2O3)</td>
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
              <h3>Material Compatibility</h3>
              <ul>
                <li>High-k Dielectrics</li>
                <li>Metal Oxides</li>
                <li>Nitride Films</li>
                <li>Metal Films</li>
                <li>Barrier Layers</li>
              </ul>
            </div>
            <div className="capability-card">
              <h3>Process Features</h3>
              <ul>
                <li>Excellent Step Coverage</li>
                <li>High Aspect Ratio Capability</li>
                <li>Precise Thickness Control</li>
                <li>Low Temperature Processing</li>
                <li>Multiple Precursor Support</li>
              </ul>
            </div>
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
                <li>High etch rates with excellent uniformity</li>
                <li>Superior aspect ratio control</li>
                <li>Precise temperature control (-70°C to 200°C)</li>
                <li>Advanced plasma source (1000-3000W)</li>
                <li>Flexible bias control (300-1000W)</li>
                <li>Multiple gas line configuration</li>
                <li>He backside cooling for thermal management</li>
              </ul>
            </div>
            <div className="capability-card">
              <h3>Technical Advantages</h3>
              <ul>
                <li>Low power plasma technology</li>
                <li>Ion damage-free processing option</li>
                <li>Parameter-dependent tuning capability</li>
                <li>Customizable process design kits</li>
                <li>Flexible sample handling options</li>
                <li>Advanced vacuum system (TMP & Mechanical)</li>
                <li>Non-uniformity &lt; ±5% (Edge Exclusion)</li>
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
            <a href="/docs/ald-datasheet.pdf" className="btn btn-secondary" target="_blank" rel="noopener noreferrer">
              <span className="icon-download"></span> Download Product Datasheet
            </a>
          </div>
        </div>
      </section>

      <div className={`floating-contact ${showFloatingContact ? 'visible' : ''}`}>
        <button className="btn btn-primary" onClick={openContactForm}>
          Contact Sales Team
        </button>
      </div>

      <ContactFormModal
        isOpen={isModalOpen}
        onClose={closeContactForm}
        productName="ALD Series"
        formData={formData}
        onFormDataChange={setFormData}
        onSuccess={handleFormSuccess}
      />
    </>
  );
}

function StriperPage() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [showFloatingContact, setShowFloatingContact] = useState(false);
  const [formData, setFormData] = useState<ContactFormData>({
    name: '',
    email: '',
    phone: '',
    organization: '',
    message: ''
  });

  useEffect(() => {
    const handleScroll = () => {
      const scrollPosition = window.scrollY;
      setShowFloatingContact(scrollPosition > 500);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const openContactForm = () => {
    setIsModalOpen(true);
    document.body.style.overflow = 'hidden';
  };

  const closeContactForm = () => {
    setIsModalOpen(false);
    document.body.style.overflow = 'auto';
  };

  const handleFormSuccess = () => {
    // Additional success handling if needed
  };

  return (
    <>
      <section className="product-detail-hero">
        <div className="container">
          <div className="product-header">
            <h1>Striper Series</h1>
            <p>Advanced Plasma Stripping System with Uniform Chamber Design</p>
          </div>
        </div>
      </section>

      <section className="product-overview">
        <div className="container">
          <div className="product-content">
            <div className="product-images">
              <img src="/assets/images/products/striper/large.jpg" alt="Striper System" className="main-product-image" />
              <div className="image-gallery">
                <img src="/assets/images/products/striper/detail-1.jpg" alt="Process Chamber" />
                <img src="/assets/images/products/striper/detail-2.jpg" alt="Gas Feed System" />
                <img src="/assets/images/products/striper/detail-3.jpg" alt="Control Interface" />
              </div>
            </div>
            <div className="product-info">
              <h2>Product Description</h2>
              <p>The Striper Series features an innovative uni-body design with outstanding footprint efficiency (0.8m × 0.8m). The system's uniform chamber center pump-down ensures superior process performance, while the configurable gas feed-in and plasma discharge gap allow for precise parameter tuning.</p>
              
              <h3>Key Features</h3>
              <ul className="feature-list">
                <li>Uni-body design concept with compact footprint</li>
                <li>Uniform chamber center pump-down design</li>
                <li>Configurable uniform gas feed-in system</li>
                <li>Adjustable plasma discharge gap</li>
                <li>Flexible cost/performance configurations</li>
                <li>Optional sample handling: Open-Load</li>
                <li>Customizable RF, pump, and valve specifications</li>
              </ul>

              <h3>Applications</h3>
              <ul className="application-list">
                <li>Organic Materials (PR, PMMA, PS nanosphere)</li>
                <li>2D Materials (MoS2, BN, Graphene)</li>
                <li>Failure Analysis</li>
                <li>Resist Stripping</li>
                <li>Surface Cleaning</li>
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
                  <td>Etching Materials</td>
                  <td>Organics, 2D Materials, Failure Analysis, etc.</td>
                </tr>
                <tr>
                  <td>Vacuum System</td>
                  <td>Mechanical pump</td>
                </tr>
                <tr>
                  <td>RF Power</td>
                  <td>Full range 300-1000W, optional</td>
                </tr>
                <tr>
                  <td>Gas System</td>
                  <td>2 lines (Standard) or customized</td>
                </tr>
                <tr>
                  <td>Wafer Cooling</td>
                  <td>Water cooling</td>
                </tr>
                <tr>
                  <td>Wafer Stage Temperature Range</td>
                  <td>From 5℃ to 200℃, optional</td>
                </tr>
                <tr>
                  <td>Non-Uniformity</td>
                  <td>Less than ±5% (Edge Exclusion)</td>
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
              <h3>Material Compatibility</h3>
              <ul>
                <li>Photoresist</li>
                <li>PMMA</li>
                <li>PS Nanospheres</li>
                <li>2D Materials</li>
                <li>Organic Films</li>
              </ul>
            </div>
            <div className="capability-card">
              <h3>Process Features</h3>
              <ul>
                <li>Uniform Gas Distribution</li>
                <li>Adjustable Plasma Gap</li>
                <li>Temperature Control</li>
                <li>Flexible Configuration</li>
                <li>High Process Stability</li>
              </ul>
            </div>
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
                <li>High etch rates with excellent uniformity</li>
                <li>Superior aspect ratio control</li>
                <li>Precise temperature control (-70°C to 200°C)</li>
                <li>Advanced plasma source (1000-3000W)</li>
                <li>Flexible bias control (300-1000W)</li>
                <li>Multiple gas line configuration</li>
                <li>He backside cooling for thermal management</li>
              </ul>
            </div>
            <div className="capability-card">
              <h3>Technical Advantages</h3>
              <ul>
                <li>Low power plasma technology</li>
                <li>Ion damage-free processing option</li>
                <li>Parameter-dependent tuning capability</li>
                <li>Customizable process design kits</li>
                <li>Flexible sample handling options</li>
                <li>Advanced vacuum system (TMP & Mechanical)</li>
                <li>Non-uniformity &lt; ±5% (Edge Exclusion)</li>
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
            <a href="/docs/striper-datasheet.pdf" className="btn btn-secondary" target="_blank" rel="noopener noreferrer">
              <span className="icon-download"></span> Download Product Datasheet
            </a>
          </div>
        </div>
      </section>

      <div className={`floating-contact ${showFloatingContact ? 'visible' : ''}`}>
        <button className="btn btn-primary" onClick={openContactForm}>
          Contact Sales Team
        </button>
      </div>

      <ContactFormModal
        isOpen={isModalOpen}
        onClose={closeContactForm}
        productName="Striper Series"
        formData={formData}
        onFormDataChange={setFormData}
        onSuccess={handleFormSuccess}
      />
    </>
  );
}

function HDPCVDPage() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [showFloatingContact, setShowFloatingContact] = useState(false);
  const [formData, setFormData] = useState<ContactFormData>({
    name: '',
    email: '',
    phone: '',
    organization: '',
    message: ''
  });

  useEffect(() => {
    const handleScroll = () => {
      const scrollPosition = window.scrollY;
      setShowFloatingContact(scrollPosition > 500);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const openContactForm = () => {
    setIsModalOpen(true);
    document.body.style.overflow = 'hidden';
  };

  const closeContactForm = () => {
    setIsModalOpen(false);
    document.body.style.overflow = 'auto';
  };

  const handleFormSuccess = () => {
    // Additional success handling if needed
  };

  return (
    <>
      <section className="product-detail-hero">
        <div className="container">
          <div className="product-header">
            <h1>HDP-CVD Series</h1>
            <p>High-Density Plasma Chemical Vapor Deposition System with Excellent Step Coverage</p>
          </div>
        </div>
      </section>

      <section className="product-overview">
        <div className="container">
          <div className="product-content">
            <div className="product-images">
              <img src="/assets/images/products/hdp-cvd/large.jpg" alt="HDP-CVD System" className="main-product-image" />
              <div className="image-gallery">
                <img src="/assets/images/products/hdp-cvd/detail-1.jpg" alt="Process Chamber" />
                <img src="/assets/images/products/hdp-cvd/detail-2.jpg" alt="Gas Distribution System" />
                <img src="/assets/images/products/hdp-cvd/detail-3.jpg" alt="Control Interface" />
              </div>
            </div>
            <div className="product-info">
              <h2>Product Description</h2>
              <p>The HDP-CVD Series features an innovative uni-body design with outstanding footprint efficiency (1.0m × 1.5m). The system's chamber liner and electrode temperature control ensure superior process performance, while the flexible process design kits allow for customization based on specific requirements.</p>
              
              <h3>Key Features</h3>
              <ul className="feature-list">
                <li>Uni-body design concept with compact footprint</li>
                <li>Process design kits for different requirements</li>
                <li>Chamber liner and electrode temperature control</li>
                <li>Excellent step coverage capability</li>
                <li>Parameter-dependent tuning</li>
                <li>Flexible cost/performance configurations</li>
                <li>Optional sample handling: Open-Load or Load-Lock</li>
                <li>Customizable RF, pump, and valve specifications</li>
              </ul>

              <h3>Applications</h3>
              <ul className="application-list">
                <li>Silicon-based Materials (Si, SiO2, SiNx, SiON, SiC)</li>
                <li>High-Aspect-Ratio Gap Fill</li>
                <li>Interlayer Dielectrics</li>
                <li>Passivation Layers</li>
                <li>Barrier Films</li>
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
                  <td>Deposition Materials</td>
                  <td>Si/SiO2/SiNx/SiON/SiC, etc.</td>
                </tr>
                <tr>
                  <td>Vacuum System</td>
                  <td>TMP & Mechanical Pump</td>
                </tr>
                <tr>
                  <td>RF Power</td>
                  <td>Source: 1000-3000W, Bias: 300-1000W, optional</td>
                </tr>
                <tr>
                  <td>Gas System</td>
                  <td>6 lines (Standard) or customized</td>
                </tr>
                <tr>
                  <td>Wafer Stage Temperature Range</td>
                  <td>From 20℃ to 200℃</td>
                </tr>
                <tr>
                  <td>Non-Uniformity</td>
                  <td>Less than ±5% (Edge Exclusion)</td>
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
              <h3>Material Compatibility</h3>
              <ul>
                <li>Silicon-based Materials</li>
                <li>Dielectrics</li>
                <li>Nitrides</li>
                <li>Oxides</li>
                <li>Carbides</li>
              </ul>
            </div>
            <div className="capability-card">
              <h3>Process Features</h3>
              <ul>
                <li>High-Density Plasma</li>
                <li>Temperature Control</li>
                <li>Multiple Gas Lines</li>
                <li>Flexible Process Kits</li>
                <li>Excellent Step Coverage</li>
              </ul>
            </div>
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
                <li>High etch rates with excellent uniformity</li>
                <li>Superior aspect ratio control</li>
                <li>Precise temperature control (-70°C to 200°C)</li>
                <li>Advanced plasma source (1000-3000W)</li>
                <li>Flexible bias control (300-1000W)</li>
                <li>Multiple gas line configuration</li>
                <li>He backside cooling for thermal management</li>
              </ul>
            </div>
            <div className="capability-card">
              <h3>Technical Advantages</h3>
              <ul>
                <li>Low power plasma technology</li>
                <li>Ion damage-free processing option</li>
                <li>Parameter-dependent tuning capability</li>
                <li>Customizable process design kits</li>
                <li>Flexible sample handling options</li>
                <li>Advanced vacuum system (TMP & Mechanical)</li>
                <li>Non-uniformity &lt; ±5% (Edge Exclusion)</li>
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
            <a href="/docs/hdp-cvd-datasheet.pdf" className="btn btn-secondary" target="_blank" rel="noopener noreferrer">
              <span className="icon-download"></span> Download Product Datasheet
            </a>
          </div>
        </div>
      </section>

      <div className={`floating-contact ${showFloatingContact ? 'visible' : ''}`}>
        <button className="btn btn-primary" onClick={openContactForm}>
          Contact Sales Team
        </button>
      </div>

      <ContactFormModal
        isOpen={isModalOpen}
        onClose={closeContactForm}
        productName="HDP-CVD Series"
        formData={formData}
        onFormDataChange={setFormData}
        onSuccess={handleFormSuccess}
      />
    </>
  );
}

function SputterPage() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [showFloatingContact, setShowFloatingContact] = useState(false);
  const [formData, setFormData] = useState<ContactFormData>({
    name: '',
    email: '',
    phone: '',
    organization: '',
    message: ''
  });

  useEffect(() => {
    const handleScroll = () => {
      const scrollPosition = window.scrollY;
      setShowFloatingContact(scrollPosition > 500);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const openContactForm = () => {
    setIsModalOpen(true);
    document.body.style.overflow = 'hidden';
  };

  const closeContactForm = () => {
    setIsModalOpen(false);
    document.body.style.overflow = 'auto';
  };

  const handleFormSuccess = () => {
    // Additional success handling if needed
  };

  return (
    <>
      <section className="product-detail-hero">
        <div className="container">
          <div className="product-header">
            <h1>Sputter Series</h1>
            <p>Advanced Magnetron Sputtering System with Flexible Target Configurations</p>
          </div>
        </div>
      </section>

      <section className="product-overview">
        <div className="container">
          <div className="product-content">
            <div className="product-images">
              <img src="/assets/images/products/sputter/large.jpg" alt="Sputter System" className="main-product-image" />
              <div className="image-gallery">
                <img src="/assets/images/products/sputter/detail-1.jpg" alt="Process Chamber" />
                <img src="/assets/images/products/sputter/detail-2.jpg" alt="Magnetron Target" />
                <img src="/assets/images/products/sputter/detail-3.jpg" alt="Control Interface" />
              </div>
            </div>
            <div className="product-info">
              <h2>Product Description</h2>
              <p>The Sputter Series features an innovative uni-body design with outstanding footprint efficiency (1.0m × 1.7m). The system's creatively designed magnetron target structure and flexible configuration options make it ideal for various sputtering applications.</p>
              
              <h3>Key Features</h3>
              <ul className="feature-list">
                <li>Uni-body design concept with compact footprint</li>
                <li>Creatively designed magnetron target structure</li>
                <li>Flexible target orientation (face-down or face-up)</li>
                <li>Angle tiltable and deposition distance tunable</li>
                <li>Rotational electrode with temperature control</li>
                <li>RF bias capability for in-situ cleaning</li>
                <li>Flexible cost/performance configurations</li>
                <li>Optional sample handling: Open-Load or Load-Lock</li>
              </ul>

              <h3>Applications</h3>
              <ul className="application-list">
                <li>Metal Film Deposition</li>
                <li>Dielectric Layer Formation</li>
                <li>Magnetic Material Processing</li>
                <li>Optical Coating</li>
                <li>Barrier Layer Deposition</li>
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
                  <td>Magnetron Sputtering Source</td>
                  <td>2-6 optional</td>
                </tr>
                <tr>
                  <td>Substrate Temperature</td>
                  <td>Water-cooling, 400℃, 800℃, 1200℃, optional</td>
                </tr>
                <tr>
                  <td>Gas System</td>
                  <td>2 lines (Standard), numbers of line customized</td>
                </tr>
                <tr>
                  <td>Power</td>
                  <td>DC or RF customized, automatic switcher</td>
                </tr>
                <tr>
                  <td>Non-Uniformity</td>
                  <td>Less than ±5%</td>
                </tr>
                <tr>
                  <td>Pre-Cleaning</td>
                  <td>Independent chamber or in-situ, RF plasma, optional</td>
                </tr>
                <tr>
                  <td>Base Pressure</td>
                  <td>Better than 5E-7 Torr, higher vacuum customized</td>
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
              <h3>Target Configurations</h3>
              <ul>
                <li>Face-down or Face-up Orientation</li>
                <li>Adjustable Tilt Angle</li>
                <li>Variable Deposition Distance</li>
                <li>Multiple Target Options</li>
                <li>Custom Target Designs</li>
              </ul>
            </div>
            <div className="capability-card">
              <h3>Process Features</h3>
              <ul>
                <li>Temperature Control</li>
                <li>RF Bias Capability</li>
                <li>In-situ Cleaning</li>
                <li>Flexible Power Options</li>
                <li>High Vacuum Operation</li>
              </ul>
            </div>
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
                <li>High etch rates with excellent uniformity</li>
                <li>Superior aspect ratio control</li>
                <li>Precise temperature control (-70°C to 200°C)</li>
                <li>Advanced plasma source (1000-3000W)</li>
                <li>Flexible bias control (300-1000W)</li>
                <li>Multiple gas line configuration</li>
                <li>He backside cooling for thermal management</li>
              </ul>
            </div>
            <div className="capability-card">
              <h3>Technical Advantages</h3>
              <ul>
                <li>Low power plasma technology</li>
                <li>Ion damage-free processing option</li>
                <li>Parameter-dependent tuning capability</li>
                <li>Customizable process design kits</li>
                <li>Flexible sample handling options</li>
                <li>Advanced vacuum system (TMP & Mechanical)</li>
                <li>Non-uniformity &lt; ±5% (Edge Exclusion)</li>
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
            <a href="/docs/sputter-datasheet.pdf" className="btn btn-secondary" target="_blank" rel="noopener noreferrer">
              <span className="icon-download"></span> Download Product Datasheet
            </a>
          </div>
        </div>
      </section>

      <div className={`floating-contact ${showFloatingContact ? 'visible' : ''}`}>
        <button className="btn btn-primary" onClick={openContactForm}>
          Contact Sales Team
        </button>
      </div>

      <ContactFormModal
        isOpen={isModalOpen}
        onClose={closeContactForm}
        productName="Sputter Series"
        formData={formData}
        onFormDataChange={setFormData}
        onSuccess={handleFormSuccess}
      />
    </>
  );
}

function ContactUsPage() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState<ContactFormData>({
    name: '',
    email: '',
    phone: '',
    organization: '',
    message: ''
  });

  const openContactForm = () => {
    setIsModalOpen(true);
    document.body.style.overflow = 'hidden';
  };

  const closeContactForm = () => {
    setIsModalOpen(false);
    document.body.style.overflow = 'auto';
  };

  const handleFormSuccess = () => {
    // Additional success handling if needed
  };

  return (
    <>
      <section className="contact-hero">
        <div className="container">
          <h1>Contact Us</h1>
          <p>Get in touch with our team for expert guidance on your research equipment needs</p>
        </div>
      </section>

      <section className="contact-info">
        <div className="container">
          <div className="contact-grid">
            <div className="contact-card">
              <h3>Office Location</h3>
              <p>12546 Cabezon PL</p>
              <p>San Diego, CA 92129</p>
              <p>United States</p>
              <div className="contact-hours">
                <h4>Business Hours</h4>
                <p>Monday - Friday: 9:00 AM - 5:00 PM PST</p>
              </div>
            </div>
            <div className="contact-card">
              <h3>Contact Information</h3>
              <p>Primary Contact: <a href="mailto:info@ninescrolls.com">info@ninescrolls.com</a></p>
              <p>Sales Inquiries: <a href="mailto:sales@ninescrolls.com">sales@ninescrolls.com</a></p>
              <p className="note">For urgent matters only: +1 (858) 537-7743</p>
              <div className="social-links">
                <a href="https://linkedin.com/company/ninescrolls" className="social-link" target="_blank" rel="noopener noreferrer">LinkedIn</a>
                <a href="https://twitter.com/ninescrolls" className="social-link" target="_blank" rel="noopener noreferrer">Twitter</a>
              </div>
            </div>
            <div className="contact-card">
              <h3>Technical Support</h3>
              <p>For equipment maintenance and technical assistance:</p>
              <p><a href="mailto:support@ninescrolls.com">support@ninescrolls.com</a></p>
              <div className="support-hours">
                <h4>Support Hours</h4>
                <p>Monday - Friday: 8:00 AM - 6:00 PM PST</p>
                <p className="note">24/7 emergency support available for critical issues</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="contact-form-section">
        <div className="container">
          <h2>Send Us a Message</h2>
          <p>Have questions about our products or services? Fill out the form below and we'll get back to you shortly.</p>
          <div className="contact-buttons">
            <button className="btn btn-primary" onClick={openContactForm}>Contact Us</button>
          </div>
        </div>
      </section>

      <ContactFormModal
        isOpen={isModalOpen}
        onClose={closeContactForm}
        productName="General Inquiry"
        formData={formData}
        onFormDataChange={setFormData}
        onSuccess={handleFormSuccess}
      />
    </>
  );
}

function CoaterDeveloperPage() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [showFloatingContact, setShowFloatingContact] = useState(false);
  const [formData, setFormData] = useState<ContactFormData>({
    name: '',
    email: '',
    phone: '',
    organization: '',
    message: ''
  });

  useEffect(() => {
    const handleScroll = () => {
      const scrollPosition = window.scrollY;
      setShowFloatingContact(scrollPosition > 500);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const openContactForm = () => {
    setIsModalOpen(true);
    document.body.style.overflow = 'hidden';
  };

  const closeContactForm = () => {
    setIsModalOpen(false);
    document.body.style.overflow = 'auto';
  };

  const handleFormSuccess = () => {
    // Additional success handling if needed
  };

  return (
    <>
      <section className="product-detail-hero">
        <div className="container">
          <div className="product-header">
            <h1>Coater/Developer & Hotplate Series</h1>
            <p>Advanced Photoresist Processing System with Flexible Configuration Options</p>
          </div>
        </div>
      </section>

      <section className="product-overview">
        <div className="container">
          <div className="product-content">
            <div className="product-images">
              <img src="/assets/images/products/coater-developer/large.jpg" alt="Coater/Developer System" className="main-product-image" />
              <div className="image-gallery">
                <img src="/assets/images/products/coater-developer/detail-1.jpg" alt="Coater Module" />
                <img src="/assets/images/products/coater-developer/detail-2.jpg" alt="Developer Module" />
                <img src="/assets/images/products/coater-developer/detail-3.jpg" alt="Hotplate Module" />
              </div>
            </div>
            <div className="product-info">
              <h2>Product Description</h2>
              <p>The Coater/Developer & Hotplate Series features an innovative uni-body design with outstanding footprint efficiency (1.0m × 0.8m). The system offers flexible configuration options with customizable numbers of coater, developer, and hotplate modules to meet specific processing requirements.</p>
              
              <h3>Key Features</h3>
              <ul className="feature-list">
                <li>Uni-body design concept with compact footprint</li>
                <li>Flexible module configuration options</li>
                <li>Wide range of customization at module level</li>
                <li>Cost or performance orientation options</li>
                <li>Optional sample handling: Open-Load</li>
                <li>Customizable dispense systems and temperature control</li>
                <li>Flexible pump and valve specifications</li>
              </ul>

              <h3>Applications</h3>
              <ul className="application-list">
                <li>Photoresist Coating</li>
                <li>Resist Development</li>
                <li>Post-Apply Baking</li>
                <li>Post-Exposure Baking</li>
                <li>Surface Preparation</li>
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
                  <th colSpan={2}>Coater Specifications</th>
                </tr>
                <tr>
                  <td>Wafer Size Range</td>
                  <td>Small-piece, 2", 4", 6", 8", 12" or Square optional</td>
                </tr>
                <tr>
                  <td>Max. Spin Speed</td>
                  <td>8000 rpm ±1rpm</td>
                </tr>
                <tr>
                  <td>Max. Acceleration</td>
                  <td>8000 rpm/s</td>
                </tr>
                <tr>
                  <td>Dispense Arm</td>
                  <td>Up to 2 photoresist lines</td>
                </tr>
                <tr>
                  <td>Interlock</td>
                  <td>Vacuum pressure, uncover etc.</td>
                </tr>
                <tr>
                  <th colSpan={2}>Developer Specifications</th>
                </tr>
                <tr>
                  <td>Wafer Size Range</td>
                  <td>Small-piece, 2", 4", 6", 8", 12" or Square optional</td>
                </tr>
                <tr>
                  <td>Max. Spin Speed</td>
                  <td>5000 rpm ±1rpm</td>
                </tr>
                <tr>
                  <td>Max. Acceleration</td>
                  <td>5000 rpm/s</td>
                </tr>
                <tr>
                  <td>Dispense Arm</td>
                  <td>Up to 2 developer lines and deionized water line</td>
                </tr>
                <tr>
                  <td>Interlock</td>
                  <td>Vacuum pressure, uncover etc.</td>
                </tr>
                <tr>
                  <th colSpan={2}>Hotplate Specifications</th>
                </tr>
                <tr>
                  <td>Wafer Size Range</td>
                  <td>Small-piece, 2", 4", 6", 8", 12" or Square optional</td>
                </tr>
                <tr>
                  <td>Max. Temperature</td>
                  <td>Up to 200℃, Higher Temperature optional</td>
                </tr>
                <tr>
                  <td>Lift-Pins</td>
                  <td>3 lift-Pins, minimum compatible 2 inch</td>
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
              <h3>Module Configurations</h3>
              <ul>
                <li>Flexible Coater Modules</li>
                <li>Customizable Developer Units</li>
                <li>Temperature-Controlled Hotplates</li>
                <li>Integrated Process Control</li>
                <li>Safety Interlocks</li>
              </ul>
            </div>
            <div className="capability-card">
              <h3>Process Features</h3>
              <ul>
                <li>High-Speed Spin Coating</li>
                <li>Precise Temperature Control</li>
                <li>Multiple Dispense Options</li>
                <li>Flexible Configuration</li>
                <li>Process Automation</li>
              </ul>
            </div>
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
                <li>High etch rates with excellent uniformity</li>
                <li>Superior aspect ratio control</li>
                <li>Precise temperature control (-70°C to 200°C)</li>
                <li>Advanced plasma source (1000-3000W)</li>
                <li>Flexible bias control (300-1000W)</li>
                <li>Multiple gas line configuration</li>
                <li>He backside cooling for thermal management</li>
              </ul>
            </div>
            <div className="capability-card">
              <h3>Technical Advantages</h3>
              <ul>
                <li>Low power plasma technology</li>
                <li>Ion damage-free processing option</li>
                <li>Parameter-dependent tuning capability</li>
                <li>Customizable process design kits</li>
                <li>Flexible sample handling options</li>
                <li>Advanced vacuum system (TMP & Mechanical)</li>
                <li>Non-uniformity &lt; ±5% (Edge Exclusion)</li>
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
            <a href="/docs/coater-developer-datasheet.pdf" className="btn btn-secondary" target="_blank" rel="noopener noreferrer">
              <span className="icon-download"></span> Download Product Datasheet
            </a>
          </div>
        </div>
      </section>

      <div className={`floating-contact ${showFloatingContact ? 'visible' : ''}`}>
        <button className="btn btn-primary" onClick={openContactForm}>
          Contact Sales Team
        </button>
      </div>

      <ContactFormModal
        isOpen={isModalOpen}
        onClose={closeContactForm}
        productName="Coater/Developer & Hotplate Series"
        formData={formData}
        onFormDataChange={setFormData}
        onSuccess={handleFormSuccess}
      />
    </>
  );
}

function PECVDPage() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [showFloatingContact, setShowFloatingContact] = useState(false);
  const [formData, setFormData] = useState<ContactFormData>({
    name: '',
    email: '',
    phone: '',
    organization: '',
    message: ''
  });

  useEffect(() => {
    const handleScroll = () => {
      const scrollPosition = window.scrollY;
      setShowFloatingContact(scrollPosition > 500);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const openContactForm = () => {
    setIsModalOpen(true);
    document.body.style.overflow = 'hidden';
  };

  const closeContactForm = () => {
    setIsModalOpen(false);
    document.body.style.overflow = 'auto';
  };

  const handleFormSuccess = () => {
    // Additional success handling if needed
  };

  return (
    <>
      <section className="product-detail-hero">
        <div className="container">
          <div className="product-header">
            <h1>PECVD Series</h1>
            <p>Advanced Plasma Enhanced Chemical Vapor Deposition Systems</p>
          </div>
        </div>
      </section>

      <section className="product-overview">
        <div className="container">
          <div className="product-content">
            <div className="product-images">
              <img 
                src="/assets/images/products/pecvd/main.jpg" 
                alt="PECVD System" 
                className="main-product-image"
              />
              <div className="image-gallery">
                <img src="/assets/images/products/pecvd/detail1.jpg" alt="PECVD Chamber" />
                <img src="/assets/images/products/pecvd/detail2.jpg" alt="PECVD Control Panel" />
                <img src="/assets/images/products/pecvd/detail3.jpg" alt="PECVD Process" />
              </div>
            </div>
            <div className="product-info">
              <h2>Advanced PECVD Technology</h2>
              <p>Our PECVD Series offers state-of-the-art plasma enhanced chemical vapor deposition systems with superior process control and reliability.</p>
              
              <h3>Key Features</h3>
              <ul className="feature-list">
                <li>Advanced RF power control system</li>
                <li>Precise temperature management</li>
                <li>Multiple gas line configuration</li>
                <li>Flexible chamber design</li>
                <li>Advanced process monitoring</li>
                <li>User-friendly interface</li>
              </ul>

              <h3>Applications</h3>
              <ul className="application-list">
                <li>Silicon nitride deposition</li>
                <li>Silicon oxide deposition</li>
                <li>Low-k dielectric films</li>
                <li>Passivation layers</li>
                <li>Barrier layers</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      <section className="detailed-specs">
        <div className="container">
          <h2>Technical Specifications</h2>
          <table className="detailed-specs-table">
            <tbody>
              <tr>
                <th>Wafer Size Range</th>
                <td>4, 6, 8, 12 inches</td>
              </tr>
              <tr>
                <th>RF Power</th>
                <td>1000-3000W</td>
              </tr>
              <tr>
                <th>Chamber Pressure</th>
                <td>0.1-10 Torr</td>
              </tr>
              <tr>
                <th>Substrate Temperature</th>
                <td>20°C to 400°C</td>
              </tr>
              <tr>
                <th>Gas Lines</th>
                <td>6 lines (customizable)</td>
              </tr>
              <tr>
                <th>Non-uniformity</th>
                <td>Less than ±5%</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section className="process-capabilities">
        <div className="container">
          <h2>Process Capabilities</h2>
          <div className="capability-grid">
            <div className="capability-card">
              <h3>Material Compatibility</h3>
              <ul>
                <li>Silicon nitride (SiNx)</li>
                <li>Silicon oxide (SiO2)</li>
                <li>Silicon oxynitride (SiON)</li>
                <li>Low-k dielectrics</li>
                <li>Barrier layers</li>
              </ul>
            </div>
            <div className="capability-card">
              <h3>Process Features</h3>
              <ul>
                <li>High deposition rates</li>
                <li>Excellent step coverage</li>
                <li>Low stress films</li>
                <li>High film quality</li>
                <li>Process repeatability</li>
              </ul>
            </div>
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
                <li>High etch rates with excellent uniformity</li>
                <li>Superior aspect ratio control</li>
                <li>Precise temperature control (-70°C to 200°C)</li>
                <li>Advanced plasma source (1000-3000W)</li>
                <li>Flexible bias control (300-1000W)</li>
                <li>Multiple gas line configuration</li>
                <li>He backside cooling for thermal management</li>
              </ul>
            </div>
            <div className="capability-card">
              <h3>Technical Advantages</h3>
              <ul>
                <li>Low power plasma technology</li>
                <li>Ion damage-free processing option</li>
                <li>Parameter-dependent tuning capability</li>
                <li>Customizable process design kits</li>
                <li>Flexible sample handling options</li>
                <li>Advanced vacuum system (TMP & Mechanical)</li>
                <li>Non-uniformity &lt; ±5% (Edge Exclusion)</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      <section className="product-contact">
        <div className="container">
          <h2>Interested in PECVD Series?</h2>
          <p>Contact our sales team for detailed information and specifications</p>
          <div className="contact-buttons">
            <button className="btn btn-primary" onClick={openContactForm}>
              Contact Sales
            </button>
            <button className="btn btn-secondary">
              Download Datasheet
            </button>
          </div>
        </div>
      </section>

      {showFloatingContact && (
        <div className="floating-contact visible">
          <button className="btn btn-primary" onClick={openContactForm}>
            Contact Sales
          </button>
        </div>
      )}

      <ContactFormModal
        isOpen={isModalOpen}
        onClose={closeContactForm}
        productName="PECVD Series"
        formData={formData}
        onFormDataChange={setFormData}
        onSuccess={handleFormSuccess}
      />
    </>
  );
}

function App() {
  return (
    <Router>
      <Layout>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/about" element={<AboutPage />} />
          <Route path="/products" element={<ProductsPage />} />
          <Route path="/contact" element={<ContactUsPage />} />
          <Route path="/products/rie-etcher" element={<RIEEtcherPage />} />
          <Route path="/products/icp-etcher" element={<ICPEtcherPage />} />
          <Route path="/products/ibe-ribe" element={<IBERIBEPage />} />
          <Route path="/products/ald" element={<ALDPage />} />
          <Route path="/products/striper" element={<StriperPage />} />
          <Route path="/products/hdp-cvd" element={<HDPCVDPage />} />
          <Route path="/products/sputter" element={<SputterPage />} />
          <Route path="/products/coater-developer" element={<CoaterDeveloperPage />} />
          <Route path="/products/pecvd" element={<PECVDPage />} />
        </Routes>
      </Layout>
    </Router>
  );
}

export default App
