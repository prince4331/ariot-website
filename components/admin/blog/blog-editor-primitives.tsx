'use client';

import { AlertCircle, CheckCircle, Loader2 } from 'lucide-react';
import type { QueueState } from '@/lib/admin/product-save-queue';

/**
 * Shared blog-editor primitives — L3 Minimal Marketing CMS.
 * Types, input styling, field wrapper, and save indicator shared by the
 * BlogEditorForm and BlogEditorSidebar components.
 */

export interface BlogEditorFormState {
  title: string;
  slug: string;
  excerpt: string;
  body: string;
  categoryId: string;
  tags: string;
  coverImageId: string;
  readingTimeMinutes: string;
  seoTitle: string;
  seoDescription: string;
  isLab: boolean;
}

export interface BlogCategoryOption {
  id: string;
  name: string;
  slug: string;
  isPublished: boolean;
}

export function inputClass(readOnly: boolean): string {
  return `w-full rounded-md border border-steel-700 bg-bg-elevated px-3 py-2 text-sm text-steel-100 placeholder:text-steel-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 ${
    readOnly ? 'cursor-not-allowed opacity-60' : ''
  }`;
}

export function Field({
  label,
  required,
  error,
  help,
  children,
}: {
  label: string;
  required?: boolean;
  error?: string[];
  help?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="text-steel-200 mb-1.5 block text-sm font-medium">
        {label}
        {required && <span className="text-danger ml-0.5">*</span>}
      </label>
      {children}
      {help && !error?.length && <p className="text-steel-500 mt-1 text-xs">{help}</p>}
      {error?.map((e, i) => (
        <p key={i} className="text-danger mt-1 text-xs">
          {e}
        </p>
      ))}
    </div>
  );
}

export function StatusSaveIndicator({ saveState }: { saveState: QueueState }) {
  if (saveState === 'saving')
    return (
      <span className="text-steel-400 inline-flex items-center gap-1.5">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Saving…
      </span>
    );
  if (saveState === 'saved')
    return (
      <span className="text-success inline-flex items-center gap-1.5">
        <CheckCircle className="h-4 w-4" aria-hidden /> Saved
      </span>
    );
  if (saveState === 'error' || saveState === 'conflict')
    return (
      <span className="text-danger inline-flex items-center gap-1.5">
        <AlertCircle className="h-4 w-4" aria-hidden /> Save failed
      </span>
    );
  return null;
}

export function normalizeSlugInput(raw: string): string {
  return raw
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-{2,}/g, '-')
    .replace(/^-|-$/g, '');
}