import { requireServerAdmin, AdminAuthError } from '@/lib/admin-auth';
import UserMessages from './UserMessages';

export default async function UserMessagesPage() {
    try { await requireServerAdmin(); }
    catch (error) {
        if (error instanceof AdminAuthError) return <p>You do not have access to this area.</p>;
        throw error;
    }
    return <UserMessages />;
}
