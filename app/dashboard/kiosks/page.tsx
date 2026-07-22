'use client';
import React, { useState, useRef, useEffect } from "react";
import Image from "next/image";
import { MapPin } from "lucide-react";

const MIN_SCALE = 0.5;
const MAX_SCALE = 3;
const DRAG_THRESHOLD = 5;

// Hardcoded for the demo — swap this for a fetch("/api/floors") call later.
// IMPORTANT: replace these ids with the real uuids Postgres returned when
// you POSTed your two floors earlier (check the curl response bodies).
const FLOORS = [
  {
    id: "019f8251-57ac-7549-b47a-e093c166ef84",
    name: "Ground Floor",
    mapSrc: "/map1.svg",
    width: 500,
    height: 500,
  },
  {
    id: "019f8251-e601-74e5-9033-17c3f54ddef1",
    name: "First Floor",
    mapSrc: "/map2.svg",
    width: 500,
    height: 500,
  },
  // Third floor: once you POST it via /api/floors, add one more entry
  // here — nothing else in this file needs to change.
  {
    id: "019f8258-3ca5-726a-a180-0ff30e4fe02f",
    name: "Third Floor",
    mapSrc: "/map3.svg",
    width: 500,
    height: 500,
  },
] as const;

interface PinPercent {
  xPct: number;
  yPct: number;
}

// Shape of an existing room/kiosk already on this floor, as returned by
// GET /api/floors?floorId=... (the `nodes` array, flattened a bit).
interface ExistingNode {
  id: string;
  name: string;
  type: "room" | "kiosk";
  px: number;
  py: number;
}

interface FloorMapPickerProps {
  mapSrc: string;
  width: number;
  height: number;
  existingNodes: ExistingNode[];
  onSelect: (px: number, py: number) => void;
}

// pin color per node type, so the one you're placing (red) stands out
// from what's already there.
const NODE_COLORS: Record<ExistingNode["type"], string> = {
  room: "text-blue-500",
  kiosk: "text-emerald-500",
};

// Reusable click-to-place map. Handles pan/zoom, and reports back a
// position in the SVG's *native* coordinate space (e.g. 0-500), not
// screen pixels — so the recorded value is stable no matter how
// zoomed in the user was when they clicked.
function FloorMapPicker({ mapSrc, width, height, existingNodes, onSelect }: FloorMapPickerProps) {
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [pin, setPin] = useState<PinPercent | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const containerImg = useRef<HTMLDivElement>(null);

  const isDragging = useRef(false);
  const hasMoved = useRef(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const offsetStart = useRef({ x: 0, y: 0 });

  // Reset pan/zoom/pin whenever the floor underneath this picker changes,
  // so switching floors doesn't leave a stale pin or zoomed-in view behind.
  useEffect(() => {
    setPin(null);
    setScale(1);
    setOffset({ x: 0, y: 0 });
  }, [mapSrc]);

  const handlePin = (cliX: number, cliY: number) => {
    const imgRect = containerImg.current?.getBoundingClientRect();
    if (!imgRect) return;

    const pX = cliX - imgRect.left;
    const pY = cliY - imgRect.top;

    if (pX < 0 || pX > imgRect.width || pY < 0 || pY > imgRect.height) return;

    // Percentage of the rendered box. imgRect already includes the
    // current zoom, so this ratio is scale-independent.
    const xPct = (pX / imgRect.width) * 100;
    const yPct = (pY / imgRect.height) * 100;
    setPin({ xPct, yPct });

    // Convert that zoom-independent percentage into the SVG's native
    // coordinate space (width/height, e.g. 500x500). This is the value
    // that actually gets saved — it means the same physical spot on
    // the map no matter what zoom level the user clicked at.
    const realX = (xPct / 100) * width;
    const realY = (yPct / 100) * height;
    onSelect(realX, realY);
  };

  const handleMouseDown = (event: React.MouseEvent<HTMLDivElement>) => {
    isDragging.current = true;
    hasMoved.current = false;
    dragStart.current = { x: event.clientX, y: event.clientY };
    offsetStart.current = offset;
  };

  const handleMouseMove = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!isDragging.current) return;
    const dx = event.clientX - dragStart.current.x;
    const dy = event.clientY - dragStart.current.y;

    if (Math.abs(dx) > DRAG_THRESHOLD || Math.abs(dy) > DRAG_THRESHOLD) {
      hasMoved.current = true;
    }
    setOffset({ x: offsetStart.current.x + dx, y: offsetStart.current.y + dy });
  };

  const handleMouseUp = (event: React.MouseEvent<HTMLDivElement>) => {
    isDragging.current = false;
    if (!hasMoved.current) {
      handlePin(event.clientX, event.clientY);
    }
  };

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleWheel = (event: WheelEvent) => {
      event.preventDefault();
      setScale((prev) => {
        const next = prev - event.deltaY * 0.001;
        return Math.min(MAX_SCALE, Math.max(MIN_SCALE, next));
      });
    };

    container.addEventListener("wheel", handleWheel, { passive: false });
    return () => container.removeEventListener("wheel", handleWheel);
  }, []);

  return (
    <div
      ref={containerRef}
      className="w-full max-w-md border-[4px] border-purple-400 overflow-hidden flex justify-center items-center relative"
      style={{ height: 320, cursor: "move" }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={() => { isDragging.current = false; }}
    >
      <div
        ref={containerImg}
        className="relative"
        style={{
          transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
          transition: isDragging.current ? "none" : "transform 0.05s linear",
        }}
      >
        <Image src={mapSrc} alt="floor map" width={width} height={height} draggable={false} />

        {/* Existing rooms/kiosks already on this floor — display only,
            no click handling, so they don't interfere with placing a new pin. */}
        {existingNodes.map((node) => (
          <div
            key={node.id}
            className={`absolute z-10 p-1 pointer-events-none ${NODE_COLORS[node.type]}`}
            style={{
              left: `${(node.px / width) * 100}%`,
              top: `${(node.py / height) * 100}%`,
              transform: `translate(-50%, -50%) scale(${1 / scale})`,
            }}
            title={node.name}
          >
            <MapPin fill="currentColor" />
          </div>
        ))}

        {pin && (
          <div
            className="absolute z-20 text-red-500 font-bold p-1"
            style={{
              left: `${pin.xPct}%`,
              top: `${pin.yPct}%`,
              transform: `translate(-50%, -50%) scale(${1 / scale})`,
            }}
          >
            <MapPin />
          </div>
        )}
      </div>
    </div>
  );
}

