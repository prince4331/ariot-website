'use client';

import Link from 'next/link';
import { AlertCircle, ArrowLeft } from 'lucide-react';
import type { AdminBlogPostEditorDto } from '@/server/admin/blog/get-blog-post';
import type { BlogStatusValue } from '@/server/admin/blog/blog-schema';
import type { QueueState } from '@/lib/admin/product-save-queue';
import { AdminStatusChip } from '@/components/admin/admin-status-chip';
import { BlogEditorSidebar } from './blog-editor-sidebar';
import {
  BlogCategoryOption,
  BlogEditorFormState,
  Field,
  inputClass,
  normalizeSlugInput,
  StatusSaveIndicator,
} from './blog-editor-primitives';

export interface BlogEditorFormProps {
  mode: 'create' | 'edit';
  post?: AdminBlogPostEditorDto;
  form: BlogEditorFormState;
  categories: BlogCategoryOption[];
  readOnly: boolean;
  isPublished: boolean;
  statusInfo: { label: string; variant: 'neutral' | 'warning' | 'success' | 'inactive' };
  saveState: QueueState;
  fieldErrors: Record<string, string[]>;
  formError: string | null;
  slugManual: boolean;
  updateField: <K extends keyof BlogEditorFormState>(key: K, value: BlogEditorFormState[K]) => void;
  submitWithStatus: (status: BlogStatusValue) => void;
  setSlugManual: (v: boolean) => void;
}

