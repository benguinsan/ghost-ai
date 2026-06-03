"use client"

import type { ReactNode } from "react"
import { useState } from "react"

import { EditorNavbar } from "@/components/editor/editor-navbar"
import {
  ProjectDialogStateProvider,
  useProjectDialogs,
} from "@/components/editor/project-dialog-state"
import { ProjectSidebar } from "@/components/editor/project-sidebar"
import type { ProjectListItem } from "@/types/project-list-item"

interface EditorLayoutProps {
  children: ReactNode
  ownedProjects: ProjectListItem[]
  sharedProjects: ProjectListItem[]
}

export function EditorLayout({ children, ownedProjects, sharedProjects }: EditorLayoutProps) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true)

  return (
    <ProjectDialogStateProvider ownedProjects={ownedProjects} sharedProjects={sharedProjects}>
      <EditorLayoutBody isSidebarOpen={isSidebarOpen} setIsSidebarOpen={setIsSidebarOpen}>
        {children}
      </EditorLayoutBody>
    </ProjectDialogStateProvider>
  )
}

interface EditorLayoutBodyProps {
  children: ReactNode
  isSidebarOpen: boolean
  setIsSidebarOpen: (value: boolean | ((value: boolean) => boolean)) => void
}

function EditorLayoutBody({
  children,
  isSidebarOpen,
  setIsSidebarOpen,
}: EditorLayoutBodyProps) {
  const dialogState = useProjectDialogs()

  return (
    <main className="relative flex min-h-screen flex-col bg-base">
      <EditorNavbar
        isSidebarOpen={isSidebarOpen}
        onToggleSidebar={() => setIsSidebarOpen((previous) => !previous)}
      />
      <ProjectSidebar
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        onCreateProject={dialogState.openCreateDialog}
        onDeleteProject={dialogState.openDeleteDialog}
        onRenameProject={dialogState.openRenameDialog}
        ownedProjects={dialogState.ownedProjects}
        sharedProjects={dialogState.sharedProjects}
      />
      <section className="flex flex-1">{children}</section>
    </main>
  )
}
