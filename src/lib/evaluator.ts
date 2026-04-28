import { GoogleGenAI } from '@google/genai';
import { fetchGitHubProfileContext } from './github';
import { EvaluationScores, EvaluatedTeam, TeamData } from './types';

const CANDIDATE_MODELS = [
  'gemini-2.5-flash-lite',
  'gemini-2.5-flash',
  'gemini-flash-lite-latest',
  'gemini-flash-latest',
  'gemini-3-flash-preview',
] as const;
const RATE_LIMIT_WAIT_MS = 65000;
const RETRY_WAIT_MS = 5000;
const INTER_BATCH_WAIT_MS = 4500;
const MAX_BATCH_SIZE = 8;
const MAX_BATCH_CHARS = 12000;

let resolvedModelName: string | null = null;

const SCORE_KEYS: Array<keyof Omit<EvaluationScores, 'summary'>> = [
  'innovation',
  'technical',
  'feasibility',
  'commercial',
  'impact',
  'design',
  'pitch',
];

type LogLevel = 'info' | 'success' | 'warn' | 'error';

interface EvaluateAllTeamsOptions {
  apiKey: string;
  teams: TeamData[];
  onLog?: (message: string, type?: LogLevel) => void;
  onProgress?: (processed: number, total: number) => void;
}

interface RawBatchEvaluation {
  evaluation_id?: string;
  team_name?: string;
  innovation?: number;
  technical?: number;
  feasibility?: number;
  commercial?: number;
  impact?: number;
  design?: number;
  pitch?: number;
  summary?: string;
}

type EnrichedTeamData = TeamData;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function probeModel(apiKey: string, modelName: string): Promise<boolean> {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${encodeURIComponent(apiKey)}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: 'Reply with just the word: READY' }] }],
      }),
    }
  );

  if (response.ok) {
    return true;
  }

  if (response.status === 404 || response.status === 429) {
    return false;
  }

  const errorText = await response.text();
  throw new Error(`HTTP ${response.status}: ${errorText}`);
}

async function resolveModel(apiKey: string): Promise<string> {
  if (resolvedModelName) {
    return resolvedModelName;
  }

  for (const modelName of CANDIDATE_MODELS) {
    const works = await probeModel(apiKey, modelName);
    if (works) {
      resolvedModelName = modelName;
      return modelName;
    }
  }

  throw new Error('No supported Gemini model is currently available for this API key.');
}

function buildTeamContext(team: TeamData): string {
  const parts: string[] = [];

  if (team.project_title) {
    parts.push(`Project Title: ${team.project_title}`);
  }
  if (team.theme) {
    parts.push(`Theme: ${team.theme}`);
  }
  if (team.problem_statement) {
    parts.push(`Problem Statement: ${team.problem_statement}`);
  }

  parts.push(`Detailed Submission: ${team.idea || 'No detailed submission text provided.'}`);

  if (team.github) {
    parts.push(`GitHub URL: ${team.github}`);
  }
  if (team.github_profile_summary) {
    parts.push(`Verified GitHub profile signals: ${team.github_profile_summary}`);
  }
  if (team.linkedin) {
    parts.push(`LinkedIn URL only (not scraped): ${team.linkedin}`);
  }

  return parts.join('\n');
}

function teamNeedsGitHubEnrichment(team: TeamData): boolean {
  if (!team.github) {
    return false;
  }

  const normalizedIdea = (team.idea || '').trim().toLowerCase();
  if (!normalizedIdea || normalizedIdea === 'no submission text provided') {
    return true;
  }

  if (team.idea_source && team.idea_source !== 'detailed_submission') {
    return true;
  }

  return normalizedIdea.length < 120;
}

