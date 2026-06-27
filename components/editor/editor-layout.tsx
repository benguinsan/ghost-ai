"use client"

import type { ReactNode } from "react"
import { useState } from "react"
import { usePathname } from "next/navigation"

import { EditorNavbar } from "@/components/editor/editor-navbar"
import {
  ProjectDialogStateProvider,
  useProjectDialogs,
} from "@/components/editor/project-dialog-state"
import { ProjectSidebar } from "@/components/editor/project-sidebar"
import { ShareDialog } from "@/components/editor/share-dialog"
import { OPEN_STARTER_TEMPLATES_EVENT } from "@/components/editor/starter-template-events"
import type { ProjectListItem } from "@/types/project-list-item"

interface EditorLayoutProps {
  children: ReactNode
  ownedProjects: ProjectListItem[]
  sharedProjects: ProjectListItem[]
}

export function EditorLayout({ children, ownedProjects, sharedProjects }: EditorLayoutProps) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true)
  const [isAiSidebarOpen, setIsAiSidebarOpen] = useState(false)
  const [isShareDialogOpen, setIsShareDialogOpen] = useState(false)
  const pathname = usePathname()
  const activeProjectId = getActiveWorkspaceId(pathname)
  const projectName = getProjectNameById(activeProjectId, [...ownedProjects, ...sharedProjects])

  return (
    <ProjectDialogStateProvider ownedProjects={ownedProjects} sharedProjects={sharedProjects}>
      <EditorLayoutBody
        activeProjectId={activeProjectId}
        isAiSidebarOpen={Boolean(activeProjectId) && isAiSidebarOpen}
        isSidebarOpen={isSidebarOpen}
        isShareDialogOpen={Boolean(activeProjectId) && isShareDialogOpen}
        projectName={projectName}
        setIsAiSidebarOpen={setIsAiSidebarOpen}
        setIsShareDialogOpen={setIsShareDialogOpen}
        setIsSidebarOpen={setIsSidebarOpen}
      >
        {children}
      </EditorLayoutBody>
    </ProjectDialogStateProvider>
  )
}

function getActiveWorkspaceId(pathname: string) {
  const match = pathname.match(/^\/editor\/([^/]+)$/)
  return match?.[1] ?? null
}

function getProjectNameById(projectId: string | null, projects: ProjectListItem[]) {
  if (!projectId) {
    return null
  }

  return projects.find((project) => project.id === projectId)?.name ?? null
}

interface EditorLayoutBodyProps {
  children: ReactNode
  activeProjectId: string | null
  isAiSidebarOpen: boolean
  isSidebarOpen: boolean
  isShareDialogOpen: boolean
  projectName: string | null
  setIsAiSidebarOpen: (value: boolean | ((value: boolean) => boolean)) => void
  setIsShareDialogOpen: (value: boolean | ((value: boolean) => boolean)) => void
  setIsSidebarOpen: (value: boolean | ((value: boolean) => boolean)) => void
}

function EditorLayoutBody({
  children,
  activeProjectId,
  isAiSidebarOpen,
  isSidebarOpen,
  isShareDialogOpen,
  projectName,
  setIsAiSidebarOpen,
  setIsShareDialogOpen,
  setIsSidebarOpen,
}: EditorLayoutBodyProps) {
  const dialogState = useProjectDialogs()
  const handleOpenStarterTemplates = () => {
    window.dispatchEvent(new CustomEvent(OPEN_STARTER_TEMPLATES_EVENT))
  }

  return (
    <main className="relative flex min-h-screen flex-col bg-base">
      <EditorNavbar
        isSidebarOpen={isSidebarOpen}
        isAiSidebarOpen={isAiSidebarOpen}
        onOpenStarterTemplates={handleOpenStarterTemplates}
        onShare={() => setIsShareDialogOpen(true)}
        onToggleAiSidebar={() => setIsAiSidebarOpen((previous) => !previous)}
        onToggleSidebar={() => setIsSidebarOpen((previous) => !previous)}
        projectName={projectName ?? undefined}
      />
      <ProjectSidebar
        activeProjectId={activeProjectId}
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        onCreateProject={dialogState.openCreateDialog}
        onDeleteProject={dialogState.openDeleteDialog}
        onRenameProject={dialogState.openRenameDialog}
        ownedProjects={dialogState.ownedProjects}
        sharedProjects={dialogState.sharedProjects}
      />
      <section className="flex flex-1">
        <div className="flex min-w-0 flex-1">{children}</div>
        {activeProjectId ? (
          <aside
            className={
              isAiSidebarOpen
                ? "hidden w-80 shrink-0 border-l border-surface-border bg-elevated/95 p-4 md:block"
                : "hidden"
            }
          >
            <div className="flex h-full items-center justify-center rounded-2xl border border-surface-border bg-subtle p-4 text-center text-sm text-copy-muted">
              AI sidebar placeholder
            </div>
          </aside>
        ) : null}
      </section>
      {activeProjectId && projectName ? (
        <ShareDialog
          isOpen={isShareDialogOpen}
          onOpenChange={setIsShareDialogOpen}
          projectId={activeProjectId}
          projectName={projectName}
        />
      ) : null}
    </main>
  )
}
