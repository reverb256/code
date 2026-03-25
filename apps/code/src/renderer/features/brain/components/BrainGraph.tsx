import { logger } from "@utils/logger";
import {
  ArrowsIn,
  ArrowsOut,
  Crosshair,
  ArrowClockwise,
  X,
} from "@phosphor-icons/react";
import { AnimatePresence, motion } from "framer-motion";
import Graph from "graphology";
import FA2Layout from "graphology-layout-forceatlas2/worker";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Sigma from "sigma";
import { EdgeArrowProgram } from "sigma/rendering";

const log = logger.scope("brain-graph");

// -- Types --

type NodeType =
  | "task"
  | "agent"
  | "file"
  | "concept"
  | "decision"
  | "observation"
  | "goal";

type EdgeType =
  | "related_to"
  | "depends_on"
  | "worked_on"
  | "produced"
  | "informed_by"
  | "contradicts";

interface BrainNode {
  id: string;
  content: string;
  nodeType: NodeType;
  importance: number;
  createdAt: string;
}

interface BrainEdge {
  id: string;
  sourceId: string;
  targetId: string;
  relationType: EdgeType;
  weight: number;
}

interface BrainGraphData {
  nodes: BrainNode[];
  edges: BrainEdge[];
}

interface NodeDetail {
  node: BrainNode;
  x: number;
  y: number;
}

// -- Constants --

const NODE_COLORS: Record<NodeType, string> = {
  task: "#3b82f6",
  agent: "#a855f7",
  file: "#06b6d4",
  concept: "#22c55e",
  decision: "#f59e0b",
  observation: "#ec4899",
  goal: "#f97316",
};

const EDGE_COLORS: Record<EdgeType, string> = {
  related_to: "#555555",
  depends_on: "#60a5fa",
  worked_on: "#4ade80",
  produced: "#fb923c",
  informed_by: "#a78bfa",
  contradicts: "#f87171",
};

const FADED_NODE_COLOR = "#333333";

// -- Sample data for initial development --

