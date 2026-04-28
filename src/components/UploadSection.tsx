import { TeamData } from '../lib/types';
import { Card, PanelBadge, Input, Button } from './ui';
import Papa, { ParseResult } from 'papaparse';
import { UploadCloud, CheckCircle2 } from 'lucide-react';
import React, { useRef, useState } from 'react';
import { parseTeamsFromRows } from '../lib/csv';

interface UploadSectionProps {
  onParsed: (teams: TeamData[]) => void;
  onClear: () => void;
  loadedCount: number;
  previewTeams: TeamData[];
}

export function UploadSection({ onParsed, onClear, loadedCount, previewTeams }: UploadSectionProps) {
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = (file: File) => {
    if (!file.name.endsWith('.csv')) {
      alert("Please upload a .csv file");
      return;
    }
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results: ParseResult<any>) => {
        processData(results.data);
      }
    });
  };

  const processData = (data: Record<string, unknown>[]) => {
    if (!data || data.length === 0) {
      alert("CSV appears empty.");
      return;
    }
    const parsedTeams: TeamData[] = parseTeamsFromRows(data);

    onParsed(parsedTeams);
  };

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const onDragLeave = () => {
    setIsDragging(false);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const hasData = loadedCount > 0;

  return (
    <Card id="upload-section" className="px-8 py-8">
      <PanelBadge>Step 1 • Telemetry</PanelBadge>
      
      {!hasData ? (
        <div
          className={`border-2 border-dashed border-border py-[60px] px-5 text-center cursor-pointer bg-black/20 transition-all duration-300 flex flex-col items-center justify-center gap-3 ${
            isDragging ? 'border-accent-pink bg-accent-pink-glow glow-hover' : 'hover:border-accent-pink hover:bg-black/40'
          }`}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          <UploadCloud size={48} className={isDragging ? 'text-accent-pink' : 'text-text-secondary'} />
          <h3 className="font-oswald text-2xl text-text-primary tracking-[0.05em] uppercase m-0">DROP CSV MATRIX HERE</h3>
          <p className="text-text-secondary m-0">or click to browse local files</p>
          <input
            type="file"
            accept=".csv"
            className="hidden"
            ref={fileInputRef}
            onChange={(e) => {
              if (e.target.files && e.target.files.length > 0) {
                handleFile(e.target.files[0]);
              }
            }}
          />
        </div>
      ) : (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="flex justify-between items-center mb-5">
            <span className="bg-success/10 text-success border border-success px-3 py-1.5 rounded-sm text-[0.85rem] tracking-[0.05em] flex items-center gap-2 font-bold uppercase">
              <CheckCircle2 size={16} /> LOADED {loadedCount} TEAMS
            </span>
            <button
              onClick={onClear}
              className="text-accent-pink hover:text-white text-[0.85rem] cursor-pointer transition-colors bg-transparent border-0 uppercase tracking-wider"
            >
              [ Reset Data ]
            </button>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[0.9rem] border-collapse">
              <thead>
                <tr>
                  <th className="p-3 text-accent-yellow font-oswald tracking-[0.05em] border-b border-border">TEAM NAME</th>
                  <th className="p-3 text-accent-yellow font-oswald tracking-[0.05em] border-b border-border">STUDENT</th>
                  <th className="p-3 text-accent-yellow font-oswald tracking-[0.05em] border-b border-border">IDEA PREVIEW</th>
                </tr>
              </thead>
              <tbody>
                {previewTeams.map((team, idx) => (
                  <tr key={idx} className="last:border-0 hover:bg-white/5 transition-colors">
                    <td className="p-3 text-white border-b border-white/5">{team.team_name}</td>
                    <td className="p-3 text-text-secondary border-b border-white/5">{team.student_name}</td>
                    <td className="p-3 text-text-muted border-b border-white/5 max-w-sm truncate overflow-hidden whitespace-nowrap hidden md:table-cell">
                      {team.idea.length > 80 ? team.idea.substring(0, 80) + '...' : team.idea || <span className="italic">No Idea Detected</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </Card>
  );
}
