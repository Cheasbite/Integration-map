'use client';
import React, { useEffect, useState, useMemo } from "react";
import Image from "next/image";
import { MapPin, Plus, X } from "lucide-react";

type NodeType = "room" | "kiosk" | "waypoint";
type TeleporterType = "staircase" | "elevator" | "others";

interface NodeRow {
  id: string;
  type: NodeType;
  floorId: string;
  px: number;
  py: number;
  room: { name: string } | null;
  kiosk: { name: string } | null;
}

interface FloorRow {
  id: string;
  name: string;
  floorNumber: number;
  mapData: string | null;
  width: number;
  height: number;
  nodes: NodeRow[];
}

interface EdgeRow {
  id: string;
  fromNodeId: string;
  toNodeId: string;
  fromNode: NodeRow;
  toNode: NodeRow;
}

interface TeleporterRow {
  id: string;
  name: string;
  type: TeleporterType;
  stops: NodeRow[];
}

type Mode = "view" | "connect-nodes" | "connect-groups" | "add-waypoint";

function nodeName(node: NodeRow) {
  return node.room?.name ?? node.kiosk?.name ?? "Waypoint";
}

// pin color per node type. Waypoints are deliberately dim/neutral —
// they're corridor corners, not places, so they shouldn't compete
// visually with actual rooms/kiosks.
const NODE_COLORS: Record<NodeType, string> = {
  room: "text-blue-500",
  kiosk: "text-emerald-500",
  waypoint: "text-gray-400",
};

