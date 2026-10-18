// Generated from parplay/src/features/moments/MomentPresentation.tsx. Do not edit; run scripts/sync-moment-preview.mjs.
import React, { type ComponentType, type ReactNode } from 'react';
import { renderMoment, type Moment } from './registry.generated';

// Shared by native cards and the web gallery. Adapters only render primitives;
// all layout, typography, themes and payload presentation live here.
export type SurfaceProps = { children?: ReactNode; style?: Record<string, string | number>; colors?: readonly [string, string]; name?: string; size?: number; color?: string; decorative?: boolean; heading?: boolean; live?: boolean; onPress?: () => void };
export type MomentPrimitives = Record<'Box' | 'Label' | 'Gradient' | 'Icon' | 'Close', ComponentType<SurfaceProps>>;
const themes = {
  blue: ['#0B182D', '#163F69', '#83D9FF'], ruby: ['#25131F', '#542638', '#FFB4C7'],
  emerald: ['#0C241F', '#174B3D', '#88EBC2'], gold: ['#241F14', '#514024', '#FFE098'],
  bronze: ['#261C17', '#503529', '#F4C4A0'], violet: ['#1B1732', '#3A2A63', '#CEB8FF'],
  teal: ['#102525', '#174C50', '#8AE4DF'], orange: ['#291B19', '#593125', '#FFC397'],
  pink: ['#26152B', '#522859', '#F4B5EA'],
} as const;
export function momentVisual(moment: Moment) {
  const { type, payload: p } = moment;
  const theme = type === 'weekly_rating_update' ? (p.delta! < 0 ? 'ruby' : 'blue')
    : type === 'personal_best' ? 'emerald' : type === 'level_milestone' || type === 'tournament_winner' ? 'gold'
    : type === 'tournament_top_five' ? (p.place === 2 ? 'gold' : 'bronze')
    : type.startsWith('league_') ? 'violet' : type.startsWith('course_record') ? 'pink'
    : type.startsWith('course_') ? 'teal' : type === 'three_day_streak' ? 'orange' : 'blue';
  return themes[theme];
}
export default function MomentPresentation({ moment, primitives, dismiss, action, error = false, minHeight = 312 }: {
  moment: Moment; primitives: MomentPrimitives; dismiss: () => void; action?: ReactNode; error?: boolean; minHeight?: number;
}) {
  const content = renderMoment(moment.type, moment.payload);
  if (!content) return null;
  const { Box, Label, Gradient, Icon, Close } = primitives;
  const [dark, color, accent] = momentVisual(moment);
  const p = moment.payload, weekly = moment.type === 'weekly_rating_update', level = moment.type === 'level_milestone';
  const placement = moment.type === 'tournament_top_five' || moment.type === 'league_top_five';
  const value = weekly ? `${p.delta! > 0 ? '+' : '\u2212'}${Math.abs(p.delta!)}` : level ? String(p.targetLevel)
    : placement ? ({ 2: '2nd', 3: '3rd', 4: '4th', 5: '5th' }[p.place!]) : null;
  const caption = weekly ? `Rating Points${p.delta! > 0 ? '!' : ''}` : level ? 'NEXT LEVEL' : 'PLACE';
  const icon = level ? 'star' : content.icon;
  return <Gradient colors={[dark, color]} style={{ minHeight, padding: 24, borderRadius: 24, borderWidth: 1, borderColor: accent + '55', overflow: 'hidden', gap: 16 }}>
    <Box decorative style={{ position: 'absolute', width: 172, height: 172, borderRadius: 86, borderWidth: 1, borderColor: accent + '24', top: -70, right: -54 }} />
    <Box decorative style={{ position: 'absolute', width: 108, height: 108, borderRadius: 54, backgroundColor: accent + '09', bottom: 18, right: -50 }} />
    <Box style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
      <Box style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: accent + '14', borderWidth: 1, borderColor: accent + '44', alignItems: 'center', justifyContent: 'center' }}>
        <Icon name={icon} size={40} color={accent} />
      </Box>
      <Close onPress={dismiss} color="#DFE7F4" style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: '#FFFFFF09', alignItems: 'center', justifyContent: 'center' }} />
    </Box>
    <Box style={{ gap: 6 }}>
      <Label heading style={{ color: '#F7F9FF', fontSize: 23, fontWeight: '800', flexShrink: 1 }}>{content.title}</Label>
      {weekly && <Label style={{ color: '#C1C9D8', fontSize: 13 }}>{new Date(p.calculationDate + 'T00:00:00Z').toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' })}</Label>}
    </Box>
    {value && <Box style={{ gap: 2, ...(level ? { alignSelf: 'flex-start', minWidth: 108, minHeight: 108, borderRadius: 54, padding: 16, borderWidth: 1, borderColor: accent + '66', alignItems: 'center', justifyContent: 'center' } : {}) }}>
      <Label style={{ color: accent, fontSize: level ? 42 : 56, fontWeight: '800', letterSpacing: -1 }}>{value}</Label>
      <Label style={{ color: accent, fontSize: 12, fontWeight: '700', letterSpacing: 1 }}>{caption}</Label>
    </Box>}
    {weekly ? <Box style={{ gap: 12 }}>
      <Label style={{ color: '#E2E8F2', fontSize: 17, lineHeight: 25 }}>Your ParPlay+ Rating at this update: <Label style={{ color: accent, fontWeight: '800', fontSize: 21 }}>{p.newRating}</Label>.</Label>
      <Label style={{ color: '#C1C9D8', fontSize: 15, lineHeight: 23 }}>{p.delta! > 0 ? 'Keep up the great work!' : 'Let your next tournament be the way back!'}</Label>
    </Box> : <Label style={{ color: '#E2E8F2', fontSize: 17, lineHeight: 25 }}>{content.text}</Label>}
    {moment.type === 'rating_increase' && Number.isFinite(p.previousRating) && Number.isFinite(p.newRating) && <Label style={{ color: accent, fontSize: 28, fontWeight: '800' }}>{p.previousRating} → {p.newRating}</Label>}
    {moment.type === 'course_record_broken' && <Box style={{ minHeight: 44 }}>{action}</Box>}
    {error && <Label live style={{ color: '#FFE0CF', fontSize: 15, lineHeight: 23 }}>Could not save dismissal. Please try again.</Label>}
  </Gradient>;
}
