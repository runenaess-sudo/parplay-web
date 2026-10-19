import { AdminAuthError, requireServerAdmin } from '@/lib/admin-auth';
import { validId } from '@/lib/status-updates';
import { NextResponse } from 'next/server';
const headers = { 'Cache-Control': 'private, no-store' };
export async function GET(request: Request) {
    try {
        const { supabase } = await requireServerAdmin();
        const params = new URL(request.url).searchParams;
        const before = params.get('before'), beforeId = params.get('before_id');
        if ((before === null) !== (beforeId === null) || (beforeId !== null && !validId(beforeId)) ||
            (before !== null && (before.length > 40 || !Number.isFinite(Date.parse(before)))))
            return NextResponse.json({ error: 'Invalid cursor.' }, { status: 400, headers });
        const { data, error } = await supabase.rpc('get_admin_suggestions_v1', { p_before: before, p_before_id: beforeId });
        if (error) throw error;
        return NextResponse.json(data, { headers });
    } catch (error) {
        return NextResponse.json({ error: error instanceof AdminAuthError ? error.message : 'Could not load suggestions.' },
            { status: error instanceof AdminAuthError ? error.status : 503, headers });
    }
}
