"use client";

import { FormEvent, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Clock3, Download, ExternalLink, FileImage, FileText, Save, Send, Upload } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { MAX_SUBMISSION_FILE_SIZE, submissionFileType } from "@/lib/submission-upload";

type Project = { id: string; title: string; description: string; status: string; external_links: string[]; mainImageUrl: string | null; pdfUrl: string | null; images: Array<{ id: string; signedUrl: string | null }> };
type Demand = { title: string; description: string; submission_due_at: string | null; publication_at: string | null; status: string };
type Deliverable = { id: string; title: string; instructions: string; due_at: string | null; is_final: boolean };
type SubmissionFile = { id: string; file_name: string; size_bytes: number; downloadUrl: string | null };
type Submission = { id: string; deliverable_id: string; notes: string; is_late: boolean; submitted_at: string; files: SubmissionFile[] };
type PreparedUpload = { uploadId: string; path: string; token: string; contentType: string };

export default function ProjectEditor({ project, demand, deliverables, submissions, canSubmitFinal }: { project: Project; demand: Demand; deliverables: Deliverable[]; submissions: Submission[]; canSubmitFinal: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [uploading, setUploading] = useState("");
  const uploaded = useRef<Record<string, { fingerprint: string; uploadId: string }>>({});

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true); setNotice("");
    try {
      const response = await fetch(`/api/projects/${project.id}`, { method: "PATCH", body: new FormData(event.currentTarget) });
      const data = await response.json().catch(() => ({}));
      setNotice(response.ok ? "Projeto salvo. O histórico da versão anterior foi preservado." : data.error || "Não foi possível salvar.");
      if (response.ok) router.refresh();
    } catch { setNotice("Falha de conexão ao salvar o projeto."); }
    finally { setBusy(false); }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const fields = new FormData(form);
    const deliverableId = String(fields.get("deliverableId") ?? "");
    const file = fields.get("file");
    setBusy(true); setNotice(""); setUploading("");
    try {
      let uploadId: string | undefined;
      if (file instanceof File && file.size) {
        const { mimeType } = submissionFileType(file.name);
        if (!mimeType || file.size > MAX_SUBMISSION_FILE_SIZE) throw new Error("Use DWG, DXF, PDF ou imagem de até 50 MB.");
        const fingerprint = `${file.name}:${file.size}:${file.lastModified}`;
        const cached = uploaded.current[deliverableId];
        if (cached?.fingerprint === fingerprint) uploadId = cached.uploadId;
        else {
          setUploading("Preparando envio direto ao Supabase…");
          const prepare = await fetch(`/api/projects/${project.id}/upload-intent`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ deliverableId, fileName: file.name, fileSize: file.size }) });
          const prepared = await prepare.json().catch(() => ({})) as PreparedUpload & { error?: string };
          if (!prepare.ok) throw new Error(prepared.error || "Não foi possível preparar o arquivo.");
          setUploading(`Enviando ${file.name} diretamente ao Supabase…`);
          const { error } = await createClient().storage.from("project-files").uploadToSignedUrl(prepared.path, prepared.token, file, { contentType: prepared.contentType });
          if (error) throw new Error(`O arquivo não foi enviado: ${error.message}`);
          uploadId = prepared.uploadId;
          uploaded.current[deliverableId] = { fingerprint, uploadId };
        }
      }
      setUploading("Confirmando a entrega…");
      const response = await fetch(`/api/projects/${project.id}/submit`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ deliverableId, notes: String(fields.get("notes") ?? ""), uploadId }) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        if (response.status === 409) delete uploaded.current[deliverableId];
        throw new Error(data.error || "Não foi possível registrar a entrega.");
      }
      delete uploaded.current[deliverableId];
      setNotice(data.isLate ? "Entrega registrada com atraso." : "Entrega registrada com sucesso.");
      form.reset();
      router.refresh();
    } catch (error) { setNotice(error instanceof Error ? error.message : "Falha de conexão. A entrega não foi registrada."); }
    finally { setBusy(false); setUploading(""); }
  }

  const latestByDeliverable = new Map<string, Submission>();
  for (const submission of submissions) if (!latestByDeliverable.has(submission.deliverable_id)) latestByDeliverable.set(submission.deliverable_id, submission);

  return <>
    <section className="project-editor-heading"><div><span className={`project-state ${project.status}`}>{projectLabel(project.status)}</span><h1>{demand.title}</h1><p>{demand.description}</p></div><div className="deadline-card"><Clock3/><div><small>Entrega final</small><strong>{demand.submission_due_at ? new Date(demand.submission_due_at).toLocaleString("pt-BR") : "Sem prazo"}</strong></div></div></section>
    {notice && <div className="notice" role="status">{notice}</div>}
    <div className="project-editor-layout">
      <form className="panel project-content-form" onSubmit={save}>
        <div className="panel-title"><FileText/><div><h2>Conteúdo do projeto</h2><p>Todos os integrantes podem editar. Cada salvamento gera histórico.</p></div></div>
        <label>Título do projeto<input name="title" required defaultValue={project.title} placeholder="Nome público do projeto"/></label>
        <label>Descrição<textarea name="description" required defaultValue={project.description} placeholder="Apresente a solução, o processo e os resultados"/></label>
        <label>Links externos <small>Um link por linha</small><textarea name="externalLinks" defaultValue={(project.external_links ?? []).join("\n")} placeholder="https://..."/></label>
        <div className="upload-grid">
          <label><FileImage/>Imagem principal <small>Opcional para entrega em AutoCAD · até 10 MB</small><input name="mainImage" type="file" accept="image/jpeg,image/png,image/webp"/>{project.mainImageUrl && <img className="upload-preview" src={project.mainImageUrl} alt="Imagem principal atual"/>}</label>
          <label><FileImage/>Imagens adicionais <small>Até 5 · selecione várias de uma vez</small><input name="additionalImages" type="file" accept="image/jpeg,image/png,image/webp" multiple/><div className="thumb-row">{project.images.map(image => image.signedUrl && <img key={image.id} src={image.signedUrl} alt="Imagem adicional"/>)}</div></label>
          <label><FileText/>PDF do projeto <small>Opcional · até 20 MB</small><input name="pdf" type="file" accept="application/pdf"/>{project.pdfUrl && <a href={project.pdfUrl} target="_blank" rel="noreferrer"><ExternalLink/>Abrir PDF atual</a>}</label>
        </div>
        <button className="primary-button" disabled={busy}><Save/>{busy ? "Salvando…" : "Salvar projeto"}</button>
      </form>
      <section className="deliverable-column"><div className="board-toolbar"><div><h2>Entregas</h2><p>Etapas e comprovantes do grupo</p></div></div>
        {deliverables.map(deliverable => {
          const previous = latestByDeliverable.get(deliverable.id);
          const history = submissions.filter(submission => submission.deliverable_id === deliverable.id);
          const finalBlocked = deliverable.is_final && !canSubmitFinal;
          return <article className="panel deliverable-card" key={deliverable.id}>
            <header><span>{deliverable.is_final ? <Send/> : <Upload/>}</span><div><h3>{deliverable.title}</h3><p>{deliverable.instructions}</p></div>{previous && <span className={`submission-badge ${previous.is_late ? "late" : ""}`}><Check/>{previous.is_late ? "Entregue atrasado" : "Entregue"}</span>}</header>
            <div className="deliverable-due"><Clock3/>{deliverable.due_at ? new Date(deliverable.due_at).toLocaleString("pt-BR") : "Sem prazo"}</div>
            {history.length > 0 && <div className="submission-history"><strong>Arquivos entregues</strong>{history.map(item => <div key={item.id}><small>{new Date(item.submitted_at).toLocaleString("pt-BR")}{item.is_late ? " · atrasado" : ""}</small>{item.files.map(att => att.downloadUrl && <a key={att.id} href={att.downloadUrl} target="_blank" rel="noreferrer" download={att.file_name}><Download/>{att.file_name} <small>({Math.ceil(att.size_bytes / 1024 / 1024)} MB)</small></a>)}</div>)}</div>}
            {finalBlocked ? <div className="leader-only">Somente o líder do grupo pode realizar a entrega final.</div> : <form className="submission-form" onSubmit={submit}><input type="hidden" name="deliverableId" value={deliverable.id}/><textarea name="notes" maxLength={5000} placeholder="Observações da entrega"/><label className="submission-file-label">Arquivo da entrega <small>DWG, DXF, PDF ou imagem · até 50 MB · envio direto ao Supabase</small><input name="file" type="file" accept=".dwg,.dxf,.pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/jpeg,image/png,image/webp"/></label>{busy && uploading && <p className="upload-status" role="status">{uploading}</p>}<button className={deliverable.is_final ? "primary-button" : "secondary-button"} disabled={busy}>{deliverable.is_final ? <><Send/>Confirmar entrega final</> : <><Upload/>Enviar etapa</>}</button></form>}
          </article>;
        })}
      </section>
    </div>
  </>;
}

function projectLabel(status: string) { const map: Record<string, string> = { draft: "Em edição", submitted: "Entregue", late: "Entregue com atraso", review: "Em análise", changes_requested: "Ajustes solicitados", approved: "Aprovado", published: "Publicado" }; return map[status] ?? status; }
