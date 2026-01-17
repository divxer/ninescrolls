import { SEO } from '../components/common/SEO';
import '../styles/ReturnPolicyPage.css';

export function ReturnPolicyPage() {
  // Fixed effective date for the Return Policy
  const effectiveDate = 'January 14, 2025';

  return (
    <>
      <SEO 
        title="Return Policy - NineScrolls" 
        description="NineScrolls Return Policy for scientific research and semiconductor processing equipment. Learn about our return conditions, process, and resolution options." 
        url="/return-policy" 
      />
      <section className="about-hero">
        <div className="container">
          <h1>Return Policy</h1>
          <p>Effective Date: {effectiveDate}</p>
        </div>
      </section>
      <section className="story">
        <div className="story-content">
          <h2>1. Overview</h2>
          <p>
            NineScrolls LLC provides advanced scientific research and semiconductor processing equipment, many of which are custom-configured or built-to-order.
            Due to the specialized nature of our products, returns are accepted only under limited and clearly defined circumstances.
          </p>
          <p>
            All systems are inspected and tested prior to shipment to ensure compliance with agreed specifications.
          </p>

          <hr className="section-divider" />

          <h2>2. Eligible Returns</h2>
          <p>Returns may be considered only if one of the following conditions is met:</p>
          <ul>
            <li>The product is dead on arrival (DOA)</li>
            <li>The product was damaged during shipping (with documented carrier evidence)</li>
            <li>The delivered product materially differs from the confirmed quotation or purchase order</li>
            <li>A verified manufacturing defect is confirmed by NineScrolls technical support.</li>
          </ul>
          <p><strong>All issues must be reported within 7 days of delivery.</strong></p>

          <hr className="section-divider" />

          <h2>3. Non-Returnable Items</h2>
          <p>The following items are not eligible for return or refund:</p>
          <ul>
            <li>Custom-built or made-to-order equipment</li>
            <li>Equipment that has been installed, powered on, or used</li>
            <li>Consumables, spare parts, or accessories</li>
            <li>Software licenses or digital products</li>
            <li>Damage resulting from improper installation, misuse, or unauthorized modification</li>
          </ul>

          <hr className="section-divider" />

          <h2>4. Return Authorization Process</h2>
          <p>Before any return is accepted, customers must:</p>
          <ol>
            <li>Contact NineScrolls Support at <a href="mailto:support@ninescrolls.com">support@ninescrolls.com</a></li>
            <li>Provide order details, serial numbers, and a detailed description of the issue</li>
            <li>Obtain a written Return Material Authorization (RMA)</li>
          </ol>
          <p><strong>Unauthorized returns will not be accepted.</strong></p>

          <hr className="section-divider" />

          <h2>5. Resolution Options</h2>
          <p>At NineScrolls' discretion, eligible cases may be resolved by:</p>
          <ul>
            <li>Remote technical support</li>
            <li>Repair or replacement of defective components</li>
            <li>Replacement of the system</li>
            <li>Refund (only if repair or replacement is not feasible)</li>
          </ul>
          <p>
            Refunds, if approved, will exclude shipping, customs duties, installation, and service fees unless otherwise agreed in writing.
          </p>

          <hr className="section-divider" />

          <h2>6. Shipping and Costs</h2>
          <ul>
            <li>For confirmed manufacturing defects, NineScrolls will coordinate appropriate resolution.</li>
            <li>For all other cases, return shipping, insurance, and related costs are the responsibility of the customer.</li>
          </ul>

          <hr className="section-divider" />

          <h2>7. Governing Law</h2>
          <p>
            This Return Policy is governed by the laws of the State of California, USA.
            In case of conflict, the terms stated in the signed quotation, purchase order, or contract shall prevail.
          </p>

          <hr className="section-divider" />

          <div className="support-note">
            <p>
              <strong>For technical concerns,</strong> NineScrolls strongly encourages customers to contact our support team first. 
              Most issues can be resolved efficiently through remote diagnostics, process optimization, or component-level support.
            </p>
            <p>
              Contact us at <a href="mailto:support@ninescrolls.com">support@ninescrolls.com</a> for assistance.
            </p>
          </div>
        </div>
      </section>
    </>
  );
}

export default ReturnPolicyPage;
