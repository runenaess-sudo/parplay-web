export const communityCategories = {
    course: 'Courses', battle: 'Battle', matchplay: 'Match Play', doubles: 'Doubles',
    friend_league: 'Friend League', rounds: 'Rounds', caddy: 'My Caddy', play_tv: 'Play-TV', other: 'Other',
} as const;
export const communityTabs = ['PENDING', 'APPROVED', 'DECLINED', 'REPORTS'] as const;
export type CommunityTab = typeof communityTabs[number];
export type CommunityCategory = keyof typeof communityCategories;
export type ModerationItem = {
    id: string; category: CommunityCategory; title: string; body: string;
    status: 'PENDING' | 'APPROVED' | 'DECLINED'; author_name: string; author_avatar: string | null;
    submitted_at: string; moderated_at: string | null; published_at: string | null;
    context_type: string | null; context_id: string | null; context_name: string | null;
    report_id: string | null; report_reason: string | null; reporter_name: string | null; reported_at: string | null;
};

export function parseCommunityQuery(params: URLSearchParams) {
    const tab = params.get('tab') ?? 'PENDING';
    const category = params.get('category') || null;
    const offset = Number(params.get('offset') ?? 0);
    if (!communityTabs.includes(tab as CommunityTab) ||
        (category !== null && !Object.hasOwn(communityCategories, category)) ||
        !Number.isInteger(offset) || offset < 0 || offset > 10000) throw new Error('Invalid filter or page.');
    return { p_tab: tab, p_category: category, p_limit: 20, p_offset: offset };
}
