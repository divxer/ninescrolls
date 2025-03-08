import '../styles/AboutPage.css';

export function AboutPage() {
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
            <p>
              NineScrolls LLC is a dynamic start-up company dedicated to advancing innovation and 
              integration in the scientific research equipment industry. Our primary focus is on establishing a 
              comprehensive platform that connects manufacturers, researchers, and industry professionals 
              across the United States.
            </p>
            <p>
              By fostering collaboration and streamlining access to cutting-edge laboratory equipment, we aim 
              to empower scientific discovery and drive technological advancements. At NineScrolls LLC, we 
              are committed to delivering tailored solutions and creating value for our partners and clients 
              through expertise, efficiency, and innovation.
            </p>
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
  );
} 