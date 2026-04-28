import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { Loader2 } from 'lucide-react';
import { UploadSection } from './components/UploadSection';
import { ConfigSection } from './components/ConfigSection';
import { ProgressSection } from './components/ProgressSection';
import { ResultsSection } from './components/ResultsSection';
import { Card, PanelBadge } from './components/ui';
import { AppConfig, EvaluatedTeam, LogEntry, TeamData } from './lib/types';
import { evaluateAllTeams, testApiKey } from './lib/evaluator';

const API_KEY_SESSION_KEY = 'hackIdeaRanker.apiKey';
const EMBEDDED_API_KEY = 'AIzaSyC40Y5Z9PlGg7ipiq8jC3oXH-9xWmGHvec';

function makeLog(message: string, type: LogEntry['type'] = 'info'): LogEntry {
  return {
    id: Math.random().toString(36).slice(2),
    timestamp: new Date().toLocaleTimeString('en-US', { hour12: false }),
    message,
    type,
  };
}

function getInitialConfig(): AppConfig {
  return {
    shortlistCount: 10,
    weights: {
      innovation: 1,
      technical: 1,
      feasibility: 1,
      commercial: 1,
      impact: 1,
      design: 1,
      pitch: 1,
    },
  };
}

function getStoredApiKey(): string {
  const envKey = typeof import.meta !== 'undefined' ? import.meta.env.VITE_GEMINI_API_KEY || '' : '';
  if (typeof window === 'undefined') {
    return EMBEDDED_API_KEY.trim() || envKey.trim();
  }
  const sessionKey = sessionStorage.getItem(API_KEY_SESSION_KEY) || '';
  return EMBEDDED_API_KEY.trim() || envKey.trim() || sessionKey.trim();
}

