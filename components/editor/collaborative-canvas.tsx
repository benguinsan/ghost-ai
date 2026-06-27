"use client"

import {
  type DragEvent,
  type ChangeEvent,
  Component,
  type ErrorInfo,
  type KeyboardEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react"
import { ClientSideSuspense, LiveblocksProvider, RoomProvider } from "@liveblocks/react/suspense"
import { useCanRedo, useCanUndo, useHistory } from "@liveblocks/react/suspense"
import { useLiveblocksFlow } from "@liveblocks/react-flow"
import {
  Circle,
  Cylinder,
  Diamond,
  Hexagon,
  Minus,
  Pill,
  Plus,
  RectangleHorizontal,
  Redo2,
  ScanSearch,
  Undo2,
} from "lucide-react"
import {
  BaseEdge,
  Background,
  BackgroundVariant,
  ConnectionMode,
  EdgeLabelRenderer,
  Handle,
  MarkerType,
  NodeResizer,
  type EdgeProps,
  type EdgeTypes,
  type NodeProps,
  type NodeTypes,
  Position,
  type ReactFlowInstance,
  ReactFlow,
  getSmoothStepPath,
  useReactFlow,
} from "@xyflow/react"

import {
  DEFAULT_CANVAS_NODE_COLOR,
  DEFAULT_CANVAS_NODE_TEXT_COLOR,
  NODE_COLORS,
  NODE_SHAPE_DEFAULT_SIZES,
  type CanvasEdge,
  type CanvasNode,
  type CanvasNodeColorPair,
  type CanvasNodeShape,
  type CanvasNodeSize,
} from "@/types/canvas"
import { useKeyboardShortcuts } from "@/hooks/use-keyboard-shortcuts"
import { OPEN_STARTER_TEMPLATES_EVENT } from "@/components/editor/starter-template-events"
import { StarterTemplatesModal } from "@/components/editor/starter-templates-modal"
import { CANVAS_TEMPLATES, type CanvasTemplate } from "@/components/editor/starter-templates"

import "@xyflow/react/dist/style.css"
import "@liveblocks/react-flow/styles.css"

interface CollaborativeCanvasProps {
  roomId: string
}

interface CanvasConnectionErrorBoundaryProps {
  children: ReactNode
  resetKey: string
}

interface CanvasConnectionErrorBoundaryState {
  hasError: boolean
  retryKey: number
}

const INITIAL_NODES: CanvasNode[] = []
const INITIAL_EDGES: CanvasEdge[] = []
const SHAPE_DRAG_MIME_TYPE = "application/x-ghost-canvas-shape"
const MIN_NODE_WIDTH = 120
const MIN_NODE_HEIGHT = 72
const EDGE_STROKE_COLOR = "#e2e8f0"
const EDGE_STROKE_REST_OPACITY = 0.72
const EDGE_STROKE_ACTIVE_OPACITY = 1
const EDGE_LABEL_HINT = "Double-click to add label"

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
          <CanvasConnectionErrorBoundary resetKey={roomId}>
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
    this.state = { hasError: false, retryKey: 0 }
  }

  static getDerivedStateFromError(): CanvasConnectionErrorBoundaryState {
    return { hasError: true, retryKey: 0 }
  }

  componentDidUpdate(prevProps: CanvasConnectionErrorBoundaryProps) {
    if (prevProps.resetKey !== this.props.resetKey && this.state.hasError) {
      this.setState((currentState) => ({ hasError: false, retryKey: currentState.retryKey + 1 }))
    }
  }

  componentDidCatch(_error: Error, _info: ErrorInfo) {}

  handleRetry = () => {
    this.setState((currentState) => ({ hasError: false, retryKey: currentState.retryKey + 1 }))
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-w-0 flex-1 items-center justify-center p-6">
          <div className="w-full max-w-lg rounded-2xl border border-surface-border bg-surface p-6 text-center">
            <h2 className="text-lg font-semibold text-copy-primary">Unable to connect to collaboration room</h2>
            <p className="mt-2 text-sm text-copy-muted">
              Live collaboration is temporarily unavailable for this workspace.
            </p>
            <button
              className="mt-4 inline-flex h-10 items-center justify-center rounded-xl border border-surface-border bg-subtle px-4 text-sm font-medium text-copy-primary transition-colors hover:bg-elevated"
              onClick={this.handleRetry}
              type="button"
            >
              Retry connection
            </button>
          </div>
        </div>
      )
    }

    return <div key={this.state.retryKey} className="flex min-w-0 flex-1">{this.props.children}</div>
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
  const history = useHistory()
  const canUndo = useCanUndo()
  const canRedo = useCanRedo()
  const [dragPreview, setDragPreview] = useState<{
    payload: ShapeDragPayload
    x: number
    y: number
  } | null>(null)
  const [isStarterTemplatesOpen, setIsStarterTemplatesOpen] = useState(false)
  const canvasWrapperRef = useRef<HTMLDivElement | null>(null)
  const nodeCreateCounterRef = useRef(0)
  const nodesRef = useRef(nodes)
  const edgesRef = useRef(edges)

  useEffect(() => {
    nodesRef.current = nodes
  }, [nodes])

  useEffect(() => {
    edgesRef.current = edges
  }, [edges])

  useEffect(() => {
    const handleOpenStarterTemplates = () => {
      setIsStarterTemplatesOpen(true)
    }

    window.addEventListener(OPEN_STARTER_TEMPLATES_EVENT, handleOpenStarterTemplates)

    return () => {
      window.removeEventListener(OPEN_STARTER_TEMPLATES_EVENT, handleOpenStarterTemplates)
    }
  }, [])

  const handleNodeLabelChange = useCallback(
    (nodeId: string, nextLabel: string) => {
      const currentNode = nodesRef.current.find((node) => node.id === nodeId)
      if (!currentNode) {
        return
      }

      onNodesChange([
        {
          id: nodeId,
          item: {
            ...currentNode,
            data: {
              ...currentNode.data,
              label: nextLabel,
            },
          },
          type: "replace",
        },
      ])
    },
    [onNodesChange],
  )

  const handleNodeColorChange = useCallback(
    (nodeId: string, colorPair: CanvasNodeColorPair) => {
      const currentNode = nodesRef.current.find((node) => node.id === nodeId)
      if (!currentNode) {
        return
      }

      onNodesChange([
        {
          id: nodeId,
          item: {
            ...currentNode,
            data: {
              ...currentNode.data,
              color: colorPair.color,
              textColor: colorPair.textColor,
            },
          },
          type: "replace",
        },
      ])
    },
    [onNodesChange],
  )

  const handleEdgeLabelChange = useCallback(
    (edgeId: string, nextLabel: string) => {
      const currentEdge = edgesRef.current.find((edge) => edge.id === edgeId)
      if (!currentEdge) {
        return
      }

      onEdgesChange([
        {
          id: edgeId,
          item: {
            ...currentEdge,
            data: {
              label: nextLabel,
            },
          },
          type: "replace",
        },
      ])
    },
    [onEdgesChange],
  )

  const nodeTypes = useMemo<NodeTypes>(
    () => ({
      canvasNode: (nodeProps: NodeProps<CanvasNode>) => (
        <CanvasNodeRenderer
          {...nodeProps}
          onColorChange={handleNodeColorChange}
          onLabelChange={handleNodeLabelChange}
        />
      ),
    }),
    [handleNodeColorChange, handleNodeLabelChange],
  )

  const edgeTypes = useMemo<EdgeTypes>(
    () => ({
      canvasEdge: (edgeProps: EdgeProps<CanvasEdge>) => (
        <CanvasEdgeRenderer {...edgeProps} onLabelChange={handleEdgeLabelChange} />
      ),
    }),
    [handleEdgeLabelChange],
  )

  const canvasEdges = useMemo(
    () =>
      edges.map((edge) => ({
        ...edge,
        data: {
          label: edge.data?.label ?? "",
        },
        markerEnd: edge.markerEnd ?? {
          color: EDGE_STROKE_COLOR,
          type: MarkerType.ArrowClosed,
        },
        type: "canvasEdge" as const,
      })),
    [edges],
  )

  const defaultEdgeOptions = useMemo(
    () => ({
      data: { label: "" },
      markerEnd: {
        color: EDGE_STROKE_COLOR,
        type: MarkerType.ArrowClosed,
      },
      style: {
        stroke: EDGE_STROKE_COLOR,
        strokeLinecap: "round" as const,
        strokeOpacity: EDGE_STROKE_REST_OPACITY,
        strokeWidth: 1.5,
      },
      type: "canvasEdge" as const,
    }),
    [],
  )

  const updateDragPreviewPosition = useCallback((clientX: number, clientY: number) => {
    setDragPreview((current) => {
      if (!current) {
        return current
      }

      const wrapperBounds = canvasWrapperRef.current?.getBoundingClientRect()
      if (!wrapperBounds) {
        return current
      }

      return {
        ...current,
        x: clientX - wrapperBounds.left,
        y: clientY - wrapperBounds.top,
      }
    })
  }, [])

  const handleDragStart = useCallback((event: DragEvent<HTMLButtonElement>, shape: CanvasNodeShape) => {
    const payload: ShapeDragPayload = {
      shape,
      size: NODE_SHAPE_DEFAULT_SIZES[shape],
    }

    const wrapperBounds = canvasWrapperRef.current?.getBoundingClientRect()
    if (wrapperBounds) {
      setDragPreview({
        payload,
        x: event.clientX - wrapperBounds.left,
        y: event.clientY - wrapperBounds.top,
      })
    }

    event.dataTransfer.setData(SHAPE_DRAG_MIME_TYPE, JSON.stringify(payload))
    event.dataTransfer.effectAllowed = "copy"
  }, [])

  const handleDrag = useCallback(
    (event: DragEvent<HTMLButtonElement>) => {
      if (event.clientX === 0 && event.clientY === 0) {
        return
      }

      updateDragPreviewPosition(event.clientX, event.clientY)
    },
    [updateDragPreviewPosition],
  )

  const handleDragEnd = useCallback(() => {
    setDragPreview(null)
  }, [])

  const handleCanvasDragOver = useCallback((event: DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    event.dataTransfer.dropEffect = "copy"
    updateDragPreviewPosition(event.clientX, event.clientY)
  }, [updateDragPreviewPosition])

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
              textColor: DEFAULT_CANVAS_NODE_TEXT_COLOR,
              shape: payload.shape,
            },
          },
          type: "add",
        },
      ])
      setDragPreview(null)
    },
    [onNodesChange, reactFlowInstance],
  )

  const handleZoomIn = useCallback(() => {
    if (!reactFlowInstance) {
      return
    }

    reactFlowInstance.zoomIn({ duration: 180 })
  }, [reactFlowInstance])

  const handleZoomOut = useCallback(() => {
    if (!reactFlowInstance) {
      return
    }

    reactFlowInstance.zoomOut({ duration: 180 })
  }, [reactFlowInstance])

  const handleFitView = useCallback(() => {
    if (!reactFlowInstance) {
      return
    }

    reactFlowInstance.fitView({ duration: 220, padding: 0.18 })
  }, [reactFlowInstance])

  const handleUndo = useCallback(() => {
    history.undo()
  }, [history])

  const handleRedo = useCallback(() => {
    history.redo()
  }, [history])

  const handleImportTemplate = useCallback(
    (template: CanvasTemplate) => {
      const currentEdges = edgesRef.current
      const currentNodes = nodesRef.current

      if (currentEdges.length) {
        onEdgesChange(currentEdges.map((edge) => ({ id: edge.id, type: "remove" as const })))
      }

      if (currentNodes.length) {
        onNodesChange(currentNodes.map((node) => ({ id: node.id, type: "remove" as const })))
      }

      const importedNodes: CanvasNode[] = template.nodes.map((node) => ({
        ...node,
        position: { ...node.position },
        data: { ...node.data },
      }))

      const importedEdges: CanvasEdge[] = template.edges.map((edge) => ({
        ...edge,
        data: {
          label: edge.data?.label ?? "",
        },
      }))

      requestAnimationFrame(() => {
        if (importedNodes.length) {
          onNodesChange(importedNodes.map((node) => ({ item: node, type: "add" as const })))
        }
        if (importedEdges.length) {
          onEdgesChange(importedEdges.map((edge) => ({ item: edge, type: "add" as const })))
        }

        requestAnimationFrame(() => {
          reactFlowInstance?.fitView({ duration: 220, padding: 0.2 })
        })
      })
    },
    [onEdgesChange, onNodesChange, reactFlowInstance],
  )

  useKeyboardShortcuts({
    onRedo: handleRedo,
    onUndo: handleUndo,
    reactFlowInstance,
  })

  return (
    <div
      ref={canvasWrapperRef}
      className="relative h-full min-h-0 w-full"
      onDragOver={handleCanvasDragOver}
      onDrop={handleCanvasDrop}
    >
      <ReactFlow
        connectionMode={ConnectionMode.Loose}
        defaultEdgeOptions={defaultEdgeOptions}
        edges={canvasEdges}
        edgeTypes={edgeTypes}
        fitView
        nodes={nodes}
        nodeTypes={nodeTypes}
        onConnect={onConnect}
        onEdgesChange={onEdgesChange}
        onInit={setReactFlowInstance}
        onNodesChange={onNodesChange}
      >
        <Background variant={BackgroundVariant.Dots} />
      </ReactFlow>

      <CanvasControlBar
        canRedo={canRedo}
        canUndo={canUndo}
        onFitView={handleFitView}
        onRedo={handleRedo}
        onUndo={handleUndo}
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
      />
      <ShapeToolbar onDrag={handleDrag} onDragEnd={handleDragEnd} onDragStart={handleDragStart} />
      {dragPreview ? (
        <ShapeDragPreview
          shape={dragPreview.payload.shape}
          size={dragPreview.payload.size}
          x={dragPreview.x}
          y={dragPreview.y}
        />
      ) : null}
      <StarterTemplatesModal
        isOpen={isStarterTemplatesOpen}
        onImport={handleImportTemplate}
        onOpenChange={setIsStarterTemplatesOpen}
        templates={CANVAS_TEMPLATES}
      />
    </div>
  )
}

