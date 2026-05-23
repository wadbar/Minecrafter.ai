import React from "react";
import { FileEdit, Globe, Trash2, Zap } from "lucide-react";
import { cn } from "../lib/utils";
import { motion, AnimatePresence } from "motion/react";

interface EditorPanelProps {
  existingData: string;
  setExistingData: (data: string) => void;
  targetLanguage: string;
  setTargetLanguage: (lang: string) => void;
}

export default function EditorPanel({ existingData, setExistingData, targetLanguage, setTargetLanguage }: EditorPanelProps) {
  return (
    <AnimatePresence>
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
        transition={{ duration: 0.3, type: "spring", stiffness: 300, damping: 25 }}
        className="w-full md:w-1/3 flex flex-col gap-4 border border-m3-outline bg-m3-surface-container rounded-3xl p-6 backdrop-blur-md relative group shadow-m3-2"
      >
        <div className="absolute inset-0 bg-m3-primary/5 opacity-0 group-hover:opacity-100 transition-opacity rounded-3xl pointer-events-none" />
        
        <div className="flex items-center justify-between z-10">
          <div className="flex items-center gap-2 text-m3-primary font-bold text-xs uppercase tracking-wider">
            <Zap className="w-4 h-4 text-m3-primary" /> 
            Source_Ingest
          </div>
          <button 
            onClick={() => setExistingData("")}
            className={cn(
              "p-2 rounded-full hover:bg-red-500/10 text-m3-on-surface-variant hover:text-red-400 transition-all shadow-m3-1 hover:shadow-m3-2 active:scale-95",
              !existingData && "opacity-0 pointer-events-none"
            )}
            title="Purge Buffer"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>

        <div className="relative flex-1 flex flex-col z-10">
          <textarea
            value={existingData}
            onChange={(e) => setExistingData(e.target.value)}
            placeholder="Inject source code or raw data here for AI synthesis and structural optimization..."
            className="flex-1 w-full bg-m3-surface-container-high border border-m3-outline-variant rounded-2xl p-5 text-m3-on-surface font-mono text-[11px] leading-relaxed focus:outline-none focus:border-m3-primary focus:ring-1 focus:ring-m3-primary/30 transition-all resize-none shadow-inner"
          />
          <div className="absolute top-3 right-3 flex flex-col items-end gap-1 pointer-events-none opacity-40 group-hover:opacity-80 transition-opacity">
            <span className="text-[9px] font-bold text-m3-on-surface-variant uppercase">Buffer_v9.0</span>
            <span className="text-[9px] font-mono text-m3-primary font-bold">{existingData.length} BITS</span>
          </div>
        </div>

        <div className="space-y-3 z-10 pt-4 border-t border-m3-outline-variant">
          <div className="flex items-center justify-between">
             <label className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-m3-on-surface-variant">
               <Globe className="w-3.5 h-3.5" /> Target_Schema
             </label>
          </div>
          <div className="relative">
            <input
              type="text"
              value={targetLanguage}
              onChange={(e) => setTargetLanguage(e.target.value)}
              className="w-full bg-m3-surface-container border border-m3-outline rounded-xl px-4 py-3 text-m3-on-surface focus:outline-none focus:border-m3-primary text-xs font-bold placeholder:text-m3-outline-variant transition-all hover:shadow-m3-1 focus:shadow-m3-2"
              placeholder="e.g., Python / Java / MD / JSON"
            />
            <div className="absolute right-3 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-m3-primary animate-pulse shadow-[0_0_8px_rgba(var(--m3-primary-rgb),0.5)]" />
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
