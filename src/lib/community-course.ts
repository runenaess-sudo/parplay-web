export const courseIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function courseCommunityHref(id: string) { return `/community?course=${encodeURIComponent(id)}`; }
export function courseFeedArgs(courseId: string | undefined, scope: string, country: string, position: { lat: number; lon: number } | null, sort: string, preview: boolean, offset: number) {
    return { p_course_id: courseId ?? null, p_scope: courseId ? 'all' : scope, p_country: country || null,
        p_lat: position?.lat ?? null, p_lon: position?.lon ?? null, p_sort: sort, p_limit: preview ? 4 : 20, p_offset: offset };
}
