import { AdminAuthError, requireServerAdmin } from '@/lib/admin-auth';
import { parseCommunityQuery } from '@/lib/community-admin';
import { NextResponse } from 'next/server';

function failure(error: unknown) {
    return NextResponse.json({ error: error instanceof AdminAuthError ? error.message : 'Community request failed. Please try again.' },
        { status: error instanceof AdminAuthError ? error.status : 500 });
}

export async function GET(request: Request) {
    try {
        const { supabase } = await requireServerAdmin();
        let args;
        try { args = parseCommunityQuery(new URL(request.url).searchParams); }
        catch { return NextResponse.json({ error: 'Invalid filter or page.' }, { status: 400 }); }
        const { data, error } = await supabase.rpc('get_community_workspace_v1', args);
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
        if (!body || typeof body.id !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(body.id) ||
            !['APPROVED', 'DECLINED'].includes(body.decision)) return NextResponse.json({ error: 'Invalid decision.' }, { status: 400 });
        const { error } = await supabase.rpc('moderate_community_post_v1', { p_post_id: body.id, p_decision: body.decision });
        if (error) throw error;
        return NextResponse.json({ success: true });
    } catch (error) { return failure(error); }
}
