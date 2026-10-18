import { AdminAuthError, requireServerAdmin } from '@/lib/admin-auth';
import { NextResponse } from 'next/server';

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const headers = { 'Cache-Control': 'private, no-store' };
function failure(error: unknown) {
    return NextResponse.json({ error: error instanceof AdminAuthError ? error.message : 'Could not load or update diagnoses.' },
        { status: error instanceof AdminAuthError ? error.status : 500, headers });
}
export async function GET(request: Request) {
    try {
        const { supabase } = await requireServerAdmin();
        const params = new URL(request.url).searchParams;
        const view = params.get('view');
        if (view !== null && !['new', 'finished'].includes(view)) return NextResponse.json({ error: 'Invalid report view.' }, { status: 400, headers });
        const id = params.get('id'), before = params.get('before'), beforeId = params.get('before_id');
        if ((id && !uuid.test(id)) || (!!before !== !!beforeId) || (beforeId && !uuid.test(beforeId))
            || (before && (before.length > 40 || !Number.isFinite(Date.parse(before)))))
            return NextResponse.json({ error: 'Invalid report reference.' }, { status: 400, headers });
        const { data, error } = view && !id && params.get('count') !== '1'
            ? await supabase.rpc('get_admin_diagnoses_by_status_v1', { p_finished: view === 'finished', p_before: before, p_before_id: beforeId })
            : await supabase.rpc('get_admin_diagnoses_v1', {
            p_id: id, p_before: before, p_before_id: beforeId, p_count_only: params.get('count') === '1',
        });
        if (error) throw error;
        return NextResponse.json(data, { headers });
    } catch (error) { return failure(error); }
}
export async function POST(request: Request) {
    try {
        const { supabase } = await requireServerAdmin();
        if (request.headers.get('origin') !== new URL(request.url).origin)
            return NextResponse.json({ error: 'Forbidden' }, { status: 403, headers });
        const text = await request.text();
        if (text.length > 1024) return NextResponse.json({ error: 'Invalid request.' }, { status: 400, headers });
        const body = JSON.parse(text);
        const statuses = ['New', 'Reviewing', 'Resolved'];
        if (!uuid.test(body?.id ?? '') || !statuses.includes(body?.status) || !statuses.includes(body?.expected_status))
            return NextResponse.json({ error: 'Invalid review status.' }, { status: 400, headers });
        const { error } = await supabase.rpc('set_admin_diagnose_status_v1', {
            p_id: body.id, p_status: body.status, p_expected_status: body.expected_status,
        });
        if (error?.code === '40001') return NextResponse.json({ error: 'Another admin changed this report. Refresh before trying again.' }, { status: 409, headers });
        if (error) throw error;
        return NextResponse.json({ ok: true }, { headers });
    } catch (error) { return failure(error); }
}
