import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import LoginForm from "./login-form";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ recovery?: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (user) redirect("/");
  const params = await searchParams;
  return <LoginForm initialMessage={params.recovery === "invalid" ? "Este link de recuperação é inválido ou expirou. Solicite um novo link." : ""} />;
}