interface CanvasControlBarProps {
  canRedo: boolean
  canUndo: boolean
  onFitView: () => void
  onRedo: () => void
  onUndo: () => void
  onZoomIn: () => void
  onZoomOut: () => void
}

function CanvasControlBar({
  canRedo,
  canUndo,
  onFitView,
  onRedo,
  onUndo,
  onZoomIn,
  onZoomOut,
}: CanvasControlBarProps) {
  return (
    <div className="pointer-events-none absolute bottom-6 left-6 z-20">
      <div className="pointer-events-auto flex items-center rounded-full border border-surface-border bg-elevated/90 p-1.5 shadow-lg backdrop-blur-sm">
        <CanvasControlButton ariaLabel="Zoom out" onClick={onZoomOut}>
          <Minus className="h-4 w-4" />
        </CanvasControlButton>
        <CanvasControlButton ariaLabel="Fit view" onClick={onFitView}>
          <ScanSearch className="h-4 w-4" />
        </CanvasControlButton>
        <CanvasControlButton ariaLabel="Zoom in" onClick={onZoomIn}>
          <Plus className="h-4 w-4" />
        </CanvasControlButton>

        <div className="mx-1 h-6 w-px bg-surface-border" />

        <CanvasControlButton ariaLabel="Undo" disabled={!canUndo} onClick={onUndo}>
          <Undo2 className="h-4 w-4" />
        </CanvasControlButton>
        <CanvasControlButton ariaLabel="Redo" disabled={!canRedo} onClick={onRedo}>
          <Redo2 className="h-4 w-4" />
        </CanvasControlButton>
      </div>
    </div>
  )
}

