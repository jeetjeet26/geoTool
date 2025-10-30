import { redirect } from 'next/navigation';

export default function QueriesPage({
  searchParams
}: {
  searchParams?: { surface?: string; clientId?: string };
}) {
  const clientId = searchParams?.clientId;

  if (!clientId) {
    redirect('/');
  }

  const surface = searchParams?.surface;
  const params = new URLSearchParams();

  if (surface) {
    params.set('surface', surface);
  }

  const suffix = params.size > 0 ? `?${params.toString()}` : '';

  redirect(`/clients/${clientId}/queries${suffix}`);
}
