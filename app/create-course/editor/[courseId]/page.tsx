"use client";
import { useParams } from "next/navigation";
import CourseEditor from "./CourseEditor";
export default function Page() {
 const { courseId } = useParams<{ courseId: string }>();
 return <CourseEditor courseId={courseId} />;
}
