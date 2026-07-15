import { redirect } from "next/navigation";

// Registration is invite-only: members register from a community invite link
// (/join/[token]) and community owners are onboarded by email. There is no
// public self-service registration.
export default function RegisterPage() {
  redirect("/login");
}
