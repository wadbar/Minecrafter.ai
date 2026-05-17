import React, { useEffect, useState } from "react";
import { Mic } from "lucide-react";

interface VoiceCommandOverlayProps {
  isListening: boolean;
  interimTranscript: string;
  onCancel: () => void;
}

export default function VoiceCommandOverlay({ isListening, interimTranscript, onCancel }: VoiceCommandOverlayProps) {
  if (!isListening) return null;

  return (
    <div className="absolute inset-0 z-[100] bg-black/80 backdrop-blur-md flex flex-col items-center justify-center rounded-2xl border border-red-500/30 animate-in fade-in duration-300">
      <div className="relative mb-8">
         <div className="w-24 h-24 rounded-full bg-red-500/20 flex items-center justify-center border border-red-500/50">
            <Mic className="w-10 h-10 text-red-500 animate-pulse" />
         </div>
         <div className="absolute inset-0 w-24 h-24 rounded-full border-2 border-red-500/30 animate-ping" />
      </div>
      
      <div className="flex items-end justify-center gap-1.5 h-12 mb-6">
         {[...Array(8)].map((_, i) => (
            <div 
              key={i} 
              className="w-1.5 bg-red-500 rounded-full animate-voice-bar" 
              style={{ animationDelay: `${i * 0.08}s` }} 
            />
         ))}
      </div>

      <div className="text-center space-y-2 max-w-lg">
         <h3 className="text-2xl font-black text-white uppercase tracking-tighter italic">Escuta Ativa</h3>
         <p className="text-xs font-mono text-red-400 uppercase tracking-widest font-bold">Aguardando Comando Neural...</p>
         
         {interimTranscript && (
            <div className="mt-8 p-4 bg-red-500/10 border border-red-500/20 rounded-xl animate-pulse">
               <p className="text-white font-mono text-sm italic">"{interimTranscript}..."</p>
            </div>
         )}

         <div className="flex items-center justify-center flex-wrap max-w-md gap-3 mt-6">
            <span className="text-[9px] font-mono text-neutral-500 uppercase border border-neutral-800 px-2 py-1 rounded">"Ajuda"</span>
            <span className="text-[9px] font-mono text-neutral-500 uppercase border border-neutral-800 px-2 py-1 rounded">"Gerar"</span>
            <span className="text-[9px] font-mono text-neutral-500 uppercase border border-neutral-800 px-2 py-1 rounded">"Limpar"</span>
            <span className="text-[9px] font-mono text-neutral-500 uppercase border border-neutral-800 px-2 py-1 rounded">"Salvar"</span>
            <span className="text-[9px] font-mono text-neutral-500 uppercase border border-neutral-800 px-2 py-1 rounded">"Parar"</span>
            <span className="text-[9px] font-mono text-neutral-500 uppercase border border-neutral-800 px-2 py-1 rounded">"Ir para [Setor]"</span>
            <span className="text-[9px] font-mono text-neutral-500 uppercase border border-neutral-800 px-2 py-1 rounded">"Modo Criação/Otimização"</span>
         </div>
      </div>
      <button 
         onClick={onCancel}
         className="mt-12 px-6 py-2 bg-neutral-900 border border-neutral-800 text-neutral-400 text-[10px] uppercase font-bold tracking-widest rounded-full hover:bg-neutral-800 transition-all"
      >
         Cancelar Escuta
      </button>
    </div>
  );
}
