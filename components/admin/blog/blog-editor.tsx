'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createSaveQueue, type QueueState, type SaveResult } from '@/lib/admin/product-save-queue';
import type { AdminBlogPostEditorDto } from '@/server/admin/blog/get-blog-post';
import type { BlogStatusValue } from '@/server/admin/blog/blog-schema';
import { BlogEditorForm } from './blog-editor-form';
import type {
  BlogCategoryOption,
  BlogEditorFormState,
} from './blog-editor-primitives';

/** Shared editor state/form shape (single source of truth in primitives). */
export type { BlogCategoryOption };
type FormState = BlogEditorFormState;

/**
 * BlogEditor — L3 Minimal Marketing CMS editor.
 *
 * Handles both create and edit modes. Edit uses the shared single-flight save
 * queue (`lib/admin/product-save-queue`). Publication state changes are
 * EXPLICIT only — the status select is a read-only chip; publishing happens
 * through dedicated Publish / Unpublish buttons so no auto-save can publish a
 * post by accident.
 */

// ── Types ────────────────────────────────────────────────────────────────────

interface BlogEditorProps {
  mode: 'create' | 'edit';
  post?: AdminBlogPostEditorDto;
  categories: BlogCategoryOption[];
  canWrite: boolean;
}

type EditorResult =
  | { ok: true; updatedAt: string; id?: string }
  | {
      ok: false;
      type: 'validation' | 'conflict' | 'duplicate' | 'forbidden' | 'error' | 'not_found';
      message?: string;
      fieldErrors?: Record<string, string[]>;
    };

const STATUS_LABEL: Record<
  BlogStatusValue,
  { label: string; variant: 'neutral' | 'warning' | 'success' | 'inactive' }
> = {
  DRAFT: { label: 'Draft', variant: 'neutral' },
  SCHEDULED: { label: 'Scheduled', variant: 'warning' },
  PUBLISHED: { label: 'Published', variant: 'success' },
  ARCHIVED: { label: 'Archived', variant: 'inactive' },
};

// ── Helpers ──────────────────────────────────────────────────────────────────

function emptyForm(): FormState {
  return {
    title: '',
    slug: '',
    excerpt: '',
    body: '',
    categoryId: '',
    tags: '',
    coverImageId: '',
    readingTimeMinutes: '',
    seoTitle: '',
    seoDescription: '',
    isLab: false,
  };
}

function postToForm(post: AdminBlogPostEditorDto): FormState {
  return {
    title: post.title,
    slug: post.slug,
    excerpt: post.excerpt ?? '',
    body: post.body,
    categoryId: post.categoryId,
    tags: Array.isArray(post.tags) ? post.tags.join(', ') : '',
    coverImageId: post.coverImageId ?? '',
    readingTimeMinutes: post.readingTimeMinutes ? String(post.readingTimeMinutes) : '',
    seoTitle: post.seoTitle ?? '',
    seoDescription: post.seoDescription ?? '',
    isLab: post.isLab,
  };
}

function parseTags(raw: string): string[] {
  return raw
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean)
    .slice(0, 20);
}

function formToData(form: FormState, status: BlogStatusValue) {
  return {
    title: form.title,
    slug: form.slug,
    excerpt: form.excerpt.trim() || null,
    body: form.body,
    categoryId: form.categoryId,
    tags: parseTags(form.tags),
    coverImageId: form.coverImageId.trim() || null,
    ogImageId: null,
    readingTimeMinutes: form.readingTimeMinutes ? Number(form.readingTimeMinutes) : undefined,
    status,
    seoTitle: form.seoTitle.trim() || null,
    seoDescription: form.seoDescription.trim() || null,
    isLab: form.isLab,
  };
}

function fieldErrorsOf(result: EditorResult): Record<string, string[]> {
  if ('fieldErrors' in result && result.fieldErrors) return result.fieldErrors;
  return {};
}

function slugFromTitle(title: string): string {
  return title
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-{2,}/g, '-')
    .replace(/^-|-$/g, '');
}

async function createPost(form: FormState, status: BlogStatusValue): Promise<EditorResult> {
  try {
    const res = await fetch('/api/admin/blog', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data: formToData(form, status) }),
    });
    return (await res.json()) as EditorResult;
  } catch {
    return { ok: false, type: 'error', message: 'Could not reach the server.' };
  }
}
// ── Component ────────────────────────────────────────────────────────────────

