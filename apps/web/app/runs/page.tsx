import { redirect } from 'next/navigation';

export default function RunsPage({
  searchParams
}: {
  searchParams?: { clientId?: string };
}) {
  const clientId = searchParams?.clientId;

  if (clientId) {
    redirect(`/clients/${clientId}/runs`);
  }

  redirect('/');
}
