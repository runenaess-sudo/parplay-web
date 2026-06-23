export default function CreateCourseLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <div className="h-screen flex flex-col overflow-hidden bg-slate-950 text-slate-100">
            {children}
        </div>
    );
}
