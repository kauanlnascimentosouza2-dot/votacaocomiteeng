"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function LoginForm() {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setMessage("");
    const data = new FormData(event.currentTarget);
    const name = String(data.get("name") ?? "").trim();
    const email = String(data.get("email") ?? "").trim();
    const password = String(data.get("password") ?? "");
    const supabase = createClient();
    if (mode === "register") {
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
        <p className="login-copy">Entre para consultar as propostas e registrar seu voto.</p>
        <form onSubmit={submit} className="login-form">
          {mode === "register" && <label>Nome<input name="name" required autoComplete="name" placeholder="Seu nome" /></label>}
          <label>E-mail<input name="email" type="email" required autoComplete="email" placeholder="nome@empresa.com" /></label>
          <label>Senha<input name="password" type="password" minLength={8} required autoComplete={mode === "login" ? "current-password" : "new-password"} placeholder="Mínimo de 8 caracteres" /></label>
          {message && <p className="form-message" role="status">{message}</p>}
          <button className="primary-button" disabled={busy}>{busy ? "Aguarde…" : mode === "login" ? "Entrar" : "Criar conta"}</button>
        </form>
        <button className="text-button" onClick={() => { setMode(mode === "login" ? "register" : "login"); setMessage(""); }}>
          {mode === "login" ? "Ainda não tenho conta" : "Já tenho uma conta"}
        </button>
      </section>
    </main>
  );
}
