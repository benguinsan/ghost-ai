import { auth, currentUser } from "@clerk/nextjs/server"

import { forbiddenResponse, serviceUnavailableResponse, unauthorizedResponse } from "@/lib/api-responses"
import { getAccessibleProjectByRoom, getCollaboratorEmailsFromUser } from "@/lib/project-access"
import { prisma } from "@/lib/prisma"

interface SpecContentRouteContext {
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

export async function GET(_request: Request, context: SpecContentRouteContext) {
  const { userId } = await auth()

  if (!userId) {
    return unauthorizedResponse()
  }

  const user = await currentUser()
  const collaboratorEmails = getCollaboratorEmailsFromUser(user?.emailAddresses)

  if (collaboratorEmails.length === 0) {
    return forbiddenResponse()
  }

  const { projectId, specId } = await context.params

  let project
  try {
    project = await getAccessibleProjectByRoom({
      roomId: projectId,
      userId,
      primaryEmail: collaboratorEmails[0],
      collaboratorEmails,
    })
  } catch (error) {
    console.error("Failed to verify project access for spec content.", error)
    return serviceUnavailableResponse("Could not load this spec right now.")
  }

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
      createdAt: true,
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

  return Response.json({
    id: spec.id,
    createdAt: spec.createdAt.toISOString(),
    filename: `${spec.id}.md`,
    markdown,
  })
}
