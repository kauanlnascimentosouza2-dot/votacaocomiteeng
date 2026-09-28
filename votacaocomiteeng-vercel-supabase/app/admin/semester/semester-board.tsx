"use client";

import { DragEvent, FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Archive, CalendarDays, Check, CirclePlus, Crown, GripVertical, Pencil, Play, UserRound, Users } from "lucide-react";

type Semester = { id: string; name: string; status: "draft" | "active" | "closed"; starts_at: string | null; ends_at: string | null };
type Group = { id: string; name: string; status: "building" | "active" | "archived"; max_members: number };
type Person = { id: string; name: string; email: string; createdAt: string; enrollmentStatus: string; groupId: string | null; role: "member" | "leader" };
type BoardData = { semester: Semester | null; semesters: Semester[]; groups: Group[]; people: Person[] };

export default function SemesterBoard({ initialData }: { initialData: BoardData }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const semester = initialData.semester;
  const waiting = useMemo(() => initialData.people.filter((person) => !person.groupId), [initialData.people]);
  const editable = Boolean(semester && semester.status !== "closed");

  async function send(url: string, method: string, body: unknown, success: string) {
    setBusy(true); setNotice("");
    const response = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const payload = await response.json().catch(() => ({}));
    setNotice(response.ok ? success : payload.error || "Não foi possível concluir a ação.");
    if (response.ok) router.refresh();
    setBusy(false);
    return response.ok;
  }

  async function createSemester(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const ok = await send("/api/admin/semesters", "POST", { name: data.get("name"), startsAt: toIso(data.get("startsAt")), endsAt: toIso(data.get("endsAt")) }, "Semestre criado. Todos os participantes estão aguardando alocação.");
    if (ok) form.reset();
  }

  async function updateSemester(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!semester) return;
    const data = new FormData(event.currentTarget);
    await send("/api/admin/semesters", "PATCH", { semesterId: semester.id, action: "update", name: data.get("name"), startsAt: toIso(data.get("startsAt")), endsAt: toIso(data.get("endsAt")) }, "Dados do semestre atualizados.");
  }

  async function createGroup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!semester) return;
    const form = event.currentTarget;
    const name = new FormData(form).get("name");
    const ok = await send("/api/admin/groups", "POST", { semesterId: semester.id, name }, "Grupo criado. Arraste os integrantes para ele.");
    if (ok) form.reset();
  }

  async function movePerson(userId: string, groupId: string | null) {
    if (!semester || !editable) return;
    const current = initialData.people.find((person) => person.id === userId);
    if (current?.groupId === groupId) return;
    await send("/api/admin/group-members", "POST", { semesterId: semester.id, userId, groupId }, groupId ? "Participante alocado." : "Participante voltou para a fila de alocação.");
    setDraggingId(null);
  }

  async function setLeader(groupId: string, userId: string) {
    await send("/api/admin/group-members", "PATCH", { groupId, userId }, "Líder do grupo atualizado.");
  }

  async function activateGroup(group: Group) {
    if (!window.confirm(`Ativar “${group.name}” e registrar sua composição atual?`)) return;
    await send("/api/admin/groups", "PATCH", { groupId: group.id, status: "active" }, "Grupo ativado e ambiente liberado.");
  }

  async function renameGroup(group: Group) {
    const name = window.prompt("Novo nome do grupo:", group.name)?.trim();
    if (name && name !== group.name) await send("/api/admin/groups", "PATCH", { groupId: group.id, name }, "Grupo renomeado.");
  }

  async function changeSemester(action: "start" | "close") {
    if (!semester) return;
    const question = action === "start" ? `Iniciar “${semester.name}”?` : `Encerrar “${semester.name}”? Demandas abertas também serão encerradas e esta ação não poderá ser desfeita.`;
    if (!window.confirm(question)) return;
    await send("/api/admin/semesters", "PATCH", { semesterId: semester.id, action }, action === "start" ? "Semestre iniciado." : "Semestre encerrado e arquivado.");
  }

  return <>
    <section className="semester-heading"><div><span className={`semester-state ${semester?.status ?? "draft"}`}>{statusLabel(semester?.status)}</span><h1>Semestres e grupos</h1><p>Organize os participantes antes de liberar o ambiente de trabalho.</p></div><label className="semester-picker">Semestre<select value={semester?.id ?? ""} onChange={(event) => router.push(`/admin/semester?semester=${event.target.value}`)}>{initialData.semesters.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</select></label></section>
    {notice && <div className="notice" role="status">{notice}</div>}

    {!semester ? <section className="panel empty-semester"><CalendarDays/><h2>Crie o primeiro semestre</h2><p>Os cadastros existentes serão incluídos automaticamente como “Aguardando alocação”.</p><SemesterCreateForm onSubmit={createSemester} busy={busy}/></section> : <>
      <section className="semester-actions panel"><form className="semester-settings" onSubmit={updateSemester}><label>Nome<input name="name" defaultValue={semester.name} disabled={!editable}/></label><label>Início<input name="startsAt" type="datetime-local" defaultValue={toLocal(semester.starts_at)} disabled={!editable}/></label><label>Encerramento<input name="endsAt" type="datetime-local" defaultValue={toLocal(semester.ends_at)} disabled={!editable}/></label>{editable && <button className="secondary-button" disabled={busy}><Check/>Salvar</button>}</form><div className="semester-lifecycle">{semester.status === "draft" && <button className="primary-button" onClick={() => changeSemester("start")} disabled={busy}><Play/>Iniciar semestre</button>}{semester.status === "active" && <button className="danger-button" onClick={() => changeSemester("close")} disabled={busy}><Archive/>Encerrar semestre</button>}</div></section>

      <section className="board-toolbar"><div><h2>Quadro de alocação</h2><p>{initialData.people.length} participante(s) · grupos com até 9 integrantes</p></div>{editable && <form className="new-group-form" onSubmit={createGroup}><input name="name" required placeholder="Nome do novo grupo"/><button className="primary-button" disabled={busy}><CirclePlus/>Criar grupo</button></form>}</section>
      <section className="allocation-board">
        <DropColumn title="Aguardando alocação" subtitle={`${waiting.length} pessoa(s)`} className="waiting-column" onDrop={(id) => movePerson(id, null)} onDragOver={allowDrop}>
          {waiting.length ? waiting.map((person) => <PersonCard person={person} key={person.id} draggable={editable} dragging={draggingId === person.id} onDragStart={() => setDraggingId(person.id)}/>) : <BoardEmpty text="Todos já foram alocados."/>}
        </DropColumn>
        {initialData.groups.map((group) => {
          const members = initialData.people.filter((person) => person.groupId === group.id);
          return <DropColumn key={group.id} title={group.name} subtitle={`${members.length}/${group.max_members}`} className={group.status === "active" ? "active-group" : ""} onDrop={(id) => movePerson(id, group.id)} onDragOver={allowDrop} actions={<><span className={`group-status ${group.status}`}>{group.status === "active" ? "Ativo" : group.status === "archived" ? "Arquivado" : "Em montagem"}</span>{editable && <button className="mini-button" onClick={() => renameGroup(group)} aria-label={`Renomear ${group.name}`}><Pencil/></button>}</>}>
            {members.length ? members.map((person) => <PersonCard person={person} key={person.id} draggable={editable && group.status !== "archived"} dragging={draggingId === person.id} onDragStart={() => setDraggingId(person.id)} onLeader={() => setLeader(group.id, person.id)}/>) : <BoardEmpty text="Arraste participantes para cá."/>}
            {editable && group.status === "building" && <button className="activate-group" onClick={() => activateGroup(group)} disabled={busy}><Play/>Ativar grupo</button>}
          </DropColumn>;
        })}
      </section>
      {editable && <details className="panel new-semester-panel"><summary>Criar outro semestre</summary><SemesterCreateForm onSubmit={createSemester} busy={busy}/></details>}
    </>}
  </>;
}

