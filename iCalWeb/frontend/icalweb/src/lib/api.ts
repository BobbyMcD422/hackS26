export type UploadedIcsFile = {
  id: string;
  url: string;
};

const DEFAULT_API_BASE_URL = "/api";

function getApiBaseUrl() {
  return import.meta.env.VITE_API_BASE_URL || DEFAULT_API_BASE_URL;
}

export async function uploadIcsFile(file: File): Promise<UploadedIcsFile> {
  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch(`${getApiBaseUrl()}/upload-ics`, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    const errorMessage = await readErrorMessage(response);
    throw new Error(errorMessage);
  }

  return response.json() as Promise<UploadedIcsFile>;
}

export function buildShareableIcsUrl(path: string) {
  if (path.startsWith("http://") || path.startsWith("https://")) {
    return path;
  }

  if (typeof window !== "undefined") {
    return new URL(path, window.location.origin).toString();
  }

  return path;
}

async function readErrorMessage(response: Response) {
  try {
    const payload = (await response.json()) as { detail?: string };

    return payload.detail || "The ICS file could not be uploaded.";
  } catch {
    return "The ICS file could not be uploaded.";
  }
}
