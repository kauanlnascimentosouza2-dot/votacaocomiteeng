"use client";

import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Archive, ArrowLeft, Clapperboard, Folder, FolderPlus, Pencil, Plus, RotateCcw, Save } from "lucide-react";

type Semester = { id: string; name: string } | null;
type FolderRow = { id: string; parent_id: string | null; name: string; description: string; status: string };
type LessonRow = { id: string; folder_id: string; title: string; content: string; video_url: string; status: string; created_at: string; embedUrl: string | null };

export default function LessonsClient({ semester, folders, lessons, isAdmin }: { semester: Semester; folders: FolderRow[]; lessons: LessonRow[]; isAdmin: boolean }) {
  const router = useRouter();
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(folders.find(folder => !folder.parent_id && folder.status === "active")?.id ?? null);
  const [selectedLessonId, setSelectedLessonId] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [folderFormOpen, setFolderFormOpen] = useState(false);
  const [lessonFormOpen, setLessonFormOpen] = useState(false);
  const [editingLessonId, setEditingLessonId] = useState<string | null>(null);
  const folderMap = useMemo(() => new Map(folders.map(folder => [folder.id, folder])), [folders]);
  const selectedFolder = selectedFolderId ? folderMap.get(selectedFolderId) ?? null : null;
  const folderLessons = lessons.filter(lesson => lesson.folder_id === selectedFolderId && (isAdmin || lesson.status === "published"));
  const selectedLesson = folderLessons.find(lesson => lesson.id === selectedLessonId) ?? null;
  const canAddLesson = isAdmin && selectedFolder?.status === "active";

  async function send(path: string, method: "POST" | "PATCH", body: object, success: string) {
    setBusy(true);
    setNotice("");
    try {
      const response = await fetch(path, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) { setNotice(result.error || "Não foi possível salvar."); return null; }
      setNotice(success);
      router.refresh();
      return result;
    } catch {
      setNotice("Falha de conexão. Tente novamente.");
      return null;
    } finally { setBusy(false); }
  }

  async function createFolder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const fields = new FormData(form);
    const result = await send("/api/admin/lesson-folders", "POST", {
      name: String(fields.get("name") ?? ""),
      description: String(fields.get("description") ?? ""),
      parentId: String(fields.get("parentId") ?? "") || null,
    }, "Pasta criada.");
    if (result?.id) { setSelectedFolderId(result.id); setSelectedLessonId(null); setFolderFormOpen(false); }
  }

  async function renameFolder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedFolder) return;
    const fields = new FormData(event.currentTarget);
    await send("/api/admin/lesson-folders", "PATCH", {
      folderId: selectedFolder.id,
      name: String(fields.get("name") ?? ""),
      description: String(fields.get("description") ?? ""),
    }, "Pasta atualizada.");
  }

  async function setFolderStatus(folder: FolderRow) {
    const archive = folder.status === "active";
    if (archive && !window.confirm("Arquivar esta pasta? As subpastas e aulas ficarão ocultas para os participantes.")) return;
    await send("/api/admin/lesson-folders", "PATCH", { folderId: folder.id, status: archive ? "archived" : "active" }, archive ? "Pasta arquivada." : "Pasta restaurada.");
  }

  async function saveLesson(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fields = new FormData(event.currentTarget);
    const input = {
      folderId: selectedFolderId,
      title: String(fields.get("title") ?? ""),
      description: String(fields.get("description") ?? ""),
      videoUrl: String(fields.get("videoUrl") ?? ""),
      ...(editingLessonId ? { lessonId: editingLessonId } : {}),
    };
    const result = await send("/api/admin/lessons", editingLessonId ? "PATCH" : "POST", input, editingLessonId ? "Aula atualizada." : "Aula publicada.");
    if (result) {
      if (result.id) setSelectedLessonId(result.id);
      setLessonFormOpen(false);
      setEditingLessonId(null);
    }
  }

  async function setLessonStatus(lesson: LessonRow) {
    const archive = lesson.status === "published";
    if (archive && !window.confirm("Arquivar esta aula? Ela deixará de aparecer para os participantes.")) return;
    const result = await send("/api/admin/lessons", "PATCH", { lessonId: lesson.id, status: archive ? "archived" : "published" }, archive ? "Aula arquivada." : "Aula restaurada.");
    if (result && archive) setSelectedLessonId(null);
  }

  function openLessonEditor(lesson: LessonRow) {
    setEditingLessonId(lesson.id);
    setLessonFormOpen(true);
  }

  function renderFolders(parentId: string | null, depth = 0, ancestors = new Set<string>()): React.ReactNode {
    if (depth > 15) return null;
    return folders.filter(folder => folder.parent_id === parentId).map(folder => {
      if (ancestors.has(folder.id)) return null;
      const nextAncestors = new Set(ancestors);
      nextAncestors.add(folder.id);
      return <div key={folder.id}>
        <button type="button" className={`lesson-folder-item ${selectedFolderId === folder.id ? "selected" : ""} ${folder.status === "archived" ? "archived" : ""}`} style={{ paddingLeft: 13 + depth * 19 }} onClick={() => { setSelectedFolderId(folder.id); setSelectedLessonId(null); setLessonFormOpen(false); }}>
          <Folder size={17}/><span>{folder.name}</span><small>{lessons.filter(lesson => lesson.folder_id === folder.id && lesson.status === "published").length}</small>
        </button>
        {renderFolders(folder.id, depth + 1, nextAncestors)}
      </div>;
    });
  }

  const folderOptions = folders.filter(folder => folder.status === "active");
  const editingLesson = lessons.find(lesson => lesson.id === editingLessonId);

  return <div className="feature-page">
    <section className="feature-heading"><div><span className="eyebrow">CONTEÚDO</span><h1>Aulas</h1><p>Vídeos e descrições organizados em pastas para {semester?.name ?? "a edição atual"}.</p></div><div className="calendar-summary"><Clapperboard/><div><strong>{lessons.filter(lesson => lesson.status === "published").length} aula(s)</strong><span>{folders.filter(folder => folder.status === "active").length} pasta(s)</span></div></div></section>
    {notice && <div className="notice" role="status">{notice}</div>}
    {!semester ? <div className="panel lesson-empty"><Clapperboard/><h2>Nenhuma edição ativa</h2><p>As aulas serão organizadas quando o administrador abrir uma edição.</p></div> : <div className="lessons-layout">
      <aside className="panel lessons-sidebar"><div className="lessons-sidebar-heading"><h2>Pastas</h2>{isAdmin && <button type="button" onClick={() => setFolderFormOpen(!folderFormOpen)} aria-label="Criar pasta" title="Criar pasta"><FolderPlus size={19}/></button>}</div>
        {folderFormOpen && isAdmin && <form className="lesson-folder-form" onSubmit={createFolder}><label>Nome da pasta<input name="name" maxLength={100} required/></label><label>Dentro de<select name="parentId" defaultValue={selectedFolderId ?? ""}><option value="">Pasta principal</option>{folderOptions.map(folder => <option key={folder.id} value={folder.id}>{folder.name}</option>)}</select></label><label>Descrição (opcional)<textarea name="description" rows={2}/></label><button className="primary-button" disabled={busy}><Plus/>Criar pasta</button></form>}
        <div className="lesson-folder-tree">{renderFolders(null)}{folders.length === 0 && <p>As pastas ainda não foram criadas.</p>}</div>
      </aside>
      <section className="lessons-main">
        {!selectedFolder ? <div className="panel lesson-empty"><Folder/><h2>Selecione uma pasta</h2><p>Escolha uma pasta ao lado para ver as aulas.</p></div> : <>
          <div className="panel lessons-folder-heading"><div><span className="eyebrow">PASTA DE AULAS</span><h2>{selectedFolder.name}</h2>{selectedFolder.description && <p>{selectedFolder.description}</p>}{selectedFolder.status === "archived" && <span className="lesson-archived-pill">Arquivada</span>}</div>{canAddLesson && <button className="primary-button" type="button" onClick={() => { setEditingLessonId(null); setLessonFormOpen(!lessonFormOpen); }}><Plus/>Nova aula</button>}</div>
          {isAdmin && <details className="panel lessons-folder-settings"><summary><Pencil size={16}/> Gerenciar esta pasta</summary><form onSubmit={renameFolder} key={selectedFolder.id}><label>Nome<input name="name" defaultValue={selectedFolder.name} required maxLength={100}/></label><label>Descrição<textarea name="description" defaultValue={selectedFolder.description}/></label><div className="lesson-admin-actions"><button className="secondary-button" disabled={busy}><Save/>Salvar pasta</button><button className="secondary-button" type="button" disabled={busy} onClick={() => setFolderStatus(selectedFolder)}>{selectedFolder.status === "active" ? <Archive/> : <RotateCcw/>}{selectedFolder.status === "active" ? "Arquivar" : "Restaurar"}</button></div></form></details>}
          {lessonFormOpen && canAddLesson && <form className="panel lesson-editor" onSubmit={saveLesson} key={editingLessonId ?? "new"}><h2>{editingLesson ? "Editar aula" : "Nova aula"}</h2><label>Título<input name="title" required maxLength={160} defaultValue={editingLesson?.title ?? ""}/></label><label>Link do vídeo (YouTube ou Vimeo)<input name="videoUrl" type="url" required placeholder="https://www.youtube.com/watch?v=..." defaultValue={editingLesson?.video_url ?? ""}/></label><label>Descrição<textarea name="description" rows={6} defaultValue={editingLesson?.content ?? ""} placeholder="Explique o conteúdo desta aula"/></label><div className="lesson-admin-actions"><button className="primary-button" disabled={busy}><Save/>{editingLesson ? "Salvar aula" : "Publicar aula"}</button><button className="secondary-button" type="button" onClick={() => { setLessonFormOpen(false); setEditingLessonId(null); }}>Cancelar</button></div></form>}
          {selectedLesson ? <article className="panel lesson-view"><button className="lesson-back" type="button" onClick={() => setSelectedLessonId(null)}><ArrowLeft size={16}/>Todas as aulas</button><h2>{selectedLesson.title}</h2>{selectedLesson.status === "archived" && <span className="lesson-archived-pill">Arquivada</span>}{selectedLesson.embedUrl ? <div className="lesson-video"><iframe src={selectedLesson.embedUrl} title={`Vídeo da aula ${selectedLesson.title}`} allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerPolicy="strict-origin-when-cross-origin" allowFullScreen loading="lazy"/></div> : <p>Vídeo indisponível. Peça ao administrador para conferir o link.</p>}<div className="lesson-description">{selectedLesson.content || "Esta aula ainda não tem descrição."}</div>{isAdmin && <div className="lesson-admin-actions"><button className="secondary-button" type="button" onClick={() => openLessonEditor(selectedLesson)}><Pencil/>Editar aula</button><button className="secondary-button" type="button" disabled={busy} onClick={() => setLessonStatus(selectedLesson)}>{selectedLesson.status === "published" ? <Archive/> : <RotateCcw/>}{selectedLesson.status === "published" ? "Arquivar aula" : "Restaurar aula"}</button></div>}</article> : <div className="lesson-cards">{folderLessons.map(lesson => <button className="panel lesson-card" type="button" key={lesson.id} onClick={() => setSelectedLessonId(lesson.id)}><span className="lesson-card-icon"><Clapperboard/></span><span><strong>{lesson.title}</strong><small>{lesson.content || "Assistir aula"}</small>{lesson.status === "archived" && <em>Arquivada</em>}</span></button>)}{folderLessons.length === 0 && <div className="panel lesson-empty"><Clapperboard/><h2>Nenhuma aula nesta pasta</h2><p>{isAdmin ? "Use Nova aula para publicar o primeiro vídeo." : "O administrador ainda não publicou aulas aqui."}</p></div>}</div>}
        </>}
      </section>
    </div>}
  </div>;
}
