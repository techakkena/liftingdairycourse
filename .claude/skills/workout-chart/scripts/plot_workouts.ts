#!/usr/bin/env tsx
/**
 * Query workouts from the past 12 months and generate a monthly bar chart PNG.
 * Uses project's existing tsx, @neondatabase/serverless, and sharp — no extra npm installs.
 *
 * Usage:
 *   npx tsx plot_workouts.ts --env /path/to/.env --output /path/to/workout_chart.png
 */

import { readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';

function parseArgs() {
  const args = process.argv.slice(2);
  const get = (flag: string) => {
    const idx = args.indexOf(flag);
    return idx !== -1 ? args[idx + 1] : null;
  };
  const envPath = get('--env');
  const output = get('--output') ?? 'workout_chart.png';
  if (!envPath) {
    console.error('Usage: tsx plot_workouts.ts --env <path/.env> --output <path/chart.png>');
    process.exit(1);
  }
  return { envPath, output };
}

function loadDatabaseUrl(envPath: string): string {
  const content = readFileSync(resolve(envPath), 'utf-8');
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (trimmed.startsWith('DATABASE_URL=')) {
      return trimmed.slice('DATABASE_URL='.length).replace(/^['"]|['"]$/g, '');
    }
  }
  const fromEnv = process.env.DATABASE_URL;
  if (fromEnv) return fromEnv;
  throw new Error('DATABASE_URL not found in env file or environment.');
}

async function queryMonthlyWorkouts(databaseUrl: string): Promise<{ label: string; count: number }[]> {
  const { neon } = await import('@neondatabase/serverless' as any);
  const sql = neon(databaseUrl);

  const rows = await sql`
    SELECT
      TO_CHAR(DATE_TRUNC('month', created_at AT TIME ZONE 'UTC'), 'Mon YYYY') AS label,
      DATE_TRUNC('month', created_at AT TIME ZONE 'UTC')                       AS month_date,
      COUNT(*)::int                                                             AS count
    FROM workouts
    WHERE created_at >= NOW() - INTERVAL '12 months'
    GROUP BY label, month_date
    ORDER BY month_date ASC
  `;

  return rows.map((r: any) => ({ label: r.label as string, count: r.count as number }));
}

function buildMonthSeries(dbRows: { label: string; count: number }[]): { label: string; count: number }[] {
  const now = new Date();
  const dataMap = new Map(dbRows.map((r) => [r.label, r.count]));
  const months: { label: string; count: number }[] = [];

  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const label = d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
    months.push({ label, count: dataMap.get(label) ?? 0 });
  }
  return months;
}

function generateSvg(data: { label: string; count: number }[]): string {
  const W = 960, H = 480;
  const MARGIN = { top: 50, right: 30, bottom: 90, left: 60 };
  const chartW = W - MARGIN.left - MARGIN.right;
  const chartH = H - MARGIN.top - MARGIN.bottom;

  const maxCount = Math.max(...data.map((d) => d.count), 1);
  const gap = 8;
  const barW = (chartW - gap * (data.length + 1)) / data.length;

  const yScale = (v: number) => chartH - (v / maxCount) * chartH;

  let gridLines = '';
  let yLabels = '';
  for (let i = 0; i <= 5; i++) {
    const val = Math.round((maxCount / 5) * i);
    const y = yScale(val);
    gridLines += `<line x1="0" y1="${y}" x2="${chartW}" y2="${y}" stroke="#e5e7eb" stroke-width="1"/>`;
    yLabels += `<text x="-8" y="${y + 4}" text-anchor="end" font-size="11" fill="#6b7280">${val}</text>`;
  }

  let bars = '';
  let xLabels = '';
  let valueLabels = '';
  data.forEach((d, i) => {
    const x = gap + i * (barW + gap);
    const barH = (d.count / maxCount) * chartH;
    const y = chartH - barH;
    const cx = x + barW / 2;

    bars += `<rect x="${x}" y="${y}" width="${barW}" height="${barH}" fill="#4f86c6" rx="3"/>`;
    if (d.count > 0) {
      valueLabels += `<text x="${cx}" y="${y - 5}" text-anchor="middle" font-size="11" fill="#374151">${d.count}</text>`;
    }
    xLabels += `<text transform="rotate(-40, ${cx}, ${chartH + 14})" x="${cx}" y="${chartH + 14}" text-anchor="end" font-size="11" fill="#6b7280">${d.label}</text>`;
  });

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <rect width="${W}" height="${H}" fill="#ffffff"/>
  <text x="${W / 2}" y="28" text-anchor="middle" font-size="16" font-weight="bold" fill="#111827">Workouts per Month (Past 12 Months)</text>
  <g transform="translate(${MARGIN.left},${MARGIN.top})">
    ${gridLines}
    ${bars}
    ${valueLabels}
    ${xLabels}
    <line x1="0" y1="0" x2="0" y2="${chartH}" stroke="#9ca3af" stroke-width="1"/>
    ${yLabels}
    <text transform="rotate(-90)" x="${-chartH / 2}" y="-44" text-anchor="middle" font-size="13" fill="#374151">Number of Workouts</text>
    <line x1="0" y1="${chartH}" x2="${chartW}" y2="${chartH}" stroke="#9ca3af" stroke-width="1"/>
  </g>
</svg>`;
}

async function svgToPng(svgBuffer: Buffer, outputPath: string): Promise<void> {
  const sharp = await import('sharp' as any);
  await sharp.default(svgBuffer).png().toFile(outputPath);
}

async function main() {
  const { envPath, output } = parseArgs();

  console.log('Loading database URL...');
  const databaseUrl = loadDatabaseUrl(envPath);

  console.log('Querying workouts from the past 12 months...');
  const dbRows = await queryMonthlyWorkouts(databaseUrl);
  console.log(`Found data for ${dbRows.length} month(s).`);

  const data = buildMonthSeries(dbRows);
  const total = data.reduce((s, d) => s + d.count, 0);
  const svg = generateSvg(data);
  const svgBuffer = Buffer.from(svg, 'utf-8');

  const outputPath = resolve(output);
  if (outputPath.endsWith('.png')) {
    console.log('Converting SVG → PNG via sharp...');
    await svgToPng(svgBuffer, outputPath);
  } else {
    writeFileSync(outputPath, svg, 'utf-8');
  }

  console.log(`Chart saved to: ${outputPath}`);
  console.log(`Total workouts: ${total}`);
  if (total > 0) {
    const peak = data.reduce((a, b) => (b.count > a.count ? b : a));
    console.log(`Busiest month: ${peak.label} (${peak.count} workouts)`);
  }
  const zeroMonths = data.filter((d) => d.count === 0).map((d) => d.label);
  if (zeroMonths.length > 0) {
    console.log(`Months with no workouts: ${zeroMonths.join(', ')}`);
  }
}

main().catch((err) => {
  console.error('ERROR:', err.message ?? err);
  process.exit(1);
});
