"use client";

type Hole = {
    id: string;
    number: number;
};

type HoleListOverlayProps = {
    holes: Hole[];
    selectedHoleId: string | null;
    onSelect: (id: string) => void;
};

export default function HoleListOverlay({
    holes,
    selectedHoleId,
    onSelect,
}: HoleListOverlayProps) {
    return (
        <div className="absolute top-14 left-0 right-0 z-30">
            <div className="flex gap-2 overflow-x-auto bg-black/60 backdrop-blur-sm px-2 py-2">
                {holes.map((h: Hole) => (
                    <button
                        key={h.id}
                        onClick={() => onSelect(h.id)}
                        className={`px-3 py-1 rounded text-sm whitespace-nowrap ${h.id === selectedHoleId
                            ? "bg-white text-black font-bold"
                            : "bg-slate-700 text-slate-200"
                            }`}
                    >
                        {h.number}
                    </button>
                ))}
            </div>
        </div>
    );
}
