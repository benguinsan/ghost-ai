import { useEffect, useRef, useState } from "react"

import type { CanvasEdge, CanvasNode } from "@/types/canvas"
import type { CanvasSaveStatus } from "@/components/editor/canvas-save-status-events"

interface UseCanvasAutosaveInput {
  projectId: string
  nodes: CanvasNode[]
  edges: CanvasEdge[]
  enabled: boolean
  debounceMs?: number
}

const DEFAULT_DEBOUNCE_MS = 1200

export function useCanvasAutosave({
  projectId,
  nodes,
  edges,
  enabled,
  debounceMs = DEFAULT_DEBOUNCE_MS,
}: UseCanvasAutosaveInput): CanvasSaveStatus {
  const [status, setStatus] = useState<CanvasSaveStatus>("saved")
  const latestSavedPayloadRef = useRef<string | null>(null)
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const requestCounterRef = useRef(0)

  useEffect(() => {
    if (!enabled) {
      return
    }

    const payload = {
      nodes,
      edges,
    }
    const serializedPayload = JSON.stringify(payload)

    if (latestSavedPayloadRef.current === serializedPayload) {
      return
    }

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current)
    }

    setStatus("saving")
    const requestCounter = requestCounterRef.current + 1
    requestCounterRef.current = requestCounter

    saveTimeoutRef.current = setTimeout(() => {
      const persistCanvas = async () => {
        try {
          const didSave = await saveCanvas({
            projectId,
            serializedPayload,
          })

          if (requestCounter !== requestCounterRef.current) {
            return
          }

          if (didSave) {
            latestSavedPayloadRef.current = serializedPayload
            setStatus("saved")
            return
          }

          setStatus("error")
        } catch (error) {
          console.error("Canvas autosave request failed.", error)
          if (requestCounter === requestCounterRef.current) {
            setStatus("error")
          }
        }
      }

      void persistCanvas()
    }, debounceMs)

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current)
      }
    }
  }, [debounceMs, edges, enabled, nodes, projectId])

  return status
}

async function saveCanvas({
  projectId,
  serializedPayload,
}: {
  projectId: string
  serializedPayload: string
}) {
  const response = await fetch(`/api/projects/${projectId}/canvas`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: serializedPayload,
  })

  if (!response.ok) {
    const responseBody = await response.text().catch(() => "")
    throw new Error(
      responseBody
        ? `Autosave failed (${response.status}): ${responseBody}`
        : `Autosave failed with status ${response.status}.`,
    )
  }

  return response.ok
}
