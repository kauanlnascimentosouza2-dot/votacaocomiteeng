"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function LoginForm({ initialMessage = "" }: { initialMessage?: string }) {
  const [mode, setMode] = useState<"login" | "register" | "forgot">("login");
  const [message, setMessage] = useState(initialMessage);
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setMessage("");
    const data = new FormData(event.currentTarget);
    const name = String(data.get("name") ?? "").trim();
    const email = String(data.get("email") ?? "").trim();
    const password = String(data.get("password") ?? "");
    const supabase = createClient();
    if (mode === "forgot") {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`,
      });
      setMessage(error
        ? "Não foi possível enviar o link agora. Aguarde um pouco e tente novamente."
        : "Se esse e-mail estiver cadastrado, você receberá um link para criar uma nova senha. Confira também a caixa de spam.");
    } else if (mode === "register") {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { name }, emailRedirectTo: `${window.location.origin}/auth/callback` },
      });
      setMessage(error ? error.message : "Cadastro realizado. Verifique seu e-mail para confirmar o acesso.");
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) setMessage("E-mail ou senha incorretos.");
      else { router.push("/"); router.refresh(); }
    }
    setBusy(false);
  }

  return (
    <main className="login-shell">
      <section className="login-card">
        <div className="brand-logo"><img src="/logo-comite.png" alt="Comitê de Engenharias Senac" /></div>
        <p className="eyebrow">Comitê de Engenharia</p>
        <h1>votacaocomiteeng</h1>
        <p className="login-copy">{mode === "forgot" ? "Informe seu e-mail para receber o link de recuperação." : "Entre para consultar as propostas e registrar seu voto."}</p>
        <form onSubmit={submit} className="login-form">
          {mode === "register" && <label>Nome<input name="name" required autoComplete="name" placeholder="Seu nome" /></label>}
          <label>E-mail<input name="email" type="email" required autoComplete="email" placeholder="nome@empresa.com" /></label>
          {mode !== "forgot" && <label>Senha<input name="password" type="password" minLength={8} required autoComplete={mode === "login" ? "current-password" : "new-password"} placeholder="Mínimo de 8 caracteres" /></label>}
          {mode === "login" && <button type="button" className="forgot-button" onClick={() => { setMode("forgot"); setMessage(""); }}>Esqueci minha senha</button>}
          {message && <p className="form-message" role="status">{message}</p>}
          <button className="primary-button" disabled={busy}>{busy ? "Aguarde…" : mode === "login" ? "Entrar" : mode === "register" ? "Criar conta" : "Enviar link de recuperação"}</button>
        </form>
        <button className="text-button" onClick={() => { setMode(mode === "login" ? "register" : "login"); setMessage(""); }}>
          {mode === "login" ? "Ainda não tenho conta" : "Voltar para entrar"}
        </button>
      </section>
    </main>
  );
}
