import { auth, currentUser } from "@clerk/nextjs/server"
import { auth as triggerAuth, tasks } from "@trigger.dev/sdk"

import { badRequestResponse, forbiddenResponse, serviceUnavailableResponse, unauthorizedResponse } from "@/lib/api-responses"
import { getAccessibleProjectByRoom, getCollaboratorEmailsFromUser } from "@/lib/project-access"
import { prisma } from "@/lib/prisma"
import type { generateSpecTask } from "@/trigger/generate-spec"

interface SpecRequestBody {
  roomId?: unknown
  chatHistory?: unknown
  nodes?: unknown
  edges?: unknown
}

export async function POST(request: Request) {
  const { userId } = await auth()

  if (!userId) {
    return unauthorizedResponse()
  }

  const user = await currentUser()
  const collaboratorEmails = getCollaboratorEmailsFromUser(user?.emailAddresses)

  if (collaboratorEmails.length === 0) {
    return forbiddenResponse()
  }

  const payload = (await request.json().catch(() => ({}))) as SpecRequestBody

  if (typeof payload.roomId !== "string" || payload.roomId.trim().length === 0) {
    return badRequestResponse("A roomId is required.")
  }

  if (payload.chatHistory !== undefined && !Array.isArray(payload.chatHistory)) {
    return badRequestResponse("chatHistory must be an array.")
  }

  if (payload.nodes !== undefined && !Array.isArray(payload.nodes)) {
    return badRequestResponse("nodes must be an array.")
  }

  if (payload.edges !== undefined && !Array.isArray(payload.edges)) {
    return badRequestResponse("edges must be an array.")
  }

  const roomId = payload.roomId.trim()

  // Project access is derived from the authenticated user + roomId only. We do
  // not trust any client-supplied projectId.
  let project
  try {
    project = await getAccessibleProjectByRoom({
      roomId,
      userId,
      primaryEmail: collaboratorEmails[0],
      collaboratorEmails,
    })
  } catch (error) {
    console.error("Failed to verify project access for spec generation.", error)
    return serviceUnavailableResponse("Could not start spec generation right now.")
  }

  if (!project) {
    return forbiddenResponse()
  }

  try {
    const handle = await tasks.trigger<typeof generateSpecTask>("generate-spec", {
      projectId: project.id,
      roomId,
      projectName: project.name,
      chatHistory: payload.chatHistory ?? [],
      nodes: payload.nodes ?? [],
      edges: payload.edges ?? [],
    })

    await prisma.taskRun.create({
      data: {
        runId: handle.id,
        projectId: project.id,
        userId,
      },
    })

    const publicToken = await triggerAuth.createPublicToken({
      scopes: {
        read: {
          runs: [handle.id],
        },
      },
      expirationTime: "1h",
    })

    return Response.json({ runId: handle.id, publicToken }, { status: 201 })
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error)
    console.error("Failed to trigger spec generation task.", error)
    return Response.json(
      { error: "Failed to start spec generation.", detail },
      { status: 502 },
    )
  }
}
