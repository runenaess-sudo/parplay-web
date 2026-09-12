import { getServerManageableCourses } from "@/lib/course-manager-auth";
import { EditCourseSelector } from "./EditCourseSelector";

export default async function EditCoursePage() {
    const courses = await getServerManageableCourses();

    return <div className="mx-auto max-w-2xl p-6 text-white">
        <h1 className="mb-6 text-3xl font-bold">Edit Existing Course</h1>
        <p className="mb-6 text-gray-400">Select one of your courses to continue editing.</p>
        {courses === null
            ? <div className="text-gray-500">Log in to edit courses.</div>
            : <EditCourseSelector courses={courses} />}
    </div>;
}