async function enrichTeamsWithGitHubContext(
  teams: TeamData[],
  onLog?: (message: string, type?: LogLevel) => void
): Promise<EnrichedTeamData[]> {
  const enrichedTeams: EnrichedTeamData[] = [];
  const candidates = teams.filter(teamNeedsGitHubEnrichment);

  if (candidates.length) {
    onLog?.(
      `Preparing GitHub fallback context for ${candidates.length} team(s) with missing or thin idea text.`,
      'info'
    );
  }

  for (const team of teams) {
    if (!teamNeedsGitHubEnrichment(team)) {
      enrichedTeams.push(team);
      continue;
    }

    try {
      const githubContext = await fetchGitHubProfileContext(team.github);
      if (githubContext?.summary) {
        onLog?.(`GitHub context loaded for [${team.team_name}] from ${githubContext.username}.`, 'info');
        enrichedTeams.push({
          ...team,
          github_username: githubContext.username,
          github_profile_summary: githubContext.summary,
        });
      } else {
        onLog?.(`GitHub link for [${team.team_name}] could not be enriched. Continuing with CSV data only.`, 'warn');
        enrichedTeams.push(team);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      onLog?.(`GitHub enrichment skipped for [${team.team_name}]: ${message}`, 'warn');
      enrichedTeams.push(team);
    }
  }

  return enrichedTeams;
}

function estimatePromptFootprint(team: TeamData): number {
  return `${team.evaluation_id}\n${team.team_name}\n${team.student_name}\n${buildTeamContext(team)}`.length;
}

function extractResponseText(data: any): string {
  const parts = data?.candidates?.[0]?.content?.parts;
  if (!Array.isArray(parts) || !parts.length) {
    throw new Error('Gemini returned an empty response.');
  }

  const text = parts
    .map((part: any) => (typeof part?.text === 'string' ? part.text : ''))
    .join('')
    .trim();

  if (!text) {
    throw new Error('Gemini returned no text content.');
  }

  return text.replace(/^```json\s*/i, '').replace(/```$/i, '').trim();
}

function normalizeScores(raw: RawBatchEvaluation): EvaluationScores | null {
  const normalized: Partial<EvaluationScores> = {};

  for (const key of SCORE_KEYS) {
    const numeric = Number(raw[key]);
    const rounded = Math.round(numeric);
    if (!Number.isFinite(numeric) || rounded < 1 || rounded > 10) {
      return null;
    }
    normalized[key] = rounded;
  }

  normalized.summary =
    typeof raw.summary === 'string' && raw.summary.trim()
      ? raw.summary.trim()
      : 'Gemini returned scores without an explanation.';

  return normalized as EvaluationScores;
}

function toEvaluatedTeam(team: TeamData, scores: EvaluationScores): EvaluatedTeam {
  const rawSum = SCORE_KEYS.reduce((sum, key) => sum + scores[key], 0);
  const totalScore = Number(((rawSum / 70) * 100).toFixed(1));

  return {
    ...team,
    scores,
    total_score: totalScore,
  };
}

function makePrompt(teamsChunk: TeamData[]): string {
  const teamBlocks = teamsChunk.map((team) => {
    return [
      `EVALUATION_ID: ${team.evaluation_id}`,
      `TEAM NAME: ${team.team_name}`,
      `STUDENTS: ${team.student_name}`,
      buildTeamContext(team),
    ].join('\n');
  });

  return [
    `You are judging ${teamsChunk.length} hackathon teams.`,
    'Score every team on these 7 criteria using integers from 1 to 10 only:',
    'innovation, technical, feasibility, commercial, impact, design, pitch.',
    'Never use 0. Even a weak or incomplete submission must still receive a real score from 1 to 10.',
    'Use the provided EVALUATION_ID exactly as given.',
    'Return only a JSON array. No markdown.',
    'Each array item must have exactly these keys:',
    '{"evaluation_id":"...","team_name":"...","innovation":1,"technical":1,"feasibility":1,"commercial":1,"impact":1,"design":1,"pitch":1,"summary":"..."}',
    'If a submission has limited detail, judge based on the available title, theme, problem statement, description, and verified GitHub profile signals when present.',
    'Do not invent GitHub or LinkedIn metrics that are not explicitly included in the prompt.',
    'Treat LinkedIn as weak context because only the URL is provided unless profile facts are explicitly listed.',
    '',
    'TEAMS TO EVALUATE:',
    teamBlocks.join('\n\n---\n\n'),
  ].join('\n');
}

async function callGeminiBatch(apiKey: string, teamsChunk: TeamData[]): Promise<RawBatchEvaluation[]> {
  const orderedModels = await resolveModel(apiKey).then((preferred) => [
    preferred,
    ...CANDIDATE_MODELS.filter((modelName) => modelName !== preferred),
  ]);

  let lastError: Error | null = null;

  for (const modelName of orderedModels) {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${encodeURIComponent(apiKey)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: makePrompt(teamsChunk) }] }],
          generationConfig: {
            temperature: 0.1,
            responseMimeType: 'application/json',
            responseSchema: {
              type: 'ARRAY',
              items: {
                type: 'OBJECT',
                properties: {
                  evaluation_id: { type: 'STRING' },
                  team_name: { type: 'STRING' },
                  innovation: { type: 'INTEGER' },
                  technical: { type: 'INTEGER' },
                  feasibility: { type: 'INTEGER' },
                  commercial: { type: 'INTEGER' },
                  impact: { type: 'INTEGER' },
                  design: { type: 'INTEGER' },
                  pitch: { type: 'INTEGER' },
                  summary: { type: 'STRING' },
                },
                required: [
                  'evaluation_id',
                  'team_name',
                  'innovation',
                  'technical',
                  'feasibility',
                  'commercial',
                  'impact',
                  'design',
                  'pitch',
                  'summary',
                ],
              },
            },
          },
        }),
      }
    );

    if (response.ok) {
      resolvedModelName = modelName;
      const data = await response.json();
      const text = extractResponseText(data);
      const parsed = JSON.parse(text);

      if (!Array.isArray(parsed)) {
        throw new Error('Gemini response was not an array.');
      }

      return parsed as RawBatchEvaluation[];
    }

    const errorText = await response.text();
    lastError = new Error(`HTTP ${response.status}: ${errorText}`);

    if (response.status === 404 || response.status === 429) {
      if (resolvedModelName === modelName) {
        resolvedModelName = null;
      }
      continue;
    }

    throw lastError;
  }

  throw lastError || new Error('No Gemini model could complete this request.');
}

