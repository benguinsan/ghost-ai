import {
  NODE_COLORS,
  NODE_SHAPE_DEFAULT_SIZES,
  type CanvasEdge,
  type CanvasNode,
  type CanvasNodeShape,
} from "@/types/canvas"

export interface CanvasTemplate {
  id: string
  name: string
  description: string
  nodes: CanvasNode[]
  edges: CanvasEdge[]
}

interface TemplateNodeConfig {
  id: string
  label: string
  shape: CanvasNodeShape
  colorIndex: number
  x: number
  y: number
  width?: number
  height?: number
}

function createTemplateNode(config: TemplateNodeConfig): CanvasNode {
  const defaultSize = NODE_SHAPE_DEFAULT_SIZES[config.shape]
  const colorPair = NODE_COLORS[config.colorIndex] ?? NODE_COLORS[0]

  return {
    id: config.id,
    type: "canvasNode",
    position: { x: config.x, y: config.y },
    width: config.width ?? defaultSize.width,
    height: config.height ?? defaultSize.height,
    data: {
      label: config.label,
      color: colorPair.color,
      textColor: colorPair.textColor,
      shape: config.shape,
    },
  }
}

function createTemplateEdge(id: string, source: string, target: string, label = ""): CanvasEdge {
  return {
    id,
    source,
    target,
    type: "canvasEdge",
    data: {
      label,
    },
  }
}

export const CANVAS_TEMPLATES: CanvasTemplate[] = [
  {
    id: "microservices-platform",
    name: "Microservices Platform",
    description: "Gateway + independent services with dedicated datastores and async event fan-out.",
    nodes: [
      createTemplateNode({ id: "ms-client", label: "Web Client", shape: "pill", colorIndex: 1, x: 40, y: 140 }),
      createTemplateNode({ id: "ms-gateway", label: "API Gateway", shape: "rectangle", colorIndex: 7, x: 330, y: 130 }),
      createTemplateNode({ id: "ms-auth", label: "Auth Service", shape: "rectangle", colorIndex: 2, x: 630, y: 10 }),
      createTemplateNode({ id: "ms-order", label: "Order Service", shape: "rectangle", colorIndex: 2, x: 630, y: 150 }),
      createTemplateNode({
        id: "ms-notify",
        label: "Notification Service",
        shape: "rectangle",
        colorIndex: 2,
        x: 630,
        y: 290,
      }),
      createTemplateNode({ id: "ms-auth-db", label: "Auth DB", shape: "cylinder", colorIndex: 6, x: 940, y: 0 }),
      createTemplateNode({ id: "ms-order-db", label: "Order DB", shape: "cylinder", colorIndex: 6, x: 940, y: 145 }),
      createTemplateNode({ id: "ms-queue", label: "Event Bus", shape: "hexagon", colorIndex: 3, x: 940, y: 290 }),
    ],
    edges: [
      createTemplateEdge("ms-e1", "ms-client", "ms-gateway"),
      createTemplateEdge("ms-e2", "ms-gateway", "ms-auth", "auth"),
      createTemplateEdge("ms-e3", "ms-gateway", "ms-order", "orders"),
      createTemplateEdge("ms-e4", "ms-gateway", "ms-notify", "notify"),
      createTemplateEdge("ms-e5", "ms-auth", "ms-auth-db"),
      createTemplateEdge("ms-e6", "ms-order", "ms-order-db"),
      createTemplateEdge("ms-e7", "ms-order", "ms-queue", "publish"),
      createTemplateEdge("ms-e8", "ms-queue", "ms-notify", "consume"),
    ],
  },
  {
    id: "cicd-pipeline",
    name: "CI/CD Pipeline",
    description: "Commit-to-production flow with checks, build artifacts, and staged deployments.",
    nodes: [
      createTemplateNode({ id: "ci-dev", label: "Developer", shape: "circle", colorIndex: 5, x: 30, y: 120 }),
      createTemplateNode({ id: "ci-repo", label: "Git Repository", shape: "rectangle", colorIndex: 1, x: 210, y: 110 }),
      createTemplateNode({ id: "ci-trigger", label: "Pipeline Trigger", shape: "diamond", colorIndex: 3, x: 430, y: 100 }),
      createTemplateNode({ id: "ci-tests", label: "Test Suite", shape: "rectangle", colorIndex: 7, x: 680, y: 20 }),
      createTemplateNode({ id: "ci-build", label: "Build", shape: "rectangle", colorIndex: 7, x: 680, y: 180 }),
      createTemplateNode({ id: "ci-registry", label: "Artifact Registry", shape: "cylinder", colorIndex: 6, x: 970, y: 170 }),
      createTemplateNode({ id: "ci-staging", label: "Staging Deploy", shape: "pill", colorIndex: 4, x: 970, y: 20 }),
      createTemplateNode({ id: "ci-prod", label: "Production Deploy", shape: "pill", colorIndex: 4, x: 1230, y: 90 }),
    ],
    edges: [
      createTemplateEdge("ci-e1", "ci-dev", "ci-repo", "push"),
      createTemplateEdge("ci-e2", "ci-repo", "ci-trigger"),
      createTemplateEdge("ci-e3", "ci-trigger", "ci-tests", "run tests"),
      createTemplateEdge("ci-e4", "ci-trigger", "ci-build", "build"),
      createTemplateEdge("ci-e5", "ci-tests", "ci-build", "pass"),
      createTemplateEdge("ci-e6", "ci-build", "ci-registry", "publish"),
      createTemplateEdge("ci-e7", "ci-registry", "ci-staging", "deploy"),
      createTemplateEdge("ci-e8", "ci-staging", "ci-prod", "promote"),
    ],
  },
  {
    id: "event-driven-orders",
    name: "Event-Driven Orders",
    description: "Decoupled order processing with an event stream and downstream consumers.",
    nodes: [
      createTemplateNode({ id: "ev-client", label: "Client App", shape: "pill", colorIndex: 1, x: 40, y: 170 }),
      createTemplateNode({ id: "ev-api", label: "Order API", shape: "rectangle", colorIndex: 7, x: 300, y: 160 }),
      createTemplateNode({ id: "ev-stream", label: "Event Stream", shape: "hexagon", colorIndex: 3, x: 580, y: 150 }),
      createTemplateNode({ id: "ev-proj", label: "Read Model Projector", shape: "rectangle", colorIndex: 2, x: 860, y: 20 }),
      createTemplateNode({ id: "ev-billing", label: "Billing Consumer", shape: "rectangle", colorIndex: 2, x: 860, y: 160 }),
      createTemplateNode({ id: "ev-notify", label: "Notification Consumer", shape: "rectangle", colorIndex: 2, x: 860, y: 300 }),
      createTemplateNode({ id: "ev-read-db", label: "Read DB", shape: "cylinder", colorIndex: 6, x: 1150, y: 10 }),
      createTemplateNode({ id: "ev-ledger", label: "Billing Ledger", shape: "cylinder", colorIndex: 6, x: 1150, y: 160 }),
    ],
    edges: [
      createTemplateEdge("ev-e1", "ev-client", "ev-api"),
      createTemplateEdge("ev-e2", "ev-api", "ev-stream", "order.created"),
      createTemplateEdge("ev-e3", "ev-stream", "ev-proj"),
      createTemplateEdge("ev-e4", "ev-stream", "ev-billing"),
      createTemplateEdge("ev-e5", "ev-stream", "ev-notify"),
      createTemplateEdge("ev-e6", "ev-proj", "ev-read-db"),
      createTemplateEdge("ev-e7", "ev-billing", "ev-ledger"),
    ],
  },
]
