"use client"

import { Plus, X } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"

interface ProjectSidebarProps {
  isOpen: boolean
  onClose: () => void
}

function EmptyProjectsState({ message }: { message: string }) {
  return (
    <div className="flex h-full items-center justify-center rounded-2xl border border-dashed border-surface-border-subtle bg-subtle px-4 text-center text-sm text-copy-muted">
      <p>{message}</p>
    </div>
  )
}

export function ProjectSidebar({ isOpen, onClose }: ProjectSidebarProps) {
  return (
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
            <TabsContent className="mt-3 h-[calc(100%-2.75rem)]" value="my-projects">
              <EmptyProjectsState message="No projects yet. Create one to get started." />
            </TabsContent>
            <TabsContent className="mt-3 h-[calc(100%-2.75rem)]" value="shared">
              <EmptyProjectsState message="No shared projects yet." />
            </TabsContent>
          </Tabs>
        </div>

        <footer className="border-t border-surface-border p-4">
          <Button className="w-full" variant="default">
            <Plus className="h-4 w-4" />
            New Project
          </Button>
        </footer>
      </div>
    </aside>
  )
}
