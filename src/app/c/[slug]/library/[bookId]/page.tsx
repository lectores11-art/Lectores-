import { BookReaderPageClient } from "@/components/library/book-reader-page-client";

export default async function BookReaderPage({
  params,
}: {
  params: Promise<{ slug: string; bookId: string }>;
}) {
  const { slug, bookId } = await params;
  return <BookReaderPageClient slug={slug} bookId={bookId} />;
}
