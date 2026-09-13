import assert from "node:assert/strict";
import test from "node:test";
import {
    COURSE_MANAGER_TRANSFER_TOKEN_PATTERN,
    courseManagerTransferPath,
    isBasicEmail,
    isSafeTransferReturnTo,
    maskTransferEmail,
} from "./course-manager-transfer.ts";

const token = "a".repeat(64);

test("accepts only the canonical opaque transfer token format", () => {
    assert.equal(COURSE_MANAGER_TRANSFER_TOKEN_PATTERN.test(token), true);
    assert.equal(COURSE_MANAGER_TRANSFER_TOKEN_PATTERN.test("not-a-token"), false);
    assert.equal(courseManagerTransferPath(token), `/course-manager-transfer/${token}`);
});

test("returnTo permits the exact transfer route without permitting open redirects", () => {
    assert.equal(isSafeTransferReturnTo(`/course-manager-transfer/${token}`), true);
    assert.equal(isSafeTransferReturnTo(`https://evil.example/course-manager-transfer/${token}`), false);
    assert.equal(isSafeTransferReturnTo(`/course-manager-transfer/${token}/extra`), false);
});

test("recipient presentation masks email and validates basic input", () => {
    assert.equal(maskTransferEmail("Recipient@Example.com"), "r***@example.com");
    assert.equal(isBasicEmail("recipient@example.com"), true);
    assert.equal(isBasicEmail("invalid address"), false);
});
