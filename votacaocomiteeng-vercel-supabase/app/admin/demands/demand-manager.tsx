"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarClock, CheckSquare, ChevronDown, CirclePlus, ClipboardList, Lock, Users } from "lucide-react";

type Semester = { id: string; name: string; status: "draft" | "active" | "closed" } | null;
type Group = { id: string; name: string; status: "building" | "active" | "archived" };
type Deliverable = { id: string; title: string; due_at: string | null; is_final: boolean; position: number };
type Demand = { id: string; title: string; description: string; status: string; voting_enabled: boolean; ballot_visibility: string; submission_due_at: string | null; publication_at: string | null; voting_starts_at: string | null; voting_ends_at: string | null; demand_groups: Array<{ group_id: string }>; deliverables: Deliverable[] };

export default function DemandManager({ semester, groups, demands }: { semester: Semester; groups: Group[]; demands: Demand[] }) {
  const router = useRouter();
  const activeGroups = groups.filter((group) => group.status === "active");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [allGroups, setAllGroups] = useState(true);
  const [voting, setVoting] = useState(true);
  const [steps, setSteps] = useState([{ title: "", instructions: "", dueAt: "" }]);

  async function createDemand(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!semester) return;
    setBusy(true); setNotice("");
    const form = event.currentTarget;
    const data = new FormData(form);
    const groupIds = allGroups ? activeGroups.map((group) => group.id) : data.getAll("groups").map(String);
    const response = await fetch("/api/admin/demands", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({
      semesterId: semester.id,
      title: data.get("title"), description: data.get("description"), groupIds,
      votingEnabled: voting, ballotVisibility: data.get("ballotVisibility"),
      submissionOpensAt: iso(data.get("submissionOpensAt")), submissionDueAt: iso(data.get("submissionDueAt")), publicationAt: iso(data.get("publicationAt")),
      votingStartsAt: voting ? iso(data.get("votingStartsAt")) : null, votingEndsAt: voting ? iso(data.get("votingEndsAt")) : null,
      deliverables: steps.map((_, index) => ({ title: data.get(`stepTitle${index}`), instructions: data.get(`stepInstructions${index}`), dueAt: iso(data.get(`stepDue${index}`)) })),
    }) });
    const payload = await response.json().catch(() => ({}));
    setNotice(response.ok ? "Demanda criada e distribuída aos grupos selecionados." : payload.error || "Não foi possível criar a demanda.");
    if (response.ok) { form.reset(); setSteps([{ title: "", instructions: "", dueAt: "" }]); router.refresh(); }
    setBusy(false);
  }

  async function closeDemand(demand: Demand) {
    if (!window.confirm(`Encerrar “${demand.title}”?`)) return;
    setBusy(true); setNotice("");
    const response = await fetch("/api/admin/demands", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ demandId: demand.id, action: "close" }) });
    const payload = await response.json().catch(() => ({}));
    setNotice(response.ok ? "Demanda encerrada." : payload.error || "Não foi possível encerrar.");
    if (response.ok) router.refresh(); setBusy(false);
  }

  if (!semester) return <section className="panel empty-semester"><ClipboardList/><h1>Nenhum semestre em preparação</h1><p>Crie um semestre e ative os grupos antes de cadastrar demandas.</p><a className="primary-button link-button" href="/admin/semester">Ir para semestres e grupos</a></section>;

  return <>
    <section className="semester-heading"><div><span className={`semester-state ${semester.status}`}>{semester.status === "active" ? "Semestre ativo" : "Em preparação"}</span><h1>Demandas e prazos</h1><p>{semester.name}</p></div><a className="secondary-button link-button" href="/admin/semester"><Users/>Gerenciar grupos</a></section>
    {notice && <div className="notice" role="status">{notice}</div>}
    <section className="demand-layout">
      <form className="panel demand-form" onSubmit={createDemand}>
        <div className="panel-title"><CirclePlus/><div><h2>Nova demanda</h2><p>A participação começa assim que a demanda for criada.</p></div></div>
        <label>Título<input name="title" required placeholder="Ex.: Troféu da Robocar Race"/></label>
        <label>Descrição e orientações<textarea name="description" required placeholder="Contexto, objetivo e critérios da demanda"/></label>
        <fieldset><legend>Grupos participantes</legend><label className="check-row"><input type="checkbox" checked={allGroups} onChange={(event) => setAllGroups(event.target.checked)}/>Todos os grupos ativos</label>{!allGroups && <div className="group-checks">{activeGroups.map((group) => <label className="check-row" key={group.id}><input type="checkbox" name="groups" value={group.id}/>{group.name}</label>)}</div>} {!activeGroups.length && <p className="field-warning">Ative pelo menos um grupo antes de criar a demanda.</p>}</fieldset>
        <div className="date-grid"><label>Abre para desenvolvimento<input name="submissionOpensAt" type="datetime-local"/></label><label>Prazo da entrega final<input name="submissionDueAt" type="datetime-local" required/></label><label>Publicação automática<input name="publicationAt" type="datetime-local" required/></label></div>
        <fieldset><legend>Etapas intermediárias opcionais</legend>{steps.map((_, index) => <div className="step-row" key={index}><input name={`stepTitle${index}`} placeholder="Nome da etapa (ex.: Protótipo)"/><input name={`stepDue${index}`} type="datetime-local"/><input name={`stepInstructions${index}`} placeholder="Orientações da etapa"/></div>)}<button type="button" className="text-action" onClick={() => setSteps([...steps, { title: "", instructions: "", dueAt: "" }])}>+ Adicionar etapa</button></fieldset>
        <fieldset><legend>Votação</legend><label className="check-row"><input type="checkbox" checked={voting} onChange={(event) => setVoting(event.target.checked)}/>Esta demanda terá votação</label>{voting && <><label>Identificação do voto<select name="ballotVisibility" defaultValue="anonymous"><option value="anonymous">Anônimo na interface</option><option value="open">Voto aberto</option></select></label><div className="date-grid"><label>Início da votação<input name="votingStartsAt" type="datetime-local" required/></label><label>Fim da votação<input name="votingEndsAt" type="datetime-local" required/></label></div></>}</fieldset>
        <button className="primary-button" disabled={busy || !activeGroups.length}><CheckSquare/>{busy ? "Criando…" : "Criar e distribuir demanda"}</button>
      </form>
      <section className="demand-list"><div className="board-toolbar"><div><h2>Demandas do semestre</h2><p>{demands.length} demanda(s)</p></div></div>{demands.length ? demands.map((demand) => <article className="panel demand-card" key={demand.id}><header><div><span className={`demand-status ${demand.status}`}>{demandStatus(demand.status)}</span><h2>{demand.title}</h2></div><ChevronDown/></header><p>{demand.description}</p><div className="demand-meta"><span><Users/>{demand.demand_groups.length} grupo(s)</span><span><CalendarClock/>{demand.submission_due_at ? new Date(demand.submission_due_at).toLocaleString("pt-BR") : "Sem prazo"}</span><span>{demand.voting_enabled ? "Com votação" : "Sem votação"}</span></div><div className="delivery-timeline">{[...demand.deliverables].sort((a,b) => a.position-b.position).map((item) => <div key={item.id}><span>{item.is_final ? <Lock/> : <CheckSquare/>}</span><div><strong>{item.title}</strong><small>{item.due_at ? new Date(item.due_at).toLocaleString("pt-BR") : "Sem prazo"}</small></div></div>)}</div>{demand.status !== "closed" && <button className="danger-button" type="button" onClick={() => closeDemand(demand)} disabled={busy}>Encerrar demanda</button>}</article>) : <div className="panel empty-demand"><ClipboardList/><p>Nenhuma demanda criada neste semestre.</p></div>}</section>
    </section>
  </>;
}

function iso(value: FormDataEntryValue | null) { return value ? new Date(String(value)).toISOString() : null; }
function demandStatus(status: string) { const labels: Record<string,string> = { draft:"Rascunho", scheduled:"Agendada", open:"Aberta", development:"Em desenvolvimento", review:"Em revisão", published:"Publicada", voting:"Em votação", awaiting_results:"Aguardando resultado", closed:"Encerrada" }; return labels[status] ?? status; }
