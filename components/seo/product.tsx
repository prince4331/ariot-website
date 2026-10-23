import { JsonLd } from './json-ld';
import { siteConfig } from '@/lib/seo/site';

interface ProductOffer {
  /** Price as a string (e.g. "45000" or "599"). */
  price: string;
  /** ISO 4217 currency code (e.g. "BDT", "USD"). */
  priceCurrency: string;
  /** Schema.org availability constant. */
  availability?: string;
  /** URL of the seller page. */
  url?: string;
}

interface ProductProps {
  /** Product name. */
  name: string;
  /** Product description. */
  description: string;
  /** Absolute URL of the product image. */
  image?: string;
  /** Brand name. Defaults to ARIOT. */
  brand?: string;
  /** GTIN (EAN/UPC). Optional — omit until a real GTIN exists. */
  gtin?: string;
  /** Product SKU. */
  sku?: string;
  /** Product offers. */
  offers?: ProductOffer[];
}

/**
 * Schema.org Product structured data.
 * Renders on `/products/[slug]`. Enables Google product rich results
 * (price, availability, reviews) in search and shopping tabs.
 */
export function Product({
  name,
  description,
  image,
  brand = siteConfig.name,
  gtin,
  sku,
  offers,
}: ProductProps) {
  return (
    <JsonLd
      data={{
        '@context': 'https://schema.org',
        '@type': 'Product',
        name,
        description,
        ...(image ? { image } : {}),
        brand: {
          '@type': 'Brand',
          name: brand,
        },
        ...(gtin && !gtin.startsWith('[') ? { gtin } : {}),
        ...(sku && !sku.startsWith('[') ? { sku } : {}),
        ...(offers && offers.length > 0
          ? {
              offers:
                offers.length === 1
                  ? {
                      '@type': 'Offer',
                      ...offers[0],
                      url: offers[0].url
                        ? new URL(offers[0].url, siteConfig.url).toString()
                        : undefined,
                    }
                  : offers.map((offer) => ({
                      '@type': 'Offer',
                      ...offer,
                      url: offer.url ? new URL(offer.url, siteConfig.url).toString() : undefined,
                    })),
            }
          : {}),
      }}
    />
  );
}
