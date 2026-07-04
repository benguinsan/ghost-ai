"use client"

import { useEffect } from "react"
import type { ReactFlowInstance } from "@xyflow/react"

import type { CanvasEdge, CanvasNode } from "@/types/canvas"

interface UseKeyboardShortcutsOptions {
  onDeleteSelection: () => void
  onRedo: () => void
  onUndo: () => void
  reactFlowInstance: ReactFlowInstance<CanvasNode, CanvasEdge> | null
}

function shouldSkipShortcutTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) {
    return false
  }

  if (target.isContentEditable) {
    return true
  }

  const editableParent = target.closest("input, textarea, [contenteditable='true']")
  return editableParent !== null
}

export function useKeyboardShortcuts({
  onDeleteSelection,
  onRedo,
  onUndo,
  reactFlowInstance,
}: UseKeyboardShortcutsOptions) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.repeat) {
        return
      }

      if (shouldSkipShortcutTarget(event.target)) {
        return
      }

      const key = event.key
      const code = event.code
      const hasCommandModifier = event.metaKey || event.ctrlKey

      if (key === "=" || key === "+") {
        if (!reactFlowInstance) {
          return
        }

        event.preventDefault()
        reactFlowInstance.zoomIn({ duration: 180 })
        return
      }

      if (key === "-") {
        if (!reactFlowInstance) {
          return
        }

        event.preventDefault()
        reactFlowInstance.zoomOut({ duration: 180 })
        return
      }

      if (
        key === "Backspace" ||
        key === "Delete" ||
        key === "Del" ||
        code === "Backspace" ||
        code === "Delete"
      ) {
        event.preventDefault()
        onDeleteSelection()
        return
      }

      if (!hasCommandModifier) {
        return
      }

      if (key.toLowerCase() === "z") {
        event.preventDefault()
        if (event.shiftKey) {
          onRedo()
          return
        }

        onUndo()
        return
      }

      if (key.toLowerCase() === "y") {
        event.preventDefault()
        onRedo()
      }
    }

    window.addEventListener("keydown", handleKeyDown, { capture: true })

    return () => {
      window.removeEventListener("keydown", handleKeyDown, { capture: true })
    }
  }, [onDeleteSelection, onRedo, onUndo, reactFlowInstance])
}
