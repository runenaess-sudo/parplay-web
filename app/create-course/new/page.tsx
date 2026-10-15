import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase-server";
import { canOpenCourseEditor } from "@/lib/course-manager-auth";
import CourseWizard from "@/components/course-wizard/CourseWizard";
export default async function NewCoursePage({ searchParams }: { searchParams: Promise<{ courseId?: string }> }) {
 const { courseId } = await searchParams;
 const db = await supabaseServer();
 const { data: { user } } = await db.auth.getUser();
 if (!user) redirect('/login?returnTo=' + encodeURIComponent('/create-course/new' + (courseId ? '?courseId=' + courseId : '')));
 if (courseId && !await canOpenCourseEditor(courseId)) return <main className="mx-auto max-w-3xl p-8"><h1 className="text-2xl font-semibold">Course access unavailable</h1><p>You do not have permission to manage this course.</p></main>;
 return <CourseWizard key={user.id + ':' + (courseId ?? 'new')} userId={user.id} initialCourseId={courseId ?? null} />;
}
