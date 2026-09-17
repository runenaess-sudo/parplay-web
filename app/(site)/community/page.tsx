import Community from '@/components/community/Community';
import { courseIdPattern } from '@/lib/community-course';
import { communityCategories, type CommunityCategory } from '@/lib/community-admin';
export const metadata = { title: 'Community | ParPlay' };
export default async function CommunityPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
    const query = await searchParams;
    if (query.course !== undefined && (typeof query.course !== 'string' || !courseIdPattern.test(query.course))) return <p>Invalid course link.</p>;
    const category = typeof query.category === 'string' && Object.hasOwn(communityCategories, query.category) ? query.category as CommunityCategory : '';
    return <Community key={typeof query.course === 'string' ? query.course : category} courseId={query.course as string | undefined} initialCategory={category} />;
}