export default function App() {
  const [apiKey, setApiKey] = useState(() => getStoredApiKey());
  const [isApiKeyValid, setIsApiKeyValid] = useState<boolean | null>(apiKey ? null : false);
  const [isValidatingKey, setIsValidatingKey] = useState(false);

  const [parsedTeams, setParsedTeams] = useState<TeamData[]>([]);
  const [config, setConfig] = useState<AppConfig>(getInitialConfig);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [progressCount, setProgressCount] = useState(0);
  const [logs, setLogs] = useState<LogEntry[]>([
    makeLog('> System ready. Upload a CSV to begin.'),
  ]);
  const [evaluatedTeams, setEvaluatedTeams] = useState<EvaluatedTeam[]>([]);
  const [evaluationComplete, setEvaluationComplete] = useState(false);

  const addLog = (message: string, type: LogEntry['type'] = 'info') => {
    setLogs((current) => [...current, makeLog(message, type)]);
  };

  useEffect(() => {
    let cancelled = false;

    const validateApiKey = async () => {
      const trimmedKey = apiKey.trim();
      if (!trimmedKey) {
        setIsApiKeyValid(false);
        setIsValidatingKey(false);
        return;
      }

      setIsValidatingKey(true);
      setIsApiKeyValid(null);

      const valid = await testApiKey(trimmedKey);
      if (cancelled) {
        return;
      }

      setIsApiKeyValid(valid);
      setIsValidatingKey(false);
    };

    validateApiKey();

    return () => {
      cancelled = true;
    };
  }, [apiKey]);

  const handleApiKeyChange = (nextKey: string) => {
    setApiKey(nextKey);
    if (typeof window !== 'undefined') {
      sessionStorage.setItem(API_KEY_SESSION_KEY, nextKey);
    }
  };

  useEffect(() => {
    if (typeof window !== 'undefined' && apiKey.trim()) {
      sessionStorage.setItem(API_KEY_SESSION_KEY, apiKey.trim());
    }
  }, [apiKey]);

  const resetWorkflow = () => {
    setParsedTeams([]);
    setEvaluatedTeams([]);
    setEvaluationComplete(false);
    setProgressCount(0);
    setLogs([makeLog('> System ready. Upload a CSV to begin.')]);
    setConfig((current) => ({
      ...current,
      shortlistCount: 10,
    }));
  };

  const runEvaluation = async () => {
    const trimmedKey = apiKey.trim();
    if (!trimmedKey || isApiKeyValid !== true || !parsedTeams.length) {
      addLog('> Evaluation blocked. Check the CSV and Gemini key.', 'error');
      return;
    }

    setIsEvaluating(true);
    setEvaluationComplete(false);
    setEvaluatedTeams([]);
    setProgressCount(0);
    setLogs([makeLog('> Starting evaluation run.', 'warn')]);

    try {
      const results = await evaluateAllTeams({
        apiKey: trimmedKey,
        teams: parsedTeams,
        onLog: addLog,
        onProgress: (processed) => setProgressCount(processed),
      });

      setEvaluatedTeams(results);
      setEvaluationComplete(true);
      addLog('> Evaluation complete. Results ready for export.', 'success');
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      addLog(`> Evaluation stopped: ${message}`, 'error');
    } finally {
      setIsEvaluating(false);
    }
  };

  const handleReset = () => {
    if (confirm('Reset application? All unexported data will be lost.')) {
      resetWorkflow();
    }
  };

  return (
    <div className="max-w-[1000px] mx-auto pb-24 relative p-6">
      <div className="star top-[15%] left-[10%] w-6 h-6 opacity-60 z-[-1] animate-pulse" />
      <div className="star top-[25%] right-[15%] w-8 h-8 opacity-70 z-[-1] animate-pulse delay-700" />
      <div className="star bottom-[40%] left-[5%] w-4 h-4 opacity-40 bg-accent-pink z-[-1] animate-pulse delay-300" />
      <div className="star bottom-[20%] right-[10%] w-10 h-10 opacity-30 bg-text-muted z-[-1]" />

      <div className="fixed top-0 left-0 w-full h-[3px] bg-accent-yellow/10 z-50">
        {isEvaluating && (
          <motion.div
            className="h-full bg-accent-yellow shadow-[0_0_10px_var(--color-accent-yellow)]"
            animate={{ x: ['-100%', '100%'] }}
            transition={{ repeat: Infinity, duration: 2, ease: 'easeInOut' }}
          />
        )}
      </div>

      <Card
        id="header"
        className="mb-6 flex flex-col md:flex-row justify-between items-center gap-6 border-t-[3px] border-t-accent-pink px-8 py-10 shadow-[0_15px_50px_rgba(0,0,0,0.5)]"
      >
        <PanelBadge>System Link</PanelBadge>
        <div className="flex flex-col flex-1 min-w-[300px]">
          <span className="text-accent-yellow font-oswald text-sm tracking-[0.2em] uppercase mb-1 opacity-80">
            Architect Your Autonomy
          </span>
          <h1 className="font-oswald text-[clamp(2.5rem,6vw,4.5rem)] uppercase tracking-[0.05em] leading-none m-0 text-white flex items-center gap-3">
            HACK<span className="text-accent-pink">4</span>RANK
          </h1>
        </div>

        <div className="flex flex-col gap-3 flex-1 w-full min-w-[300px] max-w-sm">
          <div className="text-[11px] font-oswald font-bold tracking-[0.2em] flex items-center uppercase text-text-secondary">
            ENGINE STATUS:
            <span className="ml-3 flex items-center">
              {isEvaluating ? (
                <span className="text-accent-pink flex items-center">
                  <div className="w-2 h-2 rounded-full bg-accent-pink mr-2 shadow-[0_0_10px_var(--color-accent-pink)] animate-pulse" />
                  ONLINE / EVALUATING
                </span>
              ) : isApiKeyValid === true ? (
                <span className="text-success flex items-center">
                  <div className="w-2 h-2 rounded-full bg-success mr-2 shadow-[0_0_10px_var(--color-success)] animate-pulse" />
                  GEMINI ONLINE
                </span>
              ) : isValidatingKey ? (
                <span className="text-accent-yellow flex items-center">
                  <Loader2 size={12} className="animate-spin mr-2" />
                  VERIFYING KEY
                </span>
              ) : (
                <span className="text-danger flex items-center">
                  <div className="w-2 h-2 rounded-full bg-danger mr-2 shadow-[0_0_10px_var(--color-danger)]" />
                  OFFLINE / KEY REQUIRED
                </span>
              )}
            </span>
          </div>
        </div>
      </Card>

      {!evaluationComplete && (
        <div className="space-y-6">
          <UploadSection
            onParsed={(teams) => {
              setParsedTeams(teams);
              setEvaluatedTeams([]);
              setEvaluationComplete(false);
              setProgressCount(0);
              setLogs([makeLog(`> Loaded ${teams.length} team(s). Ready for evaluation.`, 'success')]);
              setConfig((current) => ({
                ...current,
                shortlistCount: Math.max(1, Math.min(current.shortlistCount, teams.length, 10)),
              }));
            }}
            onClear={resetWorkflow}
            loadedCount={parsedTeams.length}
            previewTeams={parsedTeams.slice(0, 5)}
          />

          {parsedTeams.length > 0 && !isEvaluating && (
            <ConfigSection
              config={config}
              setConfig={setConfig}
              onStart={runEvaluation}
              disabled={isEvaluating}
              apiKeyValid={isApiKeyValid}
              loadedCount={parsedTeams.length}
              apiKey={apiKey}
              setApiKey={handleApiKeyChange}
            />
          )}

          {(isEvaluating || logs.length > 1) && (
            <ProgressSection
              progressCount={progressCount}
              totalCount={parsedTeams.length}
              logs={logs}
            />
          )}
        </div>
      )}

      {evaluationComplete && evaluatedTeams.length > 0 && (
        <ResultsSection teams={evaluatedTeams} config={config} onReset={handleReset} />
      )}

      <footer className="mt-24 text-center pb-8 font-oswald text-xs tracking-[0.2em] text-text-muted uppercase">
        Hack4Rank | Powered by Gemini | Built for Hack4Good
      </footer>
    </div>
  );
}
