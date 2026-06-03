import type { ReactNode } from "react"
import { auth, currentUser } from "@clerk/nextjs/server"

import { EditorLayout } from "@/components/editor/editor-layout"
import { getProjectSidebarData } from "@/lib/project-data"

interface EditorRouteLayoutProps {
  children: ReactNode
}

export default async function EditorRouteLayout({ children }: EditorRouteLayoutProps) {
  const { userId } = await auth()

  if (!userId) {
    return <EditorLayout ownedProjects={[]} sharedProjects={[]}>{children}</EditorLayout>
  }

  const user = await currentUser()
  const collaboratorEmails = (user?.emailAddresses ?? [])
    .map((emailAddress) => emailAddress.emailAddress)
    .filter((emailAddress): emailAddress is string => Boolean(emailAddress))

  const projectData = await getProjectSidebarData({
    userId,
    collaboratorEmails,
  })

  return (
    <EditorLayout ownedProjects={projectData.ownedProjects} sharedProjects={projectData.sharedProjects}>
      {children}
    </EditorLayout>
  )
}
