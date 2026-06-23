"use client";

import ClientPage from "./ClientPage";

export default function Page({ params }: { params: { courseId: string } }) {
    console.log("PAGE PARAMS:", params.courseId);
    return <ClientPage courseId={params.courseId} />;
}
