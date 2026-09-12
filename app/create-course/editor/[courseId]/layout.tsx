import { canOpenCourseEditor } from "@/lib/course-manager-auth";
import type { ReactNode } from "react";

export default async function CourseEditorLayout({ children, params }: { children: ReactNode; params: Promise<{ courseId: string }> }) {
    const { courseId } = await params;
    if (!await canOpenCourseEditor(courseId)) {
        return <main className="mx-auto max-w-3xl p-6 text-white"><h1 className="text-2xl font-semibold">Course Editor</h1><p className="mt-3 text-gray-300">You do not have access to manage this course.</p></main>;
    }
    return children;
}
