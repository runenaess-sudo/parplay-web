'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { diagnosesChanged } from '@/lib/diagnoses';

export default function DiagnosesLink() {
    const pathname = usePathname();
    const [count, setCount] = useState<number | null>(null);
    useEffect(() => {
        let controller: AbortController | undefined;
        async function refresh() {
            controller?.abort();
            const request = new AbortController(); controller = request;
            try {
                const response = await fetch('/api/admin/diagnoses?count=1', { cache: 'no-store', signal: request.signal });
                if (!response.ok) throw Error('Unavailable');
                const data = await response.json();
                if (!request.signal.aborted) setCount(Number.isSafeInteger(data.pending_count) && data.pending_count >= 0 ? data.pending_count : null);
            } catch { if (!request.signal.aborted) setCount(null); }
        }
        void refresh();
        window.addEventListener(diagnosesChanged, refresh);
        window.addEventListener('focus', refresh);
        return () => { controller?.abort(); window.removeEventListener(diagnosesChanged, refresh); window.removeEventListener('focus', refresh); };
    }, [pathname]);
    return <Link href="/admin/diagnoses" className={`shrink-0 rounded-xl px-3 py-2.5 text-sm font-medium ${pathname.startsWith('/admin/diagnoses') ? 'bg-blue-600 text-white' : 'text-gray-300 hover:bg-white/10'}`}>
        Diagnoses ({count ?? '—'})
    </Link>;
}
