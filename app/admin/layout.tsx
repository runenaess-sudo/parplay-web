import AdminShell from "@/components/admin/AdminShell";
import { AdminAuthError, requireServerAdmin } from "@/lib/admin-auth";
import type { ReactNode } from "react";

export default async function AdminLayout({ children }: { children: ReactNode }) {
    try {
        await requireServerAdmin();
    } catch (error: unknown) {
        if (error instanceof AdminAuthError) {
            return (
                <main className="mx-auto w-full max-w-3xl p-6 text-white">
                    <h1 className="text-2xl font-semibold">Admin</h1>
                    <p className="mt-3 text-gray-300">
                        You do not have access to this area.
                    </p>
                </main>
            );
        }
        throw error;
    }

    return <AdminShell>{children}</AdminShell>;
}
