import { auth, currentUser } from "@clerk/nextjs/server"

import { forbiddenResponse, unauthorizedResponse } from "@/lib/api-responses"
import { getAccessibleProjectByRoom } from "@/lib/project-access"
import { prisma } from "@/lib/prisma"

interface SpecDownloadRouteContext {
  params: Promise<{
    projectId: string
    specId: string
  }>
}

function getBlobReadWriteToken() {
  return process.env.BLOB_READ_WRITE_TOKEN ?? process.env.VERCEL_BLOB_READ_WRITE_TOKEN ?? null
}

function notFoundResponse() {
  return Response.json({ error: "Spec not found." }, { status: 404 })
}

export async function GET(_request: Request, context: SpecDownloadRouteContext) {
  const { userId } = await auth()

  if (!userId) {
    return unauthorizedResponse()
  }

  const user = await currentUser()
  const primaryEmail = user?.emailAddresses[0]?.emailAddress ?? null

  if (!primaryEmail) {
    return forbiddenResponse()
  }

  const { projectId, specId } = await context.params

  // Project id doubles as the Liveblocks room id, so we reuse the shared access
  // helper to enforce owner/collaborator membership before returning anything.
  const project = await getAccessibleProjectByRoom({
    roomId: projectId,
    userId,
    primaryEmail,
  })

  if (!project) {
    return forbiddenResponse()
  }

  const spec = await prisma.projectSpec.findFirst({
    where: {
      id: specId,
      projectId: project.id,
    },
    select: {
      id: true,
      filePath: true,
    },
  })

  if (!spec) {
    return notFoundResponse()
  }

  const blobToken = getBlobReadWriteToken()

  let blobResponse: Response
  try {
    blobResponse = await fetch(spec.filePath, {
      cache: "no-store",
      headers: blobToken
        ? {
            Authorization: `Bearer ${blobToken}`,
          }
        : undefined,
    })
  } catch (error) {
    console.error("Failed to fetch spec artifact from Vercel Blob.", error)
    return Response.json({ error: "Spec artifact could not be fetched." }, { status: 502 })
  }

  if (!blobResponse.ok) {
    return Response.json({ error: "Spec artifact could not be fetched." }, { status: 502 })
  }

  const markdown = await blobResponse.text()

  return new Response(markdown, {
    status: 200,
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Content-Disposition": `attachment; filename="${spec.id}.md"`,
      "Cache-Control": "no-store",
    },
  })
}
