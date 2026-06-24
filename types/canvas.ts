import type { Edge, Node } from "@xyflow/react"

export type CanvasNodeShape =
  | "rectangle"
  | "diamond"
  | "circle"
  | "pill"
  | "cylinder"
  | "hexagon"

export interface CanvasNodeData {
  label: string
  color: string
  shape: CanvasNodeShape
  [key: string]: unknown
}

export type CanvasNode = Node<CanvasNodeData, "canvasNode">

export type CanvasEdge = Edge<Record<string, never>, "canvasEdge">

export interface CanvasNodeSize {
  width: number
  height: number
}

export const DEFAULT_CANVAS_NODE_COLOR = "#1F1F1F"

export const NODE_SHAPE_DEFAULT_SIZES: Record<CanvasNodeShape, CanvasNodeSize> = {
  rectangle: { width: 220, height: 120 },
  diamond: { width: 220, height: 140 },
  circle: { width: 140, height: 140 },
  pill: { width: 220, height: 100 },
  cylinder: { width: 220, height: 120 },
  hexagon: { width: 220, height: 120 },
}
