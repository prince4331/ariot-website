import type { Metadata } from 'next';
import { LegalPage } from '@/components/marketing/legal-page';
import { defineMetadata } from '@/lib/seo/metadata';

export const metadata: Metadata = defineMetadata({
  title: 'Shipping & returns',
  description:
    'ARIOT shipping and returns policy — delivery terms, return windows, and refund procedures.',
  path: '/legal/shipping',
});

export default function ShippingReturnsPage() {
  return (
    <LegalPage
      title="Shipping & returns"
      status="Pre-commercial draft — pending legal review"
      sections={[
        {
          heading: 'Shipping status',
          body: 'ARIOT hardware is in the pre-commercial research and development phase. No products are available for purchase or shipment at this time. The terms below are placeholder policies for when commercial operations begin. All shipping and returns policies will be reviewed by legal counsel before commercial launch.',
        },
        {
          heading: 'Shipping (planned)',
          body: 'ARIOT plans to ship to customers within Bangladesh once commercial products become available. Estimated delivery times, carrier partners, shipping rates, and tracking availability will be published before accepting orders.',
        },
        {
          heading: 'Lead times (planned)',
          body: 'Product lead times vary by item and order type. Standard products, custom builds, and enterprise orders each carry their own published estimate, included with every quote.',
        },
        {
          heading: 'Returns (planned)',
          body: 'ARIOT plans to accept returns within a published window for products in original, undamaged condition with original packaging and proof of purchase. Custom and enterprise orders may have different return terms specified in the purchase agreement. Returns will not be accepted for: opened consumables; firmware-modified units; products with physical damage not caused by manufacturing defect.',
        },
        {
          heading: 'Refunds (planned)',
          body: 'Valid returns will be refunded to the original payment method within a published number of business days of receiving the returned item. Shipping costs are non-refundable unless the return is due to a manufacturing defect covered under warranty.',
        },
        {
          heading: 'Contact',
          body: 'For shipping and returns questions, use the contact form on our Contact page. ARIOT Technologies, Bangladesh.',
        },
      ]}
    />
  );
}
