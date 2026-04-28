import { AppConfig, EvaluatedTeam } from '../lib/types';
import { Card, PanelBadge, Button, Input } from './ui';
import { Search, Download, RotateCcw, ChevronDown, Check } from 'lucide-react';
import React, { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { rankTeams, serializeEvaluatedTeamsToCsv } from '../lib/results';

interface ResultsSectionProps {
  teams: EvaluatedTeam[];
  config: AppConfig;
  onReset: () => void;
}

type SortCol = 'rank' | 'team_name' | 'total_score';

const criteriaCols = [
  { key: 'innovation', label: 'INN' },
  { key: 'technical', label: 'TEC' },
  { key: 'feasibility', label: 'FEA' },
  { key: 'commercial', label: 'COM' },
  { key: 'impact', label: 'IMP' },
  { key: 'design', label: 'DES' },
  { key: 'pitch', label: 'PIT' },
] as const;

export function ResultsSection({ teams, config, onReset }: ResultsSectionProps) {
  const [search, setSearch] = useState('');
  const [showShortlistedOnly, setShowShortlistedOnly] = useState(false);
  const [sortCol, setSortCol] = useState<SortCol>('rank');
  const [sortAsc, setSortAsc] = useState(true);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  const rankedTeams = useMemo(() => rankTeams(teams, config.shortlistCount), [teams, config.shortlistCount]);

  const avgScore =
    rankedTeams.length > 0
      ? (rankedTeams.reduce((sum, team) => sum + team.total_score, 0) / rankedTeams.length).toFixed(1)
      : '0.0';

  const shortlistedCount = rankedTeams.filter((team) => team.is_shortlisted).length;

  const displayTeams = useMemo(() => {
    const filtered = rankedTeams.filter((team) => {
      const query = search.toLowerCase();
      const matchesSearch =
        team.team_name.toLowerCase().includes(query) ||
        team.student_name.toLowerCase().includes(query);
      const matchesShortlist = showShortlistedOnly ? team.is_shortlisted : true;
      return matchesSearch && matchesShortlist;
    });

    filtered.sort((left, right) => {
      const leftValue = left[sortCol];
      const rightValue = right[sortCol];

      if (typeof leftValue === 'string' && typeof rightValue === 'string') {
        return sortAsc
          ? leftValue.localeCompare(rightValue)
          : rightValue.localeCompare(leftValue);
      }

      return sortAsc
        ? Number(leftValue) - Number(rightValue)
        : Number(rightValue) - Number(leftValue);
    });

    return filtered;
  }, [rankedTeams, search, showShortlistedOnly, sortCol, sortAsc]);

  const toggleSort = (column: SortCol) => {
    if (sortCol === column) {
      setSortAsc((value) => !value);
      return;
    }
    setSortCol(column);
    setSortAsc(true);
  };

  const toggleRow = (evaluationId: string) => {
    setExpandedRows((current) => {
      const next = new Set(current);
      if (next.has(evaluationId)) {
        next.delete(evaluationId);
      } else {
        next.add(evaluationId);
      }
      return next;
    });
  };

  const exportCsv = (onlyShortlisted: boolean) => {
    const csvContent = serializeEvaluatedTeamsToCsv(teams, config.shortlistCount, onlyShortlisted);
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    link.href = url;
    link.download = `hack4rank-${onlyShortlisted ? 'shortlist' : 'all'}-${timestamp}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <Card id="results-section" className="mt-8 border-t-4 border-t-accent-yellow">
      <PanelBadge>Step 4 - Leaderboard</PanelBadge>

      <div className="font-oswald text-[1.2rem] text-accent-yellow uppercase tracking-[0.05em] mb-5 text-center">
        {rankedTeams.length} teams evaluated <span className="opacity-50 mx-2">|</span>
        <span className="text-success">{shortlistedCount} shortlisted</span> <span className="opacity-50 mx-2">|</span>
        Avg score: {avgScore}/100
      </div>

      <div className="flex flex-col md:flex-row gap-4 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" size={18} />
          <Input
            placeholder="Search teams or students..."
            className="pl-10 h-full py-2.5"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
        <Button
          variant={showShortlistedOnly ? 'primary' : 'outline'}
          onClick={() => setShowShortlistedOnly((value) => !value)}
          className="whitespace-nowrap py-2.5"
        >
          {showShortlistedOnly ? 'Showing shortlisted' : 'Show shortlisted only'}
        </Button>
        <div className="flex gap-2">
          <Button
            variant="outline"
            className="text-accent-yellow border-accent-yellow hover:bg-accent-yellow/10 py-2.5 px-4"
            onClick={() => exportCsv(false)}
          >
            <Download size={18} /> All
          </Button>
          <Button
            variant="outline"
            className="text-success border-success hover:bg-success/10 py-2.5 px-4"
            onClick={() => exportCsv(true)}
          >
            <Download size={18} /> Shortlisted
          </Button>
          <Button variant="danger" className="py-2.5 px-4 hover:animate-pulse" onClick={onReset}>
            <RotateCcw size={18} /> Restart
          </Button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-sm border border-border">
        <table className="w-full text-left whitespace-nowrap">
          <thead className="bg-[#151515] border-b border-border text-left">
            <tr>
              <th
                className="p-3 text-accent-yellow font-oswald tracking-[0.05em] cursor-pointer hover:text-white transition-colors"
                onClick={() => toggleSort('rank')}
              >
                RANK {sortCol === 'rank' && (sortAsc ? '↑' : '↓')}
              </th>
              <th className="p-3 text-accent-yellow font-oswald tracking-[0.05em]">STATUS</th>
              <th
                className="p-3 text-accent-yellow font-oswald tracking-[0.05em] cursor-pointer hover:text-white transition-colors"
                onClick={() => toggleSort('team_name')}
              >
                TEAM {sortCol === 'team_name' && (sortAsc ? '↑' : '↓')}
              </th>
              <th
                className="p-3 text-accent-yellow font-oswald tracking-[0.05em] cursor-pointer hover:text-white transition-colors text-right"
                onClick={() => toggleSort('total_score')}
              >
                SCORE {sortCol === 'total_score' && (sortAsc ? '↑' : '↓')}
              </th>
              {criteriaCols.map((column) => (
                <th
                  key={column.key}
                  className="p-3 text-accent-yellow font-oswald tracking-[0.05em] text-center cursor-help"
                  title={column.label}
                >
                  {column.label}
                </th>
              ))}
              <th className="p-3 w-12"></th>
            </tr>
          </thead>
          <tbody>
            <AnimatePresence>
              {displayTeams.map((team, index) => {
                const isExpanded = expandedRows.has(team.evaluation_id);

                let rankColor = 'text-white';
                if (team.rank === 1) rankColor = 'text-[#ffd700]';
                if (team.rank === 2) rankColor = 'text-[#c0c0c0]';
                if (team.rank === 3) rankColor = 'text-[#cd7f32]';

                let scoreColor = 'text-danger';
                if (team.total_score >= 75) scoreColor = 'text-success';
                else if (team.total_score >= 50) scoreColor = 'text-accent-yellow';

                return (
                  <React.Fragment key={team.evaluation_id}>
                    <motion.tr
                      layout
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className={cn(
                        'group cursor-pointer hover:bg-white/[0.03] transition-colors duration-200 border-b border-white/[0.03]',
                        index % 2 === 0 ? 'bg-surface' : 'bg-black/20',
                        team.is_shortlisted &&
                          "border-l-[3px] border-l-success relative after:content-[''] after:absolute after:inset-y-0 after:left-0 after:w-1 after:bg-success/20 after:blur-sm"
                      )}
                      onClick={() => toggleRow(team.evaluation_id)}
                    >
                      <td
                        className={cn(
                          'p-4 font-oswald font-bold text-[1.4rem] tracking-tighter',
                          rankColor,
                          team.is_shortlisted ? 'pl-5' : ''
                        )}
                      >
                        {team.rank}
                      </td>
                      <td className="p-4">
                        {team.is_shortlisted ? (
                          <div className="flex items-center">
                            <span className="bg-success/5 text-success border border-success/40 px-2 py-0.5 rounded-sm text-[10px] font-bold tracking-[0.1em] flex items-center gap-1.5 shadow-[0_0_10px_rgba(0,255,136,0.1)]">
                              <Check size={11} strokeWidth={3} /> SHORTLISTED
                            </span>
                          </div>
                        ) : (
                          <span className="text-text-muted font-mono text-xs">-</span>
                        )}
                      </td>
                      <td className="p-4">
                        <div className="font-bold text-accent-yellow text-base">{team.team_name}</div>
                        <div className="text-[0.8rem] text-text-secondary">{team.student_name}</div>
                      </td>
                      <td className={cn('p-4 font-oswald font-bold text-[1.5rem] text-right', scoreColor)}>
                        {team.total_score.toFixed(1)}
                      </td>
                      {criteriaCols.map((column) => {
                        const score = team.scores[column.key];
                        const percent = (score / 10) * 100;

                        return (
                          <td key={column.key} className="p-4 w-20">
                            <div className="flex flex-col items-center">
                              <span className="text-[0.75rem] text-text-secondary font-mono mb-1">{score}/10</span>
                              <div className="w-10 h-1 bg-white/10 rounded-sm overflow-hidden border border-white/5">
                                <motion.div
                                  initial={{ width: 0 }}
                                  animate={{ width: `${percent}%` }}
                                  transition={{ duration: 1, ease: 'easeOut' }}
                                  className="h-full bg-accent-pink hover:bg-white transition-colors"
                                />
                              </div>
                            </div>
                          </td>
                        );
                      })}
                      <td className="p-4 text-center">
                        <ChevronDown
                          size={20}
                          className={cn('text-neutral-500 transition-transform duration-300', isExpanded && 'rotate-180')}
                        />
                      </td>
                    </motion.tr>

                    <AnimatePresence>
                      {isExpanded && (
                        <motion.tr
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          className="bg-black/50 overflow-hidden"
                        >
                          <td colSpan={12} className="p-0 border-b border-white/[0.03]">
                            <motion.div
                              initial={{ opacity: 0, y: -5 }}
                              animate={{ opacity: 1, y: 0 }}
                              className="p-8 bg-black/40"
                            >
                              <div className="border-l-2 border-accent-pink pl-6 py-1 max-w-4xl">
                                <span className="text-accent-pink font-oswald text-[11px] uppercase tracking-[0.2em] block mb-3 font-bold">
                                  Neural engine evaluation - Summary
                                </span>
                                <p className="text-text-secondary text-[0.95rem] leading-relaxed m-0 font-space italic">
                                  "{team.scores.summary}"
                                </p>
                              </div>
                            </motion.div>
                          </td>
                        </motion.tr>
                      )}
                    </AnimatePresence>
                  </React.Fragment>
                );
              })}
            </AnimatePresence>
          </tbody>
        </table>

        {displayTeams.length === 0 && (
          <div className="p-12 text-center text-text-muted">
            No teams match your search or filter criteria.
          </div>
        )}
      </div>
    </Card>
  );
}
