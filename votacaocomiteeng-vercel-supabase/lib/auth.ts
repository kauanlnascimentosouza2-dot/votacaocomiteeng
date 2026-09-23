import type { User } from "@supabase/supabase-js";

export function isAdmin(user: User | null) {
  const configured = (process.env.ADMIN_EMAIL ?? "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);

  return Boolean(
    user?.email && configured.includes(user.email.trim().toLowerCase()),
  );
}
