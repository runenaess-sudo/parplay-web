import { COURSE_MANAGER_TRANSFER_TOKEN_PATTERN } from "@/lib/course-manager-transfer";
import TransferInvitationClient from "./TransferInvitationClient";

export default async function CourseManagerTransferPage({ params }: { params: Promise<{ token: string }> }) {
    const { token } = await params;
    return <TransferInvitationClient token={COURSE_MANAGER_TRANSFER_TOKEN_PATTERN.test(token) ? token : "invalid"} />;
}
