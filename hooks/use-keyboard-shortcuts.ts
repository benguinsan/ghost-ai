"use client"

import { useEffect } from "react"
import type { ReactFlowInstance } from "@xyflow/react"

import type { CanvasEdge, CanvasNode } from "@/types/canvas"

interface UseKeyboardShortcutsOptions {
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

export function useKeyboardShortcuts({ onRedo, onUndo, reactFlowInstance }: UseKeyboardShortcutsOptions) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (shouldSkipShortcutTarget(event.target)) {
        return
      }

      const key = event.key
      const hasCommandModifier = event.metaKey || event.ctrlKey

      if (key === "=" || key === "+") {
        event.preventDefault()
        reactFlowInstance?.zoomIn({ duration: 180 })
        return
      }

      if (key === "-") {
        event.preventDefault()
        reactFlowInstance?.zoomOut({ duration: 180 })
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

    window.addEventListener("keydown", handleKeyDown)

    return () => {
      window.removeEventListener("keydown", handleKeyDown)
    }
  }, [onRedo, onUndo, reactFlowInstance])
}
