import { redirect } from "next/navigation"

import { AccessDenied } from "@/components/editor/access-denied"
import { CollaborativeCanvas } from "@/components/editor/collaborative-canvas"
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
      <CollaborativeCanvas hasSavedCanvas={Boolean(project.canvasJsonPath)} roomId={project.id} />
    </div>
  )
}
