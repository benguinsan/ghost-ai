import { auth, currentUser } from "@clerk/nextjs/server"

import { isPrismaInfrastructureError } from "@/lib/prisma-errors"
import { prisma } from "@/lib/prisma"

export interface CurrentProjectIdentity {
  userId: string | null
  primaryEmail: string | null
}

interface ProjectAccessInput {
  roomId: string
  userId: string
  primaryEmail: string
  collaboratorEmails?: string[]
}

function normalizeProjectEmail(email: string) {
  return email.trim().toLowerCase()
}

export function getCollaboratorEmailsFromUser(
  emailAddresses: Array<{ emailAddress: string }> | undefined
) {
  const normalizedEmails = new Set<string>()

  for (const emailAddress of emailAddresses ?? []) {
    const normalized = normalizeProjectEmail(emailAddress.emailAddress)
    if (normalized) {
      normalizedEmails.add(normalized)
    }
  }

  return [...normalizedEmails]
}

export interface AccessibleProject {
  id: string
  name: string
  canvasJsonPath: string | null
}

export async function getCurrentProjectIdentity(): Promise<CurrentProjectIdentity> {
  const { userId } = await auth()

  if (!userId) {
    return {
      userId: null,
      primaryEmail: null,
    }
  }

  const user = await currentUser()
  const primaryEmail = user?.emailAddresses[0]?.emailAddress ?? null

  return {
    userId,
    primaryEmail,
  }
}

export async function getAccessibleProjectByRoom({
  roomId,
  userId,
  primaryEmail,
  collaboratorEmails,
}: ProjectAccessInput): Promise<AccessibleProject | null> {
  const normalizedEmails = collaboratorEmails?.length
    ? collaboratorEmails.map(normalizeProjectEmail).filter(Boolean)
    : [normalizeProjectEmail(primaryEmail)].filter(Boolean)

  try {
    return await prisma.project.findFirst({
      where: {
        id: roomId,
        OR: [
          {
            ownerId: userId,
          },
          ...(normalizedEmails.length
            ? [
                {
                  collaborators: {
                    some: {
                      email: {
                        in: normalizedEmails,
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
        name: true,
        canvasJsonPath: true,
      },
    })
  } catch (error) {
    console.error(`Failed to load project access for room "${roomId}".`, error)

    if (isPrismaInfrastructureError(error)) {
      throw error
    }

    return null
  }
}
