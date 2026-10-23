import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { CtaBand } from '@/components/marketing/cta-band';
import { FeatureCard } from '@/components/marketing/feature-card';
import { FeatureGrid } from '@/components/marketing/feature-grid';
import { HeroShell } from '@/components/marketing/hero-shell';
import { SectionHeader } from '@/components/marketing/section-header';
import { Container } from '@/components/ui/container';
import { Section } from '@/components/ui/section';
import { BreadcrumbList } from '@/components/seo/breadcrumb-list';
import { defineMetadata } from '@/lib/seo/metadata';
import {
  CATEGORIES,
  PRODUCTS,
  getCategoryBySlug,
  getProductsByCategory,
} from '@/app/(marketing)/products/_data';

interface CategoryPageProps {
  params: Promise<{ slug: string }>;
}

export function generateStaticParams(): Array<{ slug: string }> {
  return CATEGORIES.map((category) => ({ slug: category.slug }));
}

export async function generateMetadata({ params }: CategoryPageProps): Promise<Metadata> {
  const { slug } = await params;
  const category = getCategoryBySlug(slug);

  if (!category) {
    return defineMetadata({
      title: 'Category not found',
      description: 'The requested product category could not be found.',
      path: `/products/category/${slug}`,
      noindex: true,
    });
  }

  return defineMetadata({
    title: category.name,
    description: category.description,
    path: `/products/category/${slug}`,
  });
}

export default async function CategoryPage({ params }: CategoryPageProps) {
  const { slug } = await params;
  const category = getCategoryBySlug(slug);

  if (!category) {
    notFound();
  }

  const categoryProducts = getProductsByCategory(slug);
  // Fall back to first 3 products when no exact match (category filter is
  // placeholder until real catalog data replaces the seed).
  const displayProducts = categoryProducts.length > 0 ? categoryProducts : PRODUCTS.slice(0, 3);

  return (
    <>
      <BreadcrumbList
        items={[
          { name: 'Home', url: '/' },
          { name: 'Products', url: '/products' },
          { name: category.name, url: `/products/category/${category.slug}` },
        ]}
      />
      <HeroShell>
        <Section bg="base" spacing="loose">
          <Container className="flex flex-col gap-6">
            <p className="font-mono text-[12px] font-medium tracking-[0.18em] text-cyan-400 uppercase">
              Products / {category.name}
            </p>
            <div className="max-w-4xl">
              <h1 className="text-steel-100 font-display text-4xl leading-[1.04] font-semibold tracking-tight text-balance sm:text-5xl md:text-6xl">
                {category.name}
              </h1>
              <p className="text-steel-200 mt-5 max-w-2xl text-base sm:text-lg md:text-xl">
                {category.tagline}
              </p>
            </div>
            <p className="text-steel-300 max-w-2xl text-base">{category.description}</p>
          </Container>
        </Section>
      </HeroShell>

      <Section bg="raised" spacing="default">
        <Container className="flex flex-col gap-12">
          <SectionHeader
            eyebrow={`${displayProducts.length} product${displayProducts.length !== 1 ? 's' : ''}`}
            title={`${category.name} hardware`}
            subhead="Status labels reflect the real development stage of each product. Pricing and final specifications are confirmed at quote."
          />
          <FeatureGrid columns={3}>
            {displayProducts.map((product) => (
              <FeatureCard
                key={product.slug}
                icon={product.icon}
                eyebrow={product.status}
                title={product.title}
                description={product.description}
                chips={product.chips}
                href={`/products/${product.slug}`}
                cta="View product"
              />
            ))}
          </FeatureGrid>
        </Container>
      </Section>

      <CtaBand
        eyebrow="Custom category"
        title="Need a specific variant or configuration?"
        subtitle="Describe the environment, operating conditions, and target outcome — we will scope the right hardware path."
        primary={{ label: 'Request a quote', href: '/quote' }}
        secondary={{ label: 'Browse all products', href: '/products' }}
      />
    </>
  );
}