export default function AddRoomForm() {
  const [name, setName] = useState("");
  const [floorId, setFloorId] = useState("");
  const [position, setPosition] = useState<{ px: number; py: number } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [existingNodes, setExistingNodes] = useState<ExistingNode[]>([]);
  const [loadingNodes, setLoadingNodes] = useState(false);

  const selectedFloor = FLOORS.find((f) => f.id === floorId) ?? null;

  // Pull the floor's existing rooms/kiosks so the picker can show them
  // as reference points. Uses your real GET /api/floors?floorId=... route,
  // which already returns `nodes` with `room`/`kiosk` populated.
  const loadExistingNodes = async (id: string) => {
    setLoadingNodes(true);
    try {
      const res = await fetch(`/api/floors?floorId=${id}`);
      if (!res.ok) throw new Error("Failed to load existing rooms/kiosks");
      const body = await res.json();
      const floor = body.data?.[0];

      const nodes: ExistingNode[] = (floor?.nodes ?? [])
        .filter((n: any) => n.room || n.kiosk)
        .map((n: any) => ({
          id: n.id,
          name: n.room?.name ?? n.kiosk?.name,
          type: n.type,
          px: n.px,
          py: n.py,
        }));

      setExistingNodes(nodes);
    } catch (err) {
      // Non-fatal: the form still works without the reference pins.
      console.error(err);
      setExistingNodes([]);
    } finally {
      setLoadingNodes(false);
    }
  };

  const handleFloorChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const id = event.target.value;
    setFloorId(id);
    setPosition(null); // old pin belonged to a different floor's coordinate space
    setExistingNodes([]);
    if (id) loadExistingNodes(id);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);

    if (!name.trim()) return setError("Name is required.");
    if (!floorId) return setError("Select a floor.");
    if (!position) return setError("Click the map to place the room.");

    setSubmitting(true);
    try {
      const res = await fetch("/api/kiosks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, floorId, px: position.px, py: position.py }),
      });

      if (!res.ok) {
        const body = await res.json();
        throw new Error(
          body.error?.formErrors?.join(", ") ?? "Failed to create room"
        );
      }

      setName("");
      setPosition(null);
      if (floorId) loadExistingNodes(floorId); // show the just-added room right away
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 max-w-md">
      <div className="flex flex-col gap-1">
        <label htmlFor="room-name" className="text-sm font-medium">Name</label>
        <input
          id="room-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="border rounded px-2 py-1"
          placeholder="Cafeteria Kiosk"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="room-floor" className="text-sm font-medium">Floor</label>
        <select
          id="room-floor"
          value={floorId}
          onChange={handleFloorChange}
          className="border rounded px-2 py-1"
        >
          <option value="">Select a floor…</option>
          {FLOORS.map((floor) => (
            <option key={floor.id} value={floor.id}>{floor.name}</option>
          ))}
        </select>
      </div>

      {selectedFloor && (
        <div className="flex flex-col gap-1">
          <p className="text-sm font-medium">
            Click the map to place the room
            {loadingNodes && <span className="text-gray-400"> (loading existing…)</span>}
          </p>
          <FloorMapPicker
            mapSrc={selectedFloor.mapSrc}
            width={selectedFloor.width}
            height={selectedFloor.height}
            existingNodes={existingNodes}
            onSelect={(px, py) => setPosition({ px, py })}
          />
          {position && (
            <p className="text-xs text-gray-500 tabular-nums">
              Recorded position: x={position.px.toFixed(1)}, y={position.py.toFixed(1)}
            </p>
          )}
        </div>
      )}

      {error && <p className="text-sm text-red-500">{error}</p>}

      <button
        type="submit"
        disabled={submitting}
        className="bg-black text-white rounded px-3 py-2 disabled:opacity-50"
      >
        {submitting ? "Adding…" : "Add Kiosk"}
      </button>
    </form>
  );
}