interface CanvasControlButtonProps {
  ariaLabel: string
  children: ReactNode
  disabled?: boolean
  onClick: () => void
}

function CanvasControlButton({ ariaLabel, children, disabled = false, onClick }: CanvasControlButtonProps) {
  return (
    <button
      aria-label={ariaLabel}
      className="flex h-9 w-9 items-center justify-center rounded-full border border-transparent text-copy-secondary transition-colors hover:border-surface-border hover:bg-subtle hover:text-copy-primary disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:border-transparent disabled:hover:bg-transparent disabled:hover:text-copy-secondary"
      disabled={disabled}
      onClick={onClick}
      type="button"
    >
      {children}
    </button>
  )
}

interface ShapeToolbarProps {
  onDrag: (event: DragEvent<HTMLButtonElement>) => void
  onDragEnd: () => void
  onDragStart: (event: DragEvent<HTMLButtonElement>, shape: CanvasNodeShape) => void
}

function ShapeToolbar({ onDrag, onDragEnd, onDragStart }: ShapeToolbarProps) {
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
              onDrag={onDrag}
              onDragEnd={onDragEnd}
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

interface ShapeDragPreviewProps {
  shape: CanvasNodeShape
  size: CanvasNodeSize
  x: number
  y: number
}

function ShapeDragPreview({ shape, size, x, y }: ShapeDragPreviewProps) {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute z-30 opacity-80"
      style={{
        width: size.width,
        height: size.height,
        left: x,
        top: y,
        transform: "translate(-50%, -50%)",
      }}
    >
      <ShapeSurface isSelected={false} nodeColor={DEFAULT_CANVAS_NODE_COLOR} shape={shape} />
    </div>
  )
}

