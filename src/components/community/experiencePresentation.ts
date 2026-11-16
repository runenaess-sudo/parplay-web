export type ExperiencePost = {
 id: string; title: string; body: string; category?: string; author_name?: string; author_avatar?: string | null;
 published_at?: string | null; submitted_at?: string; status?: 'PENDING' | 'APPROVED' | 'DECLINED';
 source_round_id?: string | null; context_id?: string; context_name?: string; layout_name?: string | null;
 has_photo?: boolean; round_feeling?: number | null; course_feeling?: number | null;
 round_details?: {finished_at?: string; course_name?: string; mode?: string; total_score?: number | null;
  relative_to_par?: number | null; round_rating?: number | null; xp_earned?: number | null; layout_name?: string | null} | null;
 achievements?: {ace?: number | null; albatross?: number | null; eagle?: number | null; birdie?: number | null; personal_best?: boolean | null} | null;
 up_count?: number; down_count?: number; own_reaction?: 'UP' | 'DOWN' | null;
};
const emojis = ['😭','😠','😐','😊','🤩'];
export function feelingEmoji(value?: number | null) { return value && Number.isInteger(value) ? emojis[value-1] ?? null : null; }
export function hasRoundDetails(post: ExperiencePost) {
 // Round details are already authorized presentation data. An absent link ID
 // must not hide supplied statistics; ordinary posts have neither field.
 return !!post.source_round_id || post.round_details != null;
}
export function experienceStats(post: ExperiencePost) {
 const r = post.round_details;
 const number = (value?: number | null) => typeof value === 'number' && Number.isFinite(value);
 const relative = number(r?.relative_to_par) ? (r!.relative_to_par! > 0 ? '+' : '') + r!.relative_to_par : '—';
 return [ ['Score', number(r?.total_score) ? `${relative} (${r!.total_score})` : '—'],
  ['Rating', number(r?.round_rating) ? String(r!.round_rating) : '—'],
  ['XP', number(r?.xp_earned) ? `${r!.xp_earned! >= 0 ? '+' : ''}${r!.xp_earned}` : '—'] ];
}
export function achievementLabels(post: ExperiencePost) {
 const a = post.achievements;
 const labels = (['ace','albatross','eagle','birdie'] as const).flatMap(key => {
  const count = a?.[key]; return typeof count === 'number' && Number.isInteger(count) && count > 0
   ? [`${key[0].toUpperCase()+key.slice(1)}: ${count}`] : [];
 });
 if (a?.personal_best === true) labels.push('Personal Best: Yes');
 return labels;
}
export function mergeExperiences(previous: ExperiencePost[], next: ExperiencePost[]) {
 const map = new Map(previous.map(p => [p.id,p])); next.forEach(p => map.set(p.id,p)); return [...map.values()];
}
