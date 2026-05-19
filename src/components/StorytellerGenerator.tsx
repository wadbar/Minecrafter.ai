import React, { useState, useCallback, useMemo, useEffect } from "react";
import GeneratorLayout from "./GeneratorLayout";
import Markdown from "react-markdown";
import DOMPurify from "dompurify";
import { Loader2, ScrollText, Binary, MessageSquareCode, Play, Square } from "lucide-react";
import { saveArtifact } from "../lib/db";
import { cn } from "../lib/utils";

const FORMATS = [
  { id: "denizen", label: "Denizen Script", icon: <Binary className="w-3 h-3" /> },
  { id: "citizens", label: "Citizens CMD", icon: <MessageSquareCode className="w-3 h-3" /> },
  { id: "skript", label: "Skript (NPC)", icon: <ScrollText className="w-3 h-3" /> },
  { id: "vanilla", label: "Vanilla CMD", icon: <Binary className="w-3 h-3" /> }
];

export default function StorytellerGenerator() {
  const [format, setFormat] = useState("denizen");
  const [complexity, setComplexity] = useState("Narrative");
  const [isPlayingVoice, setIsPlayingVoice] = useState(false);

  useEffect(() => {
    return () => {
      window.speechSynthesis.cancel();
    };
  }, []);

  const handleReadAloud = useCallback((text: string) => {
    if (isPlayingVoice) {
      window.speechSynthesis.cancel();
      setIsPlayingVoice(false);
      return;
    }
    
    // Simple regex to strip markdown characters and code blocks for reading aloud
    const cleanText = text
      .replace(/```[\s\S]*?```/g, " [Código Omitido] ")
      .replace(/[*_~`#]/g, "")
      .replace(/\n\n/g, ". ");
      
    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.lang = "pt-BR";
    
    const voices = window.speechSynthesis.getVoices();
    const ptVoices = voices.filter(v => v.lang.includes("pt") || v.lang.includes("PT"));
    if (ptVoices.length > 0) utterance.voice = ptVoices[0];
    
    utterance.rate = 1.05;
    utterance.pitch = 0.9;
    
    utterance.onend = () => setIsPlayingVoice(false);
    utterance.onerror = () => setIsPlayingVoice(false);
    
    window.speechSynthesis.speak(utterance);
    setIsPlayingVoice(true);
  }, [isPlayingVoice]);

  const handleSaveCloud = useCallback(async (title: string, result: string) => {
    await saveArtifact("storyteller", title, result);
  }, []);


  const controls = useMemo(() => (
    <div className="flex flex-col gap-3">
       <div className="flex flex-wrap items-center gap-6 text-neutral-400 font-mono text-xs">
         {/* Format Selection */}
         <div className="flex items-center gap-3 bg-neutral-900/50 p-1.5 rounded-lg border border-neutral-800">
           <div className="flex items-center gap-2 pl-2 pr-1">
             <span className="uppercase tracking-widest font-bold text-[10px] text-fuchsia-400">Target</span>
           </div>
           <div className="flex gap-1">
             {FORMATS.map((f) => (
               <button
                 key={f.id}
                 onClick={() => setFormat(f.id)}
                 className={cn(
                   "px-3 py-1.5 rounded text-[10px] font-bold transition-all flex items-center gap-1.5",
                   format === f.id
                     ? "bg-fuchsia-500/20 text-fuchsia-400 border-fuchsia-500/50"
                     : "bg-transparent text-neutral-500 hover:bg-neutral-800 hover:text-neutral-300"
                 )}
               >
                 {f.icon} {f.label.split(" ")[0]}
               </button>
             ))}
           </div>
         </div>

         {/* Complexity Selection */}
         <div className="flex gap-2">
           {["Narrative", "Mechanic-Heavy", "Dynamic"].map(c => (
             <button
               key={c}
               onClick={() => setComplexity(c)}
               className={cn(
                 "px-3 py-1.5 rounded text-[10px] font-bold border transition-all",
                 complexity === c ? "border-fuchsia-500/50 text-fuchsia-400 bg-fuchsia-500/5" : "border-neutral-800 text-neutral-600"
               )}
             >
               {c}
             </button>
           ))}
         </div>
       </div>
    </div>
  ), [format, complexity]);

  return (
    <GeneratorLayout
      title="Storyteller: Criador de NPCs IA"
      description="Crie missões, lore, árvores de diálogo e comportamentos para NPCs baseados em IA."
      placeholder="Ex: Crie um ferreiro anão cego que dá dicas em formato de charadas..."
      promptTemplates={[
        { 
          label: "🧙‍♂️ Mago Louco", 
          prompt: "Crie um mago louco em uma torre em ruínas que oferece missões que desafiam a lógica e a física do mundo.",
          description: "Narrative character that provides abstract and surreal quests."
        },
        { 
          label: "🐉 Guarda de Fronteira (Inventário)", 
          prompt: "Crie um NPC guarda que tem uma árvore de diálogos ramificada. Se o jogador tiver um 'Passe Imperial' no inventário, ele deixa passar. Se tiver 'Ouro Obscuro', ele aceita suborno. Caso contrário, ele ataca ou bloqueia o caminho.",
          description: "Quest-giver with branching dialogue heavily dependent on the player's inventory items."
        },
        { 
          label: "🤝 Mercador Dinâmico", 
          prompt: "Script de comportamento para um NPC mercador que ajusta os preços dinamicamente. Os preços aumentam se o jogador comprar muito do mesmo item (oferta e demanda), ou diminuem se o jogador tiver alta reputação na cidade.",
          description: "Advanced merchant NPC with a dynamic pricing system based on supply & demand and player reputation."
        },
        {
          label: "🎭 Falsificador de Facções",
          prompt: "Crie um NPC ladino que verifica a reputação do jogador com múltiplas facções. Se o jogador for odiado pelos guardas mas amado pelos ladrões, o NPC vende disfarces e rotas de fuga. Se a condição não bater, o NPC finge ser um mendigo.",
          description: "Complex NPC using multi-faction conditional checks and behavioral shifting."
        }
      ]}
      endpointType="generate-storyteller"
      extraControls={controls}
      onSaveCloud={handleSaveCloud}
      renderOutput={(result, isGenerating) => {
        if (isGenerating) {
          return <Loader2 className="w-8 h-8 animate-spin text-fuchsia-500 mx-auto mt-20" />;
        }
        return (
          <div className="relative">
             <button
                onClick={() => handleReadAloud(result)}
                className={cn(
                  "absolute top-4 right-6 z-10 flex items-center gap-2 px-3 py-1.5 rounded-lg border text-[10px] font-bold uppercase tracking-widest transition-all",
                  isPlayingVoice ? "bg-red-500/10 text-red-400 border-red-500/30 hover:bg-red-500/20" : "bg-fuchsia-500/10 text-fuchsia-400 border-fuchsia-500/30 hover:bg-fuchsia-500/20"
                )}
             >
               {isPlayingVoice ? <Square className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
               {isPlayingVoice ? "Parar_Voz" : "Ouvir_Narrativa"}
             </button>
             <div className="prose prose-invert prose-fuchsia max-w-none markdown-body p-8 pt-14 bg-neutral-900 rounded-lg shadow-inner">
               <Markdown>{DOMPurify.sanitize(result)}</Markdown>
             </div>
          </div>
        );
      }}
    />
  );
}

