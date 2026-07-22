// pathfinding.ts
//
// Builds a weighted adjacency list from two sources:
//   1. Real edges (rooms/kiosks/waypoints connected by a drawn line).
//      Cost = straight-line pixel distance between the two nodes —
//      only meaningful because both ends are on the SAME floor, so
//      their px/py share one coordinate space.
//   2. Teleporter group membership (any two nodes with the same
//      teleporterGroupId are directly reachable — no edge row needed).
//      Cost = a fixed penalty, since "distance" between floors isn't
//      spatial the way a hallway is. Tune TELEPORTER_COST per group
//      type later if you want stairs to cost more than the elevator.

interface NodeLite {
  id: string;
  floorId: string;
  px: number;
  py: number;
  teleporterGroupId: string | null;
  floorNumber: number; // needed so staircase cost can scale with distance
}

interface TeleporterGroupLite {
  id: string;
  type: "elevator" | "staircase" | "others";
}

interface EdgeLite {
  fromNodeId: string;
  toNodeId: string;
}

const ELEVATOR_COST = 150;      // flat — a ride doesn't get much slower per floor
const COST_PER_FLIGHT = 80;     // staircase cost scales with floors climbed
const OTHER_COST = 150;

function distance(a: NodeLite, b: NodeLite) {
  return Math.sqrt((a.px - b.px) ** 2 + (a.py - b.py) ** 2);
}

function teleporterCost(
  groupType: TeleporterGroupLite["type"],
  a: NodeLite,
  b: NodeLite
) {
  if (groupType === "staircase") {
    const flights = Math.abs(a.floorNumber - b.floorNumber) || 1;
    return COST_PER_FLIGHT * flights;
  }
  if (groupType === "elevator") return ELEVATOR_COST;
  return OTHER_COST;
}

function buildAdjacency(
  nodes: NodeLite[],
  edges: EdgeLite[],
  groups: TeleporterGroupLite[]
) {
  const nodeById = new Map(nodes.map((n) => [n.id, n]));
  const groupTypeById = new Map(groups.map((g) => [g.id, g.type]));
  const adjacency = new Map<string, { to: string; cost: number }[]>();

  const addLink = (fromId: string, toId: string, cost: number) => {
    if (!adjacency.has(fromId)) adjacency.set(fromId, []);
    adjacency.get(fromId)!.push({ to: toId, cost });
  };

  // 1. Real edges — bidirectional, weighted by pixel distance.
  for (const edge of edges) {
    const from = nodeById.get(edge.fromNodeId);
    const to = nodeById.get(edge.toNodeId);
    if (!from || !to) continue;
    const cost = distance(from, to);
    addLink(from.id, to.id, cost);
    addLink(to.id, from.id, cost);
  }

  // 2. Teleporter groups — every stop is directly reachable from every
  // other stop in the same group, in both directions. Cost depends on
  // the group's type: flat for elevators, scaled by floors-apart for
  // staircases (climbing Ground -> 3rd costs ~3x Ground -> 1st).
  const groupStops = new Map<string, NodeLite[]>();
  for (const node of nodes) {
    if (!node.teleporterGroupId) continue;
    if (!groupStops.has(node.teleporterGroupId)) {
      groupStops.set(node.teleporterGroupId, []);
    }
    groupStops.get(node.teleporterGroupId)!.push(node);
  }
  for (const [groupId, stops] of groupStops) {
    const groupType = groupTypeById.get(groupId) ?? "others";
    for (const a of stops) {
      for (const b of stops) {
        if (a.id !== b.id) addLink(a.id, b.id, teleporterCost(groupType, a, b));
      }
    }
  }

  return adjacency;
}

// Dijkstra over the combined adjacency list. Returns the ordered list
// of node ids to walk, or null if no path exists (e.g. two nodes on
// disconnected floors with no shared teleporter group).
export function findShortestPath(
  nodes: NodeLite[],
  edges: EdgeLite[],
  groups: TeleporterGroupLite[],
  startId: string,
  endId: string
): string[] | null {
  const adjacency = buildAdjacency(nodes, edges, groups);
  const dist = new Map<string, number>();
  const prev = new Map<string, string>();
  const visited = new Set<string>();

  nodes.forEach((n) => dist.set(n.id, Infinity));
  dist.set(startId, 0);

  // Simple array-based priority queue — fine for a building's worth
  // of nodes. Swap for a binary heap only if node counts get huge.
  while (visited.size < nodes.length) {
    let current: string | null = null;
    let currentDist = Infinity;
    for (const [id, d] of dist) {
      if (!visited.has(id) && d < currentDist) {
        current = id;
        currentDist = d;
      }
    }
    if (current === null) break; // remaining nodes are unreachable
    if (current === endId) break; // shortest path to target is finalized

    visited.add(current);

    for (const { to, cost } of adjacency.get(current) ?? []) {
      if (visited.has(to)) continue;
      const alt = currentDist + cost;
      if (alt < (dist.get(to) ?? Infinity)) {
        dist.set(to, alt);
        prev.set(to, current);
      }
    }
  }

  if (!dist.has(endId) || dist.get(endId) === Infinity) return null;

  // Walk `prev` backwards from end to start, then reverse.
  const path: string[] = [];
  let step: string | undefined = endId;
  while (step !== undefined) {
    path.unshift(step);
    step = prev.get(step);
  }
  return path[0] === startId ? path : null;
}

