import React from "react";
import { FileEdit, Globe } from "lucide-react";

interface EditorPanelProps {
  existingData: string;
  setExistingData: (data: string) => void;
  targetLanguage: string;
  setTargetLanguage: (lang: string) => void;
}

export default function EditorPanel({ existingData, setExistingData, targetLanguage, setTargetLanguage }: EditorPanelProps) {
  return (
    <div className="w-1/3 flex flex-col gap-4 border border-neutral-800 bg-neutral-950/50 rounded-2xl p-6 backdrop-blur-sm relative group">
      <div className="absolute inset-0 bg-sky-500/5 opacity-0 group-hover:opacity-100 transition-opacity rounded-2xl pointer-events-none" />
      <div className="flex items-center justify-between text-sky-500 font-mono text-[10px] uppercase tracking-widest font-bold z-10">
        <div className="flex items-center gap-2"><FileEdit className="w-3.5 h-3.5" /> Source_Ingest</div>
        <div className="text-neutral-600">Buffer: {existingData.length} chars</div>
      </div>
      <textarea
        value={existingData}
        onChange={(e) => setExistingData(e.target.value)}
        placeholder="Inject source code here for AI analysis and structural optimization..."
        className="flex-1 w-full bg-neutral-900/30 border border-neutral-800 rounded-xl p-4 text-neutral-300 font-mono text-xs focus:outline-none focus:border-sky-500/50 transition-all resize-none shadow-inner relative z-10 custom-scrollbar"
      />
      <div className="space-y-2 z-10">
        <label className="flex items-center gap-2 text-[10px] font-mono font-bold uppercase tracking-widest text-neutral-600">
          <Globe className="w-3.5 h-3.5" /> Target_Lang
        </label>
        <input
          type="text"
          value={targetLanguage}
          onChange={(e) => setTargetLanguage(e.target.value)}
          className="w-full bg-neutral-900/50 border border-neutral-800 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-sky-500/50 text-xs font-mono"
        />
      </div>
    </div>
  );
}
