import { renderMoment, type MomentPayload, type MomentType } from '@/lib/moments/registry.generated';
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
    const content = renderMoment(type, payload);
    if (!content) return null;
    return <div className={styles.card} style={{ backgroundImage: `linear-gradient(to bottom, ${content.colors[0]}, ${content.colors[1]})` }}>
        <div className={styles.top}>
            <span aria-hidden className={styles.icon}>{String.fromCodePoint(icons[content.icon])}</span>
            <span aria-hidden className={styles.close}>{String.fromCodePoint(icons.close)}</span>
        </div>
        <h3 className={styles.title}>{content.title}</h3>
        <p className={styles.message}>{content.text}</p>
        {type === 'rating_increase' && <p className={styles.message}>{payload.previousRating} → {payload.newRating}</p>}
        {type === 'course_record_broken' && <div className={styles.actionSlot}>
            {challenge && <span className={styles.challenge}>Challenge Alex 🥏</span>}
        </div>}
    </div>;
}