export function BlogEditor({ mode, post, categories, canWrite }: BlogEditorProps) {
  const router = useRouter();
  const routerRef = useRef<typeof router | null>(null);
  useEffect(() => {
    routerRef.current = router;
  }, [router]);

  const initialStatus: BlogStatusValue =
    mode === 'edit' && post ? (post.status as BlogStatusValue) : 'DRAFT';

  const [form, setForm] = useState<FormState>(() =>
    post ? postToForm(post) : { ...emptyForm(), categoryId: categories[0]?.id ?? '' },
  );
  const [currentStatus, setCurrentStatus] = useState<BlogStatusValue>(initialStatus);
  const [saveState, setSaveState] = useState<QueueState>('idle');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [slugManual, setSlugManual] = useState(false);

  const statusRef = useRef<BlogStatusValue>(initialStatus);
  const queueRef = useRef<ReturnType<typeof createSaveQueue<FormState>> | null>(null);

  useEffect(() => {
    if (mode !== 'edit' || !canWrite || !post) return;
    const queue = createSaveQueue<FormState>({
      initialToken: post.updatedAt,
      debounceMs: 1000,
      mutate: async (snapshot, token) => {
        const body = {
          expectedUpdatedAt: token,
          data: formToData(snapshot, statusRef.current),
        };
        try {
          const res = await fetch(`/api/admin/blog/${post.id}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
          });
          const result: EditorResult = await res.json();
          if (result.ok) {
            return { ok: true, updatedAt: result.updatedAt } satisfies SaveResult;
          }
          if (result.type === 'conflict') {
            setFormError(result.message ?? 'This post was updated elsewhere.');
            setSaveState('conflict');
          } else if (result.type === 'validation') {
            setFieldErrors(fieldErrorsOf(result));
            setFormError('Some fields are invalid.');
          } else if (result.type === 'duplicate') {
            setFieldErrors({ slug: [result.message ?? 'This slug is already in use.'] });
          } else {
            setFormError(result.message ?? 'Save failed.');
          }
          // Map the editor failure taxonomy onto the shared queue's SaveResult.
          // 'not_found' surfaces to the operator as a generic save failure.
          const queueType = result.type === 'not_found' ? ('error' as const) : result.type;
          return { ok: false, type: queueType } satisfies SaveResult;
        } catch {
          setFormError('Could not reach the server.');
          return { ok: false, type: 'error' };
        }
      },
      onStateChange: setSaveState,
      onTokenUpdate: () => {},
    });
    queueRef.current = queue;
    return () => {
      queue.dispose();
      queueRef.current = null;
    };
  }, [mode, canWrite, post]);

  // (Slug auto-generation moved into `updateField` — see below.)

  function updateField<K extends keyof FormState>(key: K, value: FormState[K]) {
    if (key === 'slug') {
      setSlugManual(true);
    }
    setForm((prev) => {
      const next = { ...prev, [key]: value };
      if (key === 'title' && !slugManual && mode === 'create') {
        next.slug = slugFromTitle(value as string);
      }
      return next;
    });
    setFormError(null);
    setFieldErrors((prev) => {
      if (!prev[String(key)]) return prev;
      const next = { ...prev };
      delete next[String(key)];
      return next;
    });
  }

  async function submitWithStatus(status: BlogStatusValue): Promise<void> {
    if (!canWrite) return;
    statusRef.current = status;
    setCurrentStatus(status);
    setFormError(null);

    if (mode === 'create') {
      const result = await createPost(form, status);
      if (!result.ok) {
        if (result.type === 'validation') setFieldErrors(fieldErrorsOf(result));
        else if (result.type === 'duplicate')
          setFieldErrors({ slug: [result.message ?? 'This slug is already in use.'] });
        else setFormError(result.message ?? 'Could not save the post.');
        return;
      }
      if (result.id) routerRef.current?.push(`/admin/blog/${result.id}`);
      return;
    }

    queueRef.current?.schedule(form);
    queueRef.current?.flush();
  }

  const readOnly = !canWrite;
  const isPublished = currentStatus === 'PUBLISHED';
  const statusInfo = STATUS_LABEL[currentStatus] ?? STATUS_LABEL.DRAFT;

  return (
    <BlogEditorForm
      mode={mode}
      post={post}
      form={form}
      categories={categories}
      readOnly={readOnly}
      isPublished={isPublished}
      statusInfo={statusInfo}
      saveState={saveState}
      fieldErrors={fieldErrors}
      formError={formError}
      slugManual={slugManual}
      updateField={updateField}
      submitWithStatus={submitWithStatus}
      setSlugManual={setSlugManual}
    />
  );
}