import { NextRequest, NextResponse } from "next/server";
import { eq, param } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/lib/db";
import { nodesTable } from "@/lib/db/schema";

const addStopSchema = z.object({
  nodeId: z.string().uuid(),
});

// POST /api/teleporters/[id]/nodes
// body: { nodeId: string }
// Adds one more stop to an existing group — e.g. the elevator now also
// stops on Floor 3. Just reassigns that node's teleporterGroupId;
// nothing else in the graph changes.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const parsed = addStopSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const [node] = await db
      .update(nodesTable)
      .set({ teleporterGroupId: id })
      .where(eq(nodesTable.id, parsed.data.nodeId))
      .returning();

    return NextResponse.json({ data: node }, { status: 200 });
  } catch (err) {
    console.error("POST /api/teleporters/[id]/nodes failed:", err);
    return NextResponse.json(
      { error: "Failed to add stop to teleporter group" },
      { status: 500 }
    );
  }
}

