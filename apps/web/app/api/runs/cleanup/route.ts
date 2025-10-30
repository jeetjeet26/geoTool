import { NextResponse } from 'next/server';

import { cleanupStaleRuns, getActiveRuns } from '@geo/db';

export async function POST(request: Request) {
  const { searchParams } = new URL(request.url);
  const clientId = searchParams.get('clientId');

  if (!clientId) {
    return NextResponse.json({ error: 'Missing clientId' }, { status: 400 });
  }

  try {
    const cleanedCount = await cleanupStaleRuns(clientId);
    const activeRuns = await getActiveRuns(clientId);

    return NextResponse.json({
      success: true,
      cleanedCount,
      remainingActiveRuns: activeRuns.length
    });
  } catch (error) {
    console.error('[api] Cleanup failed', error);
    return NextResponse.json(
      {
        error: 'Cleanup failed',
        message: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}


