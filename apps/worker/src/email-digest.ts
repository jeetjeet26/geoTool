import process from 'node:process';

import { config as loadEnv } from 'dotenv';

import {
  getClientById,
  getRunDetailWithDiffById,
  listClientAnnotations,
  prisma,
  type QueryAnnotationRecord
} from '@geo/db';

import { isDirectCliInvocation } from './utils/is-direct-invoke.js';

loadEnv();

interface DigestOptions {
  runId: string;
  to?: string;
}

function parseArgs(argv: string[]): DigestOptions {
  const args = argv.slice(2);
  let runId: string | undefined;
  let to: string | undefined;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--run') {
      runId = args[++index];
    } else if (arg === '--to') {
      to = args[++index];
    }
  }

  if (!runId) {
    throw new Error('Missing required argument --run <id>');
  }

  return { runId, to };
}

function formatAnnotations(annotations: QueryAnnotationRecord[]) {
  if (annotations.length === 0) {
    return 'No annotations captured in this workspace for the selected queries.';
  }

  return annotations
    .map((annotation) => {
      const tags = annotation.tags.length ? annotation.tags.join(', ') : 'note';
      const evidence = annotation.evidence.length
        ? ` • Evidence: ${annotation.evidence.map((item) => item.label).join('; ')}`
        : '';
      return `- [${tags}] ${annotation.note ?? 'No note provided.'}${evidence}`;
    })
    .join('\n');
}

function buildDigest({
  clientName,
  runSummary,
  wins,
  risks,
  visibility,
  annotations
}: {
  clientName: string;
  runSummary: string;
  wins: string[];
  risks: string[];
  visibility: string;
  annotations: QueryAnnotationRecord[];
}) {
  const subject = `${clientName} · ${runSummary}`;
  const body = `Hello team,

Here is the latest LLM SERP digest for ${clientName}.

- Run summary: ${runSummary}
- Visibility: ${visibility}
- Top wins:
${wins.length ? wins.map((item) => `  • ${item}`).join('\n') : '  • No major wins this crawl.'}
- Priority risks:
${risks.length ? risks.map((item) => `  • ${item}`).join('\n') : '  • No high-severity regressions logged.'}

Annotations & callouts:
${formatAnnotations(annotations)}

Need anything else pulled before the client email? Reply here and we can add it to the workspace.

— GeoTool Digest Bot
`;

  return { subject, body };
}

export async function generateEmailDigest(): Promise<void> {
  const options = parseArgs(process.argv);
  const detail = await getRunDetailWithDiffById(options.runId);

  if (!detail) {
    throw new Error(`Run ${options.runId} not found`);
  }

  const client = await getClientById(detail.run.clientId);
  const annotations = await listClientAnnotations(detail.run.clientId);

  const wins = detail.queries
    .filter((query) => (query.deltas?.scoreDelta ?? 0) > 4)
    .slice(0, 3)
    .map((query) => `${query.text} (+${(query.deltas?.scoreDelta ?? 0).toFixed(1)} pts)`);

  const risks = detail.queries
    .filter((query) => !query.presence || query.flags.length > 0)
    .slice(0, 3)
    .map((query) => {
      const reasons: string[] = [];
      if (!query.presence) reasons.push('no presence');
      if (query.flags.length) reasons.push(query.flags.join('/'));
      return `${query.text} (${reasons.join(', ')})`;
    });

  const digest = buildDigest({
    clientName: client?.name ?? 'Unknown client',
    runSummary: `${detail.run.surface.toUpperCase()} · ${detail.run.modelName} · Score ${detail.run.overallScore.toFixed(1)}`,
    wins,
    risks,
    visibility: `${detail.run.visibilityPct.toFixed(1)}%`,
    annotations
  });

  if (options.to) {
    console.log(`To: ${options.to}`);
  }
  console.log(`Subject: ${digest.subject}\n`);
  console.log(digest.body);
}

if (isDirectCliInvocation(import.meta.url, process.argv[1])) {
  generateEmailDigest()
    .catch((error) => {
      console.error('Digest generation failed', error);
      process.exitCode = 1;
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}





