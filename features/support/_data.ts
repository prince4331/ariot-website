import { BookOpen, Download, Settings2, type LucideIcon } from 'lucide-react';
import { slugify } from '@/lib/utils/slugify';

export interface TocItem {
  id: string;
  text: string;
}

export interface SupportArticle {
  slug: string;
  title: string;
  category: string;
  relatedProducts: ReadonlyArray<string>;
  publishedAt: string;
  readingTimeMinutes: number;
  icon: LucideIcon;
  excerpt: string;
  /** TOC items derived from the MDX file's h2 headings.
   *  IDs must match what rehype-slug generates from the heading text. */
  toc: ReadonlyArray<TocItem>;
}

function toc(headings: ReadonlyArray<string>): ReadonlyArray<TocItem> {
  return headings.map((text) => ({ text, id: slugify(text) }));
}

export const SUPPORT_ARTICLES: ReadonlyArray<SupportArticle> = [
  {
    slug: 'floor-cleaning-robot-first-setup',
    title: 'Floor-cleaning robot: first setup guide',
    category: 'Getting started',
    relatedProducts: ['Autonomous floor-cleaning robot'],
    publishedAt: '',
    readingTimeMinutes: 5,
    icon: BookOpen,
    excerpt:
      'Step-by-step guide to unboxing, docking station placement, Wi-Fi setup, and running the first mapping clean on the ARIOT floor-cleaning robot.',
    toc: toc([
      'Unboxing checklist',
      'Docking station placement',
      'Wi-Fi setup',
      'First mapping clean',
    ]),
  },
  {
    slug: 'iot-gateway-node-deployment',
    title: 'IoT gateway node: field deployment guide',
    category: 'Setup & install',
    relatedProducts: ['IoT gateway node'],
    publishedAt: '',
    readingTimeMinutes: 7,
    icon: Settings2,
    excerpt:
      'How to mount, provision, and connect an ARIOT IoT gateway node to a sensor network and cloud endpoint in a field deployment.',
    toc: toc([
      'Pre-deployment checklist',
      'Mounting the enclosure',
      'SIM and connectivity configuration',
      'MQTT endpoint configuration',
    ]),
  },
  {
    slug: 'home-safety-device-sensor-test',
    title: 'Home safety device: testing the sensors',
    category: 'Troubleshooting',
    relatedProducts: ['IoT home safety device'],
    publishedAt: '',
    readingTimeMinutes: 4,
    icon: Download,
    excerpt:
      'How to perform a safe sensor function test on the ARIOT home safety device after installation or firmware update.',
    toc: toc(['Before you test', 'Smoke sensor test', 'Gas sensor test', 'App notification test']),
  },
] as const;

export function getSupportArticleBySlug(slug: string): SupportArticle | undefined {
  return SUPPORT_ARTICLES.find((article) => article.slug === slug);
}

export function getRelatedArticles(slug: string): ReadonlyArray<SupportArticle> {
  return SUPPORT_ARTICLES.filter((article) => article.slug !== slug).slice(0, 2);
}
