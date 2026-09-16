"use client";
import { useEffect, useRef, type ReactNode } from 'react';

export default function CommunityModal({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) {
    const ref = useRef<HTMLDialogElement>(null);
    useEffect(() => {
        const previous = document.activeElement as HTMLElement | null;
        const dialog = ref.current;
        dialog?.showModal();
        return () => { dialog?.close(); previous?.focus(); };
    }, []);
    return <dialog ref={ref} aria-label={title} onCancel={(e) => { e.preventDefault(); onClose(); }} className="m-auto max-h-[90dvh] w-[calc(100%-2rem)] max-w-lg overflow-y-auto rounded-2xl border border-white/20 bg-[#101e1c] p-5 text-white shadow-2xl backdrop:bg-black/75">
        <div className="mb-4 flex items-center justify-between gap-3"><h2 className="text-xl font-semibold">{title}</h2><button type="button" onClick={onClose} aria-label="Close dialog" className="rounded-lg p-3 hover:bg-white/10">✕</button></div>{children}
    </dialog>;
}
