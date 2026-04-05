import AdminLayout from "@/components/admin/admin-layout";
import PostEditor from "@/components/admin/post-editor";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function EditPostPage({ params }: PageProps) {
  const { id } = await params;
  return (
    <AdminLayout>
      <PostEditor postId={id} />
    </AdminLayout>
  );
}
