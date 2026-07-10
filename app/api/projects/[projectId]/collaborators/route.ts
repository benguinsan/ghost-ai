import { auth, currentUser } from "@clerk/nextjs/server"

import { badRequestResponse, forbiddenResponse, unauthorizedResponse } from "@/lib/api-responses"
import { getClerkUsersByEmails } from "@/lib/clerk-users"
import { prisma } from "@/lib/prisma"

interface CollaboratorsRouteContext {
  params: Promise<{
    projectId: string
  }>
}

interface CollaboratorMutationBody {
  email?: unknown
}

interface CollaboratorResponseItem {
  email: string
  name: string | null
  avatarUrl: string | null
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase()
}

async function getPrimaryEmailAddress() {
  const user = await currentUser()
  return user?.emailAddresses[0]?.emailAddress ? normalizeEmail(user.emailAddresses[0].emailAddress) : null
}

function parseEmailFromBody(body: CollaboratorMutationBody) {
  if (typeof body.email !== "string") {
    return null
  }

  const normalized = normalizeEmail(body.email)
  if (!normalized) {
    return null
  }

  return normalized
}

async function mapCollaboratorsWithClerk(
  collaborators: Array<{ email: string }>
): Promise<CollaboratorResponseItem[]> {
  const collaboratorEmails = collaborators.map((collaborator) => normalizeEmail(collaborator.email))
  const clerkUsersByEmail = await getClerkUsersByEmails(collaboratorEmails)

  return collaboratorEmails.map((email) => {
    const clerkProfile = clerkUsersByEmail.get(email)

    return {
      email,
      name: clerkProfile?.displayName ?? null,
      avatarUrl: clerkProfile?.avatarUrl ?? null,
    }
  })
}

export async function GET(_request: Request, context: CollaboratorsRouteContext) {
  const { userId } = await auth()
  if (!userId) {
    return unauthorizedResponse()
  }

  const requesterPrimaryEmail = await getPrimaryEmailAddress()
  if (!requesterPrimaryEmail) {
    return forbiddenResponse()
  }

  const { projectId } = await context.params
  const project = await prisma.project.findFirst({
    where: {
      id: projectId,
      OR: [
        {
          ownerId: userId,
        },
        {
          collaborators: {
            some: {
              email: {
                equals: requesterPrimaryEmail,
                mode: "insensitive",
              },
            },
          },
        },
      ],
    },
    select: {
      id: true,
      ownerId: true,
      collaborators: {
        select: {
          email: true,
        },
        orderBy: {
          createdAt: "asc",
        },
      },
    },
  })

  if (!project) {
    return forbiddenResponse()
  }

  const collaborators = await mapCollaboratorsWithClerk(project.collaborators)

  return Response.json({
    role: project.ownerId === userId ? "owner" : "collaborator",
    collaborators,
  })
}

export async function POST(request: Request, context: CollaboratorsRouteContext) {
  const { userId } = await auth()
  if (!userId) {
    return unauthorizedResponse()
  }

  const inviterPrimaryEmail = await getPrimaryEmailAddress()
  if (!inviterPrimaryEmail) {
    return forbiddenResponse()
  }

  const payload = (await request.json().catch(() => ({}))) as CollaboratorMutationBody
  const inviteeEmail = parseEmailFromBody(payload)

  if (!inviteeEmail) {
    return badRequestResponse("Collaborator email is required.")
  }

  const { projectId } = await context.params
  const project = await prisma.project.findUnique({
    where: {
      id: projectId,
    },
    select: {
      ownerId: true,
    },
  })

  if (!project || project.ownerId !== userId) {
    return forbiddenResponse()
  }

  if (inviteeEmail === inviterPrimaryEmail) {
    return badRequestResponse("You already have access as the project owner.")
  }

  const existingCollaborator = await prisma.projectCollaborator.findFirst({
    where: {
      projectId,
      email: {
        equals: inviteeEmail,
        mode: "insensitive",
      },
    },
    select: {
      id: true,
    },
  })

  if (!existingCollaborator) {
    await prisma.projectCollaborator.create({
      data: {
        projectId,
        email: inviteeEmail,
      },
    })
  }

  return Response.json({ success: true }, { status: 201 })
}

// Remove a collaborator from a project
export async function DELETE(request: Request, context: CollaboratorsRouteContext) {
  const { userId } = await auth()
  if (!userId) {
    return unauthorizedResponse()
  }

  const payload = (await request.json().catch(() => ({}))) as CollaboratorMutationBody
  const collaboratorEmail = parseEmailFromBody(payload)

  if (!collaboratorEmail) {
    return badRequestResponse("Collaborator email is required.")
  }

  const { projectId } = await context.params
  const project = await prisma.project.findUnique({
    where: {
      id: projectId,
    },
    select: {
      ownerId: true,
    },
  })

  if (!project || project.ownerId !== userId) {
    return forbiddenResponse()
  }

  const collaborator = await prisma.projectCollaborator.findFirst({
    where: {
      projectId,
      email: {
        equals: collaboratorEmail,
        mode: "insensitive",
      },
    },
    select: {
      id: true,
    },
  })

  if (!collaborator) {
    return Response.json({ success: true })
  }

  await prisma.projectCollaborator.delete({
    where: {
      id: collaborator.id,
    },
  })

  return Response.json({ success: true })
}
