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
  textColor: string
  shape: CanvasNodeShape
  [key: string]: unknown
}

export type CanvasNode = Node<CanvasNodeData, "canvasNode">

export interface CanvasEdgeData {
  label: string
  [key: string]: unknown
}

export type CanvasEdge = Edge<CanvasEdgeData, "canvasEdge">

export interface CanvasNodeSize {
  width: number
  height: number
}

export const DEFAULT_CANVAS_NODE_COLOR = "#1F1F1F"
export const DEFAULT_CANVAS_NODE_TEXT_COLOR = "#EDEDED"

export interface CanvasNodeColorPair {
  color: string
  textColor: string
}

export const NODE_COLORS: CanvasNodeColorPair[] = [
  { color: "#1F1F1F", textColor: "#EDEDED" },
  { color: "#10233D", textColor: "#52A8FF" },
  { color: "#2E1938", textColor: "#BF7AF0" },
  { color: "#331B00", textColor: "#FF990A" },
  { color: "#3C1618", textColor: "#FF6166" },
  { color: "#3A1726", textColor: "#F75F8F" },
  { color: "#0F2E18", textColor: "#62C073" },
  { color: "#062822", textColor: "#0AC7B4" },
]

export const NODE_SHAPE_DEFAULT_SIZES: Record<CanvasNodeShape, CanvasNodeSize> = {
  rectangle: { width: 220, height: 120 },
  diamond: { width: 220, height: 140 },
  circle: { width: 140, height: 140 },
  pill: { width: 220, height: 100 },
  cylinder: { width: 220, height: 120 },
  hexagon: { width: 220, height: 120 },
}
