import { revalidatePath } from 'next/cache';
import { NextResponse } from 'next/server';
import { runClientOnce } from '@geo/db';

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const clientId = formData.get('clientId')?.toString();

    if (!clientId) {
      return NextResponse.json({ error: 'Missing client ID' }, { status: 400 });
    }

    // Start the run asynchronously
    runClientOnce({
      clientId,
      surfaces: ['openai', 'claude']
    }).catch((error) => {
      console.error('[api] Run failed:', error);
    });

    // Revalidate paths
    revalidatePath(`/clients/${clientId}`);
    revalidatePath(`/clients/${clientId}/runs`);
    revalidatePath(`/clients/${clientId}/queries`);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[api] Trigger run error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to trigger run' },
      { status: 500 }
    );
  }
}


