export type Update = { id: string; headline: string; body: string; published_at: string | null; created_at: string; revision: number; publication_status: 'draft' | 'published' };
export type Comment = { id: string; author_id: string; author_name: string; body: string; created_at: string; revision: number; moderation_status: 'visible' | 'hidden' };
export function statusDate(value: string | null): string {
 if (!value) return 'Not published';
 const date = new Date(value);
 return Number.isFinite(date.getTime()) ? date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }) : 'Date unavailable';
}
export const validId = (value: unknown): value is string => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
export const validText = (value: unknown, max: number): value is string => typeof value === 'string' && value.trim().length > 0 && [...value].length <= max;
