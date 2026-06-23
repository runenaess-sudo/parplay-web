"use client";
import { supabaseBrowser } from "@/src/lib/supabase-browser";

export function useCourses() {
    async function loadCourses() {
        const supabase = supabaseBrowser;
        return supabase
            .from("courses")
            .select("id, name, location, latitude, longitude, is_published")
            .eq("is_published", true);
    }

    return { loadCourses };
}
