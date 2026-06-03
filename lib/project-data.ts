import type { ProjectListItem } from "@/types/project-list-item"

import { prisma } from "@/lib/prisma"

interface ProjectDataInput {
  userId: string
  collaboratorEmails: string[]
}

interface ProjectDataResult {
  ownedProjects: ProjectListItem[]
  sharedProjects: ProjectListItem[]
}

function mapProjectToListItem(project: { id: string; name: string }, isOwned: boolean): ProjectListItem {
  return {
    id: project.id,
    name: project.name,
    slug: project.id,
    isOwned,
  }
}

export async function getProjectSidebarData({
  userId,
  collaboratorEmails,
}: ProjectDataInput): Promise<ProjectDataResult> {
  const ownedProjects = await prisma.project.findMany({
    where: {
      ownerId: userId,
    },
    select: {
      id: true,
      name: true,
    },
    orderBy: {
      createdAt: "desc",
    },
  })

  if (!collaboratorEmails.length) {
    return {
      ownedProjects: ownedProjects.map((project) => mapProjectToListItem(project, true)),
      sharedProjects: [],
    }
  }

  const sharedProjects = await prisma.project.findMany({
    where: {
      ownerId: {
        not: userId,
      },
      collaborators: {
        some: {
          email: {
            in: collaboratorEmails,
            mode: "insensitive",
          },
        },
      },
    },
    select: {
      id: true,
      name: true,
    },
    orderBy: {
      createdAt: "desc",
    },
  })

  return {
    ownedProjects: ownedProjects.map((project) => mapProjectToListItem(project, true)),
    sharedProjects: sharedProjects.map((project) => mapProjectToListItem(project, false)),
  }
}
