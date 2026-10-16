'use client';

import { useRef } from 'react';

const sections = [
    ['Choose a hole and mode', 'Select the hole you want to edit. Set Tee and Set Basket place or reposition those markers with a left-click on the map. Drag tee markers in Set Tee and basket markers in Set Basket. In Set Tee, the mouse wheel rotates the tee in 5° steps. Choose No mode for map navigation and inspection without moving geometry. Explicitly choosing a feature or feature tool starts feature editing.'],
    ['Set Points: build and move the fairway', 'Left-click empty map space to append a fairway point. Left-click an existing fairway point to select it and show its width handles; click the same selected point again to hide the handles without leaving Set Points. Clicking markers or handles does not add another point. Hold and drag the point to move it. Right-click an existing fairway point to delete it.'],
    ['Adjust fairway width', 'In Set Points, select a fairway point, then hold and drag either side handle. Both sides use the same distance from the center point. The temporary meter label shows the full width, not just one side. Release the mouse over the map to finish that drag. You can adjust widths while building the fairway; you do not need to finish placing every point. Set valid tee and basket positions first. Handles also require a usable direction from the surrounding points.'],
    ['Leave width editing', 'Releasing the mouse ends the drag, but the point and handles remain selected. Click the selected point again, press Escape, or choose another mode to hide the handles. Escape keeps Set Points active and preserves edits. Choosing No mode also attempts to save the current hole. Clicking empty map space in Set Points adds a point; it does not exit width editing. Escape clears the fairway selection, not your edits or an unfinished feature drawing. An open dialog handles Escape first.'],
    ['OB and hazard features', 'Open FEATURES. OB AREA and HAZARD AREA need at least three map points; OB LINE needs at least two. Click Finish to create and save the feature, or Cancel to discard only the unfinished feature drawing. Select an OB line to choose its OB side, viewed from tee toward basket.'],
    ['Mando, dropzone and information', 'MANDO and DROPZONE are placed and saved with one map click. Select a mando to choose the required passing side, or select a second mando and use Pair for a double mando. INFO creates an information feature without map geometry; add its text with Save comment.'],
    ['Edit existing features', 'Select a feature on the map or under Current features. Drag its visible vertices to correct its geometry; changes save when the drag ends. Use Save comment for rule text. Delete asks for confirmation. Shared feature deletion affects every hole using it; Remove from Hole detaches it only from the current hole.'],
    ['Add Alternate Hole', 'Under FEATURES, choose Add Alternate Hole. Choose Reuse existing tee/basket, or Create new tee/basket and click empty map space to position a separate point. Give new points names. Existing points remain visible and are not moved. Reused points keep their existing IDs; points used by this hole appear first. The isolated preview has no intermediate fairway points. A cyan border highlights selected endpoints. New unsaved points are neutral until assigned by the server. Save creates a configuration of the same numbered hole; Cancel leaves your previous editor view and edits unchanged. Existing combinations cannot be added again through this panel. Stable labels such as 1A, 1B and 1C appear when server numbering is available. Layouts choose configurations separately; creating an alternate does not change a layout. Add New Hole instead creates an additional numbered hole.'],
    ['Marker colors and layouts', 'Square markers identify TEE and BASKET. Stable B is blue and C is red. Main A retains its primary icons. A shared point is drawn once: main usage takes priority, otherwise the lowest stable ordinal determines its color. Marker details list its configurations. Unknown numbering and later alternatives use neutral styling. Course overview shows available configurations; public viewers see main and published-layout alternatives. A selected layout shows only its assigned configurations.'],
    ['Variations and hole information', 'Select Variation changes the tee/basket configuration. Save current map edits first: switching variations warns that unsaved changes will be discarded. Edit par and Configuration details provide the existing par, tee, basket and distance controls. The variation form has its own Save and Cancel buttons. Add New Hole creates another hole.'],
    ['Save and cancel', 'Use Save Hole to persist tee, basket, fairway and hole edits, and check the save message. Switching holes or going from an active placement mode to No mode also attempts a save. Feature creation, feature changes and variation forms have their own save actions. Undo is not available. Cancel applies only to the unfinished feature drawing or the variation form; it does not roll back map edits. Opening or closing this guide does not save, discard or change your edits. Close Help with the Close button or Escape; Escape here closes only this guide.'],
] as const;

export default function HoleEditorHelp() {
    const dialog = useRef<HTMLDialogElement>(null);
    return <div onClick={event => event.stopPropagation()} onPointerDown={event => event.stopPropagation()} onMouseDown={event => event.stopPropagation()}>
        <button type="button" aria-label="Open Hole Editor Help" title="Hole Editor Help"
            onClick={() => dialog.current?.showModal()}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-cyan-300/40 bg-slate-800 text-lg font-semibold text-cyan-200 hover:bg-slate-700 focus-visible:outline-2 focus-visible:outline-cyan-300">?</button>
        <dialog ref={dialog} aria-labelledby="hole-editor-help-title"
            onKeyDown={event => event.stopPropagation()}
            className="m-auto max-h-[85dvh] w-[calc(100%_-_2rem)] max-w-xl overflow-y-auto rounded-2xl border border-slate-600 bg-slate-950 p-0 text-slate-100 shadow-2xl backdrop:bg-black/60">
            <header className="sticky top-0 flex items-center justify-between gap-4 border-b border-white/10 bg-slate-950 p-4">
                <h2 id="hole-editor-help-title" className="text-lg font-semibold">Hole Editor Help</h2>
                <button type="button" autoFocus onClick={() => dialog.current?.close()} className="min-h-11 rounded-lg border border-white/20 px-3 text-sm hover:bg-white/10">Close</button>
            </header>
            <div className="space-y-5 p-5">{sections.map(([title, description]) => <section key={title}>
                <h3 className="mb-1 text-sm font-semibold text-cyan-200">{title}</h3>
                <p className="text-sm leading-relaxed text-slate-300">{description}</p>
            </section>)}</div>
        </dialog>
    </div>;
}
