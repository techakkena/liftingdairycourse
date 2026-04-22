/**
 * Generate a monthly workout bar chart PNG using sharp (SVG -> PNG).
 * Data was pre-queried from Neon DB via MCP:
 *   Mar 2026: 1 workout
 *   Apr 2026: 11 workouts
 * All other months in the past 12 months: 0 workouts
 */

'use strict';

const sharp = require('C:\\AIProjects2026\\liftingdairycourse\\node_modules\\sharp');
const { writeFileSync } = require('fs');

// --- Data: past 12 months from today (Apr 18, 2026) ---
const data = [
  { label: 'May 2025', count: 0 },
  { label: 'Jun 2025', count: 0 },
  { label: 'Jul 2025', count: 0 },
  { label: 'Aug 2025', count: 0 },
  { label: 'Sep 2025', count: 0 },
  { label: 'Oct 2025', count: 0 },
  { label: 'Nov 2025', count: 0 },
  { label: 'Dec 2025', count: 0 },
  { label: 'Jan 2026', count: 0 },
  { label: 'Feb 2026', count: 0 },
  { label: 'Mar 2026', count: 1 },
  { label: 'Apr 2026', count: 11 },
];

const total = data.reduce((s, d) => s + d.count, 0);
const maxCount = Math.max(...data.map(d => d.count));
const peakMonth = data.find(d => d.count === maxCount);
const zeroMonths = data.filter(d => d.count === 0).map(d => d.label);

// --- Chart dimensions ---
const W = 1200;
const H = 600;
const paddingTop = 70;
const paddingBottom = 110;
const paddingLeft = 70;
const paddingRight = 40;
const chartW = W - paddingLeft - paddingRight;
const chartH = H - paddingTop - paddingBottom;

const barWidth = Math.floor(chartW / data.length) - 8;
const yMax = maxCount * 1.2 + 1;

function toY(count) {
  return paddingTop + chartH - (count / yMax) * chartH;
}

// --- Build SVG ---
let bars = '';
data.forEach((d, i) => {
  const x = paddingLeft + i * (chartW / data.length) + (chartW / data.length - barWidth) / 2;
  const barH = (d.count / yMax) * chartH;
  const y = paddingTop + chartH - barH;

  // Bar
  bars += `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${barWidth}" height="${Math.max(barH, 0).toFixed(1)}" fill="#4f86c6" rx="3"/>`;

  // Count label above bar
  if (d.count > 0) {
    bars += `<text x="${(x + barWidth / 2).toFixed(1)}" y="${(y - 6).toFixed(1)}" text-anchor="middle" font-size="12" fill="#333">${d.count}</text>`;
  }

  // X-axis label (rotated 45 degrees)
  const labelX = (x + barWidth / 2).toFixed(1);
  const labelY = (paddingTop + chartH + 18).toFixed(1);
  bars += `<text x="${labelX}" y="${labelY}" text-anchor="end" font-size="11" fill="#555" transform="rotate(45 ${labelX} ${labelY})">${d.label}</text>`;
});

// Y-axis grid lines and tick labels
let gridLines = '';
const tickCount = 5;
for (let t = 0; t <= tickCount; t++) {
  const val = (yMax / tickCount) * t;
  const y = toY(val);
  gridLines += `<line x1="${paddingLeft}" y1="${y.toFixed(1)}" x2="${W - paddingRight}" y2="${y.toFixed(1)}" stroke="#e0e0e0" stroke-dasharray="4,4"/>`;
  gridLines += `<text x="${(paddingLeft - 8).toFixed(1)}" y="${(y + 4).toFixed(1)}" text-anchor="end" font-size="11" fill="#666">${Math.round(val)}</text>`;
}

const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" style="background:#ffffff;font-family:Arial,Helvetica,sans-serif;">
  <!-- Title -->
  <text x="${W / 2}" y="42" text-anchor="middle" font-size="18" font-weight="bold" fill="#222222">Workouts per Month (Past 12 Months)</text>

  <!-- Grid lines and Y-axis ticks -->
  ${gridLines}

  <!-- Axes -->
  <line x1="${paddingLeft}" y1="${paddingTop}" x2="${paddingLeft}" y2="${paddingTop + chartH}" stroke="#999999" stroke-width="1.5"/>
  <line x1="${paddingLeft}" y1="${paddingTop + chartH}" x2="${W - paddingRight}" y2="${paddingTop + chartH}" stroke="#999999" stroke-width="1.5"/>

  <!-- Y-axis label -->
  <text x="18" y="${(paddingTop + chartH / 2).toFixed(1)}" text-anchor="middle" font-size="13" fill="#444444" transform="rotate(-90 18 ${(paddingTop + chartH / 2).toFixed(1)})">Number of Workouts</text>

  <!-- X-axis label -->
  <text x="${W / 2}" y="${H - 8}" text-anchor="middle" font-size="13" fill="#444444">Month</text>

  <!-- Bars and labels -->
  ${bars}
</svg>`;

// Write SVG for reference
writeFileSync('C:\\AIProjects2026\\liftingdairycourse\\workout_chart.svg', svg, 'utf8');
console.log('SVG written to: C:\\AIProjects2026\\liftingdairycourse\\workout_chart.svg');

// Convert SVG to PNG using sharp
const outputPath = 'C:\\AIProjects2026\\liftingdairycourse\\workout_chart_eval3.png';
sharp(Buffer.from(svg))
  .png()
  .toFile(outputPath)
  .then(() => {
    console.log(`Chart saved to: ${outputPath}`);
    console.log(`Total workouts: ${total}`);
    if (total > 0) {
      console.log(`Busiest month: ${peakMonth.label} (${peakMonth.count} workouts)`);
    }
    if (zeroMonths.length > 0) {
      console.log(`Months with no workouts: ${zeroMonths.join(', ')}`);
    }
  })
  .catch(err => {
    console.error('Error generating PNG:', err.message);
    process.exit(1);
  });
