import { auth, currentUser } from "@clerk/nextjs/server"

import { badRequestResponse, forbiddenResponse, unauthorizedResponse } from "@/lib/api-responses"
import { prisma } from "@/lib/prisma"
import type { CanvasEdge, CanvasNode } from "@/types/canvas"

interface CanvasRouteContext {
  params: Promise<{
    projectId: string
  }>
}

interface CanvasSnapshot {
  nodes: CanvasNode[]
  edges: CanvasEdge[]
}

interface AccessibleProjectRecord {
  id: string
  canvasJsonPath: string | null
}

interface BlobUploadResponse {
  url?: string
}

interface BlobUploadResult {
  ok: boolean
  status: number
  error?: string
  url?: string
}

const VERCEL_BLOB_API_URL = process.env.VERCEL_BLOB_API_URL ?? "https://blob.vercel-storage.com"

function missingBlobConfigResponse() {
  return Response.json({ error: "Vercel Blob token is not configured." }, { status: 503 })
}

function parseCanvasSnapshot(payload: unknown): CanvasSnapshot | null {
  if (!payload || typeof payload !== "object") {
    return null
  }

  const maybeSnapshot = payload as {
    nodes?: unknown
    edges?: unknown
  }

  if (!Array.isArray(maybeSnapshot.nodes) || !Array.isArray(maybeSnapshot.edges)) {
    return null
  }

  return {
    nodes: maybeSnapshot.nodes as CanvasNode[],
    edges: maybeSnapshot.edges as CanvasEdge[],
  }
}

function getBlobReadWriteToken() {
  return process.env.BLOB_READ_WRITE_TOKEN ?? process.env.VERCEL_BLOB_READ_WRITE_TOKEN ?? null
}

function buildBlobPath(projectId: string) {
  // Keep `/` separators intact for Blob pathname routing.
  const safeProjectId = projectId.trim().replace(/[^a-zA-Z0-9-_]/g, "-")
  return `canvas/${safeProjectId}.json`
}

function buildBlobUploadUrl(blobPath: string) {
  const baseUrl = VERCEL_BLOB_API_URL.replace(/\/+$/, "")

  // Emulator-style API endpoints expect pathname in query params.
  if (baseUrl.endsWith("/api/blob")) {
    return `${baseUrl}?pathname=${encodeURIComponent(blobPath)}`
  }

  // Vercel Blob production endpoint expects pathname in URL path.
  return `${baseUrl}/${blobPath}?addRandomSuffix=false`
}

async function getAccessibleProject(projectId: string): Promise<AccessibleProjectRecord | null> {
  const { userId } = await auth()
  if (!userId) {
    return null
  }

  const user = await currentUser()
  const collaboratorEmails = (user?.emailAddresses ?? [])
    .map((emailAddress) => emailAddress.emailAddress)
    .filter((emailAddress): emailAddress is string => Boolean(emailAddress))

  return prisma.project.findFirst({
    where: {
      id: projectId,
      OR: [
        {
          ownerId: userId,
        },
        ...(collaboratorEmails.length
          ? [
              {
                collaborators: {
                  some: {
                    email: {
                      in: collaboratorEmails,
                      mode: "insensitive" as const,
                    },
                  },
                },
              },
            ]
          : []),
      ],
    },
    select: {
      id: true,
      canvasJsonPath: true,
    },
  })
}

async function uploadCanvasToBlob({
  projectId,
  snapshot,
}: {
  projectId: string
  snapshot: CanvasSnapshot
}): Promise<BlobUploadResult> {
  const blobToken = getBlobReadWriteToken()
  if (!blobToken) {
    return {
      ok: false,
      status: 503,
      error: "Vercel Blob token is not configured.",
    }
  }

  const blobPath = buildBlobPath(projectId)
  const uploadUrl = buildBlobUploadUrl(blobPath)

  try {
    const uploadResponse = await fetch(uploadUrl, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${blobToken}`,
        "Content-Type": "application/json",
        "x-add-random-suffix": "0",
        "x-allow-overwrite": "1",
        "x-content-type": "application/json",
        "x-vercel-blob-access": "private",
      },
      body: JSON.stringify(snapshot),
    })

    if (!uploadResponse.ok) {
      const responseText = await uploadResponse.text().catch(() => "")
      return {
        ok: false,
        status: uploadResponse.status >= 400 && uploadResponse.status < 500 ? 400 : 502,
        error: responseText
          ? `Blob upload failed with status ${uploadResponse.status}: ${responseText}`
          : `Blob upload failed with status ${uploadResponse.status}.`,
      }
    }

    const responsePayload = (await uploadResponse.json().catch(() => ({}))) as BlobUploadResponse

    if (!responsePayload.url) {
      return {
        ok: false,
        status: 502,
        error: "Vercel Blob upload did not return a URL.",
      }
    }

    return {
      ok: true,
      status: 200,
      url: responsePayload.url,
    }
  } catch (error) {
    console.error("Failed to upload canvas snapshot to Vercel Blob.", error)
    return {
      ok: false,
      status: 502,
      error: "Blob upload request failed.",
    }
  }
}

export async function PUT(request: Request, context: CanvasRouteContext) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return unauthorizedResponse()
    }

    const { projectId } = await context.params
    const snapshot = parseCanvasSnapshot(await request.json().catch(() => null))

    if (!snapshot) {
      return badRequestResponse("Canvas payload must include nodes and edges arrays.")
    }

    const project = await getAccessibleProject(projectId)
    if (!project) {
      return forbiddenResponse()
    }

    const uploadResult = await uploadCanvasToBlob({
      projectId,
      snapshot,
    })

    if (!uploadResult.ok || !uploadResult.url) {
      const status = uploadResult.status === 503 ? 503 : uploadResult.status === 400 ? 400 : 502
      if (status === 503) {
        return missingBlobConfigResponse()
      }
      return Response.json(
        { error: uploadResult.error ?? "Canvas blob upload failed." },
        { status },
      )
    }

    await prisma.project.update({
      where: {
        id: project.id,
      },
      data: {
        canvasJsonPath: uploadResult.url,
      },
    })

    return Response.json({
      canvasUrl: uploadResult.url,
      ok: true,
    })
  } catch (error) {
    console.error("Unexpected error while saving canvas snapshot.", error)
    return Response.json({ error: "Failed to save canvas snapshot." }, { status: 500 })
  }
}

export async function GET(_request: Request, context: CanvasRouteContext) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return unauthorizedResponse()
    }

    const { projectId } = await context.params
    const project = await getAccessibleProject(projectId)
    if (!project) {
      return forbiddenResponse()
    }

    if (!project.canvasJsonPath) {
      return Response.json({ canvas: null }, { status: 404 })
    }

    const blobToken = getBlobReadWriteToken()
    const canvasResponse = await fetch(project.canvasJsonPath, {
      cache: "no-store",
      headers: blobToken
        ? {
            Authorization: `Bearer ${blobToken}`,
          }
        : undefined,
    })
    if (!canvasResponse.ok) {
      return Response.json({ error: "Saved canvas could not be fetched." }, { status: 502 })
    }

    const snapshot = parseCanvasSnapshot(await canvasResponse.json().catch(() => null))
    if (!snapshot) {
      return Response.json({ error: "Saved canvas payload is invalid." }, { status: 502 })
    }

    return Response.json({
      canvas: snapshot,
    })
  } catch (error) {
    console.error("Unexpected error while loading canvas snapshot.", error)
    return Response.json({ error: "Failed to load canvas snapshot." }, { status: 500 })
  }
}
