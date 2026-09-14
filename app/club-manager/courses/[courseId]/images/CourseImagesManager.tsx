"use client";

import Image from "next/image";
import { ChangeEvent, useRef, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase-browser";

type CourseImage = { id: string; image_url: string; description: string | null; sort_order: number };
const ACCEPTED_TYPES = new Map([["image/jpeg", "jpg"], ["image/png", "png"], ["image/webp", "webp"]]);
const MAX_FILE_SIZE = 10 * 1024 * 1024;

export default function CourseImagesManager({ courseId, initialImages }: { courseId: string; initialImages: CourseImage[] }) {
    const inputRef = useRef<HTMLInputElement>(null);
    const [images, setImages] = useState(initialImages);
    const [uploading, setUploading] = useState(false);
    const [busyId, setBusyId] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [notice, setNotice] = useState<string | null>(null);

    async function upload(event: ChangeEvent<HTMLInputElement>) {
        const file = event.target.files?.[0];
        event.target.value = "";
        if (!file || uploading) return;
        const extension = ACCEPTED_TYPES.get(file.type);
        if (!extension) return setError("Choose a JPEG, PNG or WebP image.");
        if (file.size > MAX_FILE_SIZE) return setError("Images must be 10 MB or smaller.");
        setUploading(true); setError(null); setNotice(null);
        const storagePath = `${courseId}/${crypto.randomUUID()}.${extension}`;
        const uploaded = await supabaseBrowser.storage.from("course-images").upload(storagePath, file, { contentType: file.type, upsert: false });
        if (uploaded.error) { setError("Upload failed. Your gallery was not changed."); setUploading(false); return; }
        const imageUrl = supabaseBrowser.storage.from("course-images").getPublicUrl(storagePath).data.publicUrl;
        const registered = await supabaseBrowser.rpc("register_course_image_v1", {
            p_course_id: courseId, p_image_url: imageUrl, p_storage_path: storagePath, p_description: null,
        });
        if (registered.error || !registered.data?.[0]) {
            await supabaseBrowser.storage.from("course-images").remove([storagePath]);
            setError("The image could not be added. Please try again."); setUploading(false); return;
        }
        setImages((current) => [...current, registered.data[0] as CourseImage]);
        setNotice("Image added."); setUploading(false);
    }

    async function saveDescription(image: CourseImage, description: string) {
        if (busyId) return;
        setBusyId(image.id); setError(null); setNotice(null);
        const { error: updateError } = await supabaseBrowser.from("course_images").update({ description: description.trim() || null })
            .eq("id", image.id).eq("course_id", courseId);
        if (updateError) setError("Description could not be saved.");
        else { setImages((current) => current.map((item) => item.id === image.id ? { ...item, description: description.trim() || null } : item)); setNotice("Description saved."); }
        setBusyId(null);
    }

    async function move(index: number, direction: -1 | 1) {
        const target = index + direction;
        if (target < 0 || target >= images.length || busyId) return;
        const reordered = [...images];
        [reordered[index], reordered[target]] = [reordered[target], reordered[index]];
        setBusyId(images[index].id); setError(null); setNotice(null);
        const { error: reorderError } = await supabaseBrowser.rpc("reorder_course_images_v1", { p_course_id: courseId, p_image_ids: reordered.map((image) => image.id) });
        if (reorderError) setError("Image order could not be changed.");
        else { setImages(reordered.map((image, sort_order) => ({ ...image, sort_order }))); setNotice("Gallery order saved."); }
        setBusyId(null);
    }

    async function remove(image: CourseImage) {
        if (busyId || !window.confirm("Delete this image from the course gallery?")) return;
        setBusyId(image.id); setError(null); setNotice(null);
        const deleted = await supabaseBrowser.rpc("delete_course_image_v1", { p_course_id: courseId, p_image_id: image.id });
        if (deleted.error || !deleted.data?.[0]?.storage_path) { setError("Image could not be deleted."); setBusyId(null); return; }
        const storageResult = await supabaseBrowser.storage.from("course-images").remove([deleted.data[0].storage_path]);
        setImages((current) => current.filter((item) => item.id !== image.id).map((item, sort_order) => ({ ...item, sort_order })));
        if (storageResult.error) setError("The gallery entry was deleted, but storage cleanup could not be confirmed.");
        else setNotice("Image deleted.");
        setBusyId(null);
    }

    return <section className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-5 shadow-2xl shadow-black/20">
        <div className="flex flex-wrap items-center justify-between gap-4"><div><h2 className="text-lg font-semibold">Course gallery</h2><p className="mt-1 text-sm text-gray-400">{images.length} {images.length === 1 ? "image" : "images"}</p></div><button type="button" onClick={() => inputRef.current?.click()} disabled={uploading} className="rounded-xl bg-blue-500 px-4 py-2.5 text-sm font-semibold transition hover:bg-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-300/50 disabled:cursor-not-allowed disabled:opacity-60">{uploading ? "Uploading..." : "+ Add image"}</button><input ref={inputRef} className="sr-only" type="file" accept="image/jpeg,image/png,image/webp" onChange={upload} /></div>
        {error && <p role="alert" className="mt-4 rounded-lg border border-red-400/20 bg-red-500/10 px-3 py-2 text-sm text-red-200">{error}</p>}
        {notice && <p role="status" className="mt-4 rounded-lg border border-emerald-400/20 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200">{notice}</p>}
        {images.length === 0 ? <div className="mt-5 rounded-xl border border-dashed border-white/15 bg-black/15 px-5 py-10 text-center"><p className="font-semibold">No course images yet</p><p className="mt-2 text-sm text-gray-400">Add a course photo to create the public gallery and cover image.</p></div> : <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{images.map((image, index) => <ImageCard key={image.id} image={image} index={index} count={images.length} busy={busyId === image.id} onMove={move} onDelete={remove} onSaveDescription={saveDescription} />)}</div>}
    </section>;
}

function ImageCard({ image, index, count, busy, onMove, onDelete, onSaveDescription }: { image: CourseImage; index: number; count: number; busy: boolean; onMove: (index: number, direction: -1 | 1) => void; onDelete: (image: CourseImage) => void; onSaveDescription: (image: CourseImage, description: string) => void }) {
    const [description, setDescription] = useState(image.description ?? "");
    return <article className="overflow-hidden rounded-xl border border-white/10 bg-black/20"><div className="relative aspect-[4/3] bg-black/30"><Image src={image.image_url} alt={image.description || `Course image ${index + 1}`} fill sizes="(max-width: 640px) 100vw, 33vw" className="object-cover" />{index === 0 && <span className="absolute left-3 top-3 rounded-full bg-blue-500 px-2.5 py-1 text-[11px] font-bold shadow-lg">Cover</span>}</div><div className="p-4"><label className="text-xs font-semibold text-gray-400">Description<input value={description} onChange={(event) => setDescription(event.target.value)} className="mt-2 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none transition placeholder:text-gray-600 focus:border-blue-400/60 focus:ring-2 focus:ring-blue-400/15" placeholder="Optional image description" /></label><div className="mt-3 flex flex-wrap gap-2"><button type="button" disabled={busy || description.trim() === (image.description ?? "")} onClick={() => onSaveDescription(image, description)} className="rounded-lg bg-white/10 px-3 py-2 text-xs font-semibold hover:bg-white/15 disabled:opacity-40">Save description</button><button type="button" aria-label="Move image earlier" disabled={busy || index === 0} onClick={() => onMove(index, -1)} className="rounded-lg border border-white/10 px-3 py-2 text-xs hover:bg-white/10 disabled:opacity-30">↑</button><button type="button" aria-label="Move image later" disabled={busy || index === count - 1} onClick={() => onMove(index, 1)} className="rounded-lg border border-white/10 px-3 py-2 text-xs hover:bg-white/10 disabled:opacity-30">↓</button><button type="button" disabled={busy} onClick={() => onDelete(image)} className="ml-auto rounded-lg border border-red-400/20 bg-red-500/10 px-3 py-2 text-xs font-semibold text-red-200 hover:bg-red-500/20 disabled:opacity-40">Delete</button></div></div></article>;
}
