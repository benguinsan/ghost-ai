"use client"

import { Plus } from "lucide-react"

import { useProjectDialogs } from "@/components/editor/project-dialog-state"
import { Button } from "@/components/ui/button"

export function NewProjectButton() {
  const { openCreateDialog } = useProjectDialogs()

  return (
    <Button onClick={openCreateDialog} type="button">
      <Plus className="h-4 w-4" />
      New Project
    </Button>
  )
}
