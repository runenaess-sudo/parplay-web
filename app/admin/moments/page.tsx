import { AdminAuthError, requireServerAdmin } from '@/lib/admin-auth';
import Moments from './Moments';
export default async function MomentsPage() {
    try { await requireServerAdmin(); }
    catch (error) {
        if (error instanceof AdminAuthError) return <p>You do not have access to this area.</p>;
        throw error;
    }
    return <Moments />;
}
