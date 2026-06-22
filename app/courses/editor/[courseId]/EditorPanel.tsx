// app/courses/editor/[courseId]/EditorPanel.tsx
"use client";

import { useState } from "react";

type Props = {
    courseId: string;
};

type EditorTab =
    | "course"
    | "holes"
    | "hole-editor"
    | "layouts"
    | "facilities"
    | "directions"
    | "contact"
    | "events"
    | "images"
    | "publish";

const TABS: { id: EditorTab; label: string }[] = [
    { id: "course", label: "Course" },
    { id: "holes", label: "Holes" },
    { id: "hole-editor", label: "Hole Editor" },
    { id: "layouts", label: "Layouts" },
    { id: "facilities", label: "Facilities" },
    { id: "directions", label: "Directions" },
    { id: "contact", label: "Contact" },
    { id: "events", label: "Events" },
    { id: "images", label: "Images" },
    { id: "publish", label: "Publish" },
];

export function EditorPanel({ courseId }: Props) {
    const [activeTab, setActiveTab] = useState<EditorTab>("course");

    return (
        <div className="flex h-full w-96 flex-col border-l border-slate-800 bg-slate-950">            {/* Tabs */}
            <div className="flex flex-wrap gap-1 border-b border-slate-800 bg-slate-900 px-2 py-2">
                {TABS.map((tab) => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`rounded-md px-2.5 py-1 text-xs font-semibold ${activeTab === tab.id
                            ? "bg-slate-100 text-slate-900"
                            : "bg-slate-800 text-slate-300 hover:bg-slate-700"
                            }`}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto px-3 py-3 text-sm text-slate-100">
                <div className="mb-2 text-[10px] uppercase tracking-wide text-slate-500">
                    Course ID: <span className="font-mono">{courseId}</span>
                </div>

                <div className="rounded-lg border border-slate-800 bg-slate-900/80 p-3">
                    <div className="text-xs font-semibold text-slate-300">
                        Active tab: <span className="font-mono">{activeTab}</span>
                    </div>
                    <p className="mt-2 text-xs text-slate-400">
                        Her kommer innholdet for <strong>{activeTab}</strong> etter hvert
                        (Course, Holes, Hole Editor, Layouts, osv.).
                    </p>
                </div>
            </div>
        </div>
    );
}
