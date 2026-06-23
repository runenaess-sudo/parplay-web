
import ClientPage from "./ClientPage";

export default function Page({ params }: { params: { courseId: string } }) {
    return <ClientPage courseId={params.courseId} />;
}
