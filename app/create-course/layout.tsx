"use client";
export default function CreateCourseLayout({ children }: { children: React.ReactNode }) {
    return (
        <div className="h-screen flex flex-col bg-slate-950 text-slate-100 relative min-h-0">
            {children}
        </div>
    );
}
