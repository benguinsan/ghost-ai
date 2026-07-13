import { auth, currentUser } from "@clerk/nextjs/server"

import { forbiddenResponse, serviceUnavailableResponse, unauthorizedResponse } from "@/lib/api-responses"
import { getAccessibleProjectByRoom, getCollaboratorEmailsFromUser } from "@/lib/project-access"
import { prisma } from "@/lib/prisma"

interface SpecsRouteContext {
  params: Promise<{
    projectId: string
  }>
}

export async function GET(_request: Request, context: SpecsRouteContext) {
  const { userId } = await auth()

  if (!userId) {
    return unauthorizedResponse()
  }

  const user = await currentUser()
  const collaboratorEmails = getCollaboratorEmailsFromUser(user?.emailAddresses)

  if (collaboratorEmails.length === 0) {
    return forbiddenResponse()
  }

  const { projectId } = await context.params

  let project
  try {
    project = await getAccessibleProjectByRoom({
      roomId: projectId,
      userId,
      primaryEmail: collaboratorEmails[0],
      collaboratorEmails,
    })
  } catch (error) {
    console.error("Failed to verify project access for specs list.", error)
    return serviceUnavailableResponse("Could not load specs right now.")
  }

  if (!project) {
    return forbiddenResponse()
  }

  const specs = await prisma.projectSpec.findMany({
    where: {
      projectId: project.id,
    },
    orderBy: {
      createdAt: "desc",
    },
    select: {
      id: true,
      createdAt: true,
    },
  })

  return Response.json({
    specs: specs.map((spec) => ({
      id: spec.id,
      createdAt: spec.createdAt.toISOString(),
      filename: `${spec.id}.md`,
    })),
  })
}
