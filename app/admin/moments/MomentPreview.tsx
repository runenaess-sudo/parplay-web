import type { CSSProperties } from 'react';
import MomentPresentation, { type MomentPrimitives } from '@/lib/moments/MomentPresentation.generated';
import { type MomentPayload, type MomentType } from '@/lib/moments/registry.generated';
import icons from '@/lib/moments/icons.generated.json';
import styles from './moments.module.css';

export const examplePayload: MomentPayload = {
    calculationDate: '2026-10-19', previousRating: 916, newRating: 928, delta: 12,
    targetLevel: 12, remainingXp: 25, courseName: 'Forest Disc Golf', eventName: 'Autumn Open',
    username: 'Alex', place: 2,
};
export default function MomentPreview({ type, negative = false, challenge = false }: {
    type: MomentType; negative?: boolean; challenge?: boolean;
}) {
    const payload = negative ? { ...examplePayload, newRating: 908, delta: -8 } : examplePayload;
    return <div className={styles.card}>
        <MomentPresentation moment={{ id: 'preview', recipient_id: 'preview', type, payload, created_at: '', displayed_at: null }}
            primitives={webPrimitives} dismiss={() => {}} minHeight={312}
            action={challenge ? <span className={styles.challenge}>{'Challenge Alex \u{1F94F}'}</span> : null} />
    </div>;
}
const boxStyle: CSSProperties = { display: 'flex', flexDirection: 'column', position: 'relative', minWidth: 0, borderStyle: 'solid', borderWidth: 0, boxSizing: 'border-box' };
const webPrimitives: MomentPrimitives = {
    Box: ({ children, style, decorative }) => <div aria-hidden={decorative || undefined} style={{ ...boxStyle, ...style as CSSProperties, ...(decorative ? { pointerEvents: 'none' } : {}) }}>{children}</div>,
    Label: ({ children, style, heading, live }) => <span role={heading ? 'heading' : undefined} aria-level={heading ? 3 : undefined} aria-live={live ? 'polite' : undefined} style={{ ...style as CSSProperties, ...(typeof style?.lineHeight === 'number' ? { lineHeight: style.lineHeight + 'px' } : {}), whiteSpace: 'pre-line', overflowWrap: 'anywhere' }}>{children}</span>,
    Gradient: ({ children, colors, style }) => <div style={{ ...boxStyle, ...style as CSSProperties, backgroundImage: 'linear-gradient(135deg, ' + colors!.join(', ') + ')' }}>{children}</div>,
    Icon: ({ name, size, color }) => <span aria-hidden className={styles.icon} style={{ fontSize: size, color }}>{String.fromCodePoint(icons[name as keyof typeof icons])}</span>,
    Close: ({ style, color }) => <button type="button" aria-label="Dismiss Moment (preview only)" className={styles.close} style={{ ...boxStyle, ...style as CSSProperties, color, flexShrink: 0 }}>{String.fromCodePoint(icons.close)}</button>,
};
