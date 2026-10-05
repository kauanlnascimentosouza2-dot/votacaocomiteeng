"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function ResetPasswordForm() {
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const router = useRouter();

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    const data = new FormData(event.currentTarget);
    const password = String(data.get("password") ?? "");
    const confirmation = String(data.get("confirmation") ?? "");
    if (password.length < 8) {
      setMessage("A nova senha precisa ter pelo menos 8 caracteres.");
      setBusy(false);
      return;
    }
    if (password !== confirmation) {
      setMessage("As duas senhas não são iguais.");
      setBusy(false);
      return;
    }
    const { error } = await createClient().auth.updateUser({ password });
    if (error) {
      setMessage("O link expirou ou não foi possível alterar a senha. Solicite um novo link.");
    } else {
      setDone(true);
      setMessage("Senha alterada com sucesso. Você já pode continuar.");
    }
    setBusy(false);
  }

  return (
    <main className="login-shell">
      <section className="login-card">
        <div className="brand-logo"><img src="/logo-comite.png" alt="Comitê de Engenharias Senac" /></div>
        <p className="eyebrow">Segurança da conta</p>
        <h1>Criar nova senha</h1>
        <p className="login-copy">Escolha uma senha com pelo menos 8 caracteres.</p>
        {!done ? <form onSubmit={submit} className="login-form">
          <label>Nova senha<input name="password" type="password" minLength={8} required autoComplete="new-password" placeholder="Mínimo de 8 caracteres" /></label>
          <label>Confirmar nova senha<input name="confirmation" type="password" minLength={8} required autoComplete="new-password" placeholder="Digite novamente" /></label>
          {message && <p className="form-message" role="status">{message}</p>}
          <button className="primary-button" disabled={busy}>{busy ? "Alterando…" : "Salvar nova senha"}</button>
        </form> : <>
          <p className="form-message" role="status">{message}</p>
          <button className="primary-button" onClick={() => { router.push("/"); router.refresh(); }}>Continuar para o site</button>
        </>}
      </section>
    </main>
  );
}
