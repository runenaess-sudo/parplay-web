export async function getUserAccess() {
    // Lazy import – evalueres KUN i browser
    const { supabaseBrowser } = await import("./supabase-browser.js");
    const supabase = supabaseBrowser;

    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return {
        membership: "basic",
        avatarUrl: null,
        fullName: null,
        username: null,
        limits: null,
        hasCourseManagerAssignments: false,
    };

    const { data: profile } = await supabase
        .from("profiles")
        .select("membership, avatar_url, full_name, username")
        .eq("id", user.id)
        .single();

    const membership = profile?.membership ?? "basic";

    const { data: limits } = await supabase
        .from("membership_limits")
        .select("*")
        .eq("membership", membership)
        .single();

    const { data: managerAssignment } = await supabase
        .from("course_manager_assignments")
        .select("id")
        .eq("status", "active")
        .eq("is_primary", true)
        .limit(1)
        .maybeSingle();

    return {
        membership,
        avatarUrl: profile?.avatar_url ?? null,
        fullName: profile?.full_name ?? null,
        username: profile?.username ?? null,
        limits,
        hasCourseManagerAssignments: Boolean(managerAssignment),
    };
}
