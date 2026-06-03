import { auth, currentUser } from "@clerk/nextjs/server"
import { notFound } from "next/navigation"

import { prisma } from "@/lib/prisma"

interface EditorWorkspacePageProps {
  params: Promise<{
    projectId: string
  }>
}

export default async function EditorWorkspacePage({ params }: EditorWorkspacePageProps) {
  const { userId } = await auth()
  const user = await currentUser()

  const primaryEmailAddress = user?.emailAddresses[0]?.emailAddress

  if (!userId || !primaryEmailAddress) {
    notFound()
  }

  const { projectId } = await params
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
                equals: primaryEmailAddress,
                mode: "insensitive",
              },
            },
          },
        },
      ],
    },
    select: {
      id: true,
    },
  })

  if (!project) {
    notFound()
  }

  return (
    <div className="flex flex-1 items-center justify-center px-6 py-10">
      <div className="w-full max-w-2xl space-y-3 text-center">
        <h1 className="text-2xl font-semibold text-copy-primary">Project Workspace</h1>
        <p className="text-copy-muted">Loaded project room: {project.id}</p>
      </div>
    </div>
  )
}
