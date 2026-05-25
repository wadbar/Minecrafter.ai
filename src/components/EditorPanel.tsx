import React, { useState } from "react";
import { FileEdit, Globe, Trash2, Zap, ChevronDown } from "lucide-react";
import { cn } from "../lib/utils";
import { motion, AnimatePresence } from "motion/react";

interface EditorPanelProps {
  existingData: string;
  setExistingData: (data: string) => void;
  targetLanguage: string;
  setTargetLanguage: (lang: string) => void;
}

export default function EditorPanel({ existingData, setExistingData, targetLanguage, setTargetLanguage }: EditorPanelProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);

  return (
    <AnimatePresence>
      <motion.div 
        initial="hidden"
        animate="visible"
        exit="exit"
        variants={{
          hidden: { opacity: 0, y: 15, scale: 0.98 },
          visible: { 
            opacity: 1, 
            y: 0, 
            scale: 1,
            transition: { 
              duration: 0.4, 
              type: "spring", 
              stiffness: 250, 
              damping: 25,
              staggerChildren: 0.1,
              delayChildren: 0.1
            } 
          },
          exit: { opacity: 0, y: -15, scale: 0.98, transition: { duration: 0.2 } }
        }}
        className={cn(
          "m3-card w-full md:w-1/3 flex flex-col gap-4 relative group backdrop-blur-md transition-all",
          isCollapsed ? "h-fit" : ""
        )}
      >
        <div className="absolute inset-0 bg-m3-primary/5 opacity-0 group-hover:opacity-100 transition-opacity rounded-3xl pointer-events-none" />
        
        <motion.div 
          variants={{ hidden: { opacity: 0, x: -10 }, visible: { opacity: 1, x: 0, transition: { type: "spring", stiffness: 300, damping: 24 } } }} 
          className="flex items-center justify-between z-10 cursor-pointer select-none"
          onClick={() => setIsCollapsed(!isCollapsed)}
        >
          <div className="flex items-center gap-2 text-m3-on-surface font-bold text-xs uppercase tracking-wider">
            <Zap className="w-4 h-4 text-m3-primary" /> 
            Source_Ingest
          </div>
          <div className="flex items-center gap-2">
            <button 
              onClick={(e) => { e.stopPropagation(); setExistingData(""); }}
              className={cn(
                "m3-button-tonal p-2 min-w-0 px-2 h-8 text-m3-on-surface-variant hover:text-m3-on-surface hover:bg-m3-error-container",
                !existingData && "opacity-0 pointer-events-none"
              )}
              title="Purge Buffer"
            >
              <Trash2 className="w-4 h-4" />
            </button>
            <motion.div animate={{ rotate: isCollapsed ? 180 : 0 }}>
              <ChevronDown className="w-4 h-4 text-m3-on-surface-variant" />
            </motion.div>
          </div>
        </motion.div>

        <AnimatePresence initial={false}>
          {!isCollapsed && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.3, ease: "easeInOut" }}
              className="flex flex-col gap-4 flex-1 origin-top overflow-hidden"
            >
              <motion.div variants={{ hidden: { opacity: 0, y: 10 }, visible: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 24 } } }} className="relative flex-1 flex flex-col z-10">
                <textarea
                  value={existingData}
                  onChange={(e) => setExistingData(e.target.value)}
                  placeholder="Inject source code or raw data here for AI synthesis and structural optimization..."
                  className="m3-input flex-1 font-mono text-[11px] leading-relaxed resize-none shadow-inner text-m3-on-surface placeholder:text-m3-on-surface-variant"
                />
                <div className="absolute top-3 right-3 flex flex-col items-end gap-1 pointer-events-none transition-opacity">
                  <span className="text-[9px] font-bold text-m3-on-surface-variant uppercase">Buffer_v9.0</span>
                  <span className="text-[9px] font-mono text-m3-on-surface font-bold">{existingData.length} BITS</span>
                </div>
              </motion.div>

              <motion.div variants={{ hidden: { opacity: 0, y: 10 }, visible: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 24 } } }} className="space-y-3 z-10 pt-4 border-t border-m3-outline-variant">
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
                    className="m3-input text-xs font-bold text-m3-on-surface placeholder:text-m3-on-surface-variant"
                    placeholder="e.g., Python / Java / MD / JSON"
                  />
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-m3-primary animate-pulse shadow-[0_0_8px_rgba(var(--m3-primary-rgb),0.5)]" />
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </AnimatePresence>
  );
}
