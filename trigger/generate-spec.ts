import { logger, metadata, task } from "@trigger.dev/sdk"

import { generateSpecInputSchema, generateSpecMarkdown } from "@/lib/spec-agent/generate"
import { persistGeneratedSpec } from "@/lib/spec-agent/persist"

export interface GenerateSpecPayload {
  projectId: string
  roomId: string
  projectName?: string
  chatHistory?: unknown
  nodes?: unknown
  edges?: unknown
}

export const generateSpecTask = task({
  id: "generate-spec",
  // Disable retries: spec generation is a single LLM call whose output is
  // returned to the client, so a silent retry would waste tokens without
  // improving the result. Failures are surfaced via run status + thrown errors.
  retry: {
    maxAttempts: 1,
  },
  run: async (payload: GenerateSpecPayload) => {
    const input = generateSpecInputSchema.parse(payload)

    logger.info("Spec generation started", {
      projectId: input.projectId,
      roomId: input.roomId,
      nodeCount: input.nodes.length,
      edgeCount: input.edges.length,
    })

    metadata.set("status", "generating")
    metadata.set("message", "Generating technical spec…")

    try {
      const spec = await generateSpecMarkdown(input)

      logger.info("Spec generation complete", {
        projectId: input.projectId,
        specLength: spec.length,
      })

      metadata.set("status", "saving")
      metadata.set("message", "Saving spec…")

      // Persist metadata in PostgreSQL and the Markdown artifact in Vercel Blob,
      // mirroring the canvas persistence pattern. Prisma stores only the Blob URL.
      const persisted = await persistGeneratedSpec({
        projectId: input.projectId,
        markdown: spec,
      })

      logger.info("Spec persisted", {
        projectId: input.projectId,
        specId: persisted.id,
      })

      metadata.set("status", "complete")
      metadata.set("message", "Spec ready")

      return {
        projectId: input.projectId,
        roomId: input.roomId,
        specId: persisted.id,
        spec,
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      logger.error("Spec generation failed", { projectId: input.projectId, error: message })

      metadata.set("status", "error")
      metadata.set("message", "Spec generation failed")

      throw error
    }
  },
})
