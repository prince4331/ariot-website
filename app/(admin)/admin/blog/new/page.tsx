import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { AuthenticationError, AuthorizationError } from '@/server/auth/errors';
import { getBlogEditorCategories } from '@/server/admin/blog/get-blog-post';
import { BlogEditor } from '@/components/admin/blog/blog-editor';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'New post',
  robots: { index: false, follow: false },
};

export default async function AdminBlogNewPage() {
  let payload;
  try {
    payload = await getBlogEditorCategories();
  } catch (err) {
    if (err instanceof AuthenticationError) redirect('/sign-in');
    if (err instanceof AuthorizationError) redirect('/');
    throw err;
  }

  return (
    <BlogEditor
      mode="create"
      categories={payload.categories}
      canWrite={payload.canWrite}
    />
  );
}