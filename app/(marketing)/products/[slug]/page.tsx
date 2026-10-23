import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { ArrowRight, CheckCircle2, Download } from 'lucide-react';
import { Breadcrumb } from '@/components/marketing/breadcrumb';
import { CtaBand } from '@/components/marketing/cta-band';
import { FeatureCard } from '@/components/marketing/feature-card';
import { FeatureGrid } from '@/components/marketing/feature-grid';
import { HeroShell } from '@/components/marketing/hero-shell';
import { SectionHeader } from '@/components/marketing/section-header';
import { Button } from '@/components/ui/button';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/card';
import { Container } from '@/components/ui/container';
import { Section } from '@/components/ui/section';
import { BreadcrumbList } from '@/components/seo/breadcrumb-list';
import { Product as ProductJsonLd } from '@/components/seo/product';
import { defineMetadata, defineProductMetadata } from '@/lib/seo/metadata';
import { ProductViewTracker } from '@/features/analytics/product-view-tracker';
import { PRODUCTS, getProductBySlug, getRelatedProducts } from '@/app/(marketing)/products/_data';

interface ProductPageProps {
  params: Promise<{ slug: string }>;
}

export function generateStaticParams(): Array<{ slug: string }> {
  return PRODUCTS.map((product) => ({ slug: product.slug }));
}

export async function generateMetadata({ params }: ProductPageProps): Promise<Metadata> {
  const { slug } = await params;
  const product = getProductBySlug(slug);

  if (!product) {
    return defineMetadata({
      title: 'Product not found',
      description: 'The requested ARIOT product could not be found.',
      path: `/products/${slug}`,
      noindex: true,
    });
  }

  return defineProductMetadata({
    title: product.title,
    description: product.description,
    path: `/products/${product.slug}`,
    category: product.category,
  });
}

export default async function ProductDetailPage({ params }: ProductPageProps) {
  const { slug } = await params;
  const product = getProductBySlug(slug);

  if (!product) {
    notFound();
  }

  const relatedProducts = getRelatedProducts(product.slug);

  return (
    <>
      <ProductViewTracker slug={product.slug} name={product.title} />
      <ProductJsonLd
        name={product.title}
        description={product.description}
        brand="ARIOT"
        offers={[
          {
            price: product.price,
            priceCurrency: 'BDT',
            availability: 'https://schema.org/PreOrder',
          },
        ]}
      />
      <BreadcrumbList
        items={[
          { name: 'Home', url: '/' },
          { name: 'Products', url: '/products' },
          { name: product.category, url: `/products` },
          { name: product.title, url: `/products/${product.slug}` },
        ]}
      />

      <HeroShell>
        <Section bg="base" spacing="loose">
          <Container className="flex flex-col gap-8">
            <Breadcrumb
              items={[
                { label: 'Home', href: '/' },
                { label: 'Products', href: '/products' },
                { label: product.category },
                { label: product.title },
              ]}
            />
            <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-start">
              <MediaGallery title={product.title} />
              <Card variant="glass">
                <CardBody className="flex flex-col gap-5 p-6 md:p-8">
                  <p className="font-mono text-[12px] font-medium tracking-[0.18em] text-cyan-400 uppercase">
                    {product.category}
                  </p>
                  <div className="flex flex-col gap-3">
                    <h1 className="text-steel-100 font-display text-4xl leading-[1.04] font-semibold tracking-tight text-balance sm:text-5xl">
                      {product.title}
                    </h1>
                    <p className="text-steel-200 text-lg">{product.tagline}</p>
                    <p className="text-steel-300 text-base">{product.description}</p>
                  </div>
                  <ul className="flex flex-wrap gap-2">
                    {[product.status, ...product.chips].map((chip) => (
                      <li
                        key={chip}
                        className="border-steel-700 bg-bg-elevated text-steel-200 rounded-sm border px-2 py-1 font-mono text-[11px]"
                      >
                        {chip}
                      </li>
                    ))}
                  </ul>
                  <div className="border-steel-800 border-t pt-5">
                    <p className="text-steel-400 font-mono text-[11px] tracking-[0.18em] uppercase">
                      Price
                    </p>
                    <p className="font-display mt-1 text-3xl font-semibold tracking-tight text-cyan-400">
                      {product.price}
                    </p>
                    <p className="text-steel-400 mt-2 text-sm">
                      Assembled and supported from Bangladesh — lead time is confirmed with your quote.
                    </p>
                  </div>
                  <div className="flex flex-col gap-3 sm:flex-row">
                    <Button asChild size="lg" variant="primary">
                      <Link href="/quote">
                        Request quote
                        <ArrowRight className="h-4 w-4" />
                      </Link>
                    </Button>
                    <Button asChild size="lg" variant="secondary">
                      <Link href="/contact">Contact sales</Link>
                    </Button>
                  </div>
                </CardBody>
              </Card>
            </div>
          </Container>
        </Section>
      </HeroShell>

      <Section bg="raised" spacing="default">
        <Container className="flex flex-col gap-12">
          <SectionHeader
            eyebrow="Highlights"
            title="What this product is built to do"
            subhead="What each system is engineered to do today, verified against our own test results."
          />
          <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {product.features.map((feature) => (
              <li
                key={feature}
                className="border-steel-700 bg-bg-elevated flex items-start gap-3 rounded-lg border p-4"
              >
                <CheckCircle2 className="text-cyan-400 mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                <span className="text-steel-200 text-sm">{feature}</span>
              </li>
            ))}
          </ul>
        </Container>
      </Section>

      <Section bg="base" spacing="default">
        <Container className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_22rem]">
          <SpecsTable productTitle={product.title} specs={product.specs} />
          <DownloadsCard downloads={product.downloads} />
        </Container>
      </Section>

      <Section bg="raised" spacing="default">
        <Container className="flex flex-col gap-12">
          <SectionHeader
            eyebrow="Related products"
            title="Compare nearby hardware paths"
            subhead="Nearby hardware paths from the ARIOT catalog."
          />
          <FeatureGrid columns={3}>
            {relatedProducts.map((related) => (
              <FeatureCard
                key={related.slug}
                icon={related.icon}
                eyebrow={related.status}
                title={related.title}
                description={related.description}
                chips={related.chips}
                href={`/products/${related.slug}`}
                cta="View product"
              />
            ))}
          </FeatureGrid>
        </Container>
      </Section>

      <CtaBand
        eyebrow="Enterprise rollout"
        title="Need this configured for your site?"
        subtitle="Send the constraints, target environment, and deployment timeline — we will respond with the right engineering path."
        primary={{ label: 'Request a quote', href: '/quote' }}
        secondary={{ label: 'Contact sales', href: '/contact' }}
      />
    </>
  );
}

