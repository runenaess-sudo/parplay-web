import { AdminAuthError, requireServerAdmin } from '@/lib/admin-auth';
import FoundationFame from './FoundationFame';

export default async function FoundationFamePage() {
    try { await requireServerAdmin(); }
    catch (error) {
        if (error instanceof AdminAuthError) return <p>You do not have access to this area.</p>;
        throw error;
    }
    return <FoundationFame />;
}
