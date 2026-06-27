"use client"

import { useMemo } from "react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { NODE_SHAPE_DEFAULT_SIZES, type CanvasEdge, type CanvasNode } from "@/types/canvas"

import type { CanvasTemplate } from "@/components/editor/starter-templates"

interface StarterTemplatesModalProps {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  onImport: (template: CanvasTemplate) => void
  templates: CanvasTemplate[]
}

interface Bounds {
  minX: number
  minY: number
  width: number
  height: number
}

const PREVIEW_WIDTH = 300
const PREVIEW_HEIGHT = 170
const PREVIEW_PADDING = 16

function getNodeWidth(node: CanvasNode) {
  return node.width ?? NODE_SHAPE_DEFAULT_SIZES[node.data.shape].width
}

function getNodeHeight(node: CanvasNode) {
  return node.height ?? NODE_SHAPE_DEFAULT_SIZES[node.data.shape].height
}

function getTemplateBounds(nodes: CanvasNode[]): Bounds {
  if (!nodes.length) {
    return {
      minX: 0,
      minY: 0,
      width: PREVIEW_WIDTH,
      height: PREVIEW_HEIGHT,
    }
  }

  const minX = Math.min(...nodes.map((node) => node.position.x))
  const minY = Math.min(...nodes.map((node) => node.position.y))
  const maxX = Math.max(...nodes.map((node) => node.position.x + getNodeWidth(node)))
  const maxY = Math.max(...nodes.map((node) => node.position.y + getNodeHeight(node)))

  return {
    minX,
    minY,
    width: Math.max(maxX - minX, 1),
    height: Math.max(maxY - minY, 1),
  }
}

