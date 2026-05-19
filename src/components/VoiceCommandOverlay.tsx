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
    <div className="absolute inset-0 z-[100] bg-black/90 backdrop-blur-md flex flex-col items-center justify-center border border-red-500/20 animate-in fade-in duration-300">
      
      {/* Dynamic Grid Background overlay */}
      <div className="absolute inset-0 pointer-events-none opacity-[0.03] bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.8)_1px,transparent_1px)] bg-[size:16px_16px]" />
      
      {/* Central Visualizer */}
      <div className="relative mb-12">
         <div className="w-32 h-32 rounded-full bg-red-500/10 flex items-center justify-center border border-red-500/40 shadow-[0_0_40px_rgba(239,68,68,0.2)]">
            <Mic className="w-12 h-12 text-red-500 animate-pulse drop-shadow-[0_0_10px_rgba(239,68,68,0.8)]" />
         </div>
         <div className="absolute inset-0 w-32 h-32 rounded-full border-2 border-red-500/30 animate-ping" style={{ animationDuration: '2s' }} />
         <div className="absolute inset-0 w-32 h-32 rounded-full border border-red-500/20 animate-ping" style={{ animationDuration: '3s', animationDelay: '0.5s' }} />
      </div>
      
      {/* Audio Visualizer Bars */}
      <div className="flex items-center justify-center gap-2 h-16 mb-8 relative z-10 w-full max-w-[200px]">
         {[...Array(12)].map((_, i) => {
            const h = 20 + Math.random() * 40;
            return (
              <div 
                key={i} 
                className="w-1.5 bg-red-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(239,68,68,0.8)]" 
                style={{ height: `${h}%`, animationDuration: `${0.5 + Math.random()}s` }} 
              />
            )
         })}
      </div>

      <div className="text-center space-y-3 max-w-2xl relative z-10">
         <h3 className="text-3xl font-black text-white uppercase tracking-[0.2em]">Escuta_Ativa</h3>
         <p className="text-[10px] font-mono text-red-400 uppercase tracking-[0.3em] font-bold">Aguardando_Input_Neural...</p>
         
         {interimTranscript && (
            <div className="mt-8 p-6 bg-red-500/10 border border-red-500/30 rounded-lg shadow-[inset_0_0_20px_rgba(239,68,68,0.1)] relative overflow-hidden">
               <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-red-500 to-transparent opacity-50" />
               <p className="text-white font-mono text-lg tracking-wide shadow-red-500/50 drop-shadow-md">"{interimTranscript}..."</p>
            </div>
         )}

         <div className="flex items-center justify-center flex-wrap gap-2 mt-10">
            {["Ajuda", "Gerar", "Limpar", "Salvar", "Parar", "Ir para [Setor]", "Modo Criação"].map((cmd, i) => (
              <span key={i} className="text-[9px] font-mono text-red-500/60 uppercase border border-red-500/20 bg-red-500/5 px-2.5 py-1 rounded-sm tracking-widest">{cmd}</span>
            ))}
         </div>
      </div>
      
      <button 
         onClick={onCancel}
         className="mt-16 px-8 py-3 bg-transparent border border-red-500/30 text-red-500 hover:text-white hover:bg-red-500/20 text-[10px] uppercase font-mono font-bold tracking-[0.2em] transition-all relative group"
      >
         <div className="absolute inset-0 bg-red-500/10 scale-x-0 group-hover:scale-x-100 transition-transform origin-left" />
         <span className="relative">Cancelar_Escuta</span>
      </button>
    </div>
  );
}
