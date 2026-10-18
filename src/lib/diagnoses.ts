export type ReviewStatus = 'New' | 'Reviewing' | 'Resolved';
export type DiagnoseRow = { id: string; display_name: string; live_id: string; mode: string; created_at: string; status: ReviewStatus; summary: string };
export type ScoreMap = Record<string, Record<string, { score: number }>>;
export type DiagnosePayload = {
    report_id: string; submitter_id: string; display_name: string; round_id: string; mode: string;
    course_id: string; layout_id: string; app_version: string; app_build: string; platform: string; os_version: string;
    client_captured_at: string; server_captured_at: string; scores_differ: boolean; guest_scores_differ: boolean;
    local_scores: ScoreMap; guest_scores: ScoreMap; server_scores: ScoreMap; server_guest_scores: ScoreMap;
    operations: { id: string; stream_id: string; revision: number; created_at: number; status: string; attempts: number;
        next_retry_at: number; player_id: string; hole_id: string; hole_number: number; score: number | null }[];
    error: { code: string | null; reason: string | null }; sync_state: string; local_source: string;
};
export type DiagnoseDetail = { id: string; status: ReviewStatus; created_at: string; expires_at: string;
    payload: DiagnosePayload; review_history: { id: number; admin_id: string; status: ReviewStatus; changed_at: string }[] };
export const diagnosesChanged = 'parplay:diagnoses-changed';

// Fixed projection: no raw HTTP errors, headers, tokens or arbitrary extra fields.
export function copyDiagnose(detail: DiagnoseDetail): string {
    const p = detail.payload;
    const scores = (value: ScoreMap) => Object.fromEntries(Object.entries(value).map(([id, holes]) => [id,
        Object.fromEntries(Object.entries(holes).map(([hole, cell]) => [hole, { score: cell.score }]))]));
    const report = {
        problem: 'Round score synchronization failure. Diagnostic snapshot only; do not treat local scores as confirmed submissions.',
        report_id: detail.id, status: detail.status, submitted_at: detail.created_at,
        player: { id: p.submitter_id, display_name: p.display_name },
        round: { id: p.round_id, mode: p.mode, course_id: p.course_id, layout_id: p.layout_id },
        app: { version: p.app_version, build: p.app_build, platform: p.platform, os_version: p.os_version },
        capture: { local: p.client_captured_at, server: p.server_captured_at },
        locally_recorded: scores(p.local_scores), local_guests: scores(p.guest_scores),
        server_confirmed: scores(p.server_scores), server_guests: scores(p.server_guest_scores),
        scores_differ: p.scores_differ, guest_scores_differ: p.guest_scores_differ,
        pending_operations: p.operations.map(o => ({ id: o.id, stream_id: o.stream_id, revision: o.revision,
            created_at: o.created_at, status: o.status, attempts: o.attempts, next_retry_at: o.next_retry_at,
            player_id: o.player_id, hole_id: o.hole_id, hole_number: o.hole_number, score: o.score })),
        error: { code: p.error.code, reason: p.error.reason,
            message: 'Raw error text omitted. Last available outbox error may not belong to this round.' },
        synchronization: 'Failed/pending operations are not confirmations. Server scores were read at submission time.',
    };
    return 'PARPLAY DIAGNOSTIC REPORT\n' + JSON.stringify(report, null, 2);
}
