import React, { useState, useCallback, useMemo } from "react";
import GeneratorLayout from "./GeneratorLayout";
import Markdown from "react-markdown";
import DOMPurify from "dompurify";
import { Loader2, ScrollText, Binary, MessageSquareCode } from "lucide-react";
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
        { label: "🧙‍♂️ Mago Louco", prompt: "Crie um mago louco em uma torre em ruínas que oferece missões que desafiam a lógica e a física do mundo." },
        { label: "🧝‍♀️ Arqueira Silvestre", prompt: "Árvore de diálogos para uma elfa reclusa na floresta que ensina receitas de veneno apenas após ser salva de aranhas." },
        { label: "🤝 Negociador Nato", prompt: "Script de comportamento para um NPC mercador que ajusta os preços dinamicamente com base na reputação do jogador (usando variables no Denizen)." }
      ]}
      endpointType="generate-storyteller"
      extraControls={controls}
      onSaveCloud={handleSaveCloud}
      renderOutput={(result, isGenerating) => {
        if (isGenerating) {
          return <Loader2 className="w-8 h-8 animate-spin text-fuchsia-500 mx-auto mt-20" />;
        }
        return (
          <div className="prose prose-invert prose-fuchsia max-w-none markdown-body p-4 bg-neutral-900 rounded-lg">
            <Markdown>{DOMPurify.sanitize(result)}</Markdown>
          </div>
        );
      }}
    />
  );
}

