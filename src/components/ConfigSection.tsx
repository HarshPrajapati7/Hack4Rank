import { Card, PanelBadge, Input, Button } from './ui';
import { AlertTriangle, Play, CheckCircle2, Loader2, XCircle } from 'lucide-react';
import React from 'react';
import { AppConfig } from '../lib/types';

interface ConfigSectionProps {
  config: AppConfig;
  setConfig: React.Dispatch<React.SetStateAction<AppConfig>>;
  onStart: () => void;
  disabled: boolean;
  apiKeyValid: boolean | null;
  loadedCount: number;
  apiKey: string;
  setApiKey: (key: string) => void;
}

export function ConfigSection({ config, setConfig, onStart, disabled, apiKeyValid, loadedCount, apiKey, setApiKey }: ConfigSectionProps) {
  const canStart = apiKeyValid === true && loadedCount > 0 && config.shortlistCount > 0;

  return (
    <Card id="config-section" className="mt-6">
      <PanelBadge>Step 2 • Configuration</PanelBadge>
      
      <div className="flex items-center gap-5 mb-6 flex-wrap">
        <label className="text-accent-yellow font-oswald text-[1.2rem] uppercase tracking-[0.05em] whitespace-nowrap">
          Teams to Shortlist:
        </label>
        <Input
          type="number"
          min="1"
          max={loadedCount || 100}
          value={config.shortlistCount}
          onChange={(e) => setConfig(prev => ({ ...prev, shortlistCount: parseInt(e.target.value) || 1 }))}
          className="w-[100px] text-center text-success border-success bg-black/40 text-[1.2rem] py-2 px-3 focus:shadow-[0_0_15px_rgba(0,255,136,0.2)] disabled:opacity-50"
          disabled={disabled}
        />
        <span className="text-text-secondary text-sm italic">
          Top {config.shortlistCount} teams will be marked as shortlisted in results.
        </span>
      </div>

      <div className="mb-6">
        <Input
          type="password"
          placeholder="Paste Gemini API Key to authorize evaluation..."
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          className="w-full bg-black/40 border-border text-text-primary px-4 py-3 bg-[rgba(0,0,0,0.4)] border border-[var(--border)] focus:border-accent-yellow focus:shadow-[0_0_15px_var(--accent-yellow-glow)] rounded-sm"
          disabled={disabled}
        />
        <div className="mt-3 text-xs uppercase tracking-[0.18em] font-oswald">
          {apiKeyValid === true && (
            <span className="text-success flex items-center gap-2">
              <CheckCircle2 size={14} /> Gemini key verified
            </span>
          )}
          {apiKeyValid === null && apiKey.trim() && (
            <span className="text-accent-yellow flex items-center gap-2">
              <Loader2 size={14} className="animate-spin" /> Verifying Gemini key
            </span>
          )}
          {apiKeyValid === false && (
            <span className="text-danger flex items-center gap-2">
              <XCircle size={14} /> Enter a valid Gemini key to enable evaluation
            </span>
          )}
          {!apiKey.trim() && (
            <span className="text-text-muted">
              Paste a Gemini key here. It stays in this browser session only.
            </span>
          )}
        </div>
      </div>

      <div className="bg-warning/10 border-l-4 border-warning text-warning p-4 rounded-r-sm mb-8 flex gap-3 text-sm font-medium">
        <AlertTriangle className="shrink-0" size={20} />
        <p className="m-0">Your idea data is sent to Google Gemini API for evaluation. If a team has weak or missing idea text, the app may also read public GitHub profile data to improve judging.</p>
      </div>

      <Button
        onClick={onStart}
        disabled={disabled || !canStart}
        className={`w-full py-4 text-[1.2rem] gap-3 ${(canStart && !disabled) ? 'border-glow animate-pulse' : ''}`}
      >
        <Play size={24} className={disabled && !canStart ? '' : 'fill-current'}/> START EVALUATION
      </Button>

    </Card>
  );
}
