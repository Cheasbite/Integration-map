import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/lib/db";
import { nodesTable, edgesTable, floorsTable, teleporterGroupsTable } from "@/lib/db/schema";
import { findShortestPath } from "@/lib/pathfinding";

const queryParamsSchema = z.object({
  from: z.string().uuid("from must be a valid uuid"),
  to: z.string().uuid("to must be a valid uuid"),
});

// GET /api/path?from=<nodeId>&to=<nodeId>
//
// Fetches every node and edge in the building (not just the current
// floor — a path might cross floors via a teleporter group) and runs
// Dijkstra over them. Returns the ordered list of node ids, plus enough
// detail on each to render pins and lines across whatever floors the
// path touches.
export async function GET(req: NextRequest) {
  try {
    const parsed = queryParamsSchema.safeParse({
      from: req.nextUrl.searchParams.get("from"),
      to: req.nextUrl.searchParams.get("to"),
    });

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.flatten() },
        { status: 400 }
      );
    }
    const { from, to } = parsed.data;

    // Pull the whole graph in a few flat queries. floorNumber is joined
    // in here (not just floorId) because staircase cost now scales with
    // how many floors apart two stops are.
    const [allNodes, allEdges, allGroups] = await Promise.all([
      db
        .select({
          id: nodesTable.id,
          floorId: nodesTable.floorId,
          px: nodesTable.px,
          py: nodesTable.py,
          teleporterGroupId: nodesTable.teleporterGroupId,
          floorNumber: floorsTable.floorNumber,
        })
        .from(nodesTable)
        .innerJoin(floorsTable, eq(nodesTable.floorId, floorsTable.id)),
      db
        .select({
          fromNodeId: edgesTable.fromNodeId,
          toNodeId: edgesTable.toNodeId,
        })
        .from(edgesTable),
      db
        .select({
          id: teleporterGroupsTable.id,
          type: teleporterGroupsTable.type,
        })
        .from(teleporterGroupsTable),
    ]);

    const startExists = allNodes.some((n) => n.id === from);
    const endExists = allNodes.some((n) => n.id === to);
    if (!startExists || !endExists) {
      return NextResponse.json(
        { error: "One or both node ids do not exist" },
        { status: 404 }
      );
    }

    const path = findShortestPath(allNodes, allEdges, allGroups, from, to);

    if (!path) {
      return NextResponse.json(
        { error: "No path exists between these nodes" },
        { status: 404 }
      );
    }

    // Return the full node objects along the path, in order, so the
    // frontend can draw pins/lines without a second round trip.
    const nodeById = new Map(allNodes.map((n) => [n.id, n]));
    const steps = path.map((id) => nodeById.get(id)!);

    return NextResponse.json({ data: { path: steps } }, { status: 200 });
  } catch (err) {
    console.error("GET /api/path failed:", err);
    return NextResponse.json(
      { error: "Failed to compute path" },
      { status: 500 }
    );
  }
}

