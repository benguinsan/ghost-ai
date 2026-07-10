import { z } from "zod"

// Shared AI activity is published through a Liveblocks feed so every participant
// in the room sees the same status without a parallel realtime channel.
export const AI_STATUS_FEED_ID = "ai-status-feed"

// Feed message payload for AI task status. Kept intentionally generic (an
// optional `text`) so both design generation and future spec generation can
// publish status through the same feed.
export const aiStatusFeedMessageSchema = z.object({
  text: z.string().optional(),
})

export type AiStatusFeedMessage = z.infer<typeof aiStatusFeedMessageSchema>

// Validates an incoming feed message payload before it is displayed. Returns the
// parsed payload on success, or `null` when the payload does not match.
export function parseAiStatusFeedMessage(data: unknown): AiStatusFeedMessage | null {
  const result = aiStatusFeedMessageSchema.safeParse(data)
  return result.success ? result.data : null
}

// Real-time collaborative room chat is published through a dedicated Liveblocks
// feed, kept separate from `ai-status-feed` (AI progress/presence) so chat
// messages never mix with status updates.
export const AI_CHAT_FEED_ID = "ai-chat"

// A single chat message in the `ai-chat` feed. Liveblocks feed messages only
// carry `id`/`createdAt`/`data`, so the sender is embedded in the payload.
// `role` is included for future assistant replies but is always `"user"` today.
export const aiChatMessageSchema = z.object({
  sender: z.string().min(1),
  role: z.enum(["user", "assistant"]),
  content: z.string().min(1),
  timestamp: z.number(),
})

export type AiChatMessage = z.infer<typeof aiChatMessageSchema>

// Validates an incoming `ai-chat` feed message payload before it is rendered.
// Returns the parsed message on success, or `null` when the payload is invalid.
export function parseAiChatMessage(data: unknown): AiChatMessage | null {
  const result = aiChatMessageSchema.safeParse(data)
  return result.success ? result.data : null
}