function generateSampleData(): BrainGraphData {
  const nodes: BrainNode[] = [
    {
      id: "task-1",
      content: "Implement brain graph visualization",
      nodeType: "task",
      importance: 0.9,
      createdAt: "2026-03-25T10:00:00Z",
    },
    {
      id: "task-2",
      content: "Set up tRPC router for brain service",
      nodeType: "task",
      importance: 0.7,
      createdAt: "2026-03-25T09:00:00Z",
    },
    {
      id: "task-3",
      content: "Design knowledge graph data model",
      nodeType: "task",
      importance: 0.8,
      createdAt: "2026-03-24T14:00:00Z",
    },
    {
      id: "agent-1",
      content: "Code review agent",
      nodeType: "agent",
      importance: 0.85,
      createdAt: "2026-03-23T08:00:00Z",
    },
    {
      id: "agent-2",
      content: "Task planner agent",
      nodeType: "agent",
      importance: 0.8,
      createdAt: "2026-03-23T08:00:00Z",
    },
    {
      id: "file-1",
      content: "BrainGraph.tsx",
      nodeType: "file",
      importance: 0.6,
      createdAt: "2026-03-25T10:30:00Z",
    },
    {
      id: "file-2",
      content: "BrainView.tsx",
      nodeType: "file",
      importance: 0.5,
      createdAt: "2026-03-25T10:30:00Z",
    },
    {
      id: "file-3",
      content: "navigationStore.ts",
      nodeType: "file",
      importance: 0.4,
      createdAt: "2026-03-20T12:00:00Z",
    },
    {
      id: "concept-1",
      content: "Force-directed graph layout",
      nodeType: "concept",
      importance: 0.7,
      createdAt: "2026-03-24T11:00:00Z",
    },
    {
      id: "concept-2",
      content: "GPU-accelerated rendering with Sigma.js",
      nodeType: "concept",
      importance: 0.65,
      createdAt: "2026-03-24T11:00:00Z",
    },
    {
      id: "concept-3",
      content: "Progressive neighbor loading",
      nodeType: "concept",
      importance: 0.6,
      createdAt: "2026-03-24T11:30:00Z",
    },
    {
      id: "decision-1",
      content: "Use Sigma + Graphology over custom Canvas2D",
      nodeType: "decision",
      importance: 0.75,
      createdAt: "2026-03-24T15:00:00Z",
    },
    {
      id: "decision-2",
      content: "Start with sample data before wiring tRPC",
      nodeType: "decision",
      importance: 0.5,
      createdAt: "2026-03-25T09:30:00Z",
    },
    {
      id: "obs-1",
      content: "Dorothy's Canvas2D graphs feel less polished",
      nodeType: "observation",
      importance: 0.4,
      createdAt: "2026-03-24T16:00:00Z",
    },
    {
      id: "obs-2",
      content: "Spacebot's MemoryGraph has smooth hover fading",
      nodeType: "observation",
      importance: 0.45,
      createdAt: "2026-03-24T16:00:00Z",
    },
    {
      id: "goal-1",
      content: "Interactive knowledge graph in the brain view",
      nodeType: "goal",
      importance: 0.95,
      createdAt: "2026-03-24T08:00:00Z",
    },
    {
      id: "goal-2",
      content: "Visualize task and agent relationships",
      nodeType: "goal",
      importance: 0.85,
      createdAt: "2026-03-24T08:00:00Z",
    },
  ];

  const edges: BrainEdge[] = [
    {
      id: "e1",
      sourceId: "goal-1",
      targetId: "task-1",
      relationType: "depends_on",
      weight: 0.9,
    },
    {
      id: "e2",
      sourceId: "goal-2",
      targetId: "task-1",
      relationType: "depends_on",
      weight: 0.8,
    },
    {
      id: "e3",
      sourceId: "task-1",
      targetId: "task-2",
      relationType: "depends_on",
      weight: 0.7,
    },
    {
      id: "e4",
      sourceId: "task-1",
      targetId: "task-3",
      relationType: "depends_on",
      weight: 0.6,
    },
    {
      id: "e5",
      sourceId: "task-1",
      targetId: "file-1",
      relationType: "produced",
      weight: 0.8,
    },
    {
      id: "e6",
      sourceId: "task-1",
      targetId: "file-2",
      relationType: "produced",
      weight: 0.5,
    },
    {
      id: "e7",
      sourceId: "agent-1",
      targetId: "task-1",
      relationType: "worked_on",
      weight: 0.7,
    },
    {
      id: "e8",
      sourceId: "agent-2",
      targetId: "task-3",
      relationType: "worked_on",
      weight: 0.6,
    },
    {
      id: "e9",
      sourceId: "concept-1",
      targetId: "task-1",
      relationType: "informed_by",
      weight: 0.5,
    },
    {
      id: "e10",
      sourceId: "concept-2",
      targetId: "concept-1",
      relationType: "related_to",
      weight: 0.6,
    },
    {
      id: "e11",
      sourceId: "concept-3",
      targetId: "concept-2",
      relationType: "related_to",
      weight: 0.4,
    },
    {
      id: "e12",
      sourceId: "decision-1",
      targetId: "concept-2",
      relationType: "informed_by",
      weight: 0.7,
    },
    {
      id: "e13",
      sourceId: "decision-1",
      targetId: "obs-1",
      relationType: "informed_by",
      weight: 0.5,
    },
    {
      id: "e14",
      sourceId: "decision-2",
      targetId: "task-2",
      relationType: "related_to",
      weight: 0.4,
    },
    {
      id: "e15",
      sourceId: "obs-2",
      targetId: "decision-1",
      relationType: "informed_by",
      weight: 0.6,
    },
    {
      id: "e16",
      sourceId: "obs-1",
      targetId: "obs-2",
      relationType: "contradicts",
      weight: 0.3,
    },
    {
      id: "e17",
      sourceId: "file-3",
      targetId: "file-2",
      relationType: "related_to",
      weight: 0.3,
    },
    {
      id: "e18",
      sourceId: "agent-1",
      targetId: "agent-2",
      relationType: "related_to",
      weight: 0.4,
    },
    {
      id: "e19",
      sourceId: "goal-1",
      targetId: "goal-2",
      relationType: "related_to",
      weight: 0.7,
    },
  ];

  return { nodes, edges };
}

