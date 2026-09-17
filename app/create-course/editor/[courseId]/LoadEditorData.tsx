"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */

import { supabaseBrowser } from "@/lib/supabase-browser";
import { useCourseEditor } from "@/state/useCourseEditor";
import { useEffect } from "react";

export default function LoadEditorData({ courseId }: { courseId: string }) {
    const loadAll = useCourseEditor((s) => s.loadAll);

    useEffect(() => {
        if (!courseId) return;

        async function load() {
            const { data: course, error: courseError } = await supabaseBrowser
                .from("courses")
                .select("*")
                .eq("id", courseId)
                .single();

            if (courseError || !course) {
                console.error("Could not load course", courseError);
                return;
            }

            const { data: legacyHoles, error: holesError } = await supabaseBrowser
                .from("holes")
                .select("*")
                .eq("course_id", courseId)
                .order("number", { ascending: true });

            if (holesError) {
                console.error("Could not load holes", holesError);
                return;
            }

            // Keep editor-only metadata, but obtain all playable data from the
            // same default resolver used by runtime. Writes still target holes.
            const { data: resolved, error: resolvedError } = await supabaseBrowser.rpc(
                "get_resolved_course_holes_v1", { p_course_id: courseId },
            );
            if (resolvedError || !Array.isArray(resolved)) {
                console.error("Could not resolve course holes", resolvedError);
                return;
            }
            const legacyById = new Map((legacyHoles ?? []).map((hole) => [hole.id, hole]));
            const holes = resolved.map((hole: any) => ({ ...legacyById.get(hole.id), ...hole }));

            const holeIds = (holes ?? []).map((hole) => hole.id);
            const [featureResult, applicabilityResult] = holeIds.length > 0
                ? await Promise.all([
                    supabaseBrowser
                    .from("hole_features")
                    .select("*")
                    .in("hole_id", holeIds)
                    .order("sort_order", { ascending: true }),
                    supabaseBrowser
                        .from("effective_hole_features")
                        .select("id,hole_id,origin_hole_id,is_origin")
                        .in("hole_id", holeIds),
                ])
                : [{ data: [], error: null }, { data: [], error: null }];

            if (featureResult.error) {
                console.error("Could not load hole features", featureResult.error);
                return;
            }
            if (applicabilityResult.error) {
                console.error("Could not load effective hole features", applicabilityResult.error);
                return;
            }

            const applicableHoleIds = new Map<string, Set<string>>();
            (applicabilityResult.data ?? []).forEach((row) => {
                const holesForFeature = applicableHoleIds.get(row.id) ?? new Set<string>();
                holesForFeature.add(row.hole_id);
                applicableHoleIds.set(row.id, holesForFeature);
            });
            const canonicalFeatures = (featureResult.data ?? []).map((feature) => ({
                ...feature,
                origin_hole_id: feature.hole_id,
                applicable_hole_ids: [...(applicableHoleIds.get(feature.id) ?? new Set([feature.hole_id]))],
            }));

            // ⭐ Riktig parsing av fairway (ikke fairway_points)
            const parsedHoles = holes.map((h: any) => ({
                ...h,
                fairway: Array.isArray(h.fairway) ? h.fairway : [],
                hole_features: h.features ?? [],
            }));

            loadAll({
                ...course,
                canonical_hole_features: canonicalFeatures,
                holes: parsedHoles,
            });
        }

        load();
    }, [courseId, loadAll]);

    return null;
}