interface CanvasNodeRendererProps extends NodeProps<CanvasNode> {
  onColorChange: (nodeId: string, colorPair: CanvasNodeColorPair) => void
  onLabelChange: (nodeId: string, nextLabel: string) => void
}

function CanvasNodeRenderer({ data, id, selected, onColorChange, onLabelChange }: CanvasNodeRendererProps) {
  const nodeColor = typeof data.color === "string" && data.color ? data.color : DEFAULT_CANVAS_NODE_COLOR
  const nodeTextColor =
    typeof data.textColor === "string" && data.textColor ? data.textColor : DEFAULT_CANVAS_NODE_TEXT_COLOR
  const [isEditingLabel, setIsEditingLabel] = useState(false)
  const [draftLabel, setDraftLabel] = useState(data.label)
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)
  const { getNode } = useReactFlow<CanvasNode, CanvasEdge>()

  useEffect(() => {
    if (isEditingLabel) {
      return
    }

    setDraftLabel(data.label)
  }, [data.label, isEditingLabel])

  useEffect(() => {
    if (!isEditingLabel) {
      return
    }

    textareaRef.current?.focus()
    textareaRef.current?.select()
  }, [isEditingLabel])

  const handleLabelDoubleClick = useCallback(() => {
    setIsEditingLabel(true)
  }, [])

  const handleLabelBlur = useCallback(() => {
    setIsEditingLabel(false)
  }, [])

  const handleLabelKeyDown = useCallback((event: KeyboardEvent<HTMLTextAreaElement>) => {
    event.stopPropagation()

    if (event.key === "Escape") {
      event.preventDefault()
      setIsEditingLabel(false)
    }
  }, [])

  const handleLabelInput = useCallback(
    (event: ChangeEvent<HTMLTextAreaElement>) => {
      const nextValue = event.target.value
      setDraftLabel(nextValue)

      const currentNode = getNode(id)
      if (!currentNode) {
        return
      }

      onLabelChange(id, nextValue)
    },
    [getNode, id, onLabelChange],
  )

  return (
    <div className="group relative h-full w-full">
      <NodeResizer
        color="var(--border-subtle)"
        handleClassName="!h-2.5 !w-2.5 !rounded-full !border !border-surface-border !bg-elevated"
        isVisible={selected}
        lineClassName="!border-surface-border/70"
        minHeight={MIN_NODE_HEIGHT}
        minWidth={MIN_NODE_WIDTH}
      />
      <ShapeSurface isSelected={selected} nodeColor={nodeColor} shape={data.shape} />
      {selected ? <NodeColorToolbar nodeColor={nodeColor} nodeId={id} nodeTextColor={nodeTextColor} onColorChange={onColorChange} /> : null}
      {isEditingLabel ? (
        <div className="absolute inset-0 flex items-center justify-center px-3">
          <textarea
            ref={textareaRef}
            aria-label="Edit node label"
            className="nodrag nopan nowheel h-full w-full resize-none overflow-y-auto border-none bg-transparent py-2 text-center text-sm outline-none placeholder:text-copy-faint whitespace-pre-wrap wrap-break-word"
            onBlur={handleLabelBlur}
            onChange={handleLabelInput}
            onKeyDown={handleLabelKeyDown}
            onPointerDown={(event) => {
              event.stopPropagation()
            }}
            rows={3}
            style={{ color: nodeTextColor }}
            value={draftLabel}
          />
        </div>
      ) : (
        <button
          className="nopan absolute inset-0 flex items-center justify-center px-3 text-center text-sm"
          onDoubleClick={handleLabelDoubleClick}
          style={{ color: nodeTextColor }}
          type="button"
        >
          {data.label ? (
            <span className="whitespace-pre-wrap wrap-break-word">{data.label}</span>
          ) : (
            <span className="opacity-60">Double-click to edit label</span>
          )}
        </button>
      )}
      <CanvasNodeHandles />
    </div>
  )
}

