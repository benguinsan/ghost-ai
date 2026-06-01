"use client"

import type { FormEvent, ReactNode } from "react"
import { createContext, useContext, useMemo, useState } from "react"

import { EditorDialogPattern } from "@/components/editor/dialog-pattern"
import { Button } from "@/components/ui/button"
import { Dialog } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"

export interface ProjectListItem {
  id: string
  name: string
  slug: string
  isOwned: boolean
}

type ActiveDialog = "create" | "rename" | "delete" | null

const INITIAL_OWNED_PROJECTS: ProjectListItem[] = [
  {
    id: "project-owned-1",
    name: "Realtime Event Mesh",
    slug: "realtime-event-mesh",
    isOwned: true,
  },
  {
    id: "project-owned-2",
    name: "Internal Billing Platform",
    slug: "internal-billing-platform",
    isOwned: true,
  },
]

const INITIAL_SHARED_PROJECTS: ProjectListItem[] = [
  {
    id: "project-shared-1",
    name: "Analytics Data Lake",
    slug: "analytics-data-lake",
    isOwned: false,
  },
  {
    id: "project-shared-2",
    name: "Mobile Push Gateway",
    slug: "mobile-push-gateway",
    isOwned: false,
  },
]

function slugifyProjectName(projectName: string) {
  return projectName
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
}

async function simulateRequestDelay() {
  await new Promise((resolve) => setTimeout(resolve, 250))
}

interface UseProjectDialogStateResult {
  activeDialog: ActiveDialog
  isLoading: boolean
  projectName: string
  slugPreview: string
  selectedProject: ProjectListItem | null
  ownedProjects: ProjectListItem[]
  sharedProjects: ProjectListItem[]
  setProjectName: (value: string) => void
  openCreateDialog: () => void
  openRenameDialog: (projectId: string) => void
  openDeleteDialog: (projectId: string) => void
  closeDialog: () => void
  submitCreateProject: (event: FormEvent<HTMLFormElement>) => Promise<void>
  submitRenameProject: (event: FormEvent<HTMLFormElement>) => Promise<void>
  submitDeleteProject: () => Promise<void>
}

function useProjectDialogState(): UseProjectDialogStateResult {
  const [activeDialog, setActiveDialog] = useState<ActiveDialog>(null)
  const [projectName, setProjectName] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null)
  const [ownedProjects, setOwnedProjects] = useState<ProjectListItem[]>(INITIAL_OWNED_PROJECTS)
  const [sharedProjects] = useState<ProjectListItem[]>(INITIAL_SHARED_PROJECTS)

  const selectedProject = useMemo(
    () => ownedProjects.find((project) => project.id === selectedProjectId) ?? null,
    [ownedProjects, selectedProjectId]
  )

  const slugPreview = useMemo(() => slugifyProjectName(projectName), [projectName])

  const closeDialog = () => {
    setActiveDialog(null)
    setProjectName("")
    setSelectedProjectId(null)
  }

  const openCreateDialog = () => {
    setProjectName("")
    setSelectedProjectId(null)
    setActiveDialog("create")
  }

  const openRenameDialog = (projectId: string) => {
    const project = ownedProjects.find((item) => item.id === projectId)

    if (!project) {
      return
    }

    setProjectName(project.name)
    setSelectedProjectId(projectId)
    setActiveDialog("rename")
  }

  const openDeleteDialog = (projectId: string) => {
    const project = ownedProjects.find((item) => item.id === projectId)

    if (!project) {
      return
    }

    setProjectName("")
    setSelectedProjectId(projectId)
    setActiveDialog("delete")
  }

  const submitCreateProject = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const trimmedName = projectName.trim()

    if (!trimmedName || isLoading) {
      return
    }

    setIsLoading(true)
    await simulateRequestDelay()

    setOwnedProjects((currentProjects) => [
      {
        id: `project-owned-${Date.now()}`,
        name: trimmedName,
        slug: slugifyProjectName(trimmedName),
        isOwned: true,
      },
      ...currentProjects,
    ])

    setIsLoading(false)
    closeDialog()
  }

  const submitRenameProject = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const trimmedName = projectName.trim()

    if (!trimmedName || !selectedProjectId || isLoading) {
      return
    }

    setIsLoading(true)
    await simulateRequestDelay()

    setOwnedProjects((currentProjects) =>
      currentProjects.map((project) =>
        project.id === selectedProjectId
          ? {
              ...project,
              name: trimmedName,
              slug: slugifyProjectName(trimmedName),
            }
          : project
      )
    )

    setIsLoading(false)
    closeDialog()
  }

  const submitDeleteProject = async () => {
    if (!selectedProjectId || isLoading) {
      return
    }

    setIsLoading(true)
    await simulateRequestDelay()

    setOwnedProjects((currentProjects) =>
      currentProjects.filter((project) => project.id !== selectedProjectId)
    )

    setIsLoading(false)
    closeDialog()
  }

  return {
    activeDialog,
    isLoading,
    projectName,
    slugPreview,
    selectedProject,
    ownedProjects,
    sharedProjects,
    setProjectName,
    openCreateDialog,
    openRenameDialog,
    openDeleteDialog,
    closeDialog,
    submitCreateProject,
    submitRenameProject,
    submitDeleteProject,
  }
}

const ProjectDialogStateContext = createContext<UseProjectDialogStateResult | null>(null)

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
          description="Name your project. The slug preview updates as you type."
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
              Slug preview:{" "}
              <span className="font-medium text-copy-secondary">
                {state.slugPreview || "project-slug"}
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
}

export function ProjectDialogStateProvider({ children }: ProjectDialogStateProviderProps) {
  const state = useProjectDialogState()

  return (
    <ProjectDialogStateContext.Provider value={state}>
      {children}
      <ProjectDialogs />
    </ProjectDialogStateContext.Provider>
  )
}
