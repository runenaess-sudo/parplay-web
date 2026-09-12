import "server-only";

import { supabaseServer } from "@/lib/supabase-server";

export async function getServerCourseManager() {
    const supabase = await supabaseServer();
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return null;
    const { data: profile, error } = await supabase.from("profiles")
        .select("id,membership").eq("id", userData.user.id).maybeSingle();
    if (error) throw error;
    if (!profile) return null;
    const { data: assignments, error: assignmentsError } = profile.membership === "admin"
        ? { data: [], error: null }
        : await supabase.from("course_manager_assignments")
            .select("course_id,club_id")
            .eq("status", "active").eq("is_primary", true);
    if (assignmentsError) throw assignmentsError;
    if (profile.membership !== "admin" && (assignments?.length ?? 0) === 0) return null;
    return { supabase, user: userData.user, profile, assignments: assignments ?? [] };
}

export async function canOpenCourseEditor(courseId: string) {
    const supabase = await supabaseServer();
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return false;
    const [{ data: profile }, { data: course }] = await Promise.all([
        supabase.from("profiles").select("membership").eq("id", userData.user.id).maybeSingle(),
        supabase.from("courses").select("id,created_by,club_id").eq("id", courseId).maybeSingle(),
    ]);
    if (!profile || !course) return false;
    if (profile.membership === "admin") return true;
    const { data: assigned, error: assignmentError } = await supabase
        .rpc("is_course_manager_v1", { p_course_id: courseId, p_user_id: userData.user.id });
    if (assignmentError) return false;
    if (assigned === true) return true;
    const { data: acceptedClaims, error: acceptedClaimsError } = await supabase
        .from("course_claim_requests")
        .select("club_id")
        .eq("course_id", courseId)
        .eq("status", "accepted");
    if (acceptedClaimsError) return false;
    return course.created_by === userData.user.id && acceptedClaims?.length === 0;
}
