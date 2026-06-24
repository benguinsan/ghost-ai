"use client"

import { type DragEvent, Component, type ErrorInfo, type ReactNode, useCallback, useMemo, useRef, useState } from "react"
import { ClientSideSuspense, LiveblocksProvider, RoomProvider } from "@liveblocks/react/suspense"
import { useLiveblocksFlow } from "@liveblocks/react-flow"
import { Circle, Cylinder, Diamond, Hexagon, Pill, RectangleHorizontal } from "lucide-react"
import {
  Background,
  BackgroundVariant,
  ConnectionMode,
  MiniMap,
  type NodeProps,
  type NodeTypes,
  type ReactFlowInstance,
  ReactFlow,
} from "@xyflow/react"

import {
  DEFAULT_CANVAS_NODE_COLOR,
  NODE_SHAPE_DEFAULT_SIZES,
  type CanvasEdge,
  type CanvasNode,
  type CanvasNodeShape,
  type CanvasNodeSize,
} from "@/types/canvas"

import "@xyflow/react/dist/style.css"
import "@liveblocks/react-flow/styles.css"

interface CollaborativeCanvasProps {
  roomId: string
}

interface CanvasConnectionErrorBoundaryProps {
  children: ReactNode
}

interface CanvasConnectionErrorBoundaryState {
  hasError: boolean
}

const INITIAL_NODES: CanvasNode[] = []
const INITIAL_EDGES: CanvasEdge[] = []
const SHAPE_DRAG_MIME_TYPE = "application/x-ghost-canvas-shape"

interface ShapeDragPayload {
  shape: CanvasNodeShape
  size: CanvasNodeSize
}

interface ShapeToolbarItem {
  shape: CanvasNodeShape
  label: string
  icon: typeof RectangleHorizontal
}

const SHAPE_TOOLBAR_ITEMS: ShapeToolbarItem[] = [
  { shape: "rectangle", label: "Rectangle", icon: RectangleHorizontal },
  { shape: "diamond", label: "Diamond", icon: Diamond },
  { shape: "circle", label: "Circle", icon: Circle },
  { shape: "pill", label: "Pill", icon: Pill },
  { shape: "cylinder", label: "Cylinder", icon: Cylinder },
  { shape: "hexagon", label: "Hexagon", icon: Hexagon },
]

export function CollaborativeCanvas({ roomId }: CollaborativeCanvasProps) {
  return (
    <div className="flex min-w-0 flex-1">
      <LiveblocksProvider authEndpoint="/api/liveblocks-auth">
        <RoomProvider id={roomId} initialPresence={{ cursor: null, isThinking: false }}>
          <CanvasConnectionErrorBoundary>
            <ClientSideSuspense fallback={<CanvasLoadingState />}>
              <LiveblocksReactFlowCanvas />
            </ClientSideSuspense>
          </CanvasConnectionErrorBoundary>
        </RoomProvider>
      </LiveblocksProvider>
    </div>
  )
}

class CanvasConnectionErrorBoundary extends Component<
  CanvasConnectionErrorBoundaryProps,
  CanvasConnectionErrorBoundaryState
> {
  constructor(props: CanvasConnectionErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(): CanvasConnectionErrorBoundaryState {
    return { hasError: true }
  }

  componentDidCatch(_error: Error, _info: ErrorInfo) {}

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-w-0 flex-1 items-center justify-center p-6">
          <div className="w-full max-w-lg rounded-2xl border border-surface-border bg-surface p-6 text-center">
            <h2 className="text-lg font-semibold text-copy-primary">Unable to connect to collaboration room</h2>
            <p className="mt-2 text-sm text-copy-muted">
              Live collaboration is temporarily unavailable for this workspace.
            </p>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

function CanvasLoadingState() {
  return (
    <div className="flex min-w-0 flex-1 items-center justify-center p-6">
      <div className="w-full max-w-lg rounded-2xl border border-surface-border bg-surface p-6 text-center">
        <p className="text-sm text-copy-muted">Loading collaborative canvas...</p>
      </div>
    </div>
  )
}

function LiveblocksReactFlowCanvas() {
  const { nodes, edges, onNodesChange, onEdgesChange, onConnect } = useLiveblocksFlow({
    suspense: true,
    nodes: {
      initial: INITIAL_NODES,
    },
    edges: {
      initial: INITIAL_EDGES,
    },
  })
  const [reactFlowInstance, setReactFlowInstance] = useState<ReactFlowInstance<CanvasNode, CanvasEdge> | null>(
    null,
  )
  const nodeCreateCounterRef = useRef(0)

  const nodeTypes = useMemo<NodeTypes>(
    () => ({
      canvasNode: CanvasNodeRenderer,
    }),
    [],
  )

  const handleDragStart = useCallback((event: DragEvent<HTMLButtonElement>, shape: CanvasNodeShape) => {
    const payload: ShapeDragPayload = {
      shape,
      size: NODE_SHAPE_DEFAULT_SIZES[shape],
    }
    event.dataTransfer.setData(SHAPE_DRAG_MIME_TYPE, JSON.stringify(payload))
    event.dataTransfer.effectAllowed = "copy"
  }, [])

  const handleCanvasDragOver = useCallback((event: DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    event.dataTransfer.dropEffect = "copy"
  }, [])

  const handleCanvasDrop = useCallback(
    (event: DragEvent<HTMLDivElement>) => {
      event.preventDefault()

      const payloadString = event.dataTransfer.getData(SHAPE_DRAG_MIME_TYPE)
      if (!payloadString || !reactFlowInstance) {
        return
      }

      let payload: ShapeDragPayload
      try {
        payload = JSON.parse(payloadString) as ShapeDragPayload
      } catch {
        return
      }

      const nodePosition = reactFlowInstance.screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      })
      const currentTimestamp = Date.now()
      const nodeId = `${payload.shape}-${currentTimestamp}-${nodeCreateCounterRef.current}`
      nodeCreateCounterRef.current += 1

      onNodesChange([
        {
          item: {
            id: nodeId,
            type: "canvasNode",
            position: nodePosition,
            width: payload.size.width,
            height: payload.size.height,
            data: {
              label: "",
              color: DEFAULT_CANVAS_NODE_COLOR,
              shape: payload.shape,
            },
          },
          type: "add",
        },
      ])
    },
    [onNodesChange, reactFlowInstance],
  )

  return (
    <div className="relative h-full min-h-0 w-full" onDragOver={handleCanvasDragOver} onDrop={handleCanvasDrop}>
      <ReactFlow
        connectionMode={ConnectionMode.Loose}
        edges={edges}
        fitView
        nodes={nodes}
        nodeTypes={nodeTypes}
        onConnect={onConnect}
        onEdgesChange={onEdgesChange}
        onInit={setReactFlowInstance}
        onNodesChange={onNodesChange}
      >
        <MiniMap />
        <Background variant={BackgroundVariant.Dots} />
      </ReactFlow>

      <ShapeToolbar onDragStart={handleDragStart} />
    </div>
  )
}

