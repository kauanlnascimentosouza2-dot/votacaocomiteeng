import type { User } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";

export function configuredAdminEmails() {
  return (process.env.ADMIN_EMAIL ?? "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

export async function isAdmin(user: User | null) {
  const email = user?.email?.trim().toLowerCase();
  if (!email) return false;
  if (configuredAdminEmails().includes(email)) return true;

  const admin = createAdminClient();
  const { data } = await admin.from("admins").select("email").eq("email", email).maybeSingle();
  return Boolean(data);
}