interface CanvasEdgeRendererProps extends EdgeProps<CanvasEdge> {
  onLabelChange: (edgeId: string, nextLabel: string) => void
}

function CanvasEdgeRenderer({
  data,
  id,
  markerEnd,
  onLabelChange,
  selected,
  sourceX,
  sourceY,
  sourcePosition,
  style,
  targetX,
  targetY,
  targetPosition,
}: CanvasEdgeRendererProps) {
  const [isHovered, setIsHovered] = useState(false)
  const [isEditingLabel, setIsEditingLabel] = useState(false)
  const [draftLabel, setDraftLabel] = useState(data?.label ?? "")
  const inputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    if (isEditingLabel) {
      return
    }

    setDraftLabel(data?.label ?? "")
  }, [data?.label, isEditingLabel])

  useEffect(() => {
    if (!isEditingLabel) {
      return
    }

    inputRef.current?.focus()
    inputRef.current?.select()
  }, [isEditingLabel])

  const [edgePath, labelX, labelY] = getSmoothStepPath({
    borderRadius: 6,
    offset: 18,
    sourcePosition,
    sourceX,
    sourceY,
    targetPosition,
    targetX,
    targetY,
  })

  const edgeIsActive = selected || isHovered || isEditingLabel
  const hasSavedLabel = (data?.label ?? "").trim().length > 0
  const showHint = edgeIsActive && !hasSavedLabel && !isEditingLabel
  const renderedLabel = hasSavedLabel ? data?.label ?? "" : EDGE_LABEL_HINT
  const labelWidthCh = Math.max(6, renderedLabel.length + 1)

  const commitLabel = useCallback(() => {
    const nextLabel = draftLabel.trim()
    onLabelChange(id, nextLabel)
    setIsEditingLabel(false)
  }, [draftLabel, id, onLabelChange])

  return (
    <>
      <BaseEdge
        interactionWidth={26}
        markerEnd={markerEnd}
        path={edgePath}
        style={{
          ...style,
          stroke: EDGE_STROKE_COLOR,
          strokeLinecap: "round",
          strokeOpacity: edgeIsActive ? EDGE_STROKE_ACTIVE_OPACITY : EDGE_STROKE_REST_OPACITY,
          strokeWidth: 1.5,
        }}
      />
      <EdgeLabelRenderer>
        <div
          className="nodrag nopan nowheel pointer-events-auto absolute"
          onDoubleClick={(event) => {
            event.preventDefault()
            event.stopPropagation()
            setIsEditingLabel(true)
          }}
          onMouseEnter={() => {
            setIsHovered(true)
          }}
          onMouseLeave={() => {
            setIsHovered(false)
          }}
          onPointerDown={(event) => {
            event.stopPropagation()
          }}
          style={{
            left: labelX,
            top: labelY,
            transform: "translate(-50%, -50%)",
          }}
        >
          {isEditingLabel ? (
            <input
              ref={inputRef}
              aria-label="Edit edge label"
              className="nodrag nopan nowheel h-7 rounded-full border border-surface-border bg-elevated px-2 text-center text-xs text-copy-primary outline-none"
              onBlur={commitLabel}
              onChange={(event) => {
                setDraftLabel(event.target.value)
              }}
              onKeyDown={(event) => {
                event.stopPropagation()
                if (event.key === "Enter" || event.key === "Escape") {
                  event.preventDefault()
                  commitLabel()
                }
              }}
              onMouseDown={(event) => {
                event.stopPropagation()
              }}
              style={{
                width: `${Math.max(5, draftLabel.length + 2)}ch`,
              }}
              value={draftLabel}
            />
          ) : hasSavedLabel || showHint ? (
            <div
              className={`rounded-full border px-2 py-1 text-[11px] leading-none ${
                hasSavedLabel
                  ? "border-surface-border bg-elevated text-copy-primary"
                  : "border-surface-border/70 bg-elevated/70 text-copy-faint"
              }`}
              style={{
                minWidth: `${labelWidthCh}ch`,
              }}
            >
              {renderedLabel}
            </div>
          ) : null}
        </div>
      </EdgeLabelRenderer>
    </>
  )
}

