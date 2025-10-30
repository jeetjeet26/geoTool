import { NextResponse } from 'next/server';

import { getActiveRuns } from '@geo/db';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const clientId = searchParams.get('clientId');

  if (!clientId) {
    return NextResponse.json({ error: 'Missing clientId' }, { status: 400 });
  }

  const activeRuns = await getActiveRuns(clientId);

  // Serialize dates properly
  const serializedRuns = activeRuns.map((run) => ({
    runId: run.runId,
    surface: run.surface,
    modelName: run.modelName,
    startedAt: run.startedAt.toISOString()
  }));

  return NextResponse.json({ activeRuns: serializedRuns });
}

