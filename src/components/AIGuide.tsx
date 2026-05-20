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
        className="flex items-center gap-2 px-3 py-1.5 bg-sky-500/10 hover:bg-sky-500/20 text-sky-400 border border-sky-500/20 rounded-lg transition-all active:scale-95 group"
        title="Trigger AI Tutorial Guide"
      >
        <Sparkles className="w-4 h-4 group-hover:rotate-12 transition-transform" />
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
              className="absolute inset-0 bg-black/60 backdrop-blur-md pointer-events-auto"
            />
            
            <motion.div
              initial={{ x: 400, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: 400, opacity: 0 }}
              className="relative w-full max-w-md h-[80vh] bg-neutral-900 border border-neutral-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col pointer-events-auto industrial-bg"
            >
              <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-800 bg-black/20">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-sky-500/20 flex items-center justify-center">
                    <Sparkles className="w-4 h-4 text-sky-400" />
                  </div>
                  <div>
                    <h3 className="text-white font-black text-[10px] uppercase tracking-[0.2em]">AI_Expert_Tutor</h3>
                    <p className="text-[8px] text-neutral-500 font-mono">Orientação Dinâmica Ativa</p>
                  </div>
                </div>
                <button 
                  onClick={() => setIsOpen(false)}
                  className="p-1 text-neutral-500 hover:text-white transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 scrollbar-none">
                {isLoading ? (
                  <div className="h-full flex flex-col items-center justify-center space-y-4">
                    <Loader2 className="w-8 h-8 text-sky-500 animate-spin" />
                    <p className="text-[10px] font-mono text-neutral-500 uppercase tracking-widest animate-pulse">Injetando Conhecimento...</p>
                  </div>
                ) : guide ? (
                  <div className="prose prose-invert prose-sm max-w-none prose-sky prose-headings:text-sky-400 prose-headings:font-black prose-headings:uppercase prose-headings:tracking-widest">
                     <div className="markdown-body">
                        <Markdown>{guide}</Markdown>
                     </div>
                  </div>
                ) : (
                  <div className="h-full flex flex-col items-center justify-center opacity-30 text-neutral-500">
                    <BookOpen className="w-12 h-12 mb-4" />
                    <p className="text-xs font-mono uppercase tracking-widest">Nenhum dado carregado.</p>
                  </div>
                )}
              </div>

              <div className="p-4 border-t border-neutral-800 bg-black/40 flex justify-between items-center text-[8px] font-mono text-neutral-600 uppercase tracking-widest">
                <span>Versão: Neural_Guide_v2.0</span>
                <button 
                  onClick={fetchGuide}
                  disabled={isLoading}
                  className="p-1 px-2 hover:text-sky-400 disabled:opacity-50 transition-colors"
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
