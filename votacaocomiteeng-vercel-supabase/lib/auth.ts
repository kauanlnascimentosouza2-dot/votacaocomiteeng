import type { User } from "@supabase/supabase-js";

export function isAdmin(user: User | null) {
  const configured = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  return Boolean(user?.email && configured && user.email.toLowerCase() === configured);
}
