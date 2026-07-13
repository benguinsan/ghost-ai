import { createGoogleGenerativeAI } from "@ai-sdk/google"
import { generateText } from "ai"
import { z } from "zod"

const GEMINI_MODEL = "gemini-2.5-flash"

// Accept the common env var names for a Google Gemini API key so the provider
// works regardless of which convention the environment uses. Mirrors the
// design-agent key resolution so both AI tasks share one Gemini setup.
const GEMINI_API_KEY_ENV_KEYS = [
  "GEMINI_API_KEY",
  "GOOGLE_GENERATIVE_AI_API_KEY",
  "GOOGLE_AI_API_KEY",
] as const

function getGeminiApiKey() {
  for (const key of GEMINI_API_KEY_ENV_KEYS) {
    const value = process.env[key]?.trim()
    if (value) {
      return value
    }
  }

  return null
}

// Input schemas are intentionally permissive: the client sends React Flow
// nodes/edges and chat messages that carry more fields than the spec prompt
// needs. We only pull out what is useful for describing the system, and ignore
// the rest via `.passthrough()`.
const specNodeDataSchema = z
  .object({
    label: z.string().optional().default(""),
    shape: z.string().optional().default(""),
  })
  .passthrough()

const specNodeSchema = z
  .object({
    id: z.string(),
    data: specNodeDataSchema.optional(),
  })
  .passthrough()

const specEdgeSchema = z
  .object({
    id: z.string().optional(),
    source: z.string(),
    target: z.string(),
    data: z
      .object({
        label: z.string().optional().default(""),
      })
      .passthrough()
      .optional(),
  })
  .passthrough()

const specChatMessageSchema = z
  .object({
    role: z.string().optional().default("user"),
    content: z.string().optional().default(""),
    sender: z.string().optional(),
  })
  .passthrough()

export const generateSpecInputSchema = z.object({
  projectId: z.string().min(1),
  roomId: z.string().min(1),
  projectName: z.string().optional().default(""),
  chatHistory: z.array(specChatMessageSchema).optional().default([]),
  nodes: z.array(specNodeSchema).optional().default([]),
  edges: z.array(specEdgeSchema).optional().default([]),
})

export type GenerateSpecInput = z.infer<typeof generateSpecInputSchema>

const SYSTEM_PROMPT = `You are Ghost AI, a senior systems architect. You are given a system design as a graph of components (nodes) and their relationships (edges), plus the chat conversation that produced it.

Write a clear, well-structured technical specification in GitHub-flavored Markdown that documents this architecture.

Requirements:
- Output only Markdown. Do not wrap the whole document in a code fence.
- Start with a single top-level "# " title for the system.
- Include these sections when the graph supports them: Overview, Architecture, Components, Data Flow, and Considerations (scalability, reliability, security).
- Describe each component (node) and what it does, grounded in its label and shape.
- Describe the relationships (edges) as data/control flow between components, using edge labels where present.
- Do not invent components or connections that are not in the graph. It is fine to add standard architectural reasoning and best-practice notes.
- Keep it concise, professional, and useful to an engineer implementing the system.`

// Renders the canvas graph and chat context into a compact text description that
// grounds the model in the actual system the users designed.
function buildGraphContext(input: GenerateSpecInput): string {
  const sections: string[] = []

  const projectName = input.projectName.trim()
  if (projectName) {
    sections.push(`Project name: ${projectName}`)
  }

  const labelById = new Map<string, string>()
  for (const node of input.nodes) {
    const label = node.data?.label?.trim() || node.id
    labelById.set(node.id, label)
  }

  if (input.nodes.length) {
    const nodeLines = input.nodes.map((node) => {
      const label = node.data?.label?.trim() || "(unlabeled)"
      const shape = node.data?.shape?.trim()
      return `- ${label}${shape ? ` [${shape}]` : ""}`
    })
    sections.push(`Components (${input.nodes.length}):\n${nodeLines.join("\n")}`)
  } else {
    sections.push("Components: none on the canvas.")
  }

  if (input.edges.length) {
    const edgeLines = input.edges.map((edge) => {
      const source = labelById.get(edge.source) ?? edge.source
      const target = labelById.get(edge.target) ?? edge.target
      const label = edge.data?.label?.trim()
      return `- ${source} -> ${target}${label ? ` (${label})` : ""}`
    })
    sections.push(`Connections (${input.edges.length}):\n${edgeLines.join("\n")}`)
  } else {
    sections.push("Connections: none.")
  }

  const conversation = input.chatHistory
    .map((message) => {
      const content = message.content.trim()
      if (!content) {
        return null
      }
      const speaker = message.role === "assistant" ? "Ghost AI" : message.sender?.trim() || "User"
      return `${speaker}: ${content}`
    })
    .filter((line): line is string => line !== null)

  if (conversation.length) {
    sections.push(`Design conversation:\n${conversation.join("\n")}`)
  }

  return sections.join("\n\n")
}

// Generates a Markdown technical spec from the canvas graph and chat context.
export async function generateSpecMarkdown(input: GenerateSpecInput): Promise<string> {
  const apiKey = getGeminiApiKey()

  if (!apiKey) {
    throw new Error(
      "Gemini API key is not configured. Set GEMINI_API_KEY (or GOOGLE_AI_API_KEY / GOOGLE_GENERATIVE_AI_API_KEY).",
    )
  }

  const google = createGoogleGenerativeAI({ apiKey })

  const context = buildGraphContext(input)
  const prompt = `Generate the technical specification for the following system design.\n\n${context}`

  const { text } = await generateText({
    model: google(GEMINI_MODEL),
    system: SYSTEM_PROMPT,
    prompt,
  })

  return text.trim()
}
