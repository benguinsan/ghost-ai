import { auth, currentUser } from "@clerk/nextjs/server"

import { prisma } from "@/lib/prisma"

export interface CurrentProjectIdentity {
  userId: string | null
  primaryEmail: string | null
}

interface ProjectAccessInput {
  roomId: string
  userId: string
  primaryEmail: string
}

export interface AccessibleProject {
  id: string
  name: string
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
}: ProjectAccessInput): Promise<AccessibleProject | null> {
  try {
    return await prisma.project.findFirst({
      where: {
        id: roomId,
        OR: [
          {
            ownerId: userId,
          },
          {
            collaborators: {
              some: {
                email: {
                  equals: primaryEmail,
                  mode: "insensitive",
                },
              },
            },
          },
        ],
      },
      select: {
        id: true,
        name: true,
      },
    })
  } catch (error) {
    console.error(`Failed to load project access for room "${roomId}".`, error)
    return null
  }
}
