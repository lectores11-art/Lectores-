import { ThreadDetailClient } from "@/components/forum/thread-detail-client";

export default async function ThreadPage({
  params,
}: {
  params: Promise<{ slug: string; threadId: string }>;
}) {
  const { slug, threadId } = await params;
  return <ThreadDetailClient slug={slug} threadId={threadId} />;
}
