import { createGoogleGenerativeAI } from "@ai-sdk/google"
import { generateObject } from "ai"
import { z } from "zod"

import {
  NODE_COLORS,
  NODE_SHAPE_DEFAULT_SIZES,
  NODE_SHAPES,
  type CanvasEdge,
  type CanvasNode,
  type CanvasNodeColorPair,
  type CanvasNodeShape,
} from "@/types/canvas"

const GEMINI_MODEL = "gemini-2.5-flash"

// Accept the common env var names for a Google Gemini API key so the provider
// works regardless of which convention the environment uses.
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

// Layout + spacing rules. The model reasons in a logical column/row grid and we
// resolve concrete pixel coordinates here so spacing stays consistent and
// nodes never overlap, regardless of what the model returns.
const COLUMN_SPACING = 340
const ROW_SPACING = 200
const ORIGIN_X = 0
const ORIGIN_Y = 0

const MAX_NODES = 16
const MAX_EDGES = 40

const COLOR_CATEGORIES = [
  "default",
  "blue",
  "purple",
  "orange",
  "red",
  "pink",
  "green",
  "teal",
] as const

type ColorCategory = (typeof COLOR_CATEGORIES)[number]

// Maps the model's semantic color choice onto the canvas palette pairs defined
// in `types/canvas.ts`, so generated designs always use approved colors.
const COLOR_CATEGORY_TO_PAIR: Record<ColorCategory, CanvasNodeColorPair> = {
  default: NODE_COLORS[0],
  blue: NODE_COLORS[1],
  purple: NODE_COLORS[2],
  orange: NODE_COLORS[3],
  red: NODE_COLORS[4],
  pink: NODE_COLORS[5],
  green: NODE_COLORS[6],
  teal: NODE_COLORS[7],
}

// The schema is intentionally permissive: `shape` and `color` are plain strings
// (not enums) because Gemini frequently returns close-but-off-list values
// (e.g. "database", "gray", capitalized). Strict enums here caused hard
// "response did not match schema" failures. We normalize every value to the
// approved shapes/palette in `normalizeDesignPlan`, so freeform input is safe.
const designNodeSchema = z.object({
  id: z.string(),
  label: z.string().optional().default(""),
  shape: z.string().optional().default("rectangle"),
  color: z.string().optional().default("default"),
  column: z.coerce.number().optional().default(0),
  row: z.coerce.number().optional().default(0),
})

const designEdgeSchema = z.object({
  source: z.string(),
  target: z.string(),
  label: z.string().optional().default(""),
})

const designPlanSchema = z.object({
  title: z.string().optional().default(""),
  summary: z.string().optional().default(""),
  nodes: z.array(designNodeSchema).min(1),
  edges: z.array(designEdgeSchema).optional().default([]),
})

type DesignPlan = z.infer<typeof designPlanSchema>

const SYSTEM_PROMPT = `You are Ghost AI, a senior systems architect that turns a natural language prompt into a clean architecture diagram for a collaborative canvas.

Return a design as structured data with nodes and edges.

Node shapes carry meaning — choose the most fitting one:
- "rectangle": general component, service group, or module
- "pill": a running service or process
- "cylinder": a database, cache, queue, or any data store
- "circle": an event, endpoint, or trigger
- "diamond": a decision, gateway, router, or load balancer
- "hexagon": an external system, third-party integration, or boundary

Node colors group related concerns. Reuse a color for components in the same layer or domain:
- "default": neutral/general
- "blue": clients, gateways, and edge/API layers
- "green": application/business services
- "teal": databases, caches, and storage
- "purple": async messaging, queues, and event pipelines
- "orange": infrastructure, workers, and background jobs
- "red": security, auth, or critical path components
- "pink": external/third-party systems

Layout rules:
- Arrange the system left-to-right using "column" (0 = left/entry points, increasing to the right toward data/storage).
- Use "row" (starting at 0) to stack components that live in the same column. Never give two nodes the same column AND row.
- Keep the diagram readable: prefer 5-12 nodes. Never exceed ${MAX_NODES} nodes.

Rules for ids and edges:
- Give every node a short, unique, lowercase id (e.g. "api_gateway").
- Edges connect nodes by their id and must reference ids that exist in the nodes list.
- Edges represent the direction of data or control flow (source -> target).
- Add a concise edge label only when it clarifies the interaction, otherwise use an empty string.

Keep labels short (1-4 words). Write a one-sentence summary of the system.`

