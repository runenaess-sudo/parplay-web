import "server-only";

import { supabaseServer } from "@/lib/supabase-server";

export async function getServerCourseManager() {
    const supabase = await supabaseServer();
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return null;
    const { data: profile, error } = await supabase.from("profiles")
        .select("id,membership,club_id").eq("id", userData.user.id).maybeSingle();
    if (error) throw error;
    if (!profile || !["club_manager", "admin"].includes(profile.membership)) return null;
    return { supabase, user: userData.user, profile };
}

export async function canOpenCourseEditor(courseId: string) {
    const supabase = await supabaseServer();
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return false;
    const [{ data: profile }, { data: course }] = await Promise.all([
        supabase.from("profiles").select("membership,club_id").eq("id", userData.user.id).maybeSingle(),
        supabase.from("courses").select("id,created_by,club_id").eq("id", courseId).maybeSingle(),
    ]);
    if (!profile || !course) return false;
    if (profile.membership === "admin") return true;
    const { data: acceptedClaims, error: acceptedClaimsError } = await supabase
        .from("course_claim_requests")
        .select("club_id")
        .eq("course_id", courseId)
        .eq("status", "accepted");
    if (acceptedClaimsError) return false;
    if (profile.membership === "club_manager") {
        return Boolean(
            profile.club_id
            && profile.club_id === course.club_id
            && acceptedClaims?.some((claim) => claim.club_id === profile.club_id),
        );
    }
    return course.created_by === userData.user.id && acceptedClaims?.length === 0;
}
