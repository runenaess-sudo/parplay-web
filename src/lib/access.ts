import { supabase } from "./supabase";
export async function getUserAccess() {
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return { membership: "basic", limits: null };

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

    return { membership, limits };
}
