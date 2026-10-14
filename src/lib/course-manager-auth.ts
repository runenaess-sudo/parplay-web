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
    const { data, error } = await supabase.rpc('can_manage_course_private_data_v1', { p_course_id: courseId });
    return !error && data === true;
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

    const { data: profile, error: profileError } = await supabase.from('profiles')
        .select('membership').eq('id', userData.user.id).maybeSingle();
    if (profileError) throw profileError;
    const courseSelect = 'id,name,location,is_published,status,club_id,created_at,created_by';
    const isAdmin = profile?.membership === 'admin';
    let query = supabase.from('courses').select(courseSelect).order('created_at', { ascending: false });
    if (!isAdmin) {
        const [{ data: created, error: createdError }, { data: assignments, error: assignmentError }] = await Promise.all([
            supabase.from('courses').select('id').eq('created_by', userData.user.id),
            supabase.from('course_manager_assignments').select('course_id')
                .eq('manager_user_id', userData.user.id).eq('status', 'active').eq('is_primary', true),
        ]);
        if (createdError) throw createdError;
        if (assignmentError) throw assignmentError;
        const ids = [...new Set([...(created ?? []).map(c => c.id), ...(assignments ?? []).map(a => a.course_id)])];
        if (!ids.length) return [];
        query = query.in('id', ids);
    }
    const { data: courses, error } = await query;
    if (error) throw error;
    const checked = await Promise.all((courses ?? []).map(async course => {
        const { data: allowed, error: permissionError } = await supabase.rpc('can_manage_course_private_data_v1', { p_course_id: course.id });
        if (permissionError) throw permissionError;
        return { ...course, canManage: allowed === true };
    }));
    return checked.filter(course => course.canManage || course.created_by === userData.user.id);
}