interface NodeColorToolbarProps {
  nodeColor: string
  nodeId: string
  nodeTextColor: string
  onColorChange: (nodeId: string, colorPair: CanvasNodeColorPair) => void
}

function NodeColorToolbar({ nodeColor, nodeId, nodeTextColor, onColorChange }: NodeColorToolbarProps) {
  return (
    <div className="nodrag nopan nowheel pointer-events-none absolute inset-x-0 -top-12 z-30 flex justify-center">
      <div className="pointer-events-auto flex items-center gap-1 rounded-full border border-surface-border bg-elevated/95 p-1 shadow-lg backdrop-blur-sm">
        {NODE_COLORS.map((colorPair) => {
          const isActive = colorPair.color === nodeColor && colorPair.textColor === nodeTextColor

          return (
            <button
              key={`${colorPair.color}-${colorPair.textColor}`}
              aria-label="Apply node color"
              className={`h-5 w-5 rounded-full border transition-all ${
                isActive ? "scale-105 border-copy-primary" : "border-surface-border"
              }`}
              onClick={(event) => {
                event.stopPropagation()
                onColorChange(nodeId, colorPair)
              }}
              onPointerDown={(event) => {
                event.stopPropagation()
              }}
              onMouseEnter={(event) => {
                if (isActive) {
                  return
                }

                event.currentTarget.style.boxShadow = `0 0 8px ${colorPair.textColor}66`
              }}
              onMouseLeave={(event) => {
                if (isActive) {
                  event.currentTarget.style.boxShadow = `0 0 0 1px ${colorPair.textColor}, 0 0 10px ${colorPair.textColor}80`
                  return
                }

                event.currentTarget.style.boxShadow = ""
              }}
              style={{
                backgroundColor: colorPair.color,
                boxShadow: isActive
                  ? `0 0 0 1px ${colorPair.textColor}, 0 0 10px ${colorPair.textColor}80`
                  : undefined,
              }}
              type="button"
            />
          )
        })}
      </div>
    </div>
  )
}

