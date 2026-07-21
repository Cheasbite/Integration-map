import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/lib/db";
import { edgesTable } from "@/lib/db/schema";

const createEdgeSchema = z
  .object({
    fromNodeId: z.string().uuid(),
    toNodeId: z.string().uuid(),
  })
  .refine((data) => data.fromNodeId !== data.toNodeId, {
    message: "Cannot connect a node to itself",
    path: ["toNodeId"],
  });

// GET /api/edges
// Returns every edge with both endpoints populated (including their
// room/kiosk name and floorId), so the Map page can decide client-side
// whether an edge is same-floor (draw a line) or cross-floor (teleporter).
export async function GET() {
  try {
    const edges = await db.query.edgesTable.findMany({
      with: {
        fromNode: { with: { room: true, kiosk: true } },
        toNode: { with: { room: true, kiosk: true } },
      },
    });

    return NextResponse.json({ data: edges }, { status: 200 });
  } catch (err) {
    console.error("GET /api/edges failed:", err);
    return NextResponse.json(
      { error: "Failed to fetch edges" },
      { status: 500 }
    );
  }
}

// POST /api/edges
// body: { fromNodeId: string, toNodeId: string }
// Whether this is a "same-floor connection" or a "teleporter" is not
// stored — it's derived by comparing fromNode.floorId to toNode.floorId
// wherever edges are read.
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = createEdgeSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { fromNodeId, toNodeId } = parsed.data;

    const [edge] = await db
      .insert(edgesTable)
      .values({ fromNodeId, toNodeId })
      .returning();

    return NextResponse.json({ data: edge }, { status: 201 });
  } catch (err) {
    console.error("POST /api/edges failed:", err);
    return NextResponse.json(
      { error: "Failed to create edge" },
      { status: 500 }
    );
  }
}

