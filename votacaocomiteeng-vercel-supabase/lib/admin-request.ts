import { isAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export async function requireAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return { user, allowed: Boolean(user && await isAdmin(user)) };
}
