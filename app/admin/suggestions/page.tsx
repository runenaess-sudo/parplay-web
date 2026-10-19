import { requireServerAdmin } from '@/lib/admin-auth';
import Suggestions from './Suggestions';
import StatusUpdates from '../../status-updates/StatusUpdates';
import Link from 'next/link';
import { validId } from '@/lib/status-updates';
export default async function SuggestionsPage({searchParams}:{searchParams:Promise<{view?:string;id?:string}>}) {
    await requireServerAdmin();
    const params=await searchParams;
    const updates=params.view==='updates';
    const id=validId(params.id)?params.id:undefined;
    return <div className="min-w-0 space-y-6">
        <nav aria-label="Suggestions administration" className="flex flex-wrap gap-2 rounded-xl border border-white/10 bg-[#161a2b] p-2">
            {[['Suggestions','/admin/suggestions',!updates],['Manage Updates','/admin/suggestions?view=updates',updates]].map(([label,href,active])=><Link key={String(href)} href={String(href)} aria-current={active?'page':undefined} className={'rounded-lg px-4 py-3 text-sm font-semibold '+(active?'bg-orange-500/15 text-orange-300':'text-slate-300 hover:bg-white/10')}>{label}</Link>)}
        </nav>
        {updates?<StatusUpdates key={id??'list'} management id={id}/>:<Suggestions/>}
    </div>;
}