function TemplateDiagramPreview({ edges, nodes }: { edges: CanvasEdge[]; nodes: CanvasNode[] }) {
  const bounds = useMemo(() => getTemplateBounds(nodes), [nodes])

  const scale = useMemo(() => {
    const widthScale = (PREVIEW_WIDTH - PREVIEW_PADDING * 2) / bounds.width
    const heightScale = (PREVIEW_HEIGHT - PREVIEW_PADDING * 2) / bounds.height
    return Math.max(Math.min(widthScale, heightScale), 0.1)
  }, [bounds.height, bounds.width])

  const nodeLayout = useMemo(() => {
    const lookup = new Map<
      string,
      {
        x: number
        y: number
        width: number
        height: number
        centerX: number
        centerY: number
        node: CanvasNode
      }
    >()

    nodes.forEach((node) => {
      const width = getNodeWidth(node)
      const height = getNodeHeight(node)
      const x = PREVIEW_PADDING + (node.position.x - bounds.minX) * scale
      const y = PREVIEW_PADDING + (node.position.y - bounds.minY) * scale

      lookup.set(node.id, {
        x,
        y,
        width: width * scale,
        height: height * scale,
        centerX: x + (width * scale) / 2,
        centerY: y + (height * scale) / 2,
        node,
      })
    })

    return lookup
  }, [bounds.minX, bounds.minY, nodes, scale])

  return (
    <div className="overflow-hidden rounded-xl border border-surface-border bg-base">
      <svg
        aria-hidden
        className="h-auto w-full"
        viewBox={`0 0 ${PREVIEW_WIDTH} ${PREVIEW_HEIGHT}`}
        xmlns="http://www.w3.org/2000/svg"
      >
        <rect fill="var(--bg-base)" height={PREVIEW_HEIGHT} width={PREVIEW_WIDTH} x="0" y="0" />
        {edges.map((edge) => {
          const source = nodeLayout.get(edge.source)
          const target = nodeLayout.get(edge.target)
          if (!source || !target) {
            return null
          }

          return (
            <line
              key={edge.id}
              stroke="rgba(237, 237, 237, 0.55)"
              strokeWidth="1.5"
              x1={source.centerX}
              x2={target.centerX}
              y1={source.centerY}
              y2={target.centerY}
            />
          )
        })}
        {Array.from(nodeLayout.values()).map(({ node, x, y, width, height }) => {
          const strokeColor = "rgba(58, 58, 66, 0.95)"

          if (node.data.shape === "diamond") {
            const points = `${x + width / 2},${y} ${x + width},${y + height / 2} ${x + width / 2},${y + height} ${x},${y + height / 2}`
            return <polygon fill={node.data.color} key={node.id} points={points} stroke={strokeColor} strokeWidth="1.25" />
          }

          if (node.data.shape === "hexagon") {
            const points = `${x + width * 0.25},${y} ${x + width * 0.75},${y} ${x + width},${y + height / 2} ${x + width * 0.75},${y + height} ${x + width * 0.25},${y + height} ${x},${y + height / 2}`
            return <polygon fill={node.data.color} key={node.id} points={points} stroke={strokeColor} strokeWidth="1.25" />
          }

          if (node.data.shape === "cylinder") {
            const bodyTop = y + height * 0.16
            const bodyBottom = y + height * 0.84
            const radiusX = width * 0.42
            const radiusY = height * 0.14

            return (
              <g key={node.id}>
                <ellipse cx={x + width / 2} cy={bodyTop} fill={node.data.color} rx={radiusX} ry={radiusY} stroke={strokeColor} strokeWidth="1.2" />
                <rect
                  fill={node.data.color}
                  height={bodyBottom - bodyTop}
                  stroke={strokeColor}
                  strokeWidth="1.2"
                  width={radiusX * 2}
                  x={x + width / 2 - radiusX}
                  y={bodyTop}
                />
                <ellipse cx={x + width / 2} cy={bodyBottom} fill={node.data.color} rx={radiusX} ry={radiusY} stroke={strokeColor} strokeWidth="1.2" />
              </g>
            )
          }

          if (node.data.shape === "circle") {
            return (
              <ellipse
                cx={x + width / 2}
                cy={y + height / 2}
                fill={node.data.color}
                key={node.id}
                rx={width / 2}
                ry={height / 2}
                stroke={strokeColor}
                strokeWidth="1.25"
              />
            )
          }

          const radius = node.data.shape === "pill" ? height / 2 : 10
          return (
            <rect
              fill={node.data.color}
              height={height}
              key={node.id}
              rx={radius}
              ry={radius}
              stroke={strokeColor}
              strokeWidth="1.25"
              width={width}
              x={x}
              y={y}
            />
          )
        })}
      </svg>
    </div>
  )
}

export function StarterTemplatesModal({
  isOpen,
  onOpenChange,
  onImport,
  templates,
}: StarterTemplatesModalProps) {
  return (
    <Dialog onOpenChange={onOpenChange} open={isOpen}>
      <DialogContent className="max-h-[85vh] rounded-3xl border border-surface-border bg-elevated p-0 text-copy-primary shadow-xl sm:max-w-5xl">
        <DialogHeader className="border-b border-surface-border px-6 py-4">
          <DialogTitle className="text-base">Import Starter Template</DialogTitle>
          <DialogDescription className="text-copy-muted">
            Pick a prebuilt architecture diagram and replace the current canvas.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[60vh] overflow-y-auto px-6 py-5">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {templates.map((template) => (
              <article className="rounded-2xl border border-surface-border bg-subtle p-3" key={template.id}>
                <TemplateDiagramPreview edges={template.edges} nodes={template.nodes} />
                <div className="mt-3 space-y-1">
                  <h3 className="text-sm font-medium text-copy-primary">{template.name}</h3>
                  <p className="text-xs text-copy-muted">{template.description}</p>
                </div>
                <Button
                  className="mt-3 w-full"
                  onClick={() => {
                    onImport(template)
                    onOpenChange(false)
                  }}
                  type="button"
                  variant="outline"
                >
                  Import template
                </Button>
              </article>
            ))}
          </div>
        </div>

        <DialogFooter className="border-t border-surface-border bg-subtle/60 px-6 py-3">
          <Button onClick={() => onOpenChange(false)} type="button" variant="ghost">
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