interface ShapeToolbarProps {
  onDragStart: (event: DragEvent<HTMLButtonElement>, shape: CanvasNodeShape) => void
}

function ShapeToolbar({ onDragStart }: ShapeToolbarProps) {
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-6 z-20 flex justify-center">
      <div className="pointer-events-auto flex items-center gap-1 rounded-full border border-surface-border bg-elevated/90 p-1.5 shadow-lg backdrop-blur-sm">
        {SHAPE_TOOLBAR_ITEMS.map((item) => {
          const Icon = item.icon
          return (
            <button
              key={item.shape}
              aria-label={`Drag ${item.label} shape`}
              className="flex h-10 w-10 cursor-grab items-center justify-center rounded-full border border-transparent text-copy-secondary transition-colors hover:border-surface-border hover:bg-subtle hover:text-copy-primary active:cursor-grabbing"
              draggable
              onDragStart={(event) => onDragStart(event, item.shape)}
              type="button"
            >
              <Icon className="h-4 w-4" />
            </button>
          )
        })}
      </div>
    </div>
  )
}

function CanvasNodeRenderer({ data }: NodeProps<CanvasNode>) {
  const nodeColor = typeof data.color === "string" && data.color ? data.color : DEFAULT_CANVAS_NODE_COLOR

  return (
    <div className="relative h-full w-full">
      <ShapeSurface shape={data.shape} nodeColor={nodeColor} />
      <span className="pointer-events-none absolute inset-0 flex items-center justify-center px-3 text-center text-sm text-copy-primary">
        {data.label}
      </span>
    </div>
  )
}

interface ShapeSurfaceProps {
  shape: CanvasNodeShape
  nodeColor: string
}

function ShapeSurface({ shape, nodeColor }: ShapeSurfaceProps) {
  if (shape === "diamond") {
    return (
      <svg aria-hidden className="absolute inset-0 h-full w-full" preserveAspectRatio="none" viewBox="0 0 100 100">
        <polygon fill={nodeColor} points="50,2 98,50 50,98 2,50" stroke="var(--border-default)" strokeWidth="2" />
      </svg>
    )
  }

  if (shape === "hexagon") {
    return (
      <svg aria-hidden className="absolute inset-0 h-full w-full" preserveAspectRatio="none" viewBox="0 0 100 100">
        <polygon
          fill={nodeColor}
          points="25,2 75,2 98,50 75,98 25,98 2,50"
          stroke="var(--border-default)"
          strokeWidth="2"
        />
      </svg>
    )
  }

  if (shape === "cylinder") {
    return (
      <svg aria-hidden className="absolute inset-0 h-full w-full" preserveAspectRatio="none" viewBox="0 0 100 100">
        <ellipse cx="50" cy="16" fill={nodeColor} rx="42" ry="14" stroke="var(--border-default)" strokeWidth="2" />
        <path
          d="M8 16V84C8 92 92 92 92 84V16"
          fill={nodeColor}
          stroke="var(--border-default)"
          strokeWidth="2"
        />
        <ellipse cx="50" cy="84" fill={nodeColor} rx="42" ry="14" stroke="var(--border-default)" strokeWidth="2" />
      </svg>
    )
  }

  const shapeClassName =
    shape === "circle"
      ? "rounded-full"
      : shape === "pill"
        ? "rounded-full"
        : "rounded-xl"

  return (
    <div
      className={`absolute inset-0 border border-surface-border ${shapeClassName}`}
      style={{ backgroundColor: nodeColor }}
    />
  )
}
