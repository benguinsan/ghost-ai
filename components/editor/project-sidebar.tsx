"use client"

import { Pencil, Plus, Trash2, X } from "lucide-react"

import type { ProjectListItem } from "@/components/editor/project-dialog-state"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"

interface ProjectSidebarProps {
  isOpen: boolean
  onClose: () => void
  ownedProjects: ProjectListItem[]
  sharedProjects: ProjectListItem[]
  onCreateProject: () => void
  onRenameProject: (projectId: string) => void
  onDeleteProject: (projectId: string) => void
}

function EmptyProjectsState({ message }: { message: string }) {
  return (
    <div className="flex h-full items-center justify-center rounded-2xl border border-dashed border-surface-border-subtle bg-subtle px-4 text-center text-sm text-copy-muted">
      <p>{message}</p>
    </div>
  )
}

interface ProjectListProps {
  projects: ProjectListItem[]
  emptyMessage: string
  onRenameProject: (projectId: string) => void
  onDeleteProject: (projectId: string) => void
}

function ProjectList({
  projects,
  emptyMessage,
  onRenameProject,
  onDeleteProject,
}: ProjectListProps) {
  if (!projects.length) {
    return <EmptyProjectsState message={emptyMessage} />
  }

  return (
    <ul className="space-y-2">
      {projects.map((project) => (
        <li
          className="flex items-center justify-between gap-2 rounded-xl border border-surface-border bg-subtle px-3 py-2"
          key={project.id}
        >
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-copy-primary">{project.name}</p>
            <p className="truncate text-xs text-copy-muted">{project.slug}</p>
          </div>
          {project.isOwned ? (
            <div className="flex items-center gap-1">
              <Button
                aria-label={`Rename ${project.name}`}
                onClick={() => onRenameProject(project.id)}
                size="icon-xs"
                type="button"
                variant="ghost"
              >
                <Pencil className="h-3.5 w-3.5" />
              </Button>
              <Button
                aria-label={`Delete ${project.name}`}
                onClick={() => onDeleteProject(project.id)}
                size="icon-xs"
                type="button"
                variant="ghost"
              >
                <Trash2 className="h-3.5 w-3.5 text-destructive" />
              </Button>
            </div>
          ) : null}
        </li>
      ))}
    </ul>
  )
}

export function ProjectSidebar({
  isOpen,
  onClose,
  ownedProjects,
  sharedProjects,
  onCreateProject,
  onRenameProject,
  onDeleteProject,
}: ProjectSidebarProps) {
  return (
    <>
      {isOpen ? (
        <button
          aria-label="Close projects sidebar backdrop"
          className="fixed inset-x-0 top-14 bottom-0 z-30 bg-black/40 md:hidden"
          onClick={onClose}
          type="button"
        />
      ) : null}
      <aside
        inert={!isOpen}
        className={cn(
          "pointer-events-none fixed top-14 bottom-0 left-0 z-40 w-full max-w-sm p-4 transition-transform duration-200 ease-out",
          isOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="pointer-events-auto flex h-full flex-col rounded-2xl border border-surface-border bg-elevated/95 shadow-lg backdrop-blur-sm">
          <header className="flex items-center justify-between border-b border-surface-border px-4 py-3">
            <h2 className="text-sm font-semibold text-copy-primary">Projects</h2>
            <Button
              aria-label="Close projects sidebar"
              onClick={onClose}
              size="icon-sm"
              variant="ghost"
            >
              <X className="h-4 w-4" />
            </Button>
          </header>

          <div className="min-h-0 flex-1 p-4">
            <Tabs className="h-full" defaultValue="my-projects">
              <TabsList className="w-full">
                <TabsTrigger className="flex-1" value="my-projects">
                  My Projects
                </TabsTrigger>
                <TabsTrigger className="flex-1" value="shared">
                  Shared
                </TabsTrigger>
              </TabsList>
              <TabsContent className="mt-3 h-[calc(100%-2.75rem)] overflow-y-auto" value="my-projects">
                <ProjectList
                  emptyMessage="No projects yet. Create one to get started."
                  onDeleteProject={onDeleteProject}
                  onRenameProject={onRenameProject}
                  projects={ownedProjects}
                />
              </TabsContent>
              <TabsContent className="mt-3 h-[calc(100%-2.75rem)] overflow-y-auto" value="shared">
                <ProjectList
                  emptyMessage="No shared projects yet."
                  onDeleteProject={onDeleteProject}
                  onRenameProject={onRenameProject}
                  projects={sharedProjects}
                />
              </TabsContent>
            </Tabs>
          </div>

          <footer className="border-t border-surface-border p-4">
            <Button className="w-full" onClick={onCreateProject} type="button" variant="default">
              <Plus className="h-4 w-4" />
              New Project
            </Button>
          </footer>
        </div>
      </aside>
    </>
  )
}
