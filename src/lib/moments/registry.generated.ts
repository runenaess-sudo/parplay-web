// Generated from parplay/src/features/moments/registry.ts. Do not edit; run scripts/sync-moment-preview.mjs.
export type MomentPayload = { calculationDate?: string; delta?: number; targetLevel?: number; remainingXp?: number; courseName?: string; eventName?: string; username?: string; place?: number; previousRating?: number; newRating?: number };
type Definition = {
  enabled: boolean; automaticTriggerEnabled: boolean; title: string | ((p: MomentPayload) => string);
  message: (p: MomentPayload) => string; icon: 'trophy' | 'trending-up' | 'trending-down' | 'calendar' | 'medal' | 'crown' | 'flag' | 'check-decagram' | 'fire' | 'sword-cross' | 'disc';
  colors: readonly [string, string]; required: readonly (keyof MomentPayload)[];
  action?: { kind: 'course_record_challenge'; enabled: boolean };
};
const ordinal = (n?: number) => ({ 2: '2nd', 3: '3rd', 4: '4th', 5: '5th' }[n ?? 0] ?? '');
const define = (d: Omit<Definition, 'enabled' | 'automaticTriggerEnabled'> & { automaticTriggerEnabled?: boolean }): Definition => ({ enabled: true, automaticTriggerEnabled: false, ...d });
export const momentRegistry = {
  weekly_rating_update: define({ automaticTriggerEnabled: true, title: 'ParPlay Rating Update',
    message: p => `${new Date(p.calculationDate + 'T00:00:00Z').toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' })}\n\n${p.delta! > 0 ? '+' : '\u2212'}${String(Math.abs(p.delta!))} Rating Points${p.delta! > 0 ? '!' : ''}\n\nYour ParPlay+ Rating at this update: ${p.newRating}.\n\n${p.delta! > 0 ? 'Keep up the great work!' : 'Let your next tournament be the way back!'}`,
    icon: 'trending-up', colors: ['#194FA3', '#122E62'], required: ['calculationDate'] }),
  level_milestone: define({ automaticTriggerEnabled: true, title: p => `SO CLOSE TO LEVEL ${p.targetLevel}! \u{2B50}`, message: p => `Just ${p.remainingXp} XP to go! Keep playing and reach your next ParPlay level!`, icon: 'trending-up', colors: ['#80600D', '#463309'], required: ['targetLevel', 'remainingXp'] }),
  personal_best: define({ automaticTriggerEnabled: true, title: 'NEW PERSONAL BEST! 🏆', message: p => `Congrats! You've set a new personal best at ${p.courseName}! Keep up the great work!`, icon: 'trophy', colors: ['#155E46', '#594509'], required: ['courseName'] }),
  rating_increase: define({ automaticTriggerEnabled: true, title: 'RATING UP! 🚀', message: () => 'Great work! Your Current Rating just increased. Keep pushing!', icon: 'trending-up', colors: ['#194FA3', '#122E62'], required: [] }),
  upcoming_event: define({ automaticTriggerEnabled: true, title: '3 DAYS TO GO! ⛳', message: p => `Only 3 days until ${p.eventName}! Stay focused, get some practice in and bring your best game! 💪`, icon: 'calendar', colors: ['#98420D', '#50320D'], required: ['eventName'] }),
  tournament_top_five: define({ automaticTriggerEnabled: true, title: 'FANTASTIC FINISH! 🥳', message: p => `Congratulations on finishing ${ordinal(p.place)} at ${p.eventName}!`, icon: 'medal', colors: ['#6933A6', '#33205F'], required: ['eventName', 'place'] }),
  tournament_winner: define({ automaticTriggerEnabled: true, title: 'WOW! YOU WON! 🏆', message: p => `You won ${p.eventName}! ParPlay congratulates you on an incredible performance!`, icon: 'trophy', colors: ['#80600D', '#463309'], required: ['eventName'] }),
  // Friends League overall ties/eligibility need an authoritative contract before activation.
  league_top_five: define({ automaticTriggerEnabled: true, title: 'GREAT LEAGUE FINISH! 🎉', message: p => `Congratulations on finishing ${ordinal(p.place)} in ${p.eventName}!`, icon: 'medal', colors: ['#553AA0', '#203B73'], required: ['eventName', 'place'] }),
  league_winner: define({ automaticTriggerEnabled: true, title: 'LEAGUE CHAMPION! 👑', message: p => `You won ${p.eventName}! Fantastic work!`, icon: 'crown', colors: ['#80600D', '#463309'], required: ['eventName'] }),
  // Legacy course_submitted identifier now means authoritative first publication.
  // Administrative Course Approved remains disabled: no approval event exists.
  course_submitted: define({ automaticTriggerEnabled: true, title: 'THANK YOU! \u{1F94F}', message: p => `Thanks for adding ${p.courseName} to ParPlay! You're helping our disc golf community grow!`, icon: 'disc', colors: ['#16694B', '#105951'], required: ['courseName'] }),
  course_approved: define({ title: 'COURSE APPROVED! \u{1F389}', message: p => `Great news! ${p.courseName} has been approved and is ready for players to discover!`, icon: 'check-decagram', colors: ['#80600D', '#16694B'], required: ['courseName'] }),
  three_day_streak: define({ automaticTriggerEnabled: true, title: '3-DAY STREAK! 🔥', message: () => 'ParPlay appreciates your activity in our app! We hope you enjoy every moment using ParPlay. Keep having fun!', icon: 'fire', colors: ['#A63E20', '#62222C'], required: [] }),
  // Challenge availability is supplied by the authenticated bounded list RPC.
  // Keep the persisted username payload key; it holds the new holder's display name.
  course_record_broken: define({ automaticTriggerEnabled: true, title: 'YOUR COURSE RECORD WAS BROKEN! \u{1F94F}', message: p => `${p.username} just beat your record at ${p.courseName}!`, icon: 'sword-cross', colors: ['#973C80', '#482668'], required: ['username', 'courseName'], action: { kind: 'course_record_challenge', enabled: true } }),
} satisfies Record<string, Definition>;
export type MomentType = keyof typeof momentRegistry;
export type Moment = { id: string; recipient_id: string; type: MomentType; payload: MomentPayload; created_at: string; displayed_at: string | null; expires_at?: string | null; challenge?: RecordChallenge };
export function renderMoment(type: string, payload: MomentPayload) {
  if (!Object.prototype.hasOwnProperty.call(momentRegistry, type) || !payload || typeof payload !== 'object') return null;
  if (type === 'weekly_rating_update' && (!Number.isFinite(payload.previousRating)
    || !Number.isFinite(payload.newRating) || !Number.isFinite(payload.delta) || payload.delta === 0
    || !/^\d{4}-\d{2}-\d{2}$/.test(payload.calculationDate ?? '')
    || !Number.isFinite(Date.parse(payload.calculationDate + 'T00:00:00Z')))) return null;
  const definition = momentRegistry[type as MomentType];
  if (!definition.enabled || definition.required.some(key => key === 'place'
    ? ![2, 3, 4, 5].includes(payload.place ?? 0)
    : key === 'targetLevel' ? !Number.isInteger(payload.targetLevel) || payload.targetLevel! < 2 || payload.targetLevel! > 100
    : key === 'remainingXp' ? !Number.isInteger(payload.remainingXp) || payload.remainingXp! < 1 || payload.remainingXp! > 50
    : typeof payload[key] !== 'string' || !(payload[key] as string).trim())) return null;
  return { ...definition, icon: type === 'weekly_rating_update' && payload.delta! < 0 ? 'trending-down' as const : definition.icon,
    title: typeof definition.title === 'function' ? definition.title(payload) : definition.title, text: definition.message(payload) };
}

export type RecordChallenge = { eventId: string; playerName: string; courseName: string; expiresAt: string | null };
