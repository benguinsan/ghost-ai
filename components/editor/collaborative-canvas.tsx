"use client"

import {
  type DragEvent,
  type ChangeEvent,
  Component,
  type ErrorInfo,
  type KeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type RefObject,
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react"
import { UserButton, useAuth } from "@clerk/nextjs"
import { ClientSideSuspense } from "@liveblocks/react/suspense"
import { useCanRedo, useCanUndo, useHistory, useMyPresence, useOthers, useStorage } from "@liveblocks/react/suspense"
import { useLiveblocksFlow } from "@liveblocks/react-flow"
import {
  Bot,
  Circle,
  Cylinder,
  Diamond,
  Hexagon,
  Loader2,
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
import { useCanvasAutosave } from "@/hooks/use-canvas-autosave"
import {
  AI_PRESENCE_COLOR,
  AI_PRESENCE_NAME,
  type AiCanvasPhase,
} from "@/types/ai-canvas"
import { OPEN_STARTER_TEMPLATES_EVENT } from "@/components/editor/starter-template-events"
import { StarterTemplatesModal } from "@/components/editor/starter-templates-modal"
import { CANVAS_TEMPLATES, type CanvasTemplate } from "@/components/editor/starter-templates"
import { emitCanvasSaveStatus } from "@/components/editor/canvas-save-status-events"

import "@xyflow/react/dist/style.css"
import "@liveblocks/react-flow/styles.css"

interface CollaborativeCanvasProps {
  roomId: string
  hasSavedCanvas: boolean
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
const MAX_VISIBLE_COLLABORATORS = 5

interface ShapeDragPayload {
  shape: CanvasNodeShape
  size: CanvasNodeSize
}

interface ShapeToolbarItem {
  shape: CanvasNodeShape
  label: string
  icon: typeof RectangleHorizontal
}

interface CollaboratorPresence {
  avatar: string | null
  color: string | null
  id: string
  name: string
}

interface RemoteCursor {
  color: string
  id: number | string
  name: string
  position: {
    x: number
    y: number
  }
  thinking: boolean
}

const SHAPE_TOOLBAR_ITEMS: ShapeToolbarItem[] = [
  { shape: "rectangle", label: "Rectangle", icon: RectangleHorizontal },
  { shape: "diamond", label: "Diamond", icon: Diamond },
  { shape: "circle", label: "Circle", icon: Circle },
  { shape: "pill", label: "Pill", icon: Pill },
  { shape: "cylinder", label: "Cylinder", icon: Cylinder },
  { shape: "hexagon", label: "Hexagon", icon: Hexagon },
]

export function CollaborativeCanvas({ roomId, hasSavedCanvas }: CollaborativeCanvasProps) {
  // The Liveblocks `LiveblocksProvider` + `RoomProvider` are owned by
  // `editor-layout.tsx` so both the canvas and the AI sidebar share one room
  // connection. This component assumes it renders inside that room provider.
  return (
    <div className="flex min-w-0 flex-1">
      <CanvasConnectionErrorBoundary resetKey={roomId}>
        <ClientSideSuspense fallback={<CanvasLoadingState />}>
          <LiveblocksReactFlowCanvas hasSavedCanvas={hasSavedCanvas} projectId={roomId} />
        </ClientSideSuspense>
      </CanvasConnectionErrorBoundary>
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

interface LiveblocksReactFlowCanvasProps {
  projectId: string
  hasSavedCanvas: boolean
}

function LiveblocksReactFlowCanvas({ projectId, hasSavedCanvas }: LiveblocksReactFlowCanvasProps) {
  const { nodes, edges, onNodesChange, onEdgesChange, onConnect, onDelete } = useLiveblocksFlow({
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
  const { userId } = useAuth()
  const others = useOthers()
  const aiState = useStorage((root) => root.ai ?? null)
  const [, updateMyPresence] = useMyPresence()
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
  const isPointerInsideCanvasRef = useRef(false)
  const nodeCreateCounterRef = useRef(0)
  const nodesRef = useRef(nodes)
  const edgesRef = useRef(edges)
  const selectedNodeIdsRef = useRef<Set<string>>(new Set())
  const selectedEdgeIdsRef = useRef<Set<string>>(new Set())
  const [isInitialCanvasResolved, setIsInitialCanvasResolved] = useState(false)

  const saveStatus = useCanvasAutosave({
    projectId,
    nodes,
    edges,
    enabled: isInitialCanvasResolved,
  })

  const collaborators = useMemo<CollaboratorPresence[]>(() => {
    const mappedCollaborators = new Map<string, CollaboratorPresence>()
    for (const other of others) {
      if (!other.id || other.id === userId || mappedCollaborators.has(other.id)) {
        continue
      }

      mappedCollaborators.set(other.id, {
        avatar: other.info.avatar || null,
        color: other.info.color || null,
        id: other.id,
        name: other.info.name || "Collaborator",
      })
    }

    return Array.from(mappedCollaborators.values())
  }, [others])

  const remoteCursors = useMemo<RemoteCursor[]>(() => {
    return others.reduce<RemoteCursor[]>((mappedCursors, other) => {
      if (!other.presence.cursor) {
        return mappedCursors
      }

      mappedCursors.push({
        color: other.info.color || "var(--accent-primary)",
        id: other.connectionId,
        name: other.info.name || "Collaborator",
        position: other.presence.cursor,
        thinking: other.presence.thinking === true,
      })

      return mappedCursors
    }, [])
  }, [others])

  const visibleCollaborators = useMemo(
    () => collaborators.slice(0, MAX_VISIBLE_COLLABORATORS),
    [collaborators],
  )
  const overflowCollaboratorCount = Math.max(0, collaborators.length - MAX_VISIBLE_COLLABORATORS)

  useEffect(() => {
    nodesRef.current = nodes
  }, [nodes])

  useEffect(() => {
    edgesRef.current = edges
  }, [edges])

  useEffect(() => {
    emitCanvasSaveStatus({
      projectId,
      status: saveStatus,
    })
  }, [projectId, saveStatus])

  useEffect(() => {
    if (isInitialCanvasResolved) {
      return
    }

    if (nodes.length > 0 || edges.length > 0) {
      setIsInitialCanvasResolved(true)
      return
    }

    if (!hasSavedCanvas) {
      setIsInitialCanvasResolved(true)
      return
    }

    let shouldIgnore = false

    const loadSavedCanvas = async () => {
      try {
        const response = await fetch(`/api/projects/${projectId}/canvas`, {
          cache: "no-store",
        })

        if (response.status === 404) {
          return
        }

        if (!response.ok) {
          throw new Error(`Failed to load saved canvas. Status: ${response.status}`)
        }

        const payload = (await response.json().catch(() => ({}))) as {
          canvas?: {
            nodes?: CanvasNode[]
            edges?: CanvasEdge[]
          }
        }
        const loadedNodes = Array.isArray(payload.canvas?.nodes) ? payload.canvas.nodes : []
        const loadedEdges = Array.isArray(payload.canvas?.edges) ? payload.canvas.edges : []

        if (shouldIgnore) {
          return
        }

        if (nodesRef.current.length > 0 || edgesRef.current.length > 0) {
          return
        }

        if (loadedNodes.length > 0) {
          onNodesChange(loadedNodes.map((node) => ({ item: node, type: "add" as const })))
        }

        if (loadedEdges.length > 0) {
          onEdgesChange(
            loadedEdges.map((edge) => ({
              item: {
                ...edge,
                data: {
                  label: edge.data?.label ?? "",
                },
              },
              type: "add" as const,
            })),
          )
        }
      } catch (error) {
        console.error("Failed to load saved canvas state.", error)
      } finally {
        if (!shouldIgnore) {
          setIsInitialCanvasResolved(true)
        }
      }
    }

    void loadSavedCanvas()

    return () => {
      shouldIgnore = true
    }
  }, [edges.length, hasSavedCanvas, isInitialCanvasResolved, nodes.length, onEdgesChange, onNodesChange, projectId])

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

  const handleSelectionChange = useCallback((params: { nodes: CanvasNode[]; edges: CanvasEdge[] }) => {
    selectedNodeIdsRef.current = new Set(params.nodes.map((node) => node.id))
    selectedEdgeIdsRef.current = new Set(params.edges.map((edge) => edge.id))
  }, [])

  const handleDeleteSelection = useCallback(() => {
    let resolvedNodeIds = new Set<string>()
    let resolvedEdgeIds = new Set<string>()
    const flowNodes = reactFlowInstance?.getNodes() ?? nodesRef.current
    const flowEdges = reactFlowInstance?.getEdges() ?? edgesRef.current

    if (reactFlowInstance) {
      const selectedNodes = reactFlowInstance.getNodes().filter((node) => node.selected)
      const selectedEdges = reactFlowInstance.getEdges().filter((edge) => edge.selected)
      let resolvedNodes = selectedNodes
      let resolvedEdges = selectedEdges

      if (!resolvedNodes.length && !resolvedEdges.length) {
        const activeElement = document.activeElement
        if (activeElement instanceof HTMLElement) {
          const focusedNode = activeElement.closest<HTMLElement>(".react-flow__node[data-id]")
          const focusedEdge = activeElement.closest<HTMLElement>(".react-flow__edge[data-id]")

          if (focusedNode?.dataset.id) {
            const focusedNodeMatch = reactFlowInstance
              .getNodes()
              .find((node) => node.id === focusedNode.dataset.id)
            if (focusedNodeMatch) {
              resolvedNodes = [focusedNodeMatch]
            }
          }

          if (focusedEdge?.dataset.id) {
            const focusedEdgeMatch = reactFlowInstance
              .getEdges()
              .find((edge) => edge.id === focusedEdge.dataset.id)
            if (focusedEdgeMatch) {
              resolvedEdges = [focusedEdgeMatch]
            }
          }
        }
      }

      if (!resolvedNodes.length && !resolvedEdges.length) {
        return
      }
      resolvedNodeIds = new Set(resolvedNodes.map((node) => node.id))
      resolvedEdgeIds = new Set(resolvedEdges.map((edge) => edge.id))
    } else {
      resolvedNodeIds = new Set(selectedNodeIdsRef.current)
      resolvedEdgeIds = new Set(selectedEdgeIdsRef.current)

      if (!resolvedNodeIds.size && !resolvedEdgeIds.size) {
        return
      }
    }

    for (const edge of flowEdges) {
      if (resolvedNodeIds.has(edge.source) || resolvedNodeIds.has(edge.target)) {
        resolvedEdgeIds.add(edge.id)
      }
    }

    const resolvedNodes = flowNodes.filter((node) => resolvedNodeIds.has(node.id))
    const resolvedEdges = flowEdges.filter((edge) => resolvedEdgeIds.has(edge.id))

    if (!resolvedNodes.length && !resolvedEdges.length) {
      return
    }

    onDelete({
      edges: resolvedEdges,
      nodes: resolvedNodes,
    })
  }, [onDelete, reactFlowInstance])

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
    onDeleteSelection: handleDeleteSelection,
    onRedo: handleRedo,
    onUndo: handleUndo,
    reactFlowInstance,
  })

  const publishCursorPosition = useCallback(
    (clientX: number, clientY: number) => {
      if (!reactFlowInstance) {
        return
      }

      const pointerPosition = reactFlowInstance.screenToFlowPosition({
        x: clientX,
        y: clientY,
      })
      updateMyPresence({ cursor: pointerPosition })
    },
    [reactFlowInstance, updateMyPresence],
  )

  const handleCanvasSurfaceMouseMove = useCallback(
    (event: ReactMouseEvent<HTMLDivElement>) => {
      isPointerInsideCanvasRef.current = true
      publishCursorPosition(event.clientX, event.clientY)
    },
    [publishCursorPosition],
  )

  const handleCanvasMouseEnter = useCallback(() => {
    isPointerInsideCanvasRef.current = true
  }, [])

  const handleCanvasPaneMouseLeave = useCallback(() => {
    isPointerInsideCanvasRef.current = false
    updateMyPresence({ cursor: null })
  }, [updateMyPresence])

  useEffect(() => {
    const handleWindowPointerMove = (event: PointerEvent) => {
      if (!isPointerInsideCanvasRef.current) {
        return
      }

      const wrapperBounds = canvasWrapperRef.current?.getBoundingClientRect()
      if (!wrapperBounds) {
        return
      }

      const isInsideCanvas =
        event.clientX >= wrapperBounds.left &&
        event.clientX <= wrapperBounds.right &&
        event.clientY >= wrapperBounds.top &&
        event.clientY <= wrapperBounds.bottom

      if (!isInsideCanvas) {
        isPointerInsideCanvasRef.current = false
        updateMyPresence({ cursor: null })
        return
      }

      publishCursorPosition(event.clientX, event.clientY)
    }

    window.addEventListener("pointermove", handleWindowPointerMove)

    return () => {
      window.removeEventListener("pointermove", handleWindowPointerMove)
    }
  }, [publishCursorPosition, updateMyPresence])

  return (
    <div
      ref={canvasWrapperRef}
      className="relative h-full min-h-0 w-full"
      onDragOver={handleCanvasDragOver}
      onDrop={handleCanvasDrop}
      onMouseEnter={handleCanvasMouseEnter}
      onMouseLeave={handleCanvasPaneMouseLeave}
      onMouseMove={handleCanvasSurfaceMouseMove}
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
        onDelete={onDelete}
        onInit={setReactFlowInstance}
        onSelectionChange={handleSelectionChange}
        onNodesChange={onNodesChange}
      >
        <Background variant={BackgroundVariant.Dots} />
      </ReactFlow>

      <CanvasPresenceBar
        collaborators={visibleCollaborators}
        overflowCollaboratorCount={overflowCollaboratorCount}
      />
      <LiveCursorLayer canvasWrapperRef={canvasWrapperRef} cursors={remoteCursors} reactFlowInstance={reactFlowInstance} />
      <AiPresenceCursor
        aiState={aiState}
        canvasWrapperRef={canvasWrapperRef}
        reactFlowInstance={reactFlowInstance}
      />
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

interface CanvasPresenceBarProps {
  collaborators: CollaboratorPresence[]
  overflowCollaboratorCount: number
}

function CanvasPresenceBar({ collaborators, overflowCollaboratorCount }: CanvasPresenceBarProps) {
  const hasCollaborators = collaborators.length > 0 || overflowCollaboratorCount > 0

  return (
    <div className="pointer-events-none absolute right-6 top-6 z-20">
      <div className="pointer-events-auto flex items-center rounded-full border border-surface-border bg-elevated/90 px-2 py-1.5 shadow-lg backdrop-blur-sm">
        {collaborators.length ? (
          <div className="flex items-center pr-1">
            {collaborators.map((collaborator, index) => (
              <CollaboratorAvatar
                key={collaborator.id}
                avatar={collaborator.avatar}
                color={collaborator.color}
                index={index}
                name={collaborator.name}
              />
            ))}
            {overflowCollaboratorCount > 0 ? (
              <div
                className="-ml-1.5 flex h-8 w-8 items-center justify-center rounded-full border text-[11px] font-medium text-copy-secondary"
                style={{ borderColor: "var(--border-subtle)", backgroundColor: "var(--bg-subtle)" }}
              >
                +{overflowCollaboratorCount}
              </div>
            ) : null}
          </div>
        ) : null}
        {hasCollaborators ? <div className="mx-2 h-6 w-px bg-surface-border" /> : null}
        <UserButton
          appearance={{
            elements: {
              avatarBox: "h-8 w-8",
              userButtonPopoverActionButton: "text-copy-primary hover:text-copy-primary",
              userButtonPopoverActionButtonIcon: "text-copy-secondary",
              userPreviewMainIdentifierText: "text-copy-primary",
              userPreviewSecondaryIdentifier: "text-copy-secondary",
            },
          }}
        />
      </div>
    </div>
  )
}

interface CollaboratorAvatarProps {
  avatar: string | null
  color: string | null
  index: number
  name: string
}

function CollaboratorAvatar({ avatar, color, index, name }: CollaboratorAvatarProps) {
  const initials = getInitials(name)

  return (
    <div
      className={`relative flex h-8 w-8 items-center justify-center overflow-hidden rounded-full border bg-subtle text-[11px] font-semibold text-copy-primary ${
        index > 0 ? "-ml-1.5" : ""
      }`}
      style={{
        borderColor: color || "var(--border-subtle)",
        boxShadow: "0 0 0 1px var(--bg-base)",
      }}
      title={name}
    >
      {avatar ? <img alt={name} className="h-full w-full object-cover" src={avatar} /> : initials}
    </div>
  )
}

interface LiveCursorLayerProps {
  canvasWrapperRef: RefObject<HTMLDivElement | null>
  cursors: RemoteCursor[]
  reactFlowInstance: ReactFlowInstance<CanvasNode, CanvasEdge> | null
}

function LiveCursorLayer({ canvasWrapperRef, cursors, reactFlowInstance }: LiveCursorLayerProps) {
  const wrapperBounds = canvasWrapperRef.current?.getBoundingClientRect()
  if (!reactFlowInstance || !wrapperBounds || !cursors.length) {
    return null
  }

  return (
    <div className="pointer-events-none absolute inset-0 z-20">
      {cursors.map((cursor) => {
        const screenPosition = reactFlowInstance.flowToScreenPosition(cursor.position)
        const x = screenPosition.x - wrapperBounds.left
        const y = screenPosition.y - wrapperBounds.top

        return (
          <div
            key={cursor.id}
            className="absolute flex items-start gap-1.5"
            style={{
              left: x,
              top: y,
              transform: "translate(-2px, -2px)",
            }}
          >
            <div
              className="h-3.5 w-3.5 -rotate-45 rounded-[2px]"
              style={{ backgroundColor: cursor.color }}
            />
            <div
              className="flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[11px] font-medium text-copy-primary"
              style={{ borderColor: cursor.color, backgroundColor: "var(--bg-elevated)" }}
            >
              <span>{cursor.name}</span>
              {cursor.thinking ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
            </div>
          </div>
        )
      })}
    </div>
  )
}

type ImmutableAiState = {
  readonly active: boolean
  readonly phase: AiCanvasPhase
  readonly cursor: { readonly x: number; readonly y: number } | null
  readonly updatedAt: number
}

interface AiPresenceCursorProps {
  aiState: ImmutableAiState | null
  canvasWrapperRef: RefObject<HTMLDivElement | null>
  reactFlowInstance: ReactFlowInstance<CanvasNode, CanvasEdge> | null
}

function AiPresenceCursor({ aiState, canvasWrapperRef, reactFlowInstance }: AiPresenceCursorProps) {
  const wrapperBounds = canvasWrapperRef.current?.getBoundingClientRect()

  if (!aiState?.active || !aiState.cursor || !reactFlowInstance || !wrapperBounds) {
    return null
  }

  const screenPosition = reactFlowInstance.flowToScreenPosition({
    x: aiState.cursor.x,
    y: aiState.cursor.y,
  })
  const x = screenPosition.x - wrapperBounds.left
  const y = screenPosition.y - wrapperBounds.top
  const isThinking = aiState.phase === "thinking" || aiState.phase === "generating"

  return (
    <div className="pointer-events-none absolute inset-0 z-20">
      <div
        className="absolute flex items-start gap-1.5 transition-[left,top] duration-500 ease-out"
        style={{ left: x, top: y, transform: "translate(-2px, -2px)" }}
      >
        <div className="h-3.5 w-3.5 -rotate-45 rounded-[2px]" style={{ backgroundColor: AI_PRESENCE_COLOR }} />
        <div
          className="flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[11px] font-medium"
          style={{ borderColor: AI_PRESENCE_COLOR, backgroundColor: "var(--bg-elevated)", color: "var(--accent-ai-text)" }}
        >
          <Bot className="h-3 w-3" />
          <span>{AI_PRESENCE_NAME}</span>
          {isThinking ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
        </div>
      </div>
    </div>
  )
}

function getInitials(name: string) {
  const trimmedName = name.trim()
  if (!trimmedName) {
    return "?"
  }

  const segments = trimmedName.split(/\s+/).slice(0, 2)
  return segments.map((segment) => segment[0]?.toUpperCase() ?? "").join("")
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
