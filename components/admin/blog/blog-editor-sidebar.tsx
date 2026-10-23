'use client';

import { Archive, Save, Send, Undo2 } from 'lucide-react';
import type { AdminBlogPostEditorDto } from '@/server/admin/blog/get-blog-post';
import type { BlogStatusValue } from '@/server/admin/blog/blog-schema';
import { MediaPicker } from '@/components/admin/blog/media-picker';
import { BlogEditorFormState } from './blog-editor-primitives';

/**
 * BlogEditorSidebar — cover picker, explicit publication actions, and
 * read-only metadata for the Blog/Updates editor.
 */

interface BlogEditorSidebarProps {
  mode: 'create' | 'edit';
  post?: AdminBlogPostEditorDto;
  form: BlogEditorFormState;
  readOnly: boolean;
  isPublished: boolean;
  isSaving: boolean;
  /** Save content while keeping the current publication state. */
  onSave: () => void;
  onPublish: () => void;
  onUnpublish: () => void;
  onArchive: () => void;
  updateField: <K extends keyof BlogEditorFormState>(key: K, value: BlogEditorFormState[K]) => void;
}

export function BlogEditorSidebar({
  mode,
  post,
  form,
  readOnly,
  isPublished,
  isSaving,
  onSave,
  onPublish,
  onUnpublish,
  onArchive,
  updateField,
}: BlogEditorSidebarProps) {
  return (
    <aside className="border-steel-800 bg-bg-elevated space-y-5 rounded-lg border p-4">
      <MediaPicker
        selectedId={form.coverImageId || null}
        selectedUrl={post?.coverUrl ?? null}
        onSelect={(id) => updateField('coverImageId', id ?? '')}
        disabled={readOnly}
      />

      <div>
        <p className="text-steel-500 mb-2 text-xs font-medium tracking-wider uppercase">
          Publication
        </p>
        {mode === 'edit' && isPublished && post?.publishedAt && (
          <p className="text-steel-400 mb-2 text-xs">
            Published {new Date(post.publishedAt).toLocaleDateString('en-US')}
          </p>
        )}
        <div className="flex flex-col gap-2">
          {!readOnly && (
            <button
              type="button"
              disabled={isSaving}
              onClick={onSave}
              className="border-steel-700 bg-bg-base text-steel-200 hover:border-cyan-400 inline-flex items-center justify-center gap-1.5 rounded-md border px-3 py-2 text-sm font-medium transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:outline-none disabled:opacity-40"
            >
              <Save className="h-4 w-4" aria-hidden />
              Save changes
            </button>
          )}
          {!readOnly && !isPublished && (
            <button
              type="button"
              disabled={isSaving}
              onClick={onPublish}
              className="bg-cyan-400 text-bg-base hover:bg-cyan-300 inline-flex items-center justify-center gap-1.5 rounded-md px-3 py-2 text-sm font-semibold transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:outline-none disabled:opacity-40"
            >
              <Send className="h-4 w-4" aria-hidden />
              Publish
            </button>
          )}
          {!readOnly && isPublished && (
            <button
              type="button"
              disabled={isSaving}
              onClick={onUnpublish}
              className="border-steel-700 text-steel-200 hover:border-steel-500 inline-flex items-center justify-center gap-1.5 rounded-md border px-3 py-2 text-sm font-medium transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:outline-none disabled:opacity-40"
            >
              <Undo2 className="h-4 w-4" aria-hidden />
              Unpublish
            </button>
          )}
          {!readOnly && !isPublished && (
            <button
              type="button"
              disabled={isSaving}
              onClick={onArchive}
              className="text-steel-500 hover:text-steel-300 inline-flex items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:outline-none disabled:opacity-40"
            >
              <Archive className="h-3.5 w-3.5" aria-hidden />
              Archive
            </button>
          )}
        </div>
      </div>

      {mode === 'edit' && post && (
        <div>
          <p className="text-steel-500 mb-2 text-xs font-medium tracking-wider uppercase">
            Metadata
          </p>
          <dl className="space-y-2 text-xs">
            <div>
              <dt className="text-steel-500">ID</dt>
              <dd className="text-steel-300 font-mono break-all">{post.id}</dd>
            </div>
            <div>
              <dt className="text-steel-500">Created</dt>
              <dd className="text-steel-300">
                {new Date(post.createdAt).toLocaleDateString('en-US')}
              </dd>
            </div>
            <div>
              <dt className="text-steel-500">Last updated</dt>
              <dd className="text-steel-300">
                {new Date(post.updatedAt).toLocaleString('en-US')}
              </dd>
            </div>
            {isPublished && post.publishedAt && (
              <div>
                <dt className="text-steel-500">Published</dt>
                <dd className="text-steel-300">
                  {new Date(post.publishedAt).toLocaleString('en-US')}
                </dd>
              </div>
            )}
          </dl>
        </div>
      )}
    </aside>
  );
}

// Re-export the status type used by callers without importing it directly.
export type { BlogStatusValue };