import {
  ArrowClockwise,
  ArrowsIn,
  ArrowsOut,
  Crosshair,
  MagnifyingGlass,
  X,
} from "@phosphor-icons/react";
import { useTRPC } from "@renderer/trpc";
import { useQuery } from "@tanstack/react-query";
import { logger } from "@utils/logger";
import { AnimatePresence, motion } from "framer-motion";
import Graph from "graphology";
import FA2Layout from "graphology-layout-forceatlas2/worker";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Sigma from "sigma";
import { EdgeArrowProgram } from "sigma/rendering";

const log = logger.scope("brain-graph");

// -- Types (aligned with agent memory system) --

type MemoryNodeType =
  | "fact"
  | "preference"
  | "decision"
  | "identity"
  | "event"
  | "observation"
  | "goal"
  | "todo";

type RelationEdgeType =
  | "related_to"
  | "updates"
  | "contradicts"
  | "caused_by"
  | "result_of"
  | "part_of";

interface MemoryNode {
  id: string;
  content: string;
  memoryType: string;
  importance: number;
  createdAt: string;
  updatedAt: string;
  lastAccessedAt: string;
  accessCount: number;
  source: string | null;
  forgotten: boolean;
}

interface AssociationEdge {
  id: string;
  sourceId: string;
  targetId: string;
  relationType: string;
  weight: number;
  createdAt: string;
}

interface NodeDetail {
  node: MemoryNode;
  x: number;
  y: number;
}

// -- Constants --

const NODE_COLORS: Record<MemoryNodeType, string> = {
  identity: "#3b82f6",
  goal: "#f97316",
  decision: "#f59e0b",
  todo: "#a855f7",
  preference: "#06b6d4",
  fact: "#22c55e",
  event: "#ec4899",
  observation: "#8b5cf6",
};

const EDGE_COLORS: Record<RelationEdgeType, string> = {
  related_to: "#555555",
  updates: "#60a5fa",
  contradicts: "#f87171",
  caused_by: "#4ade80",
  result_of: "#fb923c",
  part_of: "#a78bfa",
};

const FADED_NODE_COLOR = "#333333";

// -- Component --

