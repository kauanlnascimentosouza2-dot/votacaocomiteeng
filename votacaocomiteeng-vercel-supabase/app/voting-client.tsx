"use client";

import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { BarChart3, CalendarDays, Check, ChevronRight, CircleUserRound, Clock3, Download, Edit3, FileText, LogOut, Plus, Save, Settings2, ShieldCheck, Trash2, UserPlus, Users, Vote, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type Proposal = { id: string; title: string; description: string; image_url: string | null; accent: string };
type VoteRow = { id: string; userName: string; email: string; proposalTitle: string; createdAt: string };
type AppState = {
  user: { name: string; email: string; isAdmin: boolean };
  poll: { id: string; title: string; description: string; status: "active" | "closed"; ends_at: string | null } | null;
  proposals: Array<Record<string, unknown>>;
  myVote: Record<string, unknown> | null;
  results: Array<{ proposalId: string; total: number }>;
  votes: VoteRow[];
  admins: string[];
};

export default function VotingClient({ initialState }: { initialState: AppState }) {
  const state = { ...initialState, proposals: initialState.proposals as unknown as Proposal[] };
  const [tab, setTab] = useState<"voting" | "admin">("voting");
  const [selected, setSelected] = useState<Proposal | null>(null);
  const [previewImage, setPreviewImage] = useState<Proposal | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const router = useRouter();
  const totalVotes = useMemo(() => state.results.reduce((sum, item) => sum + item.total, 0), [state.results]);

  async function vote() {
    if (!selected) return;
    setBusy(true); setNotice("");
    const response = await fetch("/api/vote", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ proposalId: selected.id }) });
    const data = await response.json();
    if (!response.ok) setNotice(data.error || "Não foi possível registrar o voto.");
    else { setSelected(null); setNotice("Voto registrado com sucesso."); router.refresh(); }
    setBusy(false);
  }

  async function addProposal(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setNotice("");
    const form = event.currentTarget;
    const response = await fetch("/api/admin/proposals", { method: "POST", body: new FormData(form) });
    const data = await response.json();
    if (!response.ok) setNotice(data.error || "Não foi possível adicionar a proposta.");
    else { form.reset(); setNotice("Proposta adicionada."); router.refresh(); }
    setBusy(false);
  }

  async function editProposal(event: FormEvent<HTMLFormElement>, proposalId: string) {
    event.preventDefault(); setBusy(true); setNotice("");
    const response = await fetch(`/api/admin/proposals/${proposalId}`, { method: "PATCH", body: new FormData(event.currentTarget) });
    const data = await response.json();
    setNotice(response.ok ? "Proposta atualizada." : data.error || "Não foi possível editar a proposta.");
    if (response.ok) router.refresh();
    setBusy(false);
  }

  async function deleteProposal(proposal: Proposal) {
    if (!window.confirm(`Excluir a proposta “${proposal.title}”? Esta ação não poderá ser desfeita.`)) return;
    setBusy(true); setNotice("");
    const response = await fetch(`/api/admin/proposals/${proposal.id}`, { method: "DELETE" });
    const data = await response.json();
    setNotice(response.ok ? "Proposta excluída." : data.error || "Não foi possível excluir a proposta.");
    if (response.ok) router.refresh();
    setBusy(false);
  }

  async function updatePoll(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!state.poll) return;
    setBusy(true); setNotice("");
    const data = new FormData(event.currentTarget);
    const endsAtValue = String(data.get("endsAt") ?? "");
    const response = await fetch("/api/admin/poll", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ pollId: state.poll.id, status: String(data.get("status")), endsAt: endsAtValue ? new Date(endsAtValue).toISOString() : null }) });
    const payload = await response.json();
    setNotice(response.ok ? "Configuração da votação atualizada." : payload.error || "Não foi possível atualizar a votação.");
    if (response.ok) router.refresh();
    setBusy(false);
  }

  async function addAdmin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setNotice("");
    const form = event.currentTarget;
    const email = String(new FormData(form).get("email") ?? "");
    const response = await fetch("/api/admin/admins", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email }) });
    const payload = await response.json();
    setNotice(response.ok ? "Administrador adicionado." : payload.error || "Não foi possível adicionar o administrador.");
    if (response.ok) { form.reset(); router.refresh(); }
    setBusy(false);
  }

  async function removeAdmin(email: string) {
    if (!window.confirm(`Remover o acesso administrativo de ${email}?`)) return;
    setBusy(true); setNotice("");
    const response = await fetch("/api/admin/admins", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email }) });
    const payload = await response.json();
    setNotice(response.ok ? "Administrador removido." : payload.error || "Não foi possível remover o administrador.");
    if (response.ok) router.refresh();
    setBusy(false);
  }

  async function signOut() {
    await createClient().auth.signOut();
    router.push("/login"); router.refresh();
  }

  if (!state.poll) return <main className="empty-state"><div className="brand-logo"><img src="/logo-comite.png" alt="Comitê de Engenharias Senac" /></div><h1>Não há votação aberta</h1><button className="text-button" onClick={signOut}>Sair</button></main>;

  return (
    <div className="app-shell">
      <header className="topbar"><div className="topbar-inner"><div className="brand"><div className="brand-logo small"><img src="/logo-comite.png" alt="Comitê de Engenharias Senac" /></div><div><strong>votacaocomiteeng</strong><span>Comitê de Engenharia</span></div></div><div className="user-area"><div><strong>{state.user.name}</strong><span>{state.user.isAdmin ? "Administrador" : "Participante"}</span></div><CircleUserRound/><button className="icon-button" onClick={signOut} aria-label="Sair"><LogOut/></button></div></div></header>
      <main className="workspace">
        <section className="page-heading"><div><div className="status-line"><span className={`status-pill ${state.poll.status === "closed" ? "closed" : ""}`}>{state.poll.status === "active" ? "Votação aberta" : "Votação encerrada"}</span><span><Clock3/> {state.poll.ends_at ? `Encerra em ${new Intl.DateTimeFormat("pt-BR", { dateStyle: "long" }).format(new Date(state.poll.ends_at))}` : "Sem prazo definido"}</span></div><h1>{state.poll.title}</h1><p>{state.poll.description}</p></div>{state.user.isAdmin && <nav className="tabs"><button className={tab === "voting" ? "active" : ""} onClick={() => setTab("voting")}><Vote/>Votação</button><button className={tab === "admin" ? "active" : ""} onClick={() => setTab("admin")}><Settings2/>Painel admin</button></nav>}</section>
        {notice && <div className="notice" role="status">{notice}</div>}

        {tab === "voting" ? <>
          {state.myVote && <div className="success-banner"><span><Check/></span><div><strong>Seu voto foi registrado</strong><p>A escolha não pode ser alterada nesta votação.</p></div></div>}
          <section className="proposal-grid">{state.proposals.map((proposal, index) => {
            const chosen = String(state.myVote?.proposal_id ?? "") === proposal.id;
            return <article className={`proposal-card ${chosen ? "chosen" : ""}`} key={proposal.id}><div className={`proposal-media ${proposal.accent}`}>{proposal.image_url ? <button type="button" className="proposal-image-button" onClick={() => setPreviewImage(proposal)} aria-label={`Ampliar imagem de ${proposal.title}`}><img src={proposal.image_url} alt={proposal.title}/></button> : <FileText/>}<span>Proposta {String(index + 1).padStart(2, "0")}</span></div><div className="proposal-copy"><h2>{proposal.title}</h2><p>{proposal.description}</p><button disabled={Boolean(state.myVote) || state.poll?.status !== "active"} onClick={() => setSelected(proposal)} className={chosen ? "chosen-button" : "card-button"}>{chosen ? <><Check/>Sua escolha</> : state.poll?.status === "closed" ? "Votação encerrada" : <>Selecionar proposta<ChevronRight/></>}</button></div></article>;
          })}</section>
          <p className="privacy-note"><ShieldCheck/>O administrador poderá consultar a autoria dos votos.</p>
        </> : <AdminPanel state={state} totalVotes={totalVotes} busy={busy} onAdd={addProposal} onEdit={editProposal} onDelete={deleteProposal} onUpdatePoll={updatePoll} onAddAdmin={addAdmin} onRemoveAdmin={removeAdmin}/>} 
      </main>

      {previewImage?.image_url && <div className="image-preview-backdrop" onMouseDown={() => setPreviewImage(null)}><section className="image-preview" onMouseDown={(event) => event.stopPropagation()} role="dialog" aria-modal="true" aria-label={`Imagem ampliada de ${previewImage.title}`}><button type="button" className="image-preview-close" onClick={() => setPreviewImage(null)} aria-label="Fechar imagem"><X/></button><img src={previewImage.image_url} alt={previewImage.title}/><div><strong>{previewImage.title}</strong><span>Clique fora da imagem para fechar</span></div></section></div>}
      {selected && <div className="modal-backdrop" onMouseDown={() => setSelected(null)}><section className="modal" onMouseDown={(event) => event.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="confirm-title"><h2 id="confirm-title">Confirmar seu voto?</h2><p>Você está escolhendo <strong>{selected.title}</strong>. Depois de confirmar, o voto não poderá ser alterado.</p><div className="modal-actions"><button className="secondary-button" onClick={() => setSelected(null)}>Voltar</button><button className="primary-button" onClick={vote} disabled={busy}>{busy ? "Registrando…" : "Confirmar voto"}</button></div></section></div>}
    </div>
  );
}