function MediaGallery({ title }: { title: string }) {
  // Slug-derived path for the product's hero image
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
  const heroSrc = `/media/products/${slug}/products-${slug}-hero-01-4x5.svg`;

  return (
    <Card className="min-h-full">
      <CardBody className="flex flex-col gap-4 p-4 md:p-6">
        <div className="border-steel-700 relative aspect-[4/3] overflow-hidden rounded-lg border">
          <Image
            src={heroSrc}
            alt={`${title} — hero view`}
            fill
            priority
            className="object-cover"
            sizes="(max-width: 1024px) 100vw, 50vw"
          />
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0"
            style={{
              background: 'linear-gradient(180deg, transparent 60%, var(--bg-base) 100%)',
            }}
          />
          <span className="text-steel-500 absolute bottom-3 left-3 font-mono text-[10px] tracking-[0.18em] uppercase">
            Concept render — production media in progress
          </span>
        </div>
        <div className="grid grid-cols-3 gap-3" aria-label="Media thumbnails">
          <div className="border-steel-700 relative aspect-video overflow-hidden rounded-md border">
            <Image
              src={heroSrc}
              alt={`${title} front view`}
              fill
              className="object-cover"
              sizes="25vw"
            />
          </div>
          <div className="border-steel-700 bg-bg-elevated flex items-center justify-center rounded-md border">
            <span className="text-steel-500 font-mono text-[10px] tracking-[0.18em] uppercase">
              Video
            </span>
          </div>
          <div className="border-steel-700 bg-bg-elevated flex items-center justify-center rounded-md border">
            <span className="text-steel-500 font-mono text-[10px] tracking-[0.18em] uppercase">
              Detail
            </span>
          </div>
        </div>
      </CardBody>
    </Card>
  );
}

function SpecsTable({
  productTitle,
  specs,
}: {
  productTitle: string;
  specs: ReadonlyArray<{ title: string; rows: ReadonlyArray<{ label: string; value: string }> }>;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{productTitle} specifications</CardTitle>
      </CardHeader>
      <CardBody className="overflow-x-auto pb-6">
        <table className="w-full min-w-[34rem] text-left text-sm">
          <caption className="sr-only">Specifications for {productTitle}</caption>
          <tbody className="divide-steel-800 divide-y">
            {specs.map((group) =>
              group.rows.map((row, index) => (
                <tr key={`${group.title}-${row.label}`}>
                  <th className="text-steel-400 py-3 pr-6 font-mono text-[11px] font-medium tracking-[0.18em] uppercase">
                    {index === 0 ? group.title : ''}
                  </th>
                  <td className="text-steel-200 py-3 pr-6 font-medium">{row.label}</td>
                  <td className="text-steel-300 py-3 font-mono">{row.value}</td>
                </tr>
              )),
            )}
          </tbody>
        </table>
      </CardBody>
    </Card>
  );
}

function DownloadsCard({ downloads }: { downloads: ReadonlyArray<string> }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Downloads</CardTitle>
      </CardHeader>
      <CardBody>
        <ul className="flex flex-col gap-3">
          {downloads.map((download) => (
            <li key={download}>
              <Button asChild variant="secondary" className="w-full justify-start">
                <Link href="/support">
                  <Download className="h-4 w-4" />
                  {download}
                </Link>
              </Button>
            </li>
          ))}
        </ul>
      </CardBody>
    </Card>
  );
}
