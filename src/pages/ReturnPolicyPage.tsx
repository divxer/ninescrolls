import { SEO } from '../components/common/SEO';

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
      <main className="py-24 px-8 max-w-4xl mx-auto">
        <h1 className="text-5xl font-headline font-bold mb-4">Return Policy</h1>
        <p className="text-on-surface-variant mb-12">Effective Date: {effectiveDate}</p>

        <div className="bg-surface-container-low p-10 rounded-xl space-y-8">
          {/* 1. Overview */}
          <section>
            <h2 className="text-2xl font-headline font-bold text-on-surface mb-4">1. Overview</h2>
            <div className="text-on-surface-variant space-y-3 leading-relaxed">
              <p>NineScrolls LLC provides advanced scientific research and semiconductor processing equipment, many of which are custom-configured or built-to-order.</p>
              <p>NineScrolls LLC accepts returns and exchanges for defective products only. Returns or exchanges are not accepted for customer preference, ordering errors, or non-defective products.</p>
              <p>All systems are inspected and tested prior to shipment to ensure compliance with agreed specifications.</p>
            </div>
          </section>

          <hr className="border-outline-variant" />

          {/* 2. Eligible Returns and Exchanges */}
          <section>
            <h2 className="text-2xl font-headline font-bold text-on-surface mb-4">2. Eligible Returns and Exchanges</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="bg-white p-6 rounded-lg">
                <h3 className="font-bold mb-2 text-on-surface">Eligible Returns</h3>
                <p className="text-on-surface-variant text-sm mb-3">Returns and exchanges are accepted only if one of the following conditions is met:</p>
                <ul className="text-sm space-y-2 list-disc pl-4 text-on-surface-variant">
                  <li>The product is dead on arrival (DOA)</li>
                  <li>The product was damaged during shipping (with documented carrier evidence)</li>
                  <li>The delivered product materially differs from the confirmed quotation or purchase order</li>
                  <li>A verified manufacturing defect is confirmed by NineScrolls technical support</li>
                </ul>
              </div>
              <div className="bg-white p-6 rounded-lg">
                <h3 className="font-bold mb-2 text-on-surface">Non-Returnable Items</h3>
                <p className="text-on-surface-variant text-sm mb-3">The following items are not eligible for return or exchange:</p>
                <ul className="text-sm space-y-2 list-disc pl-4 text-on-surface-variant">
                  <li>Custom-built or made-to-order equipment (unless a confirmed defect is identified)</li>
                  <li>Equipment that has been installed, powered on, or used</li>
                  <li>Consumables, spare parts, or accessories</li>
                  <li>Software licenses or digital products</li>
                  <li>Damage resulting from improper installation, misuse, or unauthorized modification</li>
                </ul>
              </div>
            </div>
            <p className="mt-4 text-on-surface font-bold text-sm">All issues must be reported within 7 days of delivery.</p>
          </section>

          <hr className="border-outline-variant" />

          {/* 4. Return Authorization Process */}
          <section>
            <h2 className="text-2xl font-headline font-bold text-on-surface mb-4">3. Return Authorization Process</h2>
            <p className="text-on-surface-variant mb-4 leading-relaxed">Before any return or exchange is accepted, customers must:</p>
            <ol className="list-decimal pl-6 space-y-2 text-on-surface-variant leading-relaxed">
              <li>Contact NineScrolls Support at <a href="mailto:support@ninescrolls.com" className="text-primary font-bold hover:underline">support@ninescrolls.com</a></li>
              <li>Provide order details, serial numbers, and a detailed description of the issue</li>
              <li>Obtain a written Return Material Authorization (RMA)</li>
            </ol>
            <p className="mt-4 text-on-surface font-bold text-sm">Unauthorized returns or exchanges will not be accepted.</p>
          </section>

          <hr className="border-outline-variant" />

          {/* 5. Resolution Options */}
          <section>
            <h2 className="text-2xl font-headline font-bold text-on-surface mb-4">4. Resolution Options</h2>
            <p className="text-on-surface-variant mb-4 leading-relaxed">At NineScrolls' discretion, eligible cases may be resolved through one or more of the following:</p>
            <ul className="list-disc pl-6 space-y-2 text-on-surface-variant leading-relaxed">
              <li>Remote technical support</li>
              <li>Repair of defective components</li>
              <li>Replacement or exchange of the defective product</li>
              <li>Refund (only if repair or replacement is not feasible)</li>
            </ul>
            <p className="mt-4 text-on-surface-variant leading-relaxed">Refunds, if approved, will exclude shipping, customs duties, installation, and service fees unless otherwise agreed in writing.</p>
          </section>

          <hr className="border-outline-variant" />

          {/* 6. Shipping and Costs */}
          <section>
            <h2 className="text-2xl font-headline font-bold text-on-surface mb-4">5. Shipping and Costs</h2>
            <ul className="list-disc pl-6 space-y-2 text-on-surface-variant leading-relaxed">
              <li>For confirmed manufacturing defects, NineScrolls will coordinate appropriate resolution.</li>
              <li>For all other cases, return shipping, insurance, and related costs are the responsibility of the customer.</li>
            </ul>
          </section>

          <hr className="border-outline-variant" />

          {/* 7. Governing Law */}
          <section>
            <h2 className="text-2xl font-headline font-bold text-on-surface mb-4">6. Governing Law</h2>
            <p className="text-on-surface-variant leading-relaxed">This Return Policy is governed by the laws of the State of California, USA. In case of conflict, the terms stated in the signed quotation, purchase order, or contract shall prevail.</p>
          </section>

          <hr className="border-outline-variant" />

          {/* 8. Technical Support First */}
          <section>
            <h2 className="text-2xl font-headline font-bold text-on-surface mb-4">7. Technical Support First</h2>
            <p className="text-on-surface-variant mb-3 leading-relaxed">For technical concerns, NineScrolls strongly encourages customers to contact our support team first. Most issues can be resolved efficiently through remote diagnostics, process optimization, or component-level support.</p>
            <p className="text-on-surface-variant leading-relaxed">For assistance, please contact <a href="mailto:support@ninescrolls.com" className="text-primary font-bold hover:underline">support@ninescrolls.com</a>.</p>
          </section>
        </div>
      </main>
    </>
  );
}

export default ReturnPolicyPage;
