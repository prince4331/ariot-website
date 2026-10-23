import { notFound, redirect } from 'next/navigation';
import { AuthenticationError, AuthorizationError } from '@/server/auth/errors';
import { getBlogPostForEditor } from '@/server/admin/blog/get-blog-post';
import { BlogEditor } from '@/components/admin/blog/blog-editor';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return {
    title: `Edit post — ${id}`,
    robots: { index: false, follow: false },
  };
}

export default async function AdminBlogEditorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  let result;
  try {
    result = await getBlogPostForEditor(id);
  } catch (err) {
    if (err instanceof AuthenticationError) redirect('/sign-in');
    if (err instanceof AuthorizationError) redirect('/');
    throw err;
  }

  if (!result) notFound();

  return (
    <BlogEditor
      mode="edit"
      post={result.post}
      categories={result.categories}
      canWrite={result.post.canEdit}
    />
  );
}