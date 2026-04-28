import { TeamData } from './types';

type CsvRow = Record<string, unknown>;

const EMPTY_MARKERS = new Set(['', 'n/a', 'na', 'none', 'nil', '-', '--', 'unknown']);

function normalizeHeader(header: string): string {
  return header.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function normalizeValue(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }
  return String(value).trim();
}

function hasMeaningfulValue(value: unknown): boolean {
  const normalized = normalizeValue(value).toLowerCase();
  return !EMPTY_MARKERS.has(normalized);
}

function findHeader(
  headers: string[],
  predicates: Array<(normalized: string, raw: string) => boolean>
): string | undefined {
  for (const predicate of predicates) {
    const match = headers.find((header) => predicate(normalizeHeader(header), header));
    if (match) {
      return match;
    }
  }
  return undefined;
}

function addUniqueName(target: string[], value: unknown) {
  const normalized = normalizeValue(value);
  if (!hasMeaningfulValue(normalized)) {
    return;
  }
  if (!target.some((entry) => entry.toLowerCase() === normalized.toLowerCase())) {
    target.push(normalized);
  }
}

export function parseTeamsFromRows(data: CsvRow[]): TeamData[] {
  if (!data.length) {
    return [];
  }

  const headers = Object.keys(data[0] || {});

  const submissionIdHeader = findHeader(headers, [
    (normalized) => normalized === 'submission id',
  ]);
  const teamIdHeader = findHeader(headers, [
    (normalized) => normalized === 'team id',
  ]);
  const teamNameHeader = findHeader(headers, [
    (normalized) => normalized === 'team name',
    (normalized) => normalized.includes('team name'),
    (normalized) => normalized.includes('team') && !normalized.includes('member'),
  ]);
  const projectTitleHeader = findHeader(headers, [
    (normalized) => normalized === 'project title',
    (normalized) => normalized.includes('project title'),
    (normalized) => normalized.includes('title'),
  ]);
  const detailedIdeaHeader = findHeader(headers, [
    (normalized, raw) => raw.toLowerCase().startsWith('what amazing thing'),
    (normalized) => normalized.includes('planning to hack'),
    (normalized) => normalized.includes('core idea'),
    (normalized) => normalized.includes('problem it solves'),
    (normalized) => normalized.includes('project description'),
    (normalized) => normalized.includes('idea description'),
    (normalized) => normalized.includes('submission'),
    (normalized) => normalized.includes('description'),
    (normalized) => normalized === 'idea',
    (normalized) => normalized.includes('idea'),
    (normalized) => normalized.includes('project title'),
  ]);
  const teamLeaderHeader = findHeader(headers, [
    (normalized) => normalized === 'team leader',
    (normalized) => normalized === 'student name',
    (normalized) => normalized === 'participant name',
    (normalized) => normalized === 'member name',
  ]);
  const themeHeader = findHeader(headers, [
    (normalized) => normalized === 'theme',
    (normalized) => normalized.includes('theme'),
  ]);
  const problemStatementHeader = findHeader(headers, [
    (normalized) => normalized === 'problem statement',
    (normalized) => normalized.includes('problem statement'),
  ]);
  const githubHeader = findHeader(headers, [
    (normalized) => normalized.includes('github'),
  ]);
  const linkedinHeader = findHeader(headers, [
    (normalized) => normalized.includes('linkedin'),
    (normalized) => normalized.includes('linked in'),
  ]);

  const teamMemberHeaders = headers.filter((header) => /^team member \d+\s*-\s*name$/i.test(header));

  return data.map((row, index) => {
    const submissionId = submissionIdHeader ? normalizeValue(row[submissionIdHeader]) : '';
    const teamId = teamIdHeader ? normalizeValue(row[teamIdHeader]) : '';
    const teamName = teamNameHeader ? normalizeValue(row[teamNameHeader]) : '';
    const projectTitle = projectTitleHeader ? normalizeValue(row[projectTitleHeader]) : '';
    const detailedIdea = detailedIdeaHeader ? normalizeValue(row[detailedIdeaHeader]) : '';
    const theme = themeHeader ? normalizeValue(row[themeHeader]) : '';
    const problemStatement = problemStatementHeader ? normalizeValue(row[problemStatementHeader]) : '';
    const github = githubHeader ? normalizeValue(row[githubHeader]) : '';
    const linkedin = linkedinHeader ? normalizeValue(row[linkedinHeader]) : '';

    const memberNames: string[] = [];
    if (teamLeaderHeader) {
      addUniqueName(memberNames, row[teamLeaderHeader]);
    }
    for (const memberHeader of teamMemberHeaders) {
      addUniqueName(memberNames, row[memberHeader]);
    }

    const studentName = memberNames.length ? memberNames.join(', ') : 'Unknown';
    let idea = 'No submission text provided';
    let ideaSource: TeamData['idea_source'] = 'fallback';

    if (hasMeaningfulValue(detailedIdea)) {
      idea = detailedIdea;
      ideaSource = 'detailed_submission';
    } else if (hasMeaningfulValue(projectTitle)) {
      idea = projectTitle;
      ideaSource = 'project_title';
    } else if (hasMeaningfulValue(problemStatement)) {
      idea = problemStatement;
      ideaSource = 'problem_statement';
    } else if (hasMeaningfulValue(theme)) {
      idea = theme;
      ideaSource = 'theme';
    }

    const evaluationId = submissionId || teamId || `row-${index + 1}`;

    return {
      evaluation_id: evaluationId,
      submission_id: submissionId || undefined,
      team_id: teamId || undefined,
      team_name: teamName || `Team ${index + 1}`,
      student_name: studentName,
      project_title: projectTitle || undefined,
      idea,
      idea_source: ideaSource,
      theme: theme || undefined,
      problem_statement: problemStatement || undefined,
      github: github || undefined,
      linkedin: linkedin || undefined,
      source_row: index + 1,
      ...row,
    };
  });
}
