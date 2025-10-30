import { prisma } from '../src/index.js';

async function main() {
  const run = await prisma.run.findFirst({
    orderBy: { startedAt: 'desc' },
    include: {
      answers: {
        include: {
          query: true
        },
        orderBy: {
          createdAt: 'asc'
        }
      },
      scores: {
        orderBy: { createdAt: 'desc' },
        take: 1
      }
    }
  });

  if (!run) {
    console.log('No runs found.');
    return;
  }

  const payload = {
    runId: run.id,
    surface: run.surface,
    modelName: run.modelName,
    startedAt: run.startedAt,
    finishedAt: run.finishedAt,
    score: run.scores[0]
      ? {
          overallScore: run.scores[0].overallScore,
          visibilityPct: run.scores[0].visibilityPct
        }
      : null,
    answers: run.answers.map((answer) => {
      const rawJson = answer.rawJson as any;
      const raw = rawJson && typeof rawJson === 'object' ? rawJson.raw : null;

      const rawSummary = raw && typeof raw === 'object'
        ? {
            id: raw.id ?? null,
            model: raw.model ?? null,
            finishReason: raw.choices?.[0]?.finish_reason ?? null,
            hasChoices: Array.isArray(raw.choices)
          }
        : null;

      const rawDetails = raw && typeof raw === 'object'
        ? {
            type: Array.isArray(raw) ? 'array' : 'object',
            keys: Object.keys(raw),
            error: 'error' in raw ? String(raw.error) : null,
            contentSample:
              raw.choices?.[0]?.message?.content && typeof raw.choices[0].message.content === 'string'
                ? raw.choices[0].message.content.slice(0, 200)
                : null
          }
        : raw;

      return {
        queryId: answer.queryId,
        queryText: answer.query.text,
        presence: answer.presence,
        flags: answer.flags,
        llmRank: answer.llmRank,
        linkRank: answer.linkRank,
        sov: answer.sov,
        rawKeys: rawJson && typeof rawJson === 'object' ? Object.keys(rawJson) : [],
        rawSummary,
        rawDetails
      };
    })
  };

  console.log(JSON.stringify(payload, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

