export const COURSE_MANAGER_TRANSFER_TOKEN_PATTERN = /^[0-9a-f]{64}$/i;
export const COURSE_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function courseManagerTransferPath(token: string) {
    return `/course-manager-transfer/${token}`;
}

export function isSafeTransferReturnTo(value: string | null) {
    return !!value && /^\/course-manager-transfer\/[0-9a-f]{64}$/i.test(value);
}

export function maskTransferEmail(email: string) {
    const [local, domain] = email.trim().toLowerCase().split("@");
    return local && domain ? `${local.slice(0, 1)}***@${domain}` : "***";
}

export function isBasicEmail(value: string) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim()) && value.trim().length <= 320;
}
