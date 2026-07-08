import { redirect } from "next/navigation";

export default async function CommunityIndex({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  redirect(`/c/${slug}/forum`);
}