async function waitForRetry(
  error: unknown,
  attemptsLeft: number,
  onLog?: (message: string, type?: LogLevel) => void
) {
  const message = error instanceof Error ? error.message : String(error);
  if (/429|quota|resource exhausted/i.test(message)) {
    onLog?.(
      `Rate limit hit. Waiting ${Math.round(RATE_LIMIT_WAIT_MS / 1000)}s before retry (${attemptsLeft} left).`,
      'warn'
    );
    await sleep(RATE_LIMIT_WAIT_MS);
    return;
  }

  onLog?.(`Batch call failed: ${message}. Retrying in ${Math.round(RETRY_WAIT_MS / 1000)}s (${attemptsLeft} left).`, 'error');
  await sleep(RETRY_WAIT_MS);
}

function chunkTeamsForEvaluation(teams: TeamData[]): TeamData[][] {
  const chunks: TeamData[][] = [];
  let currentChunk: TeamData[] = [];
  let currentChars = 0;

  for (const team of teams) {
    const estimatedChars = estimatePromptFootprint(team);
    const wouldOverflow =
      currentChunk.length >= MAX_BATCH_SIZE ||
      (currentChunk.length > 0 && currentChars + estimatedChars > MAX_BATCH_CHARS);

    if (wouldOverflow) {
      chunks.push(currentChunk);
      currentChunk = [];
      currentChars = 0;
    }

    currentChunk.push(team);
    currentChars += estimatedChars;
  }

  if (currentChunk.length) {
    chunks.push(currentChunk);
  }

  return chunks;
}

function sortByOriginalOrder<T extends { evaluation_id: string }>(items: T[], originalTeams: TeamData[]): T[] {
  const order = new Map(originalTeams.map((team, index) => [team.evaluation_id, index]));
  return [...items].sort((a, b) => (order.get(a.evaluation_id) ?? 0) - (order.get(b.evaluation_id) ?? 0));
}

