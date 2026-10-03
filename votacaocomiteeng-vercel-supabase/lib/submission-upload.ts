export const MAX_SUBMISSION_FILE_SIZE = 50 * 1024 * 1024;
export const SUBMISSION_FILE_TYPES: Record<string, string> = {
  dwg: "application/octet-stream",
  dxf: "application/octet-stream",
  pdf: "application/pdf",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

export function submissionFileType(name: string) {
  const extension = name.toLowerCase().split(".").pop() ?? "";
  return { extension, mimeType: SUBMISSION_FILE_TYPES[extension] ?? null };
}
