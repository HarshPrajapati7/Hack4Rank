import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import Papa from 'papaparse';
import { parseTeamsFromRows } from '../src/lib/csv';
import { evaluateAllTeams, testApiKey } from '../src/lib/evaluator';
import { serializeEvaluatedTeamsToCsv } from '../src/lib/results';

async function main() {
  const csvPath = process.argv[2];
  const shortlistCount = Number(process.argv[3] || 10);
  const apiKey = (process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY || '').trim();

  if (!csvPath) {
    throw new Error('Usage: npm run smoke:csv -- <path-to-csv> [shortlistCount]');
  }

  if (!apiKey) {
    throw new Error('Set GEMINI_API_KEY or VITE_GEMINI_API_KEY in .env before running the smoke test.');
  }

  const csvText = fs.readFileSync(csvPath, 'utf8');
  const parsed = Papa.parse<Record<string, unknown>>(csvText, {
    header: true,
    skipEmptyLines: true,
  });

  if (parsed.errors.length) {
    console.warn('CSV parse warnings:');
    for (const error of parsed.errors) {
      console.warn(`- Row ${error.row}: ${error.message}`);
    }
  }

  const teams = parseTeamsFromRows(parsed.data);
  if (!teams.length) {
    throw new Error('The CSV did not produce any teams.');
  }

  const valid = await testApiKey(apiKey);
  if (!valid) {
    throw new Error('Gemini API key validation failed.');
  }

  console.log(`Loaded ${teams.length} team(s) from ${path.basename(csvPath)}.`);

  const results = await evaluateAllTeams({
    apiKey,
    teams,
    onLog: (message, type) => {
      const prefix = type ? `[${type.toUpperCase()}]` : '[INFO]';
      console.log(`${prefix} ${message}`);
    },
    onProgress: (processed, total) => {
      console.log(`[PROGRESS] ${processed}/${total}`);
    },
  });

  const safeShortlistCount = Math.max(1, Math.min(shortlistCount, results.length));
  const outputCsv = serializeEvaluatedTeamsToCsv(results, safeShortlistCount, false);

  fs.mkdirSync('dist', { recursive: true });
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const outputPath = path.resolve('dist', `smoke-results-${timestamp}.csv`);
  fs.writeFileSync(outputPath, outputCsv, 'utf8');

  console.log(`Wrote ranked CSV to ${outputPath}`);
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exitCode = 1;
});
