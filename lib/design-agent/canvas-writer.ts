import { mutateFlow } from "@liveblocks/react-flow/node"

import { getLiveblocksClient } from "@/lib/liveblocks"
import {
  AI_STORAGE_KEY,
  IDLE_AI_CANVAS_STATE,
  type AiCanvasPhase,
  type AiCanvasState,
} from "@/types/ai-canvas"
import type { CanvasEdge, CanvasNode } from "@/types/canvas"
import { AI_STATUS_FEED_ID, type AiStatusFeedMessage } from "@/types/tasks"

function getClientOrThrow() {
  const client = getLiveblocksClient()

  if (!client) {
    throw new Error("Liveblocks secret key is not configured.")
  }

  return client
}

export interface AiPresenceUpdate {
  phase: AiCanvasPhase
  active?: boolean
  // `undefined` keeps the existing cursor, `null` clears it.
  cursor?: { x: number; y: number } | null
}

// Publishes the on-canvas AI pointer/phase to Liveblocks Storage so every
// participant sees where Ghost AI is working in real time.
export async function setAiPresence(roomId: string, update: AiPresenceUpdate) {
  const client = getClientOrThrow()

  await client.mutateStorage(roomId, ({ root }) => {
    const current = (root.get(AI_STORAGE_KEY) as AiCanvasState | undefined) ?? IDLE_AI_CANVAS_STATE

    root.set(AI_STORAGE_KEY, {
      active: update.active ?? true,
      phase: update.phase,
      cursor: update.cursor === undefined ? current.cursor : update.cursor,
      updatedAt: Date.now(),
    })
  })
}

export async function clearAiPresence(roomId: string) {
  const client = getClientOrThrow()

  await client.mutateStorage(roomId, ({ root }) => {
    root.set(AI_STORAGE_KEY, {
      ...IDLE_AI_CANVAS_STATE,
      updatedAt: Date.now(),
    })
  })
}

// Creates the shared AI status feed if it does not already exist. Re-uses the
// existing feed on subsequent runs.
export async function ensureAiStatusFeed(roomId: string) {
  const client = getClientOrThrow()

  try {
    await client.createFeed({ roomId, feedId: AI_STATUS_FEED_ID })
  } catch {
    // Feed already exists — reuse it.
  }
}

// Publishes a human-readable status message to the shared `ai-status-feed`.
export async function publishAiStatusMessage(roomId: string, text: string) {
  const client = getClientOrThrow()
  const data: AiStatusFeedMessage = { text }

  await client.createFeedMessage({ roomId, feedId: AI_STATUS_FEED_ID, data })
}

export async function addCanvasNode(roomId: string, node: CanvasNode) {
  const client = getClientOrThrow()

  await mutateFlow<CanvasNode, CanvasEdge>({ client, roomId }, (flow) => {
    flow.addNode(node)
  })
}

export async function addCanvasEdges(roomId: string, edges: CanvasEdge[]) {
  if (!edges.length) {
    return
  }

  const client = getClientOrThrow()

  await mutateFlow<CanvasNode, CanvasEdge>({ client, roomId }, (flow) => {
    flow.addEdges(edges)
  })
}