function AdminPanel({ state, totalVotes, busy, onAdd, onEdit, onDelete, onUpdatePoll, onAddAdmin, onRemoveAdmin }: { state: ReturnType<typeof normalizeState>; totalVotes: number; busy: boolean; onAdd: (event: FormEvent<HTMLFormElement>) => void; onEdit: (event: FormEvent<HTMLFormElement>, proposalId: string) => void; onDelete: (proposal: Proposal) => void; onUpdatePoll: (event: FormEvent<HTMLFormElement>) => void; onAddAdmin: (event: FormEvent<HTMLFormElement>) => void; onRemoveAdmin: (email: string) => void }) {
  const resultFor = (id: string) => state.results.find((result) => result.proposalId === id)?.total ?? 0;
  const exportVotes = () => {
    const safe = (value: string) => { const guarded = /^[=+@-]/.test(value) ? `'${value}` : value; return `"${guarded.replaceAll('"', '""')}"`; };
    const lines = [["Participante", "E-mail", "Proposta", "Data e hora"], ...state.votes.map((row) => [row.userName, row.email, row.proposalTitle, new Date(row.createdAt).toLocaleString("pt-BR")])];
    const blob = new Blob(["\uFEFF" + lines.map((line) => line.map(safe).join(";")).join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob); const link = document.createElement("a"); link.href = url; link.download = "resultado-votacao.csv"; link.click(); URL.revokeObjectURL(url);
  };
  const localDate = state.poll?.ends_at ? new Date(new Date(state.poll.ends_at).getTime() - new Date(state.poll.ends_at).getTimezoneOffset() * 60000).toISOString().slice(0, 16) : "";
  return <div className="admin-layout">
    <section className="stats"><Stat icon={<Users/>} label="Votos registrados" value={String(totalVotes)}/><Stat icon={<FileText/>} label="Propostas" value={String(state.proposals.length)}/><Stat icon={<CalendarDays/>} label="Prazo" value={state.poll?.ends_at ? new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short" }).format(new Date(state.poll.ends_at)) : "Livre"}/></section>
    <div className="admin-grid">
      <section className="panel"><div className="panel-title"><BarChart3/><h2>Resultado parcial</h2></div><div className="results">{state.proposals.map((proposal) => { const count = resultFor(proposal.id); const percent = totalVotes ? Math.round(count / totalVotes * 100) : 0; return <div key={proposal.id}><div className="result-label"><span>{proposal.title}</span><strong>{count} votos · {percent}%</strong></div><div className="progress"><span style={{ width: `${percent}%` }}/></div></div>; })}</div></section>
      <section className="panel"><div className="panel-title"><Settings2/><h2>Controle da votação</h2></div><form onSubmit={onUpdatePoll} className="admin-form"><label>Status<select name="status" defaultValue={state.poll?.status ?? "active"}><option value="active">Aberta</option><option value="closed">Encerrada</option></select></label><label>Data de encerramento <small>Deixe vazio para não ter prazo</small><input name="endsAt" type="datetime-local" defaultValue={localDate}/></label><button className="primary-button" disabled={busy}><Save/>{busy ? "Salvando…" : "Salvar configuração"}</button></form></section>
    </div>
    <section className="panel management-panel"><div className="panel-title"><Edit3/><div><h2>Gerenciar propostas</h2><p>Propostas que já receberam votos podem ser editadas, mas não excluídas.</p></div></div><div className="manage-list">{state.proposals.map((proposal) => <details className="manage-item" key={proposal.id}><summary><span>{proposal.title}</span><span>{resultFor(proposal.id)} voto(s)</span></summary><form onSubmit={(event) => onEdit(event, proposal.id)} className="admin-form"><label>Título<input name="title" defaultValue={proposal.title} required/></label><label>Descrição<textarea name="description" defaultValue={proposal.description} required/></label><label>Trocar imagem <small>Opcional</small><input name="image" type="file" accept="image/jpeg,image/png,image/webp"/></label><div className="form-actions"><button type="button" className="danger-button" onClick={() => onDelete(proposal)} disabled={busy || resultFor(proposal.id) > 0}><Trash2/>Excluir</button><button className="primary-button" disabled={busy}><Save/>Salvar alterações</button></div></form></details>)}</div></section>
    <div className="admin-grid">
      <section className="panel"><div className="panel-title"><Plus/><h2>Nova proposta</h2></div><form onSubmit={onAdd} className="admin-form"><label>Título<input name="title" required placeholder="Nome da proposta"/></label><label>Descrição<textarea name="description" required placeholder="Explique o objetivo e o impacto"/></label><label>Imagem <small>JPG, PNG ou WebP</small><input name="image" type="file" accept="image/jpeg,image/png,image/webp"/></label><button className="primary-button" disabled={busy}><Plus/>{busy ? "Adicionando…" : "Adicionar proposta"}</button></form></section>
      <section className="panel"><div className="panel-title"><UserPlus/><h2>Administradores</h2></div><form onSubmit={onAddAdmin} className="inline-form"><input name="email" type="email" required placeholder="novo.admin@email.com"/><button className="primary-button" disabled={busy}><Plus/>Adicionar</button></form><div className="admin-list">{state.admins.map((email) => <div key={email}><span>{email}</span><button type="button" className="icon-danger" onClick={() => onRemoveAdmin(email)} disabled={busy || email === state.user.email.toLowerCase()} aria-label={`Remover ${email}`}><Trash2/></button></div>)}</div></section>
    </div>
    <section className="panel votes-panel"><div className="panel-title panel-title-actions"><div className="panel-title"><Users/><div><h2>Registro de votos</h2><p>Visível somente para administradores.</p></div></div><button type="button" className="secondary-button" onClick={exportVotes} disabled={!state.votes.length}><Download/>Exportar CSV</button></div><div className="table-wrap"><table><thead><tr><th>Participante</th><th>Proposta escolhida</th><th>Data e hora</th></tr></thead><tbody>{state.votes.length ? state.votes.map((row) => <tr key={row.id}><td><strong>{row.userName}</strong><span>{row.email}</span></td><td>{row.proposalTitle}</td><td>{new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(row.createdAt))}</td></tr>) : <tr><td colSpan={3} className="empty-cell">Ainda não há votos registrados.</td></tr>}</tbody></table></div></section>
  </div>;
}

function normalizeState(state: AppState) { return { ...state, proposals: state.proposals as unknown as Proposal[] }; }
function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) { return <article className="stat-card"><span>{icon}</span><div><p>{label}</p><strong>{value}</strong></div></article>; }