export interface NormalizedDesign {
  title: string
  summary: string
  nodes: CanvasNode[]
  edges: CanvasEdge[]
}

export async function generateDesignPlan(prompt: string): Promise<NormalizedDesign> {
  const apiKey = getGeminiApiKey()

  if (!apiKey) {
    throw new Error(
      "Gemini API key is not configured. Set GEMINI_API_KEY (or GOOGLE_AI_API_KEY / GOOGLE_GENERATIVE_AI_API_KEY).",
    )
  }

  const google = createGoogleGenerativeAI({ apiKey })

  const { object } = await generateObject({
    model: google(GEMINI_MODEL),
    schema: designPlanSchema,
    system: SYSTEM_PROMPT,
    prompt,
  })

  return normalizeDesignPlan(object)
}

function normalizeDesignPlan(plan: DesignPlan): NormalizedDesign {
  const occupiedSlots = new Set<string>()
  const idByPlanId = new Map<string, string>()
  const usedIds = new Set<string>()
  const nodes: CanvasNode[] = []

  for (const planNode of plan.nodes.slice(0, MAX_NODES)) {
    const shape = normalizeShape(planNode.shape)
    const colorPair = normalizeColor(planNode.color)
    const size = NODE_SHAPE_DEFAULT_SIZES[shape]
    const { column, row } = resolveSlot(planNode.column, planNode.row, occupiedSlots)
    const nodeId = ensureUniqueId(planNode.id, usedIds)
    idByPlanId.set(planNode.id, nodeId)

    nodes.push({
      id: nodeId,
      type: "canvasNode",
      position: {
        x: ORIGIN_X + column * COLUMN_SPACING,
        y: ORIGIN_Y + row * ROW_SPACING,
      },
      width: size.width,
      height: size.height,
      data: {
        label: planNode.label.trim(),
        color: colorPair.color,
        textColor: colorPair.textColor,
        shape,
      },
    })
  }

  const nodeIds = new Set(nodes.map((node) => node.id))
  const seenEdges = new Set<string>()
  const edges: CanvasEdge[] = []

  for (const planEdge of plan.edges) {
    const source = idByPlanId.get(planEdge.source)
    const target = idByPlanId.get(planEdge.target)

    if (!source || !target || source === target) {
      continue
    }

    if (!nodeIds.has(source) || !nodeIds.has(target)) {
      continue
    }

    const dedupeKey = `${source}->${target}`
    if (seenEdges.has(dedupeKey)) {
      continue
    }
    seenEdges.add(dedupeKey)

    edges.push({
      id: `edge-${source}-${target}`,
      source,
      target,
      type: "canvasEdge",
      data: {
        label: planEdge.label.trim(),
      },
    })

    if (edges.length >= MAX_EDGES) {
      break
    }
  }

  return {
    title: plan.title.trim() || "Untitled design",
    summary: plan.summary.trim(),
    nodes,
    edges,
  }
}

function normalizeShape(shape: string): CanvasNodeShape {
  return (NODE_SHAPES as readonly string[]).includes(shape)
    ? (shape as CanvasNodeShape)
    : "rectangle"
}

function normalizeColor(color: string): CanvasNodeColorPair {
  return (COLOR_CATEGORIES as readonly string[]).includes(color)
    ? COLOR_CATEGORY_TO_PAIR[color as ColorCategory]
    : COLOR_CATEGORY_TO_PAIR.default
}

function resolveSlot(column: number, row: number, occupied: Set<string>) {
  const safeColumn = Number.isFinite(column) ? Math.max(0, Math.round(column)) : 0
  let safeRow = Number.isFinite(row) ? Math.max(0, Math.round(row)) : 0

  while (occupied.has(`${safeColumn}:${safeRow}`)) {
    safeRow += 1
  }

  occupied.add(`${safeColumn}:${safeRow}`)
  return { column: safeColumn, row: safeRow }
}

function ensureUniqueId(rawId: string, usedIds: Set<string>) {
  const base = rawId.trim() || "node"
  let candidate = base
  let suffix = 1

  while (usedIds.has(candidate)) {
    candidate = `${base}-${suffix}`
    suffix += 1
  }

  usedIds.add(candidate)
  return candidate
}