function SemesterCreateForm({ onSubmit, busy }: { onSubmit: (event: FormEvent<HTMLFormElement>) => void; busy: boolean }) {
  return <form className="semester-create-form" onSubmit={onSubmit}><label>Nome<input name="name" required placeholder="Ex.: 15ª Semana das Engenharias — 2027.1"/></label><label>Início<input name="startsAt" type="datetime-local"/></label><label>Encerramento<input name="endsAt" type="datetime-local"/></label><button className="primary-button" disabled={busy}><CirclePlus/>Criar semestre</button></form>;
}

function DropColumn({ title, subtitle, className = "", actions, children, onDrop, onDragOver }: { title: string; subtitle: string; className?: string; actions?: React.ReactNode; children: React.ReactNode; onDrop: (id: string) => void; onDragOver: (event: DragEvent) => void }) {
  return <article className={`allocation-column ${className}`} onDragOver={onDragOver} onDrop={(event) => { event.preventDefault(); const id = event.dataTransfer.getData("text/plain"); if (id) onDrop(id); }}><header><div><h3>{title}</h3><span>{subtitle}</span></div><div>{actions}</div></header><div className="person-list">{children}</div></article>;
}

function PersonCard({ person, draggable, dragging, onDragStart, onLeader }: { person: Person; draggable: boolean; dragging: boolean; onDragStart: () => void; onLeader?: () => void }) {
  return <div className={`person-card ${dragging ? "dragging" : ""}`} draggable={draggable} onDragStart={(event) => { event.dataTransfer.setData("text/plain", person.id); event.dataTransfer.effectAllowed = "move"; onDragStart(); }}><GripVertical className="drag-handle"/><span className="person-avatar"><UserRound/></span><div><strong>{person.name}</strong><span>{person.email}</span></div>{person.role === "leader" ? <span className="leader-badge"><Crown/>Líder</span> : onLeader && <button className="leader-button" type="button" onClick={onLeader} title="Tornar líder"><Crown/></button>}</div>;
}

function BoardEmpty({ text }: { text: string }) { return <div className="board-empty"><Users/><span>{text}</span></div>; }
function allowDrop(event: DragEvent) { event.preventDefault(); event.dataTransfer.dropEffect = "move"; }
function statusLabel(status?: Semester["status"]) { return status === "active" ? "Semestre ativo" : status === "closed" ? "Semestre encerrado" : "Em preparação"; }
function toIso(value: FormDataEntryValue | null) { return value ? new Date(String(value)).toISOString() : null; }
function toLocal(value: string | null) { if (!value) return ""; const date = new Date(value); return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16); }