export function BlogEditorForm(props: BlogEditorFormProps) {
  const {
    mode,
    post,
    form,
    categories,
    readOnly,
    isPublished,
    statusInfo,
    saveState,
    fieldErrors,
    formError,
    slugManual,
    updateField,
    submitWithStatus,
    setSlugManual,
  } = props;

  const isSaving = saveState === 'saving' || saveState === 'dirty' || saveState === 'saved';
  const currentStatusValue: BlogStatusValue = isPublished ? 'PUBLISHED' : 'DRAFT';
  const inputCls = (ro: boolean) => inputClass(ro);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <Link
            href="/admin/blog"
            className="text-steel-400 hover:text-steel-200 mb-2 inline-flex items-center gap-1.5 rounded text-sm focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:outline-none"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden />
            Back to Blog &amp; Updates
          </Link>
          <h1 className="font-display text-steel-50 truncate text-2xl font-semibold tracking-tight">
            {mode === 'create' ? 'New post' : form.title || 'Untitled post'}
          </h1>
          <p className="text-steel-400 mt-0.5 flex items-center gap-2 text-sm">
            <AdminStatusChip variant={statusInfo.variant} label={statusInfo.label} size="sm" />
            {post?.authorName && <span className="text-steel-500">By {post.authorName}</span>}
            {readOnly && (
              <span className="bg-steel-800 text-steel-400 rounded px-2 py-0.5 text-[10px] font-medium">
                Read-only
              </span>
            )}
          </p>
        </div>
        <StatusSaveIndicator saveState={saveState} />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
        <div className="border-steel-800 bg-bg-elevated space-y-5 rounded-lg border p-5">
          {formError && (
            <div className="border-danger/30 bg-danger/10 text-danger flex items-start gap-2 rounded-md border px-3 py-2 text-sm">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              {formError}
            </div>
          )}

          <Field label="Title" required error={fieldErrors['title']}>
            <input
              type="text"
              value={form.title}
              readOnly={readOnly}
              onChange={(e) => updateField('title', e.target.value)}
              placeholder="Post title"
              className={inputCls(readOnly)}
            />
          </Field>

          <Field
            label="Slug"
            required
            error={fieldErrors['slug']}
            help={
              slugManual
                ? `Manual slug — the public URL is /blog/${form.slug || '…'}.`
                : 'Auto-generated from the title. Type to customise.'
            }
          >
            <input
              type="text"
              value={form.slug}
              readOnly={readOnly}
              onChange={(e) => {
                if (!slugManual) setSlugManual(true);
                updateField('slug', normalizeSlugInput(e.target.value));
              }}
              placeholder="post-slug"
              className={inputCls(readOnly)}
            />
          </Field>

          <Field
            label="Excerpt"
            error={fieldErrors['excerpt']}
            help="One or two sentences shown on cards and in search results."
          >
            <textarea
              value={form.excerpt}
              readOnly={readOnly}
              rows={2}
              onChange={(e) => updateField('excerpt', e.target.value)}
              placeholder="Short summary of the post"
              className={inputCls(readOnly)}
            />
          </Field>

          <Field
            label="Body (Markdown)"
            required
            error={fieldErrors['body']}
            help="Markdown is rendered safely on the public site. Embedded scripts and custom components are never executed."
          >
            <textarea
              value={form.body}
              readOnly={readOnly}
              rows={18}
              onChange={(e) => updateField('body', e.target.value)}
              placeholder={'## Heading\n\nWrite your post in Markdown…'}
              className={`${inputCls(readOnly)} font-mono text-[13px] leading-relaxed`}
            />
          </Field>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <Field label="Category" required error={fieldErrors['categoryId']}>
              <select
                value={form.categoryId}
                disabled={readOnly}
                onChange={(e) => updateField('categoryId', e.target.value)}
                className={inputCls(readOnly)}
              >
                <option value="">Select a category</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                    {category.isPublished ? '' : ' (hidden)'}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Tags" error={fieldErrors['tags']} help="Comma-separated, up to 20.">
              <input
                type="text"
                value={form.tags}
                readOnly={readOnly}
                onChange={(e) => updateField('tags', e.target.value)}
                placeholder="robotics, slam, field-test"
                className={inputCls(readOnly)}
              />
            </Field>
          </div>

          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <Field
              label="Reading time (minutes)"
              error={fieldErrors['readingTimeMinutes']}
              help="Blank = auto-estimated from the body."
            >
              <input
                type="number"
                min={1}
                max={240}
                value={form.readingTimeMinutes}
                readOnly={readOnly}
                onChange={(e) => updateField('readingTimeMinutes', e.target.value)}
                placeholder="Auto"
                className={inputCls(readOnly)}
              />
            </Field>
            <label className="flex items-center gap-2 pt-6">
              <input
                type="checkbox"
                checked={form.isLab}
                disabled={readOnly}
                onChange={(e) => updateField('isLab', e.target.checked)}
                className="border-steel-700 bg-bg-elevated h-4 w-4 rounded border focus-visible:ring-2 focus-visible:ring-cyan-400"
              />
              <span className="text-steel-300 text-sm">R&amp;D / Lab entry</span>
            </label>
          </div>

          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <Field
              label="SEO title"
              error={fieldErrors['seoTitle']}
              help="≤ 70 characters. Blank = post title."
            >
              <input
                type="text"
                value={form.seoTitle}
                readOnly={readOnly}
                onChange={(e) => updateField('seoTitle', e.target.value)}
                className={inputCls(readOnly)}
              />
            </Field>
            <Field
              label="SEO description"
              error={fieldErrors['seoDescription']}
              help="≤ 160 characters. Blank = excerpt."
            >
              <textarea
                value={form.seoDescription}
                readOnly={readOnly}
                rows={2}
                onChange={(e) => updateField('seoDescription', e.target.value)}
                className={inputCls(readOnly)}
              />
            </Field>
          </div>
        </div>

        <BlogEditorSidebar
          mode={mode}
          post={post}
          form={form}
          readOnly={readOnly}
          isPublished={isPublished}
          isSaving={isSaving}
          onSave={() => submitWithStatus(currentStatusValue)}
          onPublish={() => submitWithStatus('PUBLISHED')}
          onUnpublish={() => submitWithStatus('DRAFT')}
          onArchive={() => submitWithStatus('ARCHIVED')}
          updateField={updateField}
        />
      </div>
    </div>
  );
}