export type CanvasSaveStatus = "saving" | "saved" | "error"

export const CANVAS_SAVE_STATUS_EVENT = "ghost:canvas-save-status"

export interface CanvasSaveStatusEventDetail {
  projectId: string
  status: CanvasSaveStatus
}

export function emitCanvasSaveStatus(detail: CanvasSaveStatusEventDetail) {
  if (typeof window === "undefined") {
    return
  }

  window.dispatchEvent(
    new CustomEvent<CanvasSaveStatusEventDetail>(CANVAS_SAVE_STATUS_EVENT, {
      detail,
    }),
  )
}
