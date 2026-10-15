import assert from 'node:assert/strict';
import test from 'node:test';
import {
    BasicCourseValidationError,
    createSingleFlight,
    createStepNavigationLock,
    requireConfirmedCourseId,
    saveBasicCourse,
    validateBasicCourse,
} from './basicCourseSave.ts';

const valid = { name: 'Pine Course', location: 'Oslo', latitude: '', longitude: '', description: '' };

function dependencies(overrides = {}) {
    const calls = { retry: 0, nearby: 0, insert: 0, update: 0 };
    return {
        calls,
        deps: {
            findRetry: async () => { calls.retry++; return null; },
            findNearby: async () => { calls.nearby++; return []; },
            insert: async (id) => { calls.insert++; return id; },
            update: async (id) => { calls.update++; return id; },
            ...overrides,
        },
    };
}

test('requires trimmed name and city; coordinates may be omitted', () => {
    assert.deepEqual(validateBasicCourse({ ...valid, name: '  ' }).errors.name, 'Enter a course name.');
    assert.deepEqual(validateBasicCourse({ ...valid, location: '' }).errors.location, 'Enter a city or area.');
    assert.deepEqual(validateBasicCourse(valid).errors, {});
});

test('requires coordinate pairs and enforces latitude/longitude ranges', () => {
    assert.ok(validateBasicCourse({ ...valid, latitude: '59.9' }).errors.longitude);
    assert.ok(validateBasicCourse({ ...valid, longitude: '10.7' }).errors.latitude);
    assert.ok(validateBasicCourse({ ...valid, latitude: '91', longitude: '10' }).errors.latitude);
    assert.ok(validateBasicCourse({ ...valid, latitude: '59', longitude: '181' }).errors.longitude);
    assert.ok(validateBasicCourse({ ...valid, latitude: 'north', longitude: '10' }).errors.latitude);
});

test('new course saves after valid data and returns the confirmed ID', async () => {
    const { calls, deps } = dependencies();
    const id = await saveBasicCourse({ value: { ...valid, latitude: '59,9', longitude: '10,7' }, userId: 'u1', courseId: null, insertId: 'new-id', isAdmin: false }, deps);
    assert.equal(id, 'new-id');
    assert.equal(calls.insert, 1);
    assert.equal(calls.nearby, 1);
});

test('rejects a nearby course for non-admin and skips that check for Admin', async () => {
    const close = { id: 'existing', name: 'Existing course', latitude: 59.9, longitude: 10.7 };
    const denied = dependencies({ findNearby: async () => [close] });
    await assert.rejects(saveBasicCourse({ value: { ...valid, latitude: '59.9', longitude: '10.7' }, userId: 'u1', courseId: null, insertId: 'new-id', isAdmin: false }, denied.deps), /within 200 metres/);
    assert.equal(denied.calls.insert, 0);

    const admin = dependencies({ findNearby: async () => [close] });
    assert.equal(await saveBasicCourse({ value: { ...valid, latitude: '59.9', longitude: '10.7' }, userId: 'u1', courseId: null, insertId: 'new-id', isAdmin: true }, admin.deps), 'new-id');
    assert.equal(admin.calls.nearby, 0);
});

test('propagates database errors without reporting a confirmed save', async () => {
    const { deps } = dependencies({ insert: async () => { throw new Error('COURSE_DAILY_LIMIT_REACHED'); } });
    await assert.rejects(saveBasicCourse({ value: valid, userId: 'u1', courseId: null, insertId: 'new-id', isAdmin: false }, deps), /COURSE_DAILY_LIMIT_REACHED/);
});

test('updates an existing draft and does not insert another course', async () => {
    const { calls, deps } = dependencies();
    assert.equal(await saveBasicCourse({ value: valid, userId: 'u1', courseId: 'draft-id', insertId: 'unused', isAdmin: false }, deps), 'draft-id');
    assert.equal(calls.update, 1);
    assert.equal(calls.insert, 0);
    assert.equal(calls.retry, 0);
});

test('single-flight prevents duplicate Save requests from concurrent Next events', async () => {
    let finish;
    let calls = 0;
    const save = createSingleFlight(() => {
        calls++;
        return new Promise(resolve => { finish = resolve; });
    });
    const first = save();
    const second = save();
    assert.equal(first, second);
    assert.equal(calls, 1);
    finish('course-id');
    assert.equal(await first, 'course-id');
});

test('navigation lock permits only one simultaneous Next transition', async () => {
    const lock = createStepNavigationLock();
    let finish;
    let advances = 0;
    async function next() {
        if (!lock.acquire()) return false;
        try {
            await new Promise(resolve => { finish = resolve; });
            advances++;
            return true;
        } finally { lock.release(); }
    }
    const first = next();
    assert.equal(await next(), false);
    finish();
    assert.equal(await first, true);
    assert.equal(advances, 1);
    assert.equal(lock.acquire(), true);
    lock.release();
});

test('Step 1 cannot advance without a confirmed matching course ID', () => {
    assert.equal(requireConfirmedCourseId('course-id', 'course-id'), 'course-id');
    assert.throws(() => requireConfirmedCourseId(undefined, null), /did not confirm/);
    assert.throws(() => requireConfirmedCourseId('different-id', 'course-id'), /did not confirm/);
});

test('database failure keeps navigation on Step 1 and concurrent Save/Next waits for the same save', async () => {
    const failedLock = createStepNavigationLock();
    let failedAdvance = false;
    const fail = createSingleFlight(async () => { throw new Error('Database unavailable'); });
    assert.equal(failedLock.acquire(), true);
    await assert.rejects(fail(), /Database unavailable/);
    try { requireConfirmedCourseId(undefined, null); failedAdvance = true; } catch { /* Stay on Step 1. */ }
    failedLock.release();
    assert.equal(failedAdvance, false);

    const lock = createStepNavigationLock();
    let finishSave;
    let saveCalls = 0;
    let advances = 0;
    const save = createSingleFlight(() => {
        saveCalls++;
        return new Promise(resolve => { finishSave = resolve; });
    });
    const saveAlreadyStarted = save();
    async function next() {
        if (!lock.acquire()) return false;
        try {
            const id = await save();
            requireConfirmedCourseId(id, id);
            advances++;
            return true;
        } finally { lock.release(); }
    }
    const firstNext = next();
    assert.equal(await next(), false);
    assert.equal(saveCalls, 1);
    assert.equal(advances, 0);
    finishSave('course-id');
    await saveAlreadyStarted;
    assert.equal(await firstNext, true);
    assert.equal(advances, 1);
});

test('invalid input raises field-specific validation errors before database work', async () => {
    const { calls, deps } = dependencies();
    await assert.rejects(saveBasicCourse({ value: { ...valid, name: ' ' }, userId: 'u1', courseId: null, insertId: 'new-id', isAdmin: false }, deps), error => {
        assert.ok(error instanceof BasicCourseValidationError);
        assert.equal(error.fields.name, 'Enter a course name.');
        return true;
    });
    assert.equal(calls.insert, 0);
    assert.equal(calls.nearby, 0);
});