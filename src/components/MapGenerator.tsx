import React, { useCallback, useState, useMemo } from "react";
import GeneratorLayout from "./GeneratorLayout";
import { Loader2, Zap, Layers, Globe } from "lucide-react";
import { saveArtifact } from "../lib/db";
import { cn } from "../lib/utils";

const ENGINES = [
  { id: "worldedit", label: "WorldEdit //set", icon: "📐" },
  { id: "datapack", label: "Datapack (mcfunction)", icon: "📦" },
  { id: "vanilla", label: "Vanilla Commands", icon: "🕹️" }
];

const VERSIONS = ["1.21+", "1.20.x", "1.19.x", "1.18.x"];

export default function MapGenerator() {
  const [engine, setEngine] = useState("worldedit");
  const [version, setVersion] = useState("1.21+");

  const handleSaveCloud = useCallback(async (title: string, result: string) => {
    await saveArtifact("map", title, result);
  }, []);

  const generateMap = useCallback(async (prompt: string, existingData?: string, targetLanguage?: string) => {
     const isEditMode = !!existingData;
     const endpoint = isEditMode ? "/api/edit-map" : "/api/generate-map";
     
     const contextPrompt = `[ENGINE: ${engine.toUpperCase()}] [VERSION: ${version}] ${prompt}`;

     const body = isEditMode 
       ? { prompt: contextPrompt, existingData, targetLanguage }
       : { prompt: contextPrompt };

     const res = await fetch(endpoint, {
       method: "POST",
       headers: { "Content-Type": "application/json" },
       body: JSON.stringify(body),
     });
     const data = await res.json();
     if (data.error) throw new Error(data.error);
     return data.result;
  }, [engine, version]);

  const extraControls = useMemo(() => (
    <div className="flex flex-wrap items-center gap-4 text-neutral-400 font-mono text-[10px]">
       <div className="flex items-center gap-2 bg-neutral-900 px-3 py-1.5 rounded-lg border border-neutral-800">
         <Zap className="w-3 h-3 text-amber-500" />
         <span className="font-bold uppercase tracking-widest text-neutral-500">Engine</span>
         <div className="flex gap-1 ml-2">
            {ENGINES.map(eg => (
              <button 
                key={eg.id}
                onClick={() => setEngine(eg.id)}
                className={cn(
                  "px-2 py-1 rounded transition-all",
                  engine === eg.id ? "bg-amber-500/20 text-amber-500 border border-amber-500/30" : "hover:text-white"
                )}
              >
                {eg.label.split(" ")[0]}
              </button>
            ))}
         </div>
       </div>

       <div className="flex items-center gap-2 bg-neutral-900 px-3 py-1.5 rounded-lg border border-neutral-800">
         <Globe className="w-3 h-3 text-sky-500" />
         <span className="font-bold uppercase tracking-widest text-neutral-500">Manifest</span>
         <select 
           value={version}
           onChange={(e) => setVersion(e.target.value)}
           className="bg-transparent outline-none text-sky-400 font-bold ml-2 cursor-pointer"
         >
           {VERSIONS.map(v => <option key={v} value={v} className="bg-neutral-950">{v}</option>)}
         </select>
       </div>
    </div>
  ), [engine, version]);

  const renderOutput = useCallback((result: string, isGenerating: boolean) => {
    if (isGenerating) {
      return (
        <div className="flex flex-col items-center justify-center mt-20 space-y-4">
          <Loader2 className="w-10 h-10 animate-spin text-emerald-500" />
          <p className="text-[10px] font-mono font-bold text-neutral-500 animate-pulse uppercase tracking-[0.3em]">Constructing Geometry...</p>
        </div>
      );
    }
    return (
      <div className="prose prose-invert prose-emerald max-w-none p-4">
        <div className="flex items-center justify-between mb-4 border-b border-neutral-800 pb-2">
           <div className="flex items-center gap-2 text-[10px] font-mono font-bold text-neutral-600 uppercase tracking-widest">
              <Layers className="w-3 h-3" /> Structure_Manifest
           </div>
        </div>
        <pre className="bg-neutral-950/50 backdrop-blur-sm text-emerald-400 p-6 rounded-xl overflow-x-auto font-mono text-xs leading-relaxed border border-neutral-800 shadow-inner">
          {result}
        </pre>
      </div>
    );
  }, []);

  return (
    <GeneratorLayout
      title="Arquitetura de Terrenos & Estruturas"
      description="Gere ou otimize Datapacks, Comandos e estruturas complexas com traduções."
      placeholder="Ex: Crie uma arena... ou Reduza o lag deste loop de comandos e traduza..."
      promptTemplates={[
        { label: "🏟️ Arena PvP com Kits", prompt: "Crie um script de Command Blocks que gera uma arena PvP de pedra infinita e equipa full iron em quem entrar." },
        { label: "🩸 Sistema de Sangramento", prompt: "Faça um Datapack que aplica efeito de Wither quando um player recebe dano de flecha." },
        { label: "🌳 Gerador de Árvore Gigante", prompt: "Escreva comandos estruturais que criam uma árvore colossal em coordenadas estáticas com baús de tesouro no topo." },
        { label: "✨ Chão Mágico", prompt: "Um sistema command-block que transforma grama em vidro colorido por baixo dos pés de quem tem a tag 'vip'." }
      ]}
      endpointType="generate-map"
      onGenerate={generateMap}
      onSaveCloud={handleSaveCloud}
      supportsEditing={true}
      extraControls={extraControls}
      renderOutput={renderOutput}
    />
  );
}
