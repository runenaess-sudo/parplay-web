import Link from "next/link";
import { getServerCourseBuilds } from "@/lib/course-manager-auth";
import { EditCourseSelector } from "./EditCourseSelector";

export default async function EditCoursePage() {
    const courses = await getServerCourseBuilds();

    return <div className="mx-auto max-w-2xl p-6 text-white">
        <h1 className="text-3xl font-bold">My Course Builds</h1>
        <p className="mt-2 mb-6 text-gray-400">Courses you have built and can still manage.</p>
        {courses === null
            ? <div className="text-gray-500">Log in to view your course builds.</div>
            : courses.length > 0
                ? <EditCourseSelector courses={courses} />
                : <section className="rounded-2xl border border-white/10 bg-white/5 p-6 shadow-xl">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-300">Contribute to ParPlay</p>
                    <h2 className="mt-2 text-xl font-semibold">Build your first course</h2>
                    <p className="mt-3 text-sm leading-6 text-gray-300">
                        Help ParPlay grow by adding a course that is missing. Course contributions can be recognised through Foundation Fame, and a course can later be handed over to its actual owner or club.
                    </p>
                    <Link href="/create-course/new" className="mt-5 inline-block rounded-xl bg-blue-500 px-5 py-3 font-semibold text-white transition hover:bg-blue-400">
                        Create Course
                    </Link>
                </section>}
    </div>;
}
