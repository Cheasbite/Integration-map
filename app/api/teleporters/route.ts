import { NextRequest, NextResponse } from "next/server";
import { eq, inArray } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/lib/db";
import { teleporterGroupsTable, nodesTable } from "@/lib/db/schema";

const createTeleporterSchema = z.object({
  name: z.string().min(1, "name is required"),
  type: z.enum(["elevator", "staircase", "others"]),
  nodeIds: z.array(z.string().uuid()).min(2, "a teleporter needs at least 2 stops"),
});

// GET /api/teleporters
// Every group with its member nodes populated — this is what the Map
// page uses to know which nodes get the black "in a group" border,
// and to show "Elevator A ties to Floor 2" in the side panel.
export async function GET() {
  try {
    const groups = await db.query.teleporterGroupsTable.findMany({
      with: { stops: { with: { room: true, kiosk: true, } } },
    });
    return NextResponse.json({ data: groups }, { status: 200 });
  } catch (err) {
    console.error("GET /api/teleporters failed:", err);
    return NextResponse.json(
      { error: "Failed to fetch teleporter groups" },
      { status: 500 }
    );
  }
}

// POST /api/teleporters
// body: { name: string, type: "elevator" | "staircase" | "other", nodeIds: string[] }
//
// Creates a new named group AND assigns every listed node's
// teleporterGroupId in one transaction — this replaces the old
// createEdge(...) call for "Connect Groups" mode entirely. No row is
// ever written to edgesTable for this; membership alone is enough for
// pathfinding.ts to treat these nodes as directly reachable.
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = createTeleporterSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.flatten() },
        { status: 400 }
      );
    }
    const { name, type, nodeIds } = parsed.data;

    const group = await db.transaction(async (tx) => {
      const [created] = await tx
        .insert(teleporterGroupsTable)
        .values({ name, type })
        .returning();

      await tx
        .update(nodesTable)
        .set({ teleporterGroupId: created.id })
        .where(inArray(nodesTable.id, nodeIds));

      return created;
    });

    return NextResponse.json({ data: group }, { status: 201 });
  } catch (err) {
    console.error("POST /api/teleporters failed:", err);
    return NextResponse.json(
      { error: "Failed to create teleporter group" },
      { status: 500 }
    );
  }
}