function CanvasNodeHandles() {
  return (
    <>
      <Handle className={CANVAS_HANDLE_CLASSNAME} id="top" isConnectableEnd isConnectableStart position={Position.Top} type="source" />
      <Handle className={CANVAS_HANDLE_CLASSNAME} id="right" isConnectableEnd isConnectableStart position={Position.Right} type="source" />
      <Handle className={CANVAS_HANDLE_CLASSNAME} id="bottom" isConnectableEnd isConnectableStart position={Position.Bottom} type="source" />
      <Handle className={CANVAS_HANDLE_CLASSNAME} id="left" isConnectableEnd isConnectableStart position={Position.Left} type="source" />
    </>
  )
}

const CANVAS_HANDLE_CLASSNAME =
  "!h-2.5 !w-2.5 !rounded-full !border !border-surface-border !bg-copy-primary opacity-0 transition-opacity duration-150 group-hover:opacity-100"

interface ShapeSurfaceProps {
  isSelected: boolean
  shape: CanvasNodeShape
  nodeColor: string
}

function ShapeSurface({ isSelected, shape, nodeColor }: ShapeSurfaceProps) {
  const strokeColor = isSelected ? "var(--border-subtle)" : "var(--border-default)"

  if (shape === "diamond") {
    return (
      <svg aria-hidden className="absolute inset-0 h-full w-full" preserveAspectRatio="none" viewBox="0 0 100 100">
        <polygon fill={nodeColor} points="50,2 98,50 50,98 2,50" stroke={strokeColor} strokeWidth="2" />
      </svg>
    )
  }

  if (shape === "hexagon") {
    return (
      <svg aria-hidden className="absolute inset-0 h-full w-full" preserveAspectRatio="none" viewBox="0 0 100 100">
        <polygon
          fill={nodeColor}
          points="25,2 75,2 98,50 75,98 25,98 2,50"
          stroke={strokeColor}
          strokeWidth="2"
        />
      </svg>
    )
  }

  if (shape === "cylinder") {
    return (
      <svg aria-hidden className="absolute inset-0 h-full w-full" preserveAspectRatio="none" viewBox="0 0 100 100">
        <ellipse cx="50" cy="16" fill={nodeColor} rx="42" ry="14" stroke={strokeColor} strokeWidth="2" />
        <path
          d="M8 16V84C8 92 92 92 92 84V16"
          fill={nodeColor}
          stroke={strokeColor}
          strokeWidth="2"
        />
        <ellipse cx="50" cy="84" fill={nodeColor} rx="42" ry="14" stroke={strokeColor} strokeWidth="2" />
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
      style={{ backgroundColor: nodeColor, borderColor: strokeColor }}
    />
  )
}
