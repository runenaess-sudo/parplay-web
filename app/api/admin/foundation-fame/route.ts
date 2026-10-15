import { AdminAuthError, requireServerAdmin } from '@/lib/admin-auth';
import { NextResponse } from 'next/server';

function failure(error: unknown) {
    return NextResponse.json({ error: error instanceof AdminAuthError ? error.message : 'Foundation request failed. Please retry.' },
        { status: error instanceof AdminAuthError ? error.status : 500 });
}
export async function GET(request: Request) {
    try {
        const { supabase } = await requireServerAdmin();
        const query = new URL(request.url).searchParams;
        const tab = query.get('tab') ?? 'PENDING';
        const offset = Number(query.get('offset') ?? 0);
        if (!['PENDING', 'QUALIFIED', 'REJECTED', 'ALL'].includes(tab) || !Number.isSafeInteger(offset) || offset < 0 || offset > 2147483627)
            return NextResponse.json({ error: 'Invalid filter or page.' }, { status: 400 });
        const { data, error } = await supabase.rpc('get_foundation_admin_workspace_v1', { p_tab: tab, p_offset: offset });
        if (error) throw error;
        return NextResponse.json(data, { headers: { 'Cache-Control': 'private, no-store' } });
    } catch (error) { return failure(error); }
}
export async function POST(request: Request) {
    try {
        const { supabase } = await requireServerAdmin();
        const origin = request.headers.get('origin');
        if (origin && origin !== new URL(request.url).origin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        const body = await request.json().catch(() => null);
        if (!body || typeof body.id !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(body.id) || !['QUALIFIED', 'INVALID', 'DUPLICATE'].includes(body.state))
            return NextResponse.json({ error: 'Invalid decision.' }, { status: 400 });
        const { error } = await supabase.rpc('decide_foundation_pending_contribution_v1', { p_contribution_id: body.id, p_state: body.state });
        if (error?.message === 'FOUNDATION_ALREADY_REVIEWED') return NextResponse.json({ error: 'This contribution has already been reviewed. Refresh the list.' }, { status: 409 });
        if (error?.message === 'FOUNDATION_PUBLISHED_CONTRIBUTION_REQUIRED') return NextResponse.json({ error: 'Approval requires a published course with verified first-publication history.' }, { status: 409 });
        if (error) throw error;
        return NextResponse.json({ success: true });
    } catch (error) { return failure(error); }
}
