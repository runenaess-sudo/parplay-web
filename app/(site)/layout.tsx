export const dynamic = "force-dynamic";
import { Header } from "@/src/components/Header/Header";

export default function SiteLayout({ children }: { children: React.ReactNode }) {
    return (
        <>
            <Header />
            <main className="flex-1 pt-6">
                {children}
            </main>
        </>
    );
}
