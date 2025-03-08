import { Link } from 'react-router-dom';

export function AboutPage() {
  return (
    <>
      <section className="about-hero">
        <div className="container">
          <div className="about-header">
            <h1>About NineScrolls</h1>
            <p className="subtitle">Advancing Semiconductor Technology Through Innovation</p>
          </div>
        </div>
      </section>

      <section className="mission">
        <div className="container">
          <div className="mission-content">
            <h2>Our Mission</h2>
            <p>
              At NineScrolls, we are dedicated to advancing semiconductor technology by providing cutting-edge processing equipment
              that enables breakthrough research and efficient manufacturing solutions. Our commitment to innovation, quality, and
              customer success drives everything we do.
            </p>
          </div>
        </div>
      </section>

      <section className="values">
        <div className="container">
          <h2>Our Core Values</h2>
          <div className="values-grid">
            <div className="value-card">
              <h3>Innovation</h3>
              <p>Continuously pushing the boundaries of technology to deliver advanced solutions</p>
            </div>
            <div className="value-card">
              <h3>Quality</h3>
              <p>Maintaining the highest standards in equipment design and manufacturing</p>
            </div>
            <div className="value-card">
              <h3>Partnership</h3>
              <p>Building long-term relationships with customers through dedicated support</p>
            </div>
            <div className="value-card">
              <h3>Excellence</h3>
              <p>Striving for excellence in every aspect of our operations</p>
            </div>
          </div>
        </div>
      </section>

      <section className="expertise">
        <div className="container">
          <h2>Our Expertise</h2>
          <div className="expertise-grid">
            <div className="expertise-card">
              <h3>Research & Development</h3>
              <p>
                Our team of experts continuously develops new technologies and improves existing solutions
                to meet the evolving needs of semiconductor research and manufacturing.
              </p>
            </div>
            <div className="expertise-card">
              <h3>Manufacturing Excellence</h3>
              <p>
                We maintain strict quality control standards in our manufacturing processes to ensure
                reliable and high-performance equipment.
              </p>
            </div>
            <div className="expertise-card">
              <h3>Customer Support</h3>
              <p>
                Our dedicated support team provides comprehensive technical assistance, training,
                and maintenance services to ensure optimal equipment performance.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="commitment">
        <div className="container">
          <div className="commitment-content">
            <h2>Our Commitment</h2>
            <p>
              We are committed to supporting our customers' success by providing:
            </p>
            <ul>
              <li>State-of-the-art equipment solutions</li>
              <li>Comprehensive technical support</li>
              <li>Continuous innovation and improvement</li>
              <li>Flexible customization options</li>
              <li>Reliable after-sales service</li>
            </ul>
          </div>
        </div>
      </section>

      <section className="about-cta">
        <div className="container">
          <div className="cta-content">
            <h2>Ready to Work Together?</h2>
            <p>Discover how our equipment solutions can support your research and manufacturing needs.</p>
            <div className="cta-buttons">
              <Link to="/products" className="btn btn-primary">View Our Products</Link>
              <Link to="/contact" className="btn btn-secondary">Contact Us</Link>
            </div>
          </div>
        </div>
      </section>
    </>
  );
} 