export default function MapPage() {
  const [floors, setFloors] = useState<FloorRow[]>([]);
  const [edges, setEdges] = useState<EdgeRow[]>([]);
  const [teleporters, setTeleporters] = useState<TeleporterRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedFloorId, setSelectedFloorId] = useState("");
  const [mode, setMode] = useState<Mode>("view");
  const [pendingNodeId, setPendingNodeId] = useState<string | null>(null);
  const [groupTargetFloorId, setGroupTargetFloorId] = useState("");
  const [groupTargetNodeId, setGroupTargetNodeId] = useState("");
  const [showAddFloor, setShowAddFloor] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Floors come from a real fetch now (not hardcoded) so a floor added
  // through the modal shows up in the dropdown immediately.
  const loadAll = async () => {
    setLoading(true);
    try {
      const [floorsRes, edgesRes, teleporterRes] = await Promise.all([
        fetch("/api/floors"),
        fetch("/api/edges"),
        fetch("/api/teleporters")
      ]);
      const floorsBody = await floorsRes.json();
      const edgesBody = await edgesRes.json();
      const teleportersBody = await teleporterRes.json()
      setFloors(floorsBody.data ?? []);
      setEdges(edgesBody.data ?? []);
      setTeleporters(teleportersBody.data ?? []);
    } catch (err) {
      console.error(err);
      setError("Failed to load map data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

  const selectedFloor = floors.find((f) => f.id === selectedFloorId) ?? null;

  // Same-floor edges only — these are the ones drawn as purple lines.
  // This is the only place in the whole app that renders edge lines,
  // so they never leak into the add-room/add-kiosk forms.
  const sameFloorEdges = useMemo(
    () =>
      edges.filter(
        (e) =>
          e.fromNode.floorId === selectedFloorId &&
          e.toNode.floorId === selectedFloorId
      ),
    [edges, selectedFloorId]
  );

  // Any node touching a cross-floor edge gets the black border.
  const teleporterNodeIds = useMemo(() => {
    const ids = new Set<string>();
    teleporters.forEach((group) => {
      group.stops.forEach((n) => ids.add(n.id));
    });
    return ids;
  }, [teleporters]);

  const handleFloorChange = (id: string) => {
    setSelectedFloorId(id);
    setMode("view");
    setPendingNodeId(null);
    setGroupTargetFloorId("");
    setGroupTargetNodeId("");
  };

  const createEdge = async (fromNodeId: string, toNodeId: string) => {
    setError(null);
    try {
      const res = await fetch("/api/edges", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fromNodeId, toNodeId }),
      });
      if (!res.ok) {
        const body = await res.json();
        throw new Error(
          body.error?.formErrors?.join(", ") ?? "Failed to connect nodes"
        );
      }
      await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    }
  };

  const handlePinClick = (node: NodeRow) => {
    if (mode === "view" || mode === "add-waypoint") return;

    if (mode === "connect-nodes") {
      if (!pendingNodeId) {
        setPendingNodeId(node.id);
        return;
      }
      if (pendingNodeId === node.id) {
        setPendingNodeId(null); // clicked the same pin again — end the chain
        return;
      }
      // Create the edge, then keep the just-clicked node as the new
      // pending node. This is what lets a sequence of clicks lay down
      // a whole corridor (Room -> Waypoint -> Waypoint -> Room) instead
      // of only ever connecting one pair before you have to restart.
      createEdge(pendingNodeId, node.id);
      setPendingNodeId(node.id);
      return;
    }

    if (mode === "connect-groups") {
      // Source is picked on the map; the target floor isn't rendered
      // here, so its node is picked via the dropdowns below instead.
      setPendingNodeId(node.id);
    }
  };

  // Only fires in "add-waypoint" mode, and only for clicks that land on
  // the map background — pins call stopPropagation so a click meant to
  // select a pin never accidentally drops a waypoint underneath it.
  const handleMapBackgroundClick = async (
    event: React.MouseEvent<HTMLDivElement>
  ) => {
    if (mode !== "add-waypoint" || !selectedFloor) return;

    const rect = event.currentTarget.getBoundingClientRect();
    const pctX = ((event.clientX - rect.left) / rect.width) * 100;
    const pctY = ((event.clientY - rect.top) / rect.height) * 100;
    const px = (pctX / 100) * selectedFloor.width;
    const py = (pctY / 100) * selectedFloor.height;

    setError(null);
    try {
      const res = await fetch("/api/nodes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ floorId: selectedFloor.id, px, py }),
      });
      if (!res.ok) {
        const body = await res.json();
        throw new Error(
          body.error?.formErrors?.join(", ") ?? "Failed to place waypoint"
        );
      }
      await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    }
  };

  const [teleporterName, setTeleporterName] = useState("");
  const [teleporterType, setTeleporterType] = useState<"elevator" | "staircase" | "others">("elevator");
  const [existingGroupId, setExistingGroupId] = useState(""); // "" = create new

  const handleCreateTeleporter = async () => {
    if (!pendingNodeId || !groupTargetNodeId) return;
    setError(null);

    try {
      if (existingGroupId) {
        // Adding a stop to an elevator/staircase that already exists —
        // both the source and target nodes join that group.
        await Promise.all([
          fetch(`/api/teleporters/${existingGroupId}/nodes`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ nodeId: pendingNodeId }),
          }),
          fetch(`/api/teleporters/${existingGroupId}/nodes`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ nodeId: groupTargetNodeId }),
          }),
        ]);
      } else {
        if (!teleporterName.trim()) {
          setError("Name the teleporter (e.g. 'Elevator A').");
          return;
        }
        const res = await fetch("/api/teleporters", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: teleporterName,
            type: teleporterType,
            nodeIds: [pendingNodeId, groupTargetNodeId],
          }),
        });
        if (!res.ok) {
          const body = await res.json();
          throw new Error(body.error?.formErrors?.join(", ") ?? "Failed to create teleporter");
        }
      }

      await loadAll();
      setPendingNodeId(null);
      setGroupTargetFloorId("");
      setGroupTargetNodeId("");
      setTeleporterName("");
      setExistingGroupId("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    }
  };

  const otherFloors = floors.filter((f) => f.id !== selectedFloorId);
  const targetFloorNodes =
    floors.find((f) => f.id === groupTargetFloorId)?.nodes ?? [];

  return (
    <div className="flex gap-6 p-6">
      {/* Left: floor + mode controls */}
      <div className="flex flex-col gap-4 w-56 shrink-0">
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium">Floor</label>
          <select
            value={selectedFloorId}
            onChange={(e) => handleFloorChange(e.target.value)}
            className="border rounded px-2 py-1"
          >
            <option value="">Select a floor…</option>
            {floors.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium">Mode</label>
          <select
            value={mode}
            onChange={(e) => {
              setMode(e.target.value as Mode);
              setPendingNodeId(null);
            }}
            disabled={!selectedFloorId}
            className="border rounded px-2 py-1 disabled:opacity-50"
          >
            <option value="view">View</option>
            <option value="connect-nodes">Connect Nodes</option>
            <option value="connect-groups">Connect Groups (teleporter)</option>
            <option value="add-waypoint">Add Waypoint</option>
          </select>
        </div>

        {mode === "connect-nodes" && (
          <p className="text-xs text-gray-500">
            {pendingNodeId
              ? "Click the next pin to continue the chain, or click the highlighted pin again to stop."
              : "Click a pin to start a connection."}
          </p>
        )}

        {mode === "add-waypoint" && (
          <p className="text-xs text-gray-500">
            Click anywhere on the map to drop a waypoint — a corridor
            corner with no name, used to bend a connection around walls.
          </p>
        )}

        {mode === "connect-groups" && (
          <div className="flex flex-col gap-2 border rounded p-2">
            <p className="text-xs text-gray-500">
              {pendingNodeId
                ? "Source picked. Choose the destination below."
                : "Click a pin on this floor to start a teleporter."}
            </p>
            {pendingNodeId && (
              <>
                {/* Step 1: pick the destination — a node on a DIFFERENT floor,
                    since that floor isn't rendered here for you to click into. */}
                <select
                  value={groupTargetFloorId}
                  onChange={(e) => {
                    setGroupTargetFloorId(e.target.value);
                    setGroupTargetNodeId("");
                  }}
                  className="border rounded px-2 py-1 text-sm"
                >
                  <option value="">Target floor…</option>
                  {otherFloors.map((f) => (
                    <option key={f.id} value={f.id}>{f.name}</option>
                  ))}
                </select>
                <select
                  value={groupTargetNodeId}
                  onChange={(e) => setGroupTargetNodeId(e.target.value)}
                  disabled={!groupTargetFloorId}
                  className="border rounded px-2 py-1 text-sm disabled:opacity-50"
                >
                  <option value="">Target node…</option>
                  {targetFloorNodes.map((n) => (
                    <option key={n.id} value={n.id}>{nodeName(n)}</option>
                  ))}
                </select>

                {/* Step 2: pick or create the named group this hop belongs to */}
                <select
                  value={existingGroupId}
                  onChange={(e) => setExistingGroupId(e.target.value)}
                  className="border rounded px-2 py-1 text-sm"
                >
                  <option value="">+ Create new teleporter</option>
                  {teleporters.map((g) => (
                    <option key={g.id} value={g.id}>{g.name}</option>
                  ))}
                </select>

                {!existingGroupId && (
                  <>
                    <input
                      value={teleporterName}
                      onChange={(e) => setTeleporterName(e.target.value)}
                      placeholder="Stair A"
                      className="border rounded px-2 py-1 text-sm"
                    />
                    <select
                      value={teleporterType}
                      onChange={(e) => setTeleporterType(e.target.value as any)}
                      className="border rounded px-2 py-1 text-sm"
                    >
                      <option value="elevator">Elevator</option>
                      <option value="staircase">Staircase</option>
                      <option value="other">Other</option>
                    </select>
                  </>
                )}

                <button
                  onClick={handleCreateTeleporter}
                  disabled={!groupTargetNodeId}
                  className="bg-black text-white rounded px-2 py-1 text-sm disabled:opacity-50"
                >
                  Create Teleporter
                </button>
              </>
            )}
          </div>
        )}

        <button
          onClick={() => setShowAddFloor(true)}
          className="flex items-center justify-center gap-1 border rounded px-2 py-1 text-sm"
        >
          <Plus size={16} /> Add Floor
        </button>

        {error && <p className="text-xs text-red-500">{error}</p>}
      </div>

      {/* Center: the map itself — empty until a floor is picked */}
      <div className="flex-1 min-h-[600px] flex items-center justify-center border rounded bg-gray-50">
        {loading ? (
          <p className="text-gray-400">Loading…</p>
        ) : !selectedFloor ? (
          <p className="text-gray-400">Select a floor to view its map</p>
        ) : (
          <div
            className="relative"
            style={{
              width: selectedFloor.width,
              height: selectedFloor.height,
              cursor: mode === "add-waypoint" ? "crosshair" : "default",
            }}
            onClick={handleMapBackgroundClick}
          >
            {selectedFloor.mapData && (
              <Image
                src={selectedFloor.mapData}
                alt={selectedFloor.name}
                width={selectedFloor.width}
                height={selectedFloor.height}
                draggable={false}
              />
            )}

            {/* Purple connection lines — same-floor edges only. This svg
                only exists on the Map page, so lines never show up on
                the add-room/add-kiosk forms. */}
            <svg
              viewBox={`0 0 ${selectedFloor.width} ${selectedFloor.height}`}
              className="absolute inset-0 w-full h-full pointer-events-none"
            >
              {sameFloorEdges.map((edge) => (
                <line
                  key={edge.id}
                  x1={edge.fromNode.px}
                  y1={edge.fromNode.py}
                  x2={edge.toNode.px}
                  y2={edge.toNode.py}
                  stroke="#a855f7"
                  strokeOpacity={0.5}
                  strokeWidth={3}
                />
              ))}
            </svg>

            {selectedFloor.nodes.map((node) => {
              const isTeleporter = teleporterNodeIds.has(node.id);
              const isPending = pendingNodeId === node.id;
              return (
                <button
                  key={node.id}
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation(); // don't let this bubble to the
                    // background handler and drop a waypoint under the pin
                    handlePinClick(node);
                  }}
                  title={nodeName(node)}
                  className={`absolute z-10 p-0.5 rounded-full ${NODE_COLORS[node.type]} ${
                    isTeleporter ? "border-2 border-black" : ""
                  } ${isPending ? "ring-2 ring-offset-1 ring-red-500" : ""}`}
                  style={{
                    left: `${(node.px / selectedFloor.width) * 100}%`,
                    top: `${(node.py / selectedFloor.height) * 100}%`,
                    transform: "translate(-50%, -50%)",
                    cursor: mode === "view" ? "default" : "pointer",
                  }}
                >
                  <MapPin fill="currentColor" />
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Right: info about the selected floor */}
      <div className="w-64 shrink-0 border rounded p-4 flex flex-col gap-3">
        {!selectedFloor ? (
          <p className="text-gray-400 text-sm">No floor selected</p>
        ) : (
          <>
            <div>
              <h3 className="font-semibold">{selectedFloor.name}</h3>
              <p className="text-xs text-gray-500">Floor {selectedFloor.floorNumber}</p>
              <p className="text-xs text-gray-500">
                {selectedFloor.width}×{selectedFloor.height}
              </p>
            </div>

            <div>
              <p className="text-sm font-medium mb-1">Nodes</p>
              <p className="text-xs text-gray-500">
                {selectedFloor.nodes.filter((n) => n.type === "room").length} rooms,{" "}
                {selectedFloor.nodes.filter((n) => n.type === "kiosk").length} kiosks
              </p>
            </div>

            <div>
              <p className="text-sm font-medium mb-1">Teleporter group</p>
              {(() => {
                // Groups that have at least one stop on this floor.
                const relevantGroups = teleporters.filter((g) =>
                  g.stops.some((n) => n.floorId === selectedFloorId)
                );

                if (relevantGroups.length === 0) {
                  return <p className="text-xs text-gray-500">No teleporters on this floor yet.</p>;
                }

                return (
                  <ul className="flex flex-col gap-2">
                    {relevantGroups.map((group) => {
                      const localStop = group.stops.find((n) => n.floorId === selectedFloorId);
                      const otherStops = group.stops.filter((n) => n.floorId !== selectedFloorId);

                      return (
                        <li key={group.id} className="text-xs border-l-2 border-black pl-2">
                          <span className="font-medium">{group.name}</span>{" "}
                          <span className="text-gray-400">({group.type})</span>
                          {otherStops.length === 0 ? (
                            <p className="text-gray-500">No other stops yet.</p>
                          ) : (
                            otherStops.map((stop) => {
                              const stopFloor = floors.find((f) => f.id === stop.floorId);
                              return (
                                <p key={stop.id}>
                                  {localStop ? nodeName(localStop) : "?"} → {nodeName(stop)}
                                  {stopFloor ? ` (${stopFloor.name})` : ""}
                                </p>
                              );
                            })
                          )}
                        </li>
                      );
                    })}
                  </ul>
                );
              })()}
            </div>
          </>
        )}
      </div>

      {showAddFloor && (
        <AddFloorModal
          onClose={() => setShowAddFloor(false)}
          onCreated={() => {
            setShowAddFloor(false);
            loadAll();
          }}
        />
      )}
    </div>
  );
}

function AddFloorModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => void;
}) {
  const [name, setName] = useState("");
  const [floorNumber, setFloorNumber] = useState("");
  const [mapData, setMapData] = useState("");
  const [width, setWidth] = useState("500");
  const [height, setHeight] = useState("500");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/floors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          floorNumber: Number(floorNumber),
          mapData,
          width: Number(width),
          height: Number(height),
        }),
      });
      if (!res.ok) {
        const body = await res.json();
        throw new Error(
          body.error?.formErrors?.join(", ") ?? "Failed to create floor"
        );
      }
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <form
        onSubmit={handleSubmit}
        className="bg-white rounded p-6 w-80 flex flex-col gap-3 relative"
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute top-2 right-2"
          aria-label="Close"
        >
          <X size={18} />
        </button>
        <h3 className="font-semibold">Add Floor</h3>

        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Second Floor"
          className="border rounded px-2 py-1 text-sm"
        />
        <input
          value={floorNumber}
          onChange={(e) => setFloorNumber(e.target.value)}
          placeholder="Floor number (e.g. 2)"
          type="number"
          className="border rounded px-2 py-1 text-sm"
        />
        <input
          value={mapData}
          onChange={(e) => setMapData(e.target.value)}
          placeholder="/maps/floor-2.svg"
          className="border rounded px-2 py-1 text-sm"
        />
        <div className="flex gap-2">
          <input
            value={width}
            onChange={(e) => setWidth(e.target.value)}
            type="number"
            className="border rounded px-2 py-1 text-sm w-1/2"
          />
          <input
            value={height}
            onChange={(e) => setHeight(e.target.value)}
            type="number"
            className="border rounded px-2 py-1 text-sm w-1/2"
          />
        </div>

        {error && <p className="text-xs text-red-500">{error}</p>}

        <button
          type="submit"
          disabled={submitting}
          className="bg-black text-white rounded px-3 py-2 text-sm disabled:opacity-50"
        >
          {submitting ? "Adding…" : "Add Floor"}
        </button>
      </form>
    </div>
  );
}

