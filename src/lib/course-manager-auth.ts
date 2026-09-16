import "server-only";

import { supabaseServer } from "@/lib/supabase-server";

export type ManageableCourse = {
    id: string;
    name: string;
    location: string | null;
    is_published: boolean;
    status: string | null;
    club_id: string | null;
    created_at: string;
};

export type CourseBuild = ManageableCourse & {
    canManage: boolean;
};

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

export async function getServerManageableCourses(): Promise<ManageableCourse[] | null> {
    const supabase = await supabaseServer();
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return null;

    const { data: profile, error: profileError } = await supabase
        .from("profiles").select("membership").eq("id", userData.user.id).maybeSingle();
    if (profileError) throw profileError;
    if (!profile) return null;

    const courseSelect = "id,name,location,is_published,status,club_id,created_at";
    if (profile.membership === "admin") {
        const { data, error } = await supabase
            .from("courses").select(courseSelect).order("created_at", { ascending: false });
        if (error) throw error;
        return (data ?? []) as ManageableCourse[];
    }

    const [{ data: assignments, error: assignmentsError }, { data: creatorRows, error: creatorError }] =
        await Promise.all([
            supabase.from("course_manager_assignments").select("course_id,club_id")
                .eq("status", "active").eq("is_primary", true),
            supabase.from("courses").select("id").eq("created_by", userData.user.id),
        ]);
    if (assignmentsError) throw assignmentsError;
    if (creatorError) throw creatorError;

    const creatorCourseIds = (creatorRows ?? []).map((course) => course.id);
    const candidateCourseIds = [...new Set([
        ...(assignments ?? []).map((assignment) => assignment.course_id), ...creatorCourseIds,
    ])];
    if (candidateCourseIds.length === 0) return [];

    const [{ data: courses, error: coursesError }, { data: acceptedClaims, error: claimsError }] =
        await Promise.all([
            supabase.from("courses").select(courseSelect).in("id", candidateCourseIds)
                .order("created_at", { ascending: false }),
            supabase.from("course_claim_requests").select("course_id,club_id")
                .in("course_id", candidateCourseIds).eq("status", "accepted"),
        ]);
    if (coursesError) throw coursesError;
    if (claimsError) throw claimsError;

    const assignmentPairs = new Set(
        (assignments ?? []).map((assignment) => `${assignment.course_id}:${assignment.club_id}`)
    );
    const acceptedPairs = new Set(
        (acceptedClaims ?? []).map((claim) => `${claim.course_id}:${claim.club_id}`)
    );
    const acceptedCourseIds = new Set((acceptedClaims ?? []).map((claim) => claim.course_id));
    const creatorCourseIdSet = new Set(creatorCourseIds);

    return ((courses ?? []) as ManageableCourse[]).filter((course) => {
        const pair = `${course.id}:${course.club_id}`;
        return (assignmentPairs.has(pair) && acceptedPairs.has(pair))
            || (creatorCourseIdSet.has(course.id) && !acceptedCourseIds.has(course.id));
    });
}

/** Historical course contributions, with current management authority kept separate. */
export async function getServerCourseBuilds(): Promise<CourseBuild[] | null> {
    const supabase = await supabaseServer();
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return null;

    const { data: creatorCourses, error: coursesError } = await supabase
        .from("courses")
        .select("id,name,location,is_published,status,club_id,created_at")
        .eq("created_by", userData.user.id)
        .order("created_at", { ascending: false });
    if (coursesError) throw coursesError;

    return Promise.all((creatorCourses as ManageableCourse[]).map(async (course) => ({
        ...course,
        canManage: await canOpenCourseEditor(course.id),
    })));
}
