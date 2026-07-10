export interface ProjectSpecSummary {
  id: string
  createdAt: string
  filename: string
}

export interface ProjectSpecContent extends ProjectSpecSummary {
  markdown: string
}

export type ListProjectSpecsResult =
  | { status: "ok"; specs: ProjectSpecSummary[] }
  | { status: "error"; kind: "forbidden" | "unavailable" | "unknown" }

export async function listProjectSpecs(projectId: string): Promise<ListProjectSpecsResult> {
  try {
    const response = await fetch(`/api/projects/${projectId}/specs`, {
      method: "GET",
      cache: "no-store",
    })

    if (response.status === 403) {
      return { status: "error", kind: "forbidden" }
    }

    if (response.status === 503) {
      return { status: "error", kind: "unavailable" }
    }

    if (!response.ok) {
      return { status: "error", kind: "unknown" }
    }

    const payload = (await response.json()) as { specs?: ProjectSpecSummary[] }
    return {
      status: "ok",
      specs: Array.isArray(payload.specs) ? payload.specs : [],
    }
  } catch (error) {
    console.error("Failed to load project specs.", error)
    return { status: "error", kind: "unavailable" }
  }
}

export async function getProjectSpecContent(
  projectId: string,
  specId: string
): Promise<ProjectSpecContent | null> {
  try {
    const response = await fetch(`/api/projects/${projectId}/specs/${specId}`, {
      method: "GET",
      cache: "no-store",
    })

    if (!response.ok) {
      return null
    }

    const payload = (await response.json()) as ProjectSpecContent
    if (!payload?.id || typeof payload.markdown !== "string") {
      return null
    }

    return payload
  } catch (error) {
    console.error("Failed to load spec content.", error)
    return null
  }
}

export function getProjectSpecDownloadUrl(projectId: string, specId: string) {
  return `/api/projects/${projectId}/specs/${specId}/download`
}
