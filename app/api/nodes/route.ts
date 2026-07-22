import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/lib/db";
import { nodesTable } from "@/lib/db/schema";

// This route only ever creates "waypoint" type nodes. Rooms and kiosks
// keep going through /api/rooms and /api/kiosks, since those need the
// two-table transaction (nodesTable + their own name/details table).
// A waypoint has nothing beyond position, so a single insert is enough.
const createWaypointSchema = z.object({
  floorId: z.string().uuid(),
  px: z.number(),
  py: z.number(),
});

// POST /api/nodes
// body: { floorId: string, px: number, py: number }
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = createWaypointSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { floorId, px, py } = parsed.data;

    const [node] = await db
      .insert(nodesTable)
      .values({ type: "waypoint", floorId, px, py })
      .returning();

    return NextResponse.json({ data: node }, { status: 201 });
  } catch (err) {
    console.error("POST /api/nodes failed:", err);
    return NextResponse.json(
      { error: "Failed to create waypoint" },
      { status: 500 }
    );
  }
}

