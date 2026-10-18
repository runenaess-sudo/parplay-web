import { requireServerAdmin } from '@/lib/admin-auth';
import Diagnoses from './Diagnoses';
export default async function DiagnosesPage() {
    await requireServerAdmin();
    return <Diagnoses />;
}
