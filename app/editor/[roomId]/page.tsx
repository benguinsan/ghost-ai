import { redirect } from "next/navigation"

import { AccessDenied } from "@/components/editor/access-denied"
import { getAccessibleProjectByRoom, getCurrentProjectIdentity } from "@/lib/project-access"

interface EditorWorkspacePageProps {
  params: Promise<{
    roomId: string
  }>
}

export default async function EditorWorkspacePage({ params }: EditorWorkspacePageProps) {
  const identity = await getCurrentProjectIdentity()

  if (!identity.userId) {
    redirect("/sign-in")
  }

  if (!identity.primaryEmail) {
    return <AccessDenied />
  }

  const { roomId } = await params
  const project = await getAccessibleProjectByRoom({
    roomId,
    userId: identity.userId,
    primaryEmail: identity.primaryEmail,
  })

  if (!project) {
    return <AccessDenied />
  }

  return (
    <div className="flex min-w-0 flex-1 bg-base">
      <div className="flex flex-1 items-center justify-center px-6 py-10">
        <div className="w-full max-w-2xl rounded-2xl border border-surface-border bg-surface p-8 text-center">
          <h1 className="text-2xl font-semibold text-copy-primary">Workspace Canvas</h1>
          <p className="mt-2 text-copy-muted">Canvas area placeholder for {project.name}</p>
        </div>
      </div>
    </div>
  )
}
