import { logger, task } from "@trigger.dev/sdk"

import {
  addCanvasEdges,
  addCanvasNode,
  clearAiPresence,
  ensureAiStatusFeed,
  publishAiStatusMessage,
  setAiPresence,
} from "@/lib/design-agent/canvas-writer"
import { generateDesignPlan } from "@/lib/design-agent/plan"
import type { CanvasNode } from "@/types/canvas"

export interface DesignAgentPayload {
  prompt: string
  roomId: string
}

const NODE_PLACEMENT_DELAY_MS = 240
const COMPLETE_HOLD_MS = 1500
const ERROR_HOLD_MS = 2500

export const designAgentTask = task({
  id: "design-agent",
  // Disable retries: the task mutates shared canvas state, so a retry after a
  // partial run could add duplicate nodes. Failures are surfaced via AI status.
  retry: {
    maxAttempts: 1,
  },
  run: async (payload: DesignAgentPayload) => {
    const prompt = payload.prompt.trim()
    const roomId = payload.roomId.trim()

    logger.info("Design agent started", { roomId, promptLength: prompt.length })

    try {
      await ensureAiStatusFeed(roomId)

      await setAiPresence(roomId, { active: true, phase: "thinking", cursor: null })
      await publishAiStatusMessage(roomId, "Ghost AI is reading your prompt…")

      const design = await generateDesignPlan(prompt)

      logger.info("Design plan generated", {
        roomId,
        title: design.title,
        nodeCount: design.nodes.length,
        edgeCount: design.edges.length,
      })

      await setAiPresence(roomId, { phase: "generating", cursor: null })
      await publishAiStatusMessage(roomId, `Designing “${design.title}”…`)

      for (const node of design.nodes) {
        const label = node.data.label || "component"

        await setAiPresence(roomId, { phase: "generating", cursor: getNodeCenter(node) })
        await publishAiStatusMessage(roomId, `Adding ${label}…`)

        await addCanvasNode(roomId, node)
        await sleep(NODE_PLACEMENT_DELAY_MS)
      }

      if (design.edges.length) {
        await setAiPresence(roomId, { phase: "generating", cursor: null })
        await publishAiStatusMessage(roomId, "Connecting components…")

        await addCanvasEdges(roomId, design.edges)
      }

      await setAiPresence(roomId, { phase: "complete", cursor: null })
      await publishAiStatusMessage(roomId, "Design complete")

      await sleep(COMPLETE_HOLD_MS)
      await clearAiPresence(roomId)

      return {
        roomId,
        title: design.title,
        nodeCount: design.nodes.length,
        edgeCount: design.edges.length,
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      logger.error("Design agent failed", { roomId, error: message })

      try {
        await setAiPresence(roomId, { phase: "error", cursor: null })
        await publishAiStatusMessage(
          roomId,
          "Ghost AI couldn't complete the design. Please try again.",
        )
        await sleep(ERROR_HOLD_MS)
        await clearAiPresence(roomId)
      } catch (presenceError) {
        logger.error("Failed to update AI presence after error", {
          roomId,
          error: presenceError instanceof Error ? presenceError.message : String(presenceError),
        })
      }

      throw error
    }
  },
})

function getNodeCenter(node: CanvasNode) {
  const width = node.width ?? 0
  const height = node.height ?? 0

  return {
    x: node.position.x + width / 2,
    y: node.position.y + height / 2,
  }
}

function sleep(ms: number) {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, ms)
  })
}