export function BrainGraph() {
  const containerRef = useRef<HTMLDivElement>(null);
  const sigmaRef = useRef<Sigma | null>(null);
  const graphRef = useRef<Graph | null>(null);
  const layoutRef = useRef<FA2Layout | null>(null);
  const [nodeCount, setNodeCount] = useState(0);
  const [edgeCount, setEdgeCount] = useState(0);
  const [selectedNode, setSelectedNode] = useState<NodeDetail | null>(null);
  const [_hoveredNode, setHoveredNode] = useState<string | null>(null);
  const hoveredNodeRef = useRef<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeNodeTypes, setActiveNodeTypes] = useState<Set<MemoryNodeType>>(
    () => new Set(),
  );
  const [activeEdgeTypes, setActiveEdgeTypes] = useState<Set<RelationEdgeType>>(
    () => new Set(),
  );
  const searchInputRef = useRef<HTMLInputElement>(null);
  const visibleNodesRef = useRef<Set<string> | null>(null);
  const visibleEdgesRef = useRef<Set<string> | null>(null);

  const trpc = useTRPC();
  const { data: graphData, isLoading } = useQuery(
    trpc.memory.graph.queryOptions({ limit: 200 }),
  );

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

  const toggleNodeType = useCallback((type: MemoryNodeType) => {
    setActiveNodeTypes((prev) => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
  }, []);

  const toggleEdgeType = useCallback((type: RelationEdgeType) => {
    setActiveEdgeTypes((prev) => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
  }, []);

  useEffect(() => {
    const graph = graphRef.current;
    if (!graph) return;

    const hasSearch = searchQuery.length > 0;
    const hasNodeFilter = activeNodeTypes.size > 0;
    const hasEdgeFilter = activeEdgeTypes.size > 0;

    if (!hasSearch && !hasNodeFilter && !hasEdgeFilter) {
      visibleNodesRef.current = null;
      visibleEdgesRef.current = null;
      sigmaRef.current?.refresh();
      return;
    }

    const filterSets: Set<string>[] = [];

    if (hasSearch) {
      const query = searchQuery.toLowerCase();
      const directMatches = new Set<string>();
      const searchVisible = new Set<string>();

      graph.forEachNode((node, attrs) => {
        const data = attrs.nodeData as MemoryNode;
        if (data.content.toLowerCase().includes(query)) {
          directMatches.add(node);
          searchVisible.add(node);
        }
      });

      for (const node of directMatches) {
        graph.forEachNeighbor(node, (neighbor) => {
          searchVisible.add(neighbor);
        });
      }

      filterSets.push(searchVisible);
    }

    if (hasNodeFilter) {
      const typeVisible = new Set<string>();
      graph.forEachNode((node, attrs) => {
        const data = attrs.nodeData as MemoryNode;
        if (activeNodeTypes.has(data.memoryType as MemoryNodeType)) {
          typeVisible.add(node);
        }
      });
      filterSets.push(typeVisible);
    }

    if (hasEdgeFilter) {
      const edgeNodeVisible = new Set<string>();
      graph.forEachEdge((_edge, attrs, source, target) => {
        if (activeEdgeTypes.has(attrs.relationType as RelationEdgeType)) {
          edgeNodeVisible.add(source);
          edgeNodeVisible.add(target);
        }
      });
      filterSets.push(edgeNodeVisible);
    }

    let visibleNodes: Set<string>;
    if (filterSets.length === 1) {
      visibleNodes = filterSets[0];
    } else {
      const smallest = filterSets.reduce((a, b) => (a.size < b.size ? a : b));
      visibleNodes = new Set<string>();
      for (const node of smallest) {
        if (filterSets.every((s) => s.has(node))) {
          visibleNodes.add(node);
        }
      }
    }

    const visibleEdges = new Set<string>();
    graph.forEachEdge((edge, attrs, source, target) => {
      const endpointsVisible =
        visibleNodes.has(source) && visibleNodes.has(target);
      const passesEdgeFilter =
        !hasEdgeFilter ||
        activeEdgeTypes.has(attrs.relationType as RelationEdgeType);

      if (endpointsVisible && passesEdgeFilter) {
        visibleEdges.add(edge);
      }
    });

    visibleNodesRef.current = visibleNodes;
    visibleEdgesRef.current = visibleEdges;
    sigmaRef.current?.refresh();
  }, [searchQuery, activeNodeTypes, activeEdgeTypes]);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (
        e.key === "/" &&
        !e.metaKey &&
        !e.ctrlKey &&
        document.activeElement?.tagName !== "INPUT"
      ) {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
      if (
        e.key === "Escape" &&
        document.activeElement === searchInputRef.current
      ) {
        setSearchQuery("");
        searchInputRef.current?.blur();
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  useEffect(() => {
    if (!containerRef.current || !graphData) return;

    cleanup();
    setSelectedNode(null);

    const graph = new Graph({ multi: false, type: "directed" });
    graphRef.current = graph;

    for (const node of graphData.nodes) {
      const size = 3 + node.importance * 8;
      graph.addNode(node.id, {
        label: truncateLabel(node.content),
        size,
        color: NODE_COLORS[node.memoryType as MemoryNodeType] ?? "#666666",
        x: Math.random() * 100,
        y: Math.random() * 100,
        nodeData: node,
      });
    }

    addEdgesToGraph(graph, graphData.edges);

    setNodeCount(graph.order);
    setEdgeCount(graph.size);

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
        const visible = visibleNodesRef.current;
        if (visible && !visible.has(node)) {
          res.color = FADED_NODE_COLOR;
          res.label = "";
          return res;
        }
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
      edgeReducer: (edge, data) => {
        const res = { ...data };
        const visible = visibleEdgesRef.current;
        if (visible && !visible.has(edge)) {
          res.color = FADED_NODE_COLOR;
        }
        return res;
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

    log.info("Brain graph loaded", {
      nodes: graphData.nodes.length,
      edges: graphData.edges.length,
    });

    return () => {
      cleanup();
    };
  }, [graphData, cleanup]);

  useEffect(() => {
    const sigma = sigmaRef.current;
    if (!sigma) return;

    function handleClickNode({ node }: { node: string }) {
      const graph = graphRef.current;
      const s = sigmaRef.current;
      if (!graph || !s) return;

      const attrs = graph.getNodeAttributes(node);
      const nodeData = attrs.nodeData as MemoryNode | undefined;
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
  });

  const nodeTypeEntries = useMemo(
    () => Object.entries(NODE_COLORS) as [MemoryNodeType, string][],
    [],
  );
  const edgeTypeEntries = useMemo(
    () => Object.entries(EDGE_COLORS) as [RelationEdgeType, string][],
    [],
  );

  const selectedColor = selectedNode
    ? (NODE_COLORS[selectedNode.node.memoryType as MemoryNodeType] ?? "#666666")
    : "#666666";

  return (
    <div className="relative h-full w-full">
      {/* Search + Stats */}
      <div className="absolute top-3 left-3 z-10 flex flex-col gap-1.5">
        <div className="flex items-center gap-2 rounded-md bg-[--color-panel-solid] px-2 py-1.5">
          <MagnifyingGlass size={14} className="shrink-0 text-[--gray-a9]" />
          <input
            ref={searchInputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search nodes..."
            className="w-40 bg-transparent text-[--gray-12] text-xs outline-none placeholder:text-[--gray-a6]"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="shrink-0 text-[--gray-a9] transition-colors hover:text-[--gray-12]"
            >
              <X size={12} />
            </button>
          )}
        </div>
        <div className="flex items-center gap-3 rounded-md bg-[--color-panel-solid] px-3 py-1.5 text-[--gray-a9] text-xs">
          <span>{nodeCount} nodes</span>
          <span className="text-[--gray-a6]">|</span>
          <span>{edgeCount} edges</span>
        </div>
      </div>

      {/* Legend */}
      <div className="absolute bottom-3 left-3 z-10 rounded-md bg-[--color-panel-solid] p-3">
        <div className="mb-2 font-medium text-[--gray-a9] text-xs">
          Memory Types
        </div>
        <div className="grid grid-cols-2 gap-x-4 gap-y-0.5">
          {nodeTypeEntries.map(([type, color]) => (
            <button
              key={type}
              type="button"
              onClick={() => toggleNodeType(type)}
              className={`flex cursor-pointer items-center gap-1.5 rounded px-2 py-0.5 text-left transition-all hover:bg-[--gray-a3] ${activeNodeTypes.has(type) ? "bg-[--gray-a3]" : ""}`}
              style={{
                opacity:
                  activeNodeTypes.size > 0 && !activeNodeTypes.has(type)
                    ? 0.3
                    : 1,
              }}
            >
              <span
                className="inline-block h-2 w-2 shrink-0 rounded-full"
                style={{ backgroundColor: color }}
              />
              <span className="text-[--gray-a9] text-xs">{type}</span>
            </button>
          ))}
        </div>
        <div className="mt-2 border-[--gray-a4] border-t pt-2">
          <div className="mb-1 font-medium text-[--gray-a9] text-xs">
            Relation Types
          </div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-0.5">
            {edgeTypeEntries.map(([type, color]) => (
              <button
                key={type}
                type="button"
                onClick={() => toggleEdgeType(type)}
                className={`flex cursor-pointer items-center gap-1.5 rounded px-2 py-0.5 text-left transition-all hover:bg-[--gray-a3] ${activeEdgeTypes.has(type) ? "bg-[--gray-a3]" : ""}`}
                style={{
                  opacity:
                    activeEdgeTypes.size > 0 && !activeEdgeTypes.has(type)
                      ? 0.3
                      : 1,
                }}
              >
                <span
                  className="inline-block h-0.5 w-3 shrink-0"
                  style={{
                    backgroundColor: color,
                    borderStyle: type === "contradicts" ? "dashed" : "solid",
                  }}
                />
                <span className="text-[--gray-a9] text-xs">
                  {type.replace(/_/g, " ")}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="absolute top-3 right-3 z-10 flex flex-col gap-1.5">
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
            className="absolute right-3 bottom-3 z-20 w-72 rounded-lg border border-[--gray-a4] bg-[--color-panel-solid] p-4 shadow-xl"
          >
            <div className="mb-2 flex items-center justify-between">
              <span
                className="rounded px-1.5 py-0.5 font-medium text-xs"
                style={{
                  backgroundColor: `${selectedColor}22`,
                  color: selectedColor,
                }}
              >
                {selectedNode.node.memoryType}
              </span>
              <button
                type="button"
                onClick={() => setSelectedNode(null)}
                className="flex h-6 w-6 items-center justify-center rounded text-[--gray-a9] transition-colors hover:text-[--gray-12]"
              >
                <X size={12} />
              </button>
            </div>
            <p className="mb-3 max-h-32 overflow-y-auto whitespace-pre-wrap text-[--gray-a11] text-sm leading-relaxed">
              {selectedNode.node.content}
            </p>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-[--gray-a9] text-xs">
              <span>Importance: {selectedNode.node.importance.toFixed(2)}</span>
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

      {/* Loading / empty states */}
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="flex items-center gap-2 text-[--gray-a9]">
            <div className="h-2 w-2 animate-pulse rounded-full bg-[--accent-9]" />
            Loading graph...
          </div>
        </div>
      )}
      {!isLoading && graphData && graphData.nodes.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center text-[--gray-a9]">
            <p className="text-sm">No memories yet</p>
            <p className="mt-1 text-xs">
              Memories will appear here as agents work on tasks
            </p>
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

function addEdgesToGraph(graph: Graph, edges: AssociationEdge[]) {
  for (const edge of edges) {
    if (
      graph.hasNode(edge.sourceId) &&
      graph.hasNode(edge.targetId) &&
      !graph.hasEdge(edge.id) &&
      !graph.hasDirectedEdge(edge.sourceId, edge.targetId)
    ) {
      graph.addEdgeWithKey(edge.id, edge.sourceId, edge.targetId, {
        color: EDGE_COLORS[edge.relationType as RelationEdgeType] ?? "#444444",
        size: 1 + edge.weight * 2,
        type: "arrow",
        relationType: edge.relationType,
      });
    }
  }
}
