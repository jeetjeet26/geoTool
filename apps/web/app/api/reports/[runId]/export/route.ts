import { NextResponse } from 'next/server';

import { getClientById, getRunDetailWithDiffById } from '@geo/db';

function toPercent(value: number | null | undefined): string {
  if (value === null || value === undefined) {
    return '—';
  }
  return `${value.toFixed(1)}%`;
}

async function generatePDF(runId: string, baseUrl: string): Promise<Buffer> {
  const puppeteer = await import('puppeteer-core');
  const chromium = await import('@sparticuz/chromium');
  
  const browser = await puppeteer.default.launch({
    args: chromium.default.args,
    executablePath: await chromium.default.executablePath(),
    headless: true,
  });
  
  try {
    const page = await browser.newPage();
    
    // Navigate to the report page
    const reportUrl = `${baseUrl}/reports/${runId}/client`;
    
    // Set up error handling
    const errors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });
    
    page.on('pageerror', (error) => {
      errors.push(error.message);
    });
    
    await page.goto(reportUrl, { waitUntil: 'networkidle0', timeout: 30000 });
    
    // Wait for React to hydrate and render
    await page.waitForSelector('.print-report', { timeout: 10000 }).catch(() => {
      // If selector not found, continue anyway
    });
    
    // Wait for charts and visualizations to render
    await page.waitForTimeout(3000);
    
    // Hide any error overlays or development indicators before PDF generation
    await page.evaluate(() => {
      // Hide Next.js error overlays and development indicators
      const selectors = [
        '[data-nextjs-dialog]',
        '[data-nextjs-dialog-overlay]',
        '[data-nextjs-toast]',
        '#__next-build-watcher',
        '#__next-dev-overlay',
        '[id^="__nextjs"]',
        '[id*="error-overlay"]',
        '[class*="react-error-overlay"]',
        '[class*="__nextjs"]',
        // Common error indicator patterns
        'button[aria-label*="error"]',
        'button[aria-label*="Error"]',
        '[role="button"][class*="error"]',
        'a[href*="error"]',
        // Any fixed/floating error indicators
        '[style*="position: fixed"][class*="error"]',
        '[style*="position: fixed"][id*="error"]'
      ];
      
      selectors.forEach(selector => {
        try {
          const elements = document.querySelectorAll(selector);
          elements.forEach(el => {
            const htmlEl = el as HTMLElement;
            htmlEl.style.display = 'none';
            htmlEl.style.visibility = 'hidden';
            htmlEl.style.opacity = '0';
            htmlEl.style.position = 'absolute';
            htmlEl.style.left = '-9999px';
          });
        } catch (e) {
          // Ignore selector errors
        }
      });
      
      // Hide any error buttons/indicators that appear as overlays
      const errorButtons = document.querySelectorAll('button[class*="error"], [role="dialog"][class*="error"]');
      errorButtons.forEach(el => {
        const htmlEl = el as HTMLElement;
        htmlEl.style.display = 'none';
        htmlEl.style.visibility = 'hidden';
      });
      
      // Specifically look for error count badges/buttons (like "1 error")
      const allButtons = document.querySelectorAll('button, [role="button"], a[role="button"]');
      allButtons.forEach(button => {
        const htmlEl = button as HTMLElement;
        const text = (button.textContent || '').toLowerCase();
        const ariaLabel = (button.getAttribute('aria-label') || '').toLowerCase();
        const rect = htmlEl.getBoundingClientRect();
        const isFixed = window.getComputedStyle(htmlEl).position === 'fixed';
        const isNearBottom = rect.top > window.innerHeight - 100;
        
        // Check if it's an error indicator button
        if ((text.match(/\d+\s*error/i) || ariaLabel.match(/\d+\s*error/i) || 
             (text.includes('error') && isFixed) || (text.includes('error') && isNearBottom)) &&
            !htmlEl.closest('.print-report')) {
          htmlEl.style.display = 'none';
          htmlEl.style.visibility = 'hidden';
          htmlEl.style.opacity = '0';
        }
      });
    });
    
    // Wait a bit more for any animations to complete
    await page.waitForTimeout(500);
    
    // Log any remaining errors for debugging
    if (errors.length > 0) {
      console.warn('Errors detected during PDF generation:', errors.slice(0, 5)); // Limit to first 5
    }
    
    // Check for any visible error indicators that weren't hidden
    const remainingErrors = await page.evaluate(() => {
      const errorButtons = Array.from(document.querySelectorAll('button, [role="button"]'))
        .filter(el => {
          const text = (el.textContent || '').toLowerCase();
          return text.includes('error') && text.match(/\d+/);
        })
        .map(el => ({
          text: el.textContent,
          position: window.getComputedStyle(el as HTMLElement).position,
          visible: window.getComputedStyle(el as HTMLElement).display !== 'none'
        }));
      return errorButtons;
    });
    
    if (remainingErrors.length > 0) {
      console.warn('Remaining error indicators found:', remainingErrors);
    }
    
    // Generate PDF
    const pdfBuffer = await page.pdf({
      format: 'letter',
      margin: {
        top: '0.75in',
        right: '0.75in',
        bottom: '0.75in',
        left: '0.75in'
      },
      printBackground: true,
      preferCSSPageSize: false
    });
    
    return pdfBuffer;
  } finally {
    await browser.close();
  }
}

