import { AdminAuthError, requireServerAdmin } from '@/lib/admin-auth';
import { NextResponse } from 'next/server';
function failure(error: unknown) {
    return NextResponse.json({ error: error instanceof AdminAuthError ? error.message : 'Could not load or save Moment controls. Check that the Moments admin migration is installed.' },
        { status: error instanceof AdminAuthError ? error.status : 500 });
}
export async function GET() {
    try {
        const { supabase } = await requireServerAdmin();
        const { data, error } = await supabase.rpc('get_admin_moment_types_v1');
        if (error) throw error;
        return NextResponse.json(data, { headers: { 'Cache-Control': 'private, no-store' } });
    } catch (error) { return failure(error); }
}
export async function POST(request: Request) {
    try {
        const { supabase } = await requireServerAdmin();
        if (request.headers.get('origin') !== new URL(request.url).origin)
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        const body = await request.json().catch(() => null);
        if (!body || typeof body.type !== 'string' || !/^[a-z_]{1,80}$/.test(body.type)
            || typeof body.enabled !== 'boolean' || !Number.isSafeInteger(body.revision) || body.revision < 0)
            return NextResponse.json({ error: 'Invalid Moment control.' }, { status: 400 });
        const { data, error } = await supabase.rpc('set_admin_moment_type_v1', {
            p_type: body.type, p_enabled: body.enabled, p_expected_revision: body.revision,
        });
        if (error?.code === '40001') return NextResponse.json({ error: 'Another admin changed this type. Refresh before trying again.' }, { status: 409 });
        if (error) throw error;
        return NextResponse.json(data, { headers: { 'Cache-Control': 'private, no-store' } });
    } catch (error) { return failure(error); }
}
