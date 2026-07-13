"use client"

import type { ReactNode } from "react"
import { useEffect, useState } from "react"
import { usePathname } from "next/navigation"
import { LiveblocksProvider, RoomProvider } from "@liveblocks/react/suspense"

import { AiSidebar } from "@/components/editor/ai-sidebar"
import { EditorNavbar } from "@/components/editor/editor-navbar"
import {
  ProjectDialogStateProvider,
  useProjectDialogs,
} from "@/components/editor/project-dialog-state"
import { ProjectSidebar } from "@/components/editor/project-sidebar"
import { ShareDialog } from "@/components/editor/share-dialog"
import { OPEN_STARTER_TEMPLATES_EVENT } from "@/components/editor/starter-template-events"
import {
  CANVAS_SAVE_STATUS_EVENT,
  type CanvasSaveStatus,
  type CanvasSaveStatusEventDetail,
} from "@/components/editor/canvas-save-status-events"
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
  const [canvasSaveStatus, setCanvasSaveStatus] = useState<CanvasSaveStatus | null>(null)
  const pathname = usePathname()
  const activeProjectId = getActiveWorkspaceId(pathname)
  const projectName = getProjectNameById(activeProjectId, [...ownedProjects, ...sharedProjects])

  useEffect(() => {
    const handleCanvasSaveStatus = (event: Event) => {
      const customEvent = event as CustomEvent<CanvasSaveStatusEventDetail>
      if (!customEvent.detail || customEvent.detail.projectId !== activeProjectId) {
        return
      }

      setCanvasSaveStatus(customEvent.detail.status)
    }

    window.addEventListener(CANVAS_SAVE_STATUS_EVENT, handleCanvasSaveStatus)

    return () => {
      window.removeEventListener(CANVAS_SAVE_STATUS_EVENT, handleCanvasSaveStatus)
    }
  }, [activeProjectId])

  useEffect(() => {
    if (!activeProjectId) {
      setCanvasSaveStatus(null)
      return
    }

    setCanvasSaveStatus("saved")
  }, [activeProjectId])

  return (
    <ProjectDialogStateProvider ownedProjects={ownedProjects} sharedProjects={sharedProjects}>
      <EditorLayoutBody
        activeProjectId={activeProjectId}
        canvasSaveStatus={canvasSaveStatus}
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
  canvasSaveStatus: CanvasSaveStatus | null
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
  canvasSaveStatus,
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
        saveStatus={canvasSaveStatus}
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
      {activeProjectId ? (
        <LiveblocksProvider authEndpoint="/api/liveblocks-auth">
          <RoomProvider id={activeProjectId} initialPresence={{ cursor: null, thinking: false }}>
            <section className="flex flex-1">
              <div className="flex min-w-0 flex-1">{children}</div>
            </section>
            <AiSidebar
              isOpen={isAiSidebarOpen}
              onClose={() => setIsAiSidebarOpen(false)}
              projectId={activeProjectId}
            />
          </RoomProvider>
        </LiveblocksProvider>
      ) : (
        <section className="flex flex-1">
          <div className="flex min-w-0 flex-1">{children}</div>
        </section>
      )}
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