// -- Component --

export function BrainGraph() {
  const containerRef = useRef<HTMLDivElement>(null);
  const sigmaRef = useRef<Sigma | null>(null);
  const graphRef = useRef<Graph | null>(null);
  const layoutRef = useRef<FA2Layout | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [nodeCount, setNodeCount] = useState(0);
  const [edgeCount, setEdgeCount] = useState(0);
  const [selectedNode, setSelectedNode] = useState<NodeDetail | null>(null);
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const hoveredNodeRef = useRef<string | null>(null);

  const cleanup = useCallback(() => {
    if (layoutRef.current) {
      layoutRef.current.kill();
      layoutRef.current = null;
    }
    if (sigmaRef.current) {
      sigmaRef.current.kill();
      sigmaRef.current = null;
    }
    graphRef.current = null;
  }, []);

  useEffect(() => {
    if (!containerRef.current) return;

    let cancelled = false;

    function loadGraph() {
      setIsLoading(true);
      setSelectedNode(null);
      cleanup();

      // TODO: Replace with tRPC query when brain service exists
      const data = generateSampleData();

      if (cancelled) return;

      const graph = new Graph({ multi: false, type: "directed" });
      graphRef.current = graph;

      for (const node of data.nodes) {
        const size = 3 + node.importance * 8;
        graph.addNode(node.id, {
          label: truncateLabel(node.content),
          size,
          color: NODE_COLORS[node.nodeType] ?? "#666666",
          x: Math.random() * 100,
          y: Math.random() * 100,
          nodeData: node,
        });
      }

      addEdgesToGraph(graph, data.edges);

      setNodeCount(graph.order);
      setEdgeCount(graph.size);

      if (!containerRef.current || cancelled) return;

      const sigma = new Sigma(graph, containerRef.current, {
        allowInvalidContainer: true,
        renderLabels: true,
        labelRenderedSizeThreshold: 12,
        labelSize: 10,
        labelColor: { color: "#999999" },
        defaultEdgeType: "arrow",
        defaultEdgeColor: "#444444",
        edgeLabelSize: 10,
        edgeProgramClasses: {
          arrow: EdgeArrowProgram,
        },
        nodeReducer: (node, data) => {
          const res = { ...data };
          const currentHovered = hoveredNodeRef.current;
          if (currentHovered && currentHovered !== node) {
            const g = graphRef.current;
            if (
              g &&
              !g.hasEdge(currentHovered, node) &&
              !g.hasEdge(node, currentHovered)
            ) {
              res.color = FADED_NODE_COLOR;
              res.label = "";
            }
          }
          return res;
        },
        edgeReducer: (_edge, data) => {
          return { ...data };
        },
      });

      sigmaRef.current = sigma;

      const layout = new FA2Layout(graph, {
        settings: {
          gravity: 1,
          scalingRatio: 10,
          barnesHutOptimize: true,
          barnesHutTheta: 0.5,
          strongGravityMode: false,
          slowDown: 5,
        },
      });
      layoutRef.current = layout;
      layout.start();

      setTimeout(() => {
        if (layout.isRunning()) {
          layout.stop();
        }
      }, 3000);

      setIsLoading(false);
      log.info("Brain graph loaded", {
        nodes: data.nodes.length,
        edges: data.edges.length,
      });
    }

    loadGraph();

    return () => {
      cancelled = true;
      cleanup();
    };
  }, [cleanup]);

  useEffect(() => {
    const sigma = sigmaRef.current;
    if (!sigma) return;

    function handleClickNode({ node }: { node: string }) {
      const graph = graphRef.current;
      const s = sigmaRef.current;
      if (!graph || !s) return;

      const attrs = graph.getNodeAttributes(node);
      const nodeData = attrs.nodeData as BrainNode | undefined;
      if (!nodeData) return;

      const position = s.graphToViewport({ x: attrs.x, y: attrs.y });
      setSelectedNode({
        node: nodeData,
        x: position.x,
        y: position.y,
      });
    }

    function handleEnterNode({ node }: { node: string }) {
      hoveredNodeRef.current = node;
      setHoveredNode(node);
      if (sigmaRef.current) {
        sigmaRef.current.getContainer().style.cursor = "pointer";
      }
    }

    function handleLeaveNode() {
      hoveredNodeRef.current = null;
      setHoveredNode(null);
      if (sigmaRef.current) {
        sigmaRef.current.getContainer().style.cursor = "default";
      }
    }

    function handleClickStage() {
      setSelectedNode(null);
    }

    sigma.on("clickNode", handleClickNode);
    sigma.on("enterNode", handleEnterNode);
    sigma.on("leaveNode", handleLeaveNode);
    sigma.on("clickStage", handleClickStage);

    return () => {
      sigma.off("clickNode", handleClickNode);
      sigma.off("enterNode", handleEnterNode);
      sigma.off("leaveNode", handleLeaveNode);
      sigma.off("clickStage", handleClickStage);
    };
  }, [isLoading]);

  useEffect(() => {
    sigmaRef.current?.refresh();
  }, [hoveredNode]);

  const nodeTypeEntries = useMemo(
    () => Object.entries(NODE_COLORS) as [NodeType, string][],
    [],
  );
  const edgeTypeEntries = useMemo(
    () => Object.entries(EDGE_COLORS) as [EdgeType, string][],
    [],
  );

  return (
    <div className="relative h-full w-full">
      {/* Stats bar */}
      <div className="absolute left-3 top-3 z-10 flex items-center gap-3 rounded-md bg-[--color-panel-solid] px-3 py-1.5 text-xs text-[--gray-a9]">
        <span>{nodeCount} nodes</span>
        <span className="text-[--gray-a6]">|</span>
        <span>{edgeCount} edges</span>
      </div>

      {/* Legend */}
      <div className="absolute bottom-3 left-3 z-10 rounded-md bg-[--color-panel-solid] p-3">
        <div className="mb-2 text-xs font-medium text-[--gray-a9]">
          Node Types
        </div>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1">
          {nodeTypeEntries.map(([type, color]) => (
            <div key={type} className="flex items-center gap-1.5">
              <span
                className="inline-block h-2 w-2 rounded-full"
                style={{ backgroundColor: color }}
              />
              <span className="text-xs text-[--gray-a9]">{type}</span>
            </div>
          ))}
        </div>
        <div className="mt-2 border-t border-[--gray-a4] pt-2">
          <div className="mb-1 text-xs font-medium text-[--gray-a9]">
            Edge Types
          </div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1">
            {edgeTypeEntries.map(([type, color]) => (
              <div key={type} className="flex items-center gap-1.5">
                <span
                  className="inline-block h-0.5 w-3"
                  style={{
                    backgroundColor: color,
                    borderStyle:
                      type === "contradicts" ? "dashed" : "solid",
                  }}
                />
                <span className="text-xs text-[--gray-a9]">
                  {type.replace(/_/g, " ")}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="absolute right-3 top-3 z-10 flex flex-col gap-1.5">
        <button
          type="button"
          onClick={() => sigmaRef.current?.getCamera().animatedReset()}
          className="flex h-7 w-7 items-center justify-center rounded-md bg-[--color-panel-solid] text-[--gray-a9] transition-colors hover:text-[--gray-12]"
          title="Reset zoom"
        >
          <Crosshair size={14} />
        </button>
        <button
          type="button"
          onClick={() => {
            const camera = sigmaRef.current?.getCamera();
            if (camera) camera.animatedZoom({ duration: 200 });
          }}
          className="flex h-7 w-7 items-center justify-center rounded-md bg-[--color-panel-solid] text-[--gray-a9] transition-colors hover:text-[--gray-12]"
          title="Zoom in"
        >
          <ArrowsIn size={14} />
        </button>
        <button
          type="button"
          onClick={() => {
            const camera = sigmaRef.current?.getCamera();
            if (camera) camera.animatedUnzoom({ duration: 200 });
          }}
          className="flex h-7 w-7 items-center justify-center rounded-md bg-[--color-panel-solid] text-[--gray-a9] transition-colors hover:text-[--gray-12]"
          title="Zoom out"
        >
          <ArrowsOut size={14} />
        </button>
        <button
          type="button"
          onClick={() => {
            const layout = layoutRef.current;
            if (layout) {
              if (layout.isRunning()) {
                layout.stop();
              } else {
                layout.start();
                setTimeout(() => {
                  if (layout.isRunning()) layout.stop();
                }, 3000);
              }
            }
          }}
          className="flex h-7 w-7 items-center justify-center rounded-md bg-[--color-panel-solid] text-[--gray-a9] transition-colors hover:text-[--gray-12]"
          title="Re-run layout"
        >
          <ArrowClockwise size={14} />
        </button>
      </div>

      {/* Node detail panel */}
      <AnimatePresence>
        {selectedNode && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.15 }}
            className="absolute bottom-3 right-3 z-20 w-72 rounded-lg border border-[--gray-a4] bg-[--color-panel-solid] p-4 shadow-xl"
          >
            <div className="mb-2 flex items-center justify-between">
              <span
                className="rounded px-1.5 py-0.5 text-xs font-medium"
                style={{
                  backgroundColor: `${NODE_COLORS[selectedNode.node.nodeType]}22`,
                  color: NODE_COLORS[selectedNode.node.nodeType],
                }}
              >
                {selectedNode.node.nodeType}
              </span>
              <button
                type="button"
                onClick={() => setSelectedNode(null)}
                className="flex h-6 w-6 items-center justify-center rounded text-[--gray-a9] transition-colors hover:text-[--gray-12]"
              >
                <X size={12} />
              </button>
            </div>
            <p className="mb-3 max-h-32 overflow-y-auto whitespace-pre-wrap text-sm leading-relaxed text-[--gray-a11]">
              {selectedNode.node.content}
            </p>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-[--gray-a9]">
              <span>
                Importance: {selectedNode.node.importance.toFixed(2)}
              </span>
              <span>
                Created:{" "}
                {new Date(selectedNode.node.createdAt).toLocaleDateString()}
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Sigma container */}
      <div
        ref={containerRef}
        className="h-full w-full"
        style={{ background: "transparent" }}
      />

      {/* Loading state */}
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="flex items-center gap-2 text-[--gray-a9]">
            <div className="h-2 w-2 animate-pulse rounded-full bg-[--accent-9]" />
            Loading graph...
          </div>
        </div>
      )}
    </div>
  );
}

function truncateLabel(content: string): string {
  const firstLine = content.split("\n")[0].trim();
  if (firstLine.length <= 24) return firstLine;
  return `${firstLine.slice(0, 22)}...`;
}

function addEdgesToGraph(graph: Graph, edges: BrainEdge[]) {
  for (const edge of edges) {
    if (
      graph.hasNode(edge.sourceId) &&
      graph.hasNode(edge.targetId) &&
      !graph.hasEdge(edge.id) &&
      !graph.hasDirectedEdge(edge.sourceId, edge.targetId)
    ) {
      graph.addEdgeWithKey(edge.id, edge.sourceId, edge.targetId, {
        color: EDGE_COLORS[edge.relationType] ?? "#444444",
        size: 1 + edge.weight * 2,
        type: "arrow",
        relationType: edge.relationType,
      });
    }
  }
}
