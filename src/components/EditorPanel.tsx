import React from "react";
import { FileEdit, Globe, Trash2, Zap } from "lucide-react";
import { cn } from "../lib/utils";

interface EditorPanelProps {
  existingData: string;
  setExistingData: (data: string) => void;
  targetLanguage: string;
  setTargetLanguage: (lang: string) => void;
}

export default function EditorPanel({ existingData, setExistingData, targetLanguage, setTargetLanguage }: EditorPanelProps) {
  return (
    <div className="w-1/3 flex flex-col gap-4 border border-neutral-800 bg-black/40 rounded-2xl p-6 backdrop-blur-md relative group animate-in slide-in-from-left-4 duration-500">
      <div className="absolute inset-0 bg-sky-500/5 opacity-0 group-hover:opacity-100 transition-opacity rounded-2xl pointer-events-none" />
      
      <div className="flex items-center justify-between z-10">
        <div className="flex items-center gap-2 text-sky-500 font-mono text-[10px] uppercase tracking-[0.2em] font-black">
          <Zap className="w-3.5 h-3.5 fill-sky-500/20" /> 
          Source_Ingest
        </div>
        <button 
          onClick={() => setExistingData("")}
          className={cn(
            "p-1.5 rounded-md hover:bg-red-500/10 text-neutral-600 hover:text-red-400 transition-all",
            !existingData && "opacity-0 pointer-events-none"
          )}
          title="Purge Buffer"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="relative flex-1 flex flex-col z-10">
        <textarea
          value={existingData}
          onChange={(e) => setExistingData(e.target.value)}
          placeholder="Inject source code or raw data here for AI synthesis and structural optimization..."
          className="flex-1 w-full bg-neutral-900/30 border border-neutral-800/80 rounded-xl p-5 text-neutral-300 font-mono text-[10px] leading-relaxed focus:outline-none focus:border-sky-500/50 focus:ring-1 focus:ring-sky-500/20 transition-all resize-none shadow-inner"
        />
        <div className="absolute top-3 right-3 flex flex-col items-end gap-1 pointer-events-none opacity-30 group-hover:opacity-60 transition-opacity">
          <span className="text-[8px] font-mono font-bold text-neutral-500 uppercase">Buffer_v9.0</span>
          <span className="text-[8px] font-mono text-sky-500 font-bold">{existingData.length} BITS</span>
        </div>
      </div>

      <div className="space-y-3 z-10 pt-2 border-t border-neutral-900">
        <div className="flex items-center justify-between">
           <label className="flex items-center gap-2 text-[9px] font-mono font-black uppercase tracking-[0.2em] text-neutral-500">
             <Globe className="w-3 h-3" /> Target_Schema
           </label>
        </div>
        <div className="relative">
          <input
            type="text"
            value={targetLanguage}
            onChange={(e) => setTargetLanguage(e.target.value)}
            className="w-full bg-neutral-900/50 border border-neutral-800 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-sky-500/50 text-[11px] font-mono font-bold placeholder:text-neutral-700 transition-all"
            placeholder="e.g., Python / Java / MD / JSON"
          />
          <div className="absolute right-3 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-sky-500/40 animate-pulse shadow-[0_0_8px_rgba(14,165,233,0.4)]" />
        </div>
      </div>

      {/* Decorative corners */}
      <div className="absolute top-0 left-0 w-2 h-2 border-t border-l border-neutral-800 rounded-tl-2xl" />
      <div className="absolute bottom-0 right-0 w-2 h-2 border-b border-r border-neutral-800 rounded-br-2xl" />
    </div>
  );
}