async function evaluateChunkWithRecovery(
  apiKey: string,
  teamsChunk: TeamData[],
  onLog?: (message: string, type?: LogLevel) => void
): Promise<EvaluatedTeam[]> {
  let attemptsLeft = teamsChunk.length === 1 ? 8 : 4;
  let lastError: unknown;

  while (attemptsLeft > 0) {
    try {
      const rawResults = await callGeminiBatch(apiKey, teamsChunk);
      const evaluatedById = new Map<string, EvaluatedTeam>();

      for (const rawResult of rawResults) {
        const evaluationId = typeof rawResult.evaluation_id === 'string' ? rawResult.evaluation_id.trim() : '';
        if (!evaluationId) {
          continue;
        }

        const team = teamsChunk.find((item) => item.evaluation_id === evaluationId);
        if (!team) {
          continue;
        }

        const scores = normalizeScores(rawResult);
        if (!scores) {
          continue;
        }

        evaluatedById.set(evaluationId, toEvaluatedTeam(team, scores));
      }

      const missingTeams = teamsChunk.filter((team) => !evaluatedById.has(team.evaluation_id));
      if (!missingTeams.length) {
        return sortByOriginalOrder(Array.from(evaluatedById.values()), teamsChunk);
      }

      onLog?.(
        `Gemini returned ${evaluatedById.size}/${teamsChunk.length} valid results. Retrying ${missingTeams.length} missing team(s).`,
        'warn'
      );

      const recoveredMissing = await recoverMissingTeams(apiKey, missingTeams, onLog);
      return sortByOriginalOrder([...evaluatedById.values(), ...recoveredMissing], teamsChunk);
    } catch (error) {
      lastError = error;
      attemptsLeft -= 1;
      if (attemptsLeft > 0) {
        await waitForRetry(error, attemptsLeft, onLog);
      }
    }
  }

  if (teamsChunk.length === 1) {
    throw lastError instanceof Error
      ? new Error(`Unable to evaluate ${teamsChunk[0].team_name}: ${lastError.message}`)
      : new Error(`Unable to evaluate ${teamsChunk[0].team_name}.`);
  }

  onLog?.(`Splitting batch of ${teamsChunk.length} after repeated failures.`, 'warn');
  const midpoint = Math.ceil(teamsChunk.length / 2);
  const firstHalf = await evaluateChunkWithRecovery(apiKey, teamsChunk.slice(0, midpoint), onLog);
  const secondHalf = await evaluateChunkWithRecovery(apiKey, teamsChunk.slice(midpoint), onLog);
  return sortByOriginalOrder([...firstHalf, ...secondHalf], teamsChunk);
}

async function recoverMissingTeams(
  apiKey: string,
  missingTeams: TeamData[],
  onLog?: (message: string, type?: LogLevel) => void
): Promise<EvaluatedTeam[]> {
  if (!missingTeams.length) {
    return [];
  }

  const chunks = chunkTeamsForEvaluation(missingTeams);
  const recovered: EvaluatedTeam[] = [];

  for (let index = 0; index < chunks.length; index += 1) {
    const chunk = chunks[index];
    const results = await evaluateChunkWithRecovery(apiKey, chunk, onLog);
    recovered.push(...results);
    if (index < chunks.length - 1) {
      await sleep(1500);
    }
  }

  return sortByOriginalOrder(recovered, missingTeams);
}

export async function testApiKey(apiKey: string): Promise<boolean> {
  try {
    await resolveModel(apiKey);
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: resolvedModelName!,
      contents: 'Reply with just the word: READY',
      config: { temperature: 0.1 },
    });
    return response.text.trim().toUpperCase().includes('READY');
  } catch (error: any) {
    const message = error?.message || String(error);
    return false;
  }
}

export async function evaluateAllTeams({
  apiKey,
  teams,
  onLog,
  onProgress,
}: EvaluateAllTeamsOptions): Promise<EvaluatedTeam[]> {
  const selectedModel = await resolveModel(apiKey);
  onLog?.(`Using Gemini model ${selectedModel}.`, 'info');
  const enrichedTeams = await enrichTeamsWithGitHubContext(teams, onLog);
  const chunks = chunkTeamsForEvaluation(enrichedTeams);
  const results: EvaluatedTeam[] = [];
  let processed = 0;

  for (let index = 0; index < chunks.length; index += 1) {
    const chunk = chunks[index];
    onLog?.(`Sending batch ${index + 1}/${chunks.length} with ${chunk.length} team(s).`, 'info');
    const evaluatedChunk = await evaluateChunkWithRecovery(apiKey, chunk, onLog);

    for (const evaluatedTeam of evaluatedChunk) {
      onLog?.(`Scored [${evaluatedTeam.team_name}] ${evaluatedTeam.total_score.toFixed(1)}/100`, 'success');
    }

    results.push(...evaluatedChunk);
    processed += chunk.length;
    onProgress?.(processed, enrichedTeams.length);

    if (index < chunks.length - 1) {
      await sleep(INTER_BATCH_WAIT_MS);
    }
  }

  return sortByOriginalOrder(results, enrichedTeams);
}
