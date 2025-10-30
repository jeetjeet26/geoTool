'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';

export default function ClientActions() {
  const searchParams = useSearchParams();
  const clientId = searchParams.get('clientId');

  const href = clientId ? { pathname: '/runs', query: { clientId } } : '/runs';

  return (
    <Link
      className="inline-flex items-center gap-2 rounded-full bg-brand px-5 py-2 text-sm font-semibold text-white shadow-card transition-colors hover:bg-brand-bold"
      href={href as any}
    >
      Prepare client report
    </Link>
  );
}





