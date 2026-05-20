import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Sparkles, X, Loader2, BookOpen } from 'lucide-react';
import Markdown from 'react-markdown';
import { toast } from 'sonner';

interface AIGuideProps {
  context: string;
  prompt?: string;
  parameters?: any;
}

export default function AIGuide({ context, prompt, parameters }: AIGuideProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [guide, setGuide] = useState<string | null>(null);

  const fetchGuide = async () => {
    setIsLoading(true);
    setGuide(null);
    try {
      const res = await fetch("/api/ai-guide", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ context, prompt, parameters }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setGuide(data.result);
    } catch (err: any) {
      toast.error("Erro ao gerar guia AI", { description: err.message });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <button
        onClick={() => {
          setIsOpen(true);
          if (!guide) fetchGuide();
        }}
        className="flex items-center gap-2 px-3 py-1.5 bg-m3-secondary-container/50 hover:bg-m3-secondary-container text-m3-on-secondary-container border border-m3-outline-variant rounded-full transition-all active:scale-95 group shadow-m3-1"
        title="Trigger AI Tutorial Guide"
      >
        <Sparkles className="w-4 h-4 group-hover:rotate-12 transition-transform text-m3-secondary" />
        <span className="text-[10px] font-black uppercase tracking-widest hidden sm:inline">Guia_Instrução_AI</span>
        <span className="text-[10px] font-black sm:hidden tracking-widest">AI</span>
      </button>

      <AnimatePresence>
        {isOpen && (
          <div className="fixed inset-0 z-[110] flex items-center justify-end p-4 md:p-8 pointer-events-none">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsOpen(false)}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm pointer-events-auto"
            />
            
            <motion.div
              initial={{ x: 400, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: 400, opacity: 0 }}
              className="relative w-full max-w-md h-[85vh] bg-m3-surface-container-high border border-m3-outline-variant rounded-[2.5rem] shadow-m3-5 overflow-hidden flex flex-col pointer-events-auto"
            >
              <div className="flex items-center justify-between px-8 py-6 border-b border-m3-outline-variant/30 bg-m3-surface-container-highest/20">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-m3-secondary-container flex items-center justify-center shadow-m3-1">
                    <Sparkles className="w-5 h-5 text-m3-on-secondary-container" />
                  </div>
                  <div>
                    <h3 className="text-m3-on-surface font-black text-[11px] uppercase tracking-[0.25em]">AI_Expert_Tutor</h3>
                    <p className="text-[9px] text-m3-on-surface-variant font-mono opacity-60">Orientação Dinâmica Ativa</p>
                  </div>
                </div>
                <button 
                  onClick={() => setIsOpen(false)}
                  className="p-2 text-m3-on-surface-variant hover:bg-m3-surface-variant rounded-full transition-all active:scale-90"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-8 scrollbar-none">
                {isLoading ? (
                  <div className="h-full flex flex-col items-center justify-center space-y-6">
                    <div className="relative">
                      <Loader2 className="w-10 h-10 text-m3-primary animate-spin" />
                      <div className="absolute inset-0 blur-lg bg-m3-primary/20 animate-pulse" />
                    </div>
                    <p className="text-[10px] font-mono text-m3-on-surface-variant uppercase tracking-widest animate-pulse font-black">Injetando Conhecimento...</p>
                  </div>
                ) : guide ? (
                  <div className="prose prose-invert prose-sm max-w-none prose-headings:text-m3-primary prose-headings:font-black prose-headings:uppercase prose-headings:tracking-widest prose-p:text-m3-on-surface-variant prose-p:leading-relaxed">
                     <div className="markdown-body">
                        <Markdown>{guide}</Markdown>
                     </div>
                  </div>
                ) : (
                  <div className="h-full flex flex-col items-center justify-center opacity-20 text-m3-on-surface-variant">
                    <BookOpen className="w-16 h-16 mb-6" />
                    <p className="text-[11px] font-black uppercase tracking-[0.3em]">Nenhum dado carregado.</p>
                  </div>
                )}
              </div>

              <div className="px-8 py-4 border-t border-m3-outline-variant/30 bg-m3-surface-container-highest/20 flex justify-between items-center text-[9px] font-black text-m3-on-surface-variant/40 uppercase tracking-widest">
                <span>Versão: Neural_Guide_v2.0</span>
                <button 
                  onClick={fetchGuide}
                  disabled={isLoading}
                  className="px-4 py-2 hover:bg-m3-surface-variant hover:text-m3-primary rounded-full disabled:opacity-50 transition-all font-black"
                >
                  Recalcular_Guia
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
