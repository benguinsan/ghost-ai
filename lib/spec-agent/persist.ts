import { randomUUID } from "node:crypto"

import { prisma } from "@/lib/prisma"

// Persists a generated Markdown spec by uploading the content to Vercel Blob and
// storing only the resulting Blob URL as metadata in Prisma. This mirrors the
// canvas persistence pattern (metadata in PostgreSQL, artifact in Vercel Blob)
// without touching the canvas route itself.

const VERCEL_BLOB_API_URL = process.env.VERCEL_BLOB_API_URL ?? "https://blob.vercel-storage.com"

interface PersistSpecInput {
  projectId: string
  markdown: string
}

export interface PersistedSpec {
  id: string
  projectId: string
  filePath: string
  createdAt: Date
}

interface BlobUploadResponse {
  url?: string
}

function getBlobReadWriteToken() {
  return process.env.BLOB_READ_WRITE_TOKEN ?? process.env.VERCEL_BLOB_READ_WRITE_TOKEN ?? null
}

function buildBlobPath(projectId: string, specId: string) {
  // Keep `/` separators intact for Blob pathname routing.
  const safeProjectId = projectId.trim().replace(/[^a-zA-Z0-9-_]/g, "-")
  const safeSpecId = specId.trim().replace(/[^a-zA-Z0-9-_]/g, "-")
  return `specs/${safeProjectId}/${safeSpecId}.md`
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

async function uploadSpecToBlob({
  projectId,
  specId,
  markdown,
}: {
  projectId: string
  specId: string
  markdown: string
}): Promise<string> {
  const blobToken = getBlobReadWriteToken()
  if (!blobToken) {
    throw new Error("Vercel Blob token is not configured.")
  }

  const blobPath = buildBlobPath(projectId, specId)
  const uploadUrl = buildBlobUploadUrl(blobPath)

  const uploadResponse = await fetch(uploadUrl, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${blobToken}`,
      "Content-Type": "text/markdown",
      "x-add-random-suffix": "0",
      "x-allow-overwrite": "1",
      "x-content-type": "text/markdown",
      "x-vercel-blob-access": "private",
    },
    body: markdown,
  })

  if (!uploadResponse.ok) {
    const responseText = await uploadResponse.text().catch(() => "")
    throw new Error(
      responseText
        ? `Blob upload failed with status ${uploadResponse.status}: ${responseText}`
        : `Blob upload failed with status ${uploadResponse.status}.`,
    )
  }

  const responsePayload = (await uploadResponse.json().catch(() => ({}))) as BlobUploadResponse

  if (!responsePayload.url) {
    throw new Error("Vercel Blob upload did not return a URL.")
  }

  return responsePayload.url
}

// Uploads the spec Markdown to Vercel Blob and records the Blob URL as a
// `ProjectSpec` metadata row linked to the project.
export async function persistGeneratedSpec({
  projectId,
  markdown,
}: PersistSpecInput): Promise<PersistedSpec> {
  const specId = randomUUID()

  const filePath = await uploadSpecToBlob({ projectId, specId, markdown })

  const spec = await prisma.projectSpec.create({
    data: {
      id: specId,
      projectId,
      filePath,
    },
    select: {
      id: true,
      projectId: true,
      filePath: true,
      createdAt: true,
    },
  })

  return spec
}
