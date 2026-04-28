import { EvaluatedTeam } from './types';

function escapeCsv(value: unknown): string {
  const text = String(value ?? '');
  if (text.includes('"') || text.includes(',') || text.includes('\n')) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

export function rankTeams(teams: EvaluatedTeam[], shortlistCount: number): EvaluatedTeam[] {
  return [...teams]
    .sort((a, b) => b.total_score - a.total_score)
    .map((team, index) => ({
      ...team,
      rank: index + 1,
      is_shortlisted: index + 1 <= shortlistCount,
    }));
}

export function serializeEvaluatedTeamsToCsv(
  teams: EvaluatedTeam[],
  shortlistCount: number,
  onlyShortlisted = false
): string {
  const rankedTeams = rankTeams(teams, shortlistCount);
  const exportTeams = onlyShortlisted
    ? rankedTeams.filter((team) => team.is_shortlisted)
    : rankedTeams;

  const header = [
    'Rank',
    'Shortlisted',
    'Team Name',
    'Student Name',
    'Total Score',
    'Innovation',
    'Technical',
    'Feasibility',
    'Commercial',
    'Impact',
    'Design',
    'Pitch',
    'AI Summary',
  ].join(',');

  const rows = exportTeams.map((team) => [
    escapeCsv(team.rank),
    escapeCsv(team.is_shortlisted ? 'Yes' : 'No'),
    escapeCsv(team.team_name),
    escapeCsv(team.student_name),
    escapeCsv(team.total_score.toFixed(1)),
    escapeCsv(team.scores.innovation),
    escapeCsv(team.scores.technical),
    escapeCsv(team.scores.feasibility),
    escapeCsv(team.scores.commercial),
    escapeCsv(team.scores.impact),
    escapeCsv(team.scores.design),
    escapeCsv(team.scores.pitch),
    escapeCsv(team.scores.summary),
  ].join(','));

  return [header, ...rows].join('\n');
}
