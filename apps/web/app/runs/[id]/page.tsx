import { notFound, redirect } from 'next/navigation';

import { getRunDetail } from '@geo/db';

export default async function LegacyRunDetailRedirect({
  params,
  searchParams
}: {
  params: { id: string };
  searchParams?: { clientId?: string };
}) {
  const clientId = searchParams?.clientId;

  if (clientId) {
    redirect(`/clients/${clientId}/runs/${params.id}`);
  }

  const runDetail = await getRunDetail(params.id);

  if (runDetail) {
    redirect(`/clients/${runDetail.run.clientId}/runs/${params.id}`);
  }

  notFound();
}
