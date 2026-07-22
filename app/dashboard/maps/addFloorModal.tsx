'use client';
import { useState } from "react";
import { X } from 'lucide-react';

export function AddFloorModal({
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

