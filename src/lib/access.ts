export async function getUserAccess() {
    // Lazy import – evalueres KUN i browser
    const { supabaseBrowser } = await import("./supabase-browser.js");
    const supabase = supabaseBrowser;

    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return { membership: "basic", limits: null, hasCourseManagerAssignments: false };

    const { data: profile } = await supabase
        .from("profiles")
        .select("membership")
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
        limits,
        hasCourseManagerAssignments: Boolean(managerAssignment),
    };
}
