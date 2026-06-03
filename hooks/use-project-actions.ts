"use client"

import { useMemo, useState, type FormEvent } from "react"
import { usePathname, useRouter } from "next/navigation"

import type { ProjectListItem } from "@/types/project-list-item"

type ActiveDialog = "create" | "rename" | "delete" | null

interface UseProjectActionsInput {
  ownedProjects: ProjectListItem[]
  sharedProjects: ProjectListItem[]
}

interface UseProjectActionsResult {
  activeDialog: ActiveDialog
  isLoading: boolean
  projectName: string
  roomIdPreview: string
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

function slugifyProjectName(projectName: string) {
  return projectName
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
}

function generateShortSuffix() {
  return Math.random().toString(36).slice(2, 8)
}

function getActiveWorkspaceId(pathname: string): string | null {
  const match = pathname.match(/^\/editor\/([^/]+)$/)
  return match?.[1] ?? null
}

export function useProjectActions({
  ownedProjects: initialOwnedProjects,
  sharedProjects: initialSharedProjects,
}: UseProjectActionsInput): UseProjectActionsResult {
  const router = useRouter()
  const pathname = usePathname()

  const [activeDialog, setActiveDialog] = useState<ActiveDialog>(null)
  const [projectName, setProjectName] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null)
  const [createSuffix, setCreateSuffix] = useState("")
  const ownedProjects = initialOwnedProjects
  const sharedProjects = initialSharedProjects

  const selectedProject = useMemo(
    () => ownedProjects.find((project) => project.id === selectedProjectId) ?? null,
    [ownedProjects, selectedProjectId]
  )

  const roomIdPreview = useMemo(() => {
    const slug = slugifyProjectName(projectName)
    const suffix = createSuffix || "xxxxxx"

    if (!slug) {
      return `project-${suffix}`
    }

    return `${slug}-${suffix}`
  }, [createSuffix, projectName])

  const closeDialog = () => {
    if (isLoading) {
      return
    }

    setActiveDialog(null)
    setProjectName("")
    setSelectedProjectId(null)
    setCreateSuffix("")
  }

  const openCreateDialog = () => {
    setProjectName("")
    setSelectedProjectId(null)
    setCreateSuffix(generateShortSuffix())
    setActiveDialog("create")
  }

  const openRenameDialog = (projectId: string) => {
    const project = ownedProjects.find((item) => item.id === projectId)

    if (!project) {
      return
    }

    setProjectName(project.name)
    setSelectedProjectId(projectId)
    setCreateSuffix("")
    setActiveDialog("rename")
  }

  const openDeleteDialog = (projectId: string) => {
    const project = ownedProjects.find((item) => item.id === projectId)

    if (!project) {
      return
    }

    setProjectName("")
    setSelectedProjectId(projectId)
    setCreateSuffix("")
    setActiveDialog("delete")
  }

  const submitCreateProject = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const trimmedName = projectName.trim()

    if (!trimmedName || isLoading) {
      return
    }

    const slug = slugifyProjectName(trimmedName)
    const roomId = `${slug || "project"}-${createSuffix || generateShortSuffix()}`

    try {
      setIsLoading(true)

      const response = await fetch("/api/projects", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: trimmedName,
          roomId,
        }),
      })

      if (!response.ok) {
        throw new Error("Failed to create project")
      }

      const payload = (await response.json()) as { project: { id: string } }

      setIsLoading(false)
      setActiveDialog(null)
      setProjectName("")
      setSelectedProjectId(null)
      setCreateSuffix("")
      router.push(`/editor/${payload.project.id}`)
      router.refresh()
    } catch (error) {
      console.error(error)
      setIsLoading(false)
    }
  }

  const submitRenameProject = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const trimmedName = projectName.trim()

    if (!trimmedName || !selectedProjectId || isLoading) {
      return
    }

    try {
      setIsLoading(true)

      const response = await fetch(`/api/projects/${selectedProjectId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: trimmedName,
        }),
      })

      if (!response.ok) {
        throw new Error("Failed to rename project")
      }

      setIsLoading(false)
      setActiveDialog(null)
      setProjectName("")
      setSelectedProjectId(null)
      router.refresh()
    } catch (error) {
      console.error(error)
      setIsLoading(false)
    }
  }

  const submitDeleteProject = async () => {
    if (!selectedProjectId || isLoading) {
      return
    }

    try {
      setIsLoading(true)

      const response = await fetch(`/api/projects/${selectedProjectId}`, {
        method: "DELETE",
      })

      if (!response.ok) {
        throw new Error("Failed to delete project")
      }

      const activeWorkspaceId = getActiveWorkspaceId(pathname)
      const deletedProjectId = selectedProjectId

      setIsLoading(false)
      setActiveDialog(null)
      setProjectName("")
      setSelectedProjectId(null)

      if (activeWorkspaceId && activeWorkspaceId === deletedProjectId) {
        router.push("/editor")
        router.refresh()
        return
      }

      router.refresh()
    } catch (error) {
      console.error(error)
      setIsLoading(false)
    }
  }

  return {
    activeDialog,
    isLoading,
    projectName,
    roomIdPreview,
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
