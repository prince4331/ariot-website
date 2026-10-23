import { BookOpen, FlaskConical, NotebookPen, Wifi, type LucideIcon } from 'lucide-react';

/**
 * Category icon mapping for DB-backed blog/update cards.
 *
 * BlogPost rows carry a category slug, not an icon. This maps the seeded
 * launch taxonomy to the same glyphs the legacy static teasers used, with a
 * neutral fallback for any category added later through the admin panel.
 */

const CATEGORY_ICONS: Readonly<Record<string, LucideIcon>> = {
  'robotics-rd': FlaskConical,
  'iot-in-bangladesh': Wifi,
  'engineering-notes': BookOpen,
};

export function blogCategoryIcon(categorySlug: string): LucideIcon {
  return CATEGORY_ICONS[categorySlug] ?? NotebookPen;
}