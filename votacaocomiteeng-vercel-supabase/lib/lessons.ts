import { createAdminClient } from "@/lib/supabase/admin";

export function normalizeLessonUrl(value: unknown) {
  const raw = String(value ?? "").trim();
  if (!raw) return undefined;
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:") return undefined;
    const host = url.hostname.toLowerCase();
    if (!["youtube.com", "www.youtube.com", "m.youtube.com", "youtu.be", "vimeo.com", "www.vimeo.com", "player.vimeo.com"].includes(host)) return undefined;
    return url.toString();
  } catch {
    return undefined;
  }
}

export function lessonEmbedUrl(value: string) {
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase();
    if (["youtube.com", "www.youtube.com", "m.youtube.com"].includes(host)) {
      const id = url.pathname.startsWith("/shorts/") || url.pathname.startsWith("/embed/") ? url.pathname.split("/")[2] : url.searchParams.get("v");
      if (id && /^[A-Za-z0-9_-]{11}$/.test(id)) return `https://www.youtube-nocookie.com/embed/${id}`;
    }
    if (host === "youtu.be") {
      const id = url.pathname.slice(1).split("/")[0];
      if (/^[A-Za-z0-9_-]{11}$/.test(id)) return `https://www.youtube-nocookie.com/embed/${id}`;
    }
    if (["vimeo.com", "www.vimeo.com", "player.vimeo.com"].includes(host)) {
      const id = url.pathname.split("/").filter(Boolean).pop();
      if (id && /^\d+$/.test(id)) return `https://player.vimeo.com/video/${id}`;
    }
  } catch { /* URL inválida */ }
  return null;
}

export async function activeLessonSemester() {
  const { data } = await createAdminClient().from("semesters").select("id,name").eq("status", "active").maybeSingle();
  return data;
}

export async function lessonFolderIsActive(semesterId: string, folderId: string) {
  const admin = createAdminClient();
  const seen = new Set<string>();
  let current: string | null = folderId;
  while (current) {
    if (seen.has(current)) return false;
    seen.add(current);
    const result = await admin.from("lesson_folders").select("id,parent_id,status").eq("id", current).eq("semester_id", semesterId).maybeSingle();
    const folder = result.data as { id: string; parent_id: string | null; status: string } | null;
    if (!folder || folder.status !== "active") return false;
    current = folder.parent_id;
  }
  return true;
}
