"use client"

import { Plus } from "lucide-react"

import { useProjectDialogs } from "@/components/editor/project-dialog-state"
import { Button } from "@/components/ui/button"

export default function EditorPage() {
  const { openCreateDialog } = useProjectDialogs()

  return (
    <div className="flex flex-1 items-center justify-center px-6 py-10">
      <div className="w-full max-w-2xl space-y-3 text-center">
        <h1 className="text-2xl font-semibold text-copy-primary">
          Create a project or open an existing one
        </h1>
        <p className="text-copy-muted">
          Start a new architecture workspace, or choose a project from the sidebar.
        </p>
        <div className="pt-2">
          <Button onClick={openCreateDialog} type="button">
            <Plus className="h-4 w-4" />
            New Project
          </Button>
        </div>
      </div>
    </div>
  )
}
