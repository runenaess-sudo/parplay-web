import test from 'node:test';
import assert from 'node:assert/strict';
import { courseCommunityHref, courseFeedArgs, courseIdPattern } from './community-course.ts';
test('specific course links retain exact UUID and suppress geographic scope', () => {
    const id = '12345678-1234-1234-1234-123456789abc';
    assert.ok(courseIdPattern.test(id));
    assert.ok(!courseIdPattern.test('../courses'));
    assert.equal(courseCommunityHref(id), `/community?course=${id}`);
    assert.deepEqual(courseFeedArgs(id, 'nearby', 'NO', null, 'helpful', true, 0), {
        p_course_id: id, p_scope: 'all', p_country: 'NO', p_lat: null, p_lon: null, p_sort: 'helpful', p_limit: 4, p_offset: 0,
    });
});
test('geographic scope and sort are independent server parameters with bounded paging', () => {
    for (const scope of ['nearby', 'country', 'all']) for (const sort of ['newest', 'helpful']) {
        const args = courseFeedArgs(undefined, scope, 'NO', { lat: 60, lon: 9 }, sort, false, 20);
        assert.equal(args.p_course_id, null); assert.equal(args.p_scope, scope); assert.equal(args.p_sort, sort);
        assert.equal(args.p_lat, 60); assert.equal(args.p_lon, 9); assert.equal(args.p_limit, 20); assert.equal(args.p_offset, 20);
    }
});
