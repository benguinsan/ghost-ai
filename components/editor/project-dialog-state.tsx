"use client"

import type { ReactNode } from "react"
import { createContext, useContext } from "react"

import { EditorDialogPattern } from "@/components/editor/dialog-pattern"
import { useProjectActions } from "@/hooks/use-project-actions"
import type { ProjectListItem } from "@/types/project-list-item"
import { Button } from "@/components/ui/button"
import { Dialog } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"

type ProjectActionsState = ReturnType<typeof useProjectActions>

const ProjectDialogStateContext = createContext<ProjectActionsState | null>(null)

export function useProjectDialogs() {
  const context = useContext(ProjectDialogStateContext)

  if (!context) {
    throw new Error("useProjectDialogs must be used within a ProjectDialogStateProvider")
  }

  return context
}

function ProjectDialogs() {
  const state = useProjectDialogs()

  return (
    <>
      <Dialog
        onOpenChange={(open) => {
          if (!open) {
            state.closeDialog()
          }
        }}
        open={state.activeDialog === "create"}
      >
        <EditorDialogPattern
          description="Name your project. The room ID preview updates as you type."
          footerActions={
            <>
              <Button disabled={state.isLoading} onClick={state.closeDialog} type="button" variant="ghost">
                Cancel
              </Button>
              <Button
                disabled={!state.projectName.trim() || state.isLoading}
                form="create-project-form"
                type="submit"
              >
                {state.isLoading ? "Creating..." : "Create Project"}
              </Button>
            </>
          }
          title="Create Project"
        >
          <form className="space-y-3" id="create-project-form" onSubmit={state.submitCreateProject}>
            <label className="space-y-1 text-sm text-copy-primary">
              <span>Project name</span>
              <Input
                onChange={(event) => state.setProjectName(event.target.value)}
                placeholder="e.g. Checkout Platform"
                value={state.projectName}
              />
            </label>
            <p className="text-xs text-copy-muted">
              Room ID preview:{" "}
              <span className="font-medium text-copy-secondary">
                {state.roomIdPreview}
              </span>
            </p>
          </form>
        </EditorDialogPattern>
      </Dialog>

      <Dialog
        onOpenChange={(open) => {
          if (!open) {
            state.closeDialog()
          }
        }}
        open={state.activeDialog === "rename"}
      >
        <EditorDialogPattern
          description={`Current project name: ${state.selectedProject?.name ?? ""}`}
          footerActions={
            <>
              <Button disabled={state.isLoading} onClick={state.closeDialog} type="button" variant="ghost">
                Cancel
              </Button>
              <Button
                disabled={!state.projectName.trim() || state.isLoading}
                form="rename-project-form"
                type="submit"
              >
                {state.isLoading ? "Renaming..." : "Save"}
              </Button>
            </>
          }
          title="Rename Project"
        >
          <form className="space-y-3" id="rename-project-form" onSubmit={state.submitRenameProject}>
            <label className="space-y-1 text-sm text-copy-primary">
              <span>Project name</span>
              <Input
                autoFocus
                onChange={(event) => state.setProjectName(event.target.value)}
                value={state.projectName}
              />
            </label>
          </form>
        </EditorDialogPattern>
      </Dialog>

      <Dialog
        onOpenChange={(open) => {
          if (!open) {
            state.closeDialog()
          }
        }}
        open={state.activeDialog === "delete"}
      >
        <EditorDialogPattern
          description={`Delete "${state.selectedProject?.name ?? "this project"}"? This action cannot be undone.`}
          footerActions={
            <>
              <Button disabled={state.isLoading} onClick={state.closeDialog} type="button" variant="ghost">
                Cancel
              </Button>
              <Button disabled={state.isLoading} onClick={state.submitDeleteProject} type="button" variant="destructive">
                {state.isLoading ? "Deleting..." : "Delete Project"}
              </Button>
            </>
          }
          title="Delete Project"
        />
      </Dialog>
    </>
  )
}

interface ProjectDialogStateProviderProps {
  children: ReactNode
  ownedProjects: ProjectListItem[]
  sharedProjects: ProjectListItem[]
}

export function ProjectDialogStateProvider({
  children,
  ownedProjects,
  sharedProjects,
}: ProjectDialogStateProviderProps) {
  const state = useProjectActions({
    ownedProjects,
    sharedProjects,
  })

  return (
    <ProjectDialogStateContext.Provider value={state}>
      {children}
      <ProjectDialogs />
    </ProjectDialogStateContext.Provider>
  )
}
