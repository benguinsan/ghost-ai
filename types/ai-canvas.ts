// On-canvas AI presence for the collaborative canvas.
//
// Only the AI's on-canvas pointer lives in Liveblocks Storage (root key `ai`),
// published by the durable design-agent background task. Human-readable status
// text is published to the Liveblocks feed `ai-status-feed` (see `types/tasks.ts`),
// and per-participant "working" state uses Liveblocks Presence (`thinking`).

export type AiCanvasPhase = "idle" | "thinking" | "generating" | "complete" | "error"

export type AiCanvasCursor = {
  x: number
  y: number
}

export type AiCanvasState = {
  active: boolean
  phase: AiCanvasPhase
  cursor: AiCanvasCursor | null
  updatedAt: number
}

export const AI_STORAGE_KEY = "ai"
export const AI_PRESENCE_NAME = "Ghost AI"
export const AI_PRESENCE_COLOR = "#8B82FF"

export const IDLE_AI_CANVAS_STATE: AiCanvasState = {
  active: false,
  phase: "idle",
  cursor: null,
  updatedAt: 0,
}
