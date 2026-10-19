import { requireServerAdmin } from '@/lib/admin-auth';
import Suggestions from './Suggestions';
export default async function SuggestionsPage() {
    await requireServerAdmin();
    return <Suggestions />;
}
