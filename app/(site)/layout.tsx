export default function SiteLayout({
    children,
    params,
}: {
    children: React.ReactNode;
    params: any;
}) {
    return (
        <>
            <main className="flex-1 pt-6">
                {children}
            </main>
        </>
    );
}