export async function GET(
  request: Request,
  context: {
    params: {
      runId: string;
    };
  }
) {
  const { runId } = context.params;

  if (!runId) {
    return NextResponse.json({ error: 'Missing runId' }, { status: 400 });
  }

  const runDetail = await getRunDetailWithDiffById(runId);

  if (!runDetail) {
    return NextResponse.json({ error: 'Run not found' }, { status: 404 });
  }

  const client = await getClientById(runDetail.run.clientId);
  const clientName = client?.name ?? 'Unknown client';

  // Check if PDF format is requested
  const url = new URL(request.url);
  const format = url.searchParams.get('format') || 'markdown';

  if (format === 'pdf') {
    try {
      // Get base URL from request headers or environment
      const baseUrl =
        process.env.NEXT_PUBLIC_BASE_URL ||
        `${request.headers.get('x-forwarded-proto') || 'http'}://${request.headers.get('host') || 'localhost:3000'}`;

      const pdfBuffer = await generatePDF(runId, baseUrl);

      // Generate filename with client name and run details
      const dateStr = runDetail.run.finishedAt
        ? new Date(runDetail.run.finishedAt).toISOString().split('T')[0]
        : 'in-progress';
      const filename = `${clientName.replace(/[^a-z0-9]/gi, '_')}_report_${dateStr}.pdf`;

      return new NextResponse(pdfBuffer as unknown as BodyInit, {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="${filename}"`
        }
      });
    } catch (error) {
      console.error('PDF generation failed:', error);
      return NextResponse.json(
        { error: 'Failed to generate PDF', details: error instanceof Error ? error.message : 'Unknown error' },
        { status: 500 }
      );
    }
  }

  // Default: return markdown report
  const wins = runDetail.queries
    .filter((query) => (query.deltas?.scoreDelta ?? 0) > 4)
    .slice(0, 5);
  const declines = runDetail.queries
    .filter((query) => (query.deltas?.scoreDelta ?? 0) < -4)
    .slice(0, 5);
  const flagged = runDetail.queries.filter((query) => query.flags.length > 0);

  const markdownReport = [`# ${clientName} · ${runDetail.run.surface.toUpperCase()} run`, '', `- Run ID: ${runDetail.run.runId}`, `- Model: ${runDetail.run.modelName}`, `- Completed: ${runDetail.run.finishedAt?.toISOString() ?? 'in progress'}`, `- Overall score: ${runDetail.run.overallScore.toFixed(1)}`, `- Visibility: ${runDetail.run.visibilityPct.toFixed(1)}%`, '', '## Highlights', wins.length === 0 ? '- No major wins this run.' : wins.map((query) => `- ✅ ${query.text} (+${(query.deltas?.scoreDelta ?? 0).toFixed(1)} pts)`).join('\n'), '', '## Regression watch', declines.length === 0 ? '- No meaningful declines.' : declines.map((query) => `- ⚠️ ${query.text} (${(query.deltas?.scoreDelta ?? 0).toFixed(1)} pts)`).join('\n'), '', '## Flagged queries', flagged.length === 0 ? '- No evaluator flags recorded.' : flagged.map((query) => `- ❗ ${query.text}: ${query.flags.join(', ')}`).join('\n'), '', '## Full query table', '| Query | Presence | LLM Rank | Link Rank | SOV | Score | Δ Score |', '| ----- | -------- | -------- | --------- | --- | ----- | ------- |'];

  runDetail.queries.forEach((query) => {
    markdownReport.push(
      `| ${query.text} | ${query.presence ? 'Yes' : 'No'} | ${query.llmRank ?? '—'} | ${
        query.linkRank ?? '—'
      } | ${toPercent(query.sov ? query.sov * 100 : null)} | ${query.score.toFixed(1)} | ${
        (query.deltas?.scoreDelta ?? 0) >= 0 ? '+' : ''
      }${(query.deltas?.scoreDelta ?? 0).toFixed(1)} |`
    );
  });

  const markdown = markdownReport.join('\n');

  // Generate filename with client name and run details
  const dateStr = runDetail.run.finishedAt
    ? new Date(runDetail.run.finishedAt).toISOString().split('T')[0]
    : 'in-progress';
  const filename = `${clientName.replace(/[^a-z0-9]/gi, '_')}_${runDetail.run.surface}_${dateStr}.md`;

  return new NextResponse(markdown, {
    headers: {
      'Content-Type': 'text/markdown; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`
    }
  });
}




