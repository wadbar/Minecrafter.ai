import React, { useEffect, useRef, useState, useCallback, useMemo } from "react";
import GeneratorLayout from "./GeneratorLayout";
import Prism from "prismjs";
import "prismjs/themes/prism-tomorrow.css";
import "prismjs/components/prism-java";
import "prismjs/components/prism-javascript";
import { Loader2, Box, Layers, Sparkles, BookOpen } from "lucide-react";
import { saveArtifact } from "../lib/db";
import { cn } from "../lib/utils";

const FRAMEWORKS = [
  { id: "spigot", label: "Spigot Plugin", icon: "⚙️" },
  { id: "paper", label: "Paper Plugin", icon: "📄" },
  { id: "fabric", label: "Fabric Mod", icon: "🧶" },
  { id: "forge", label: "Forge Mod", icon: "🔨" },
  { id: "skript", label: "Skript", icon: "📜" }
];

const VERSIONS = ["1.21", "1.20.4", "1.19.4", "1.16.5", "1.12.2", "1.8.8"];
const COMPLEXITIES = ["Standard", "Advanced (OO)", "Enterprise (SRE/Clean)"];

export default function ModGenerator() {
  const [framework, setFramework] = useState("spigot");
  const [version, setVersion] = useState("1.21");
  const [complexity, setComplexity] = useState("Standard");
  const [showDocs, setShowDocs] = useState(false);

  const generateMod = useCallback(async (prompt: string, existingData?: string, targetLanguage?: string) => {
    const isEditMode = !!existingData;
    const endpoint = isEditMode ? "/api/edit-mod" : "/api/generate-mod";
    
    // Anexa o contexto do framework no prompt no modo de criação se não for editar
    const finalPrompt = isEditMode ? prompt : `(Contexto: ${framework.toUpperCase()} para Minecraft ${version}, Estilo de Código: ${complexity}) ${prompt}`;

    const body = isEditMode 
      ? { prompt: finalPrompt, existingData, targetLanguage }
      : { prompt: finalPrompt, type: `${framework}-plugin` };

    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (data.error) throw new Error(data.error);

    // Clean up markdown ticks if Gemini provides them
    let code = data.result;
    if (code.startsWith("\`\`\`java")) {
      code = code.replace(/^\`\`\`java\n/, "");
    } else if (code.startsWith("\`\`\`javascript")) {
      code = code.replace(/^\`\`\`javascript\n/, "");
    }
    if (code.endsWith("\`\`\`")) {
      code = code.slice(0, -3);
    }
    return code;
  }, [framework, version]);

  const handleSaveCloud = useCallback(async (title: string, result: string) => {
    await saveArtifact("mod", title, result);
  }, []);

  const controls = useMemo(() => (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-6 text-neutral-400 font-mono text-xs">
        
        {/* Framework Selection */}
        <div className="flex items-center gap-3 bg-neutral-900/50 p-1.5 rounded-lg border border-neutral-800">
          <div className="flex items-center gap-2 pl-2 pr-1">
            <Box className="w-3.5 h-3.5 text-sky-500" />
            <span className="uppercase tracking-widest font-bold text-[10px]">Engine</span>
          </div>
          <div className="flex gap-1">
            {FRAMEWORKS.map((f) => (
              <button
                key={f.id}
                onClick={() => setFramework(f.id)}
                className={cn(
                  "px-3 py-1.5 rounded text-[10px] font-bold transition-all flex items-center gap-1.5",
                  framework === f.id
                    ? "bg-sky-500/20 text-sky-400 border-sky-500/50"
                    : "bg-transparent text-neutral-500 hover:bg-neutral-800 hover:text-neutral-300"
                )}
              >
                <span>{f.icon}</span> {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* Version Selection */}
        <div className="flex items-center gap-3 bg-neutral-900/50 p-1.5 rounded-lg border border-neutral-800">
          <div className="flex items-center gap-2 pl-2 pr-1">
            <Layers className="w-3.5 h-3.5 text-amber-500" />
            <span className="uppercase tracking-widest font-bold text-[10px]">Build</span>
          </div>
          <select 
            value={version}
            onChange={(e) => setVersion(e.target.value)}
            className="bg-neutral-950 border border-neutral-700 rounded px-3 py-1.5 text-white focus:border-sky-500 focus:outline-none text-[10px] font-bold cursor-pointer hover:border-neutral-600 transition-colors"
          >
            {VERSIONS.map(v => (
              <option key={v} value={v}>MC {v}</option>
            ))}
          </select>
        </div>

        {/* Complexity Selection */}
        <div className="flex items-center gap-3 bg-neutral-900/50 p-1.5 rounded-lg border border-neutral-800">
          <div className="flex items-center gap-2 pl-2 pr-1">
            <Sparkles className="w-3.5 h-3.5 text-emerald-500" />
            <span className="uppercase tracking-widest font-bold text-[10px]">Quality</span>
          </div>
          <div className="flex gap-1">
            {COMPLEXITIES.map((c) => (
              <button
                key={c}
                onClick={() => setComplexity(c)}
                className={cn(
                  "px-3 py-1.5 rounded text-[10px] font-bold transition-all",
                  complexity === c
                    ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/50"
                    : "bg-transparent text-neutral-500 hover:bg-neutral-800 hover:text-neutral-300"
                )}
              >
                {c.split(" ")[0]}
              </button>
            ))}
          </div>
        </div>

        {/* Documentation Toggle */}
        <button 
          onClick={() => setShowDocs(!showDocs)}
          className={cn(
            "flex items-center gap-2 p-1.5 px-3 rounded-lg border transition-colors",
            showDocs 
              ? "bg-sky-500/20 border-sky-500/50 text-sky-400" 
              : "bg-neutral-900/50 border-neutral-800 text-neutral-400 hover:bg-neutral-800"
          )}
        >
          <BookOpen className="w-3.5 h-3.5" />
          <span className="uppercase tracking-widest font-bold text-[10px]">Doc & APIs</span>
        </button>

      </div>

      {showDocs && (
        <div className="bg-neutral-900/50 border border-neutral-800 p-4 rounded-lg text-xs text-neutral-400 leading-relaxed animate-in fade-in slide-in-from-top-2">
          <h4 className="text-sky-400 font-bold mb-3 uppercase tracking-widest flex items-center gap-2">
            <BookOpen className="w-4 h-4" /> 
            Modding API Reference & Best Practices
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-3">
              <div>
                <strong className="text-white block mb-1">Spigot / Paper</strong> 
                Server-side plugin APIs. Very popular for minigames, economy, and server logic. Does not require clients to install anything. Paper is a highly optimized fork of Spigot.
              </div>
              <div>
                <strong className="text-white block mb-1">Forge</strong> 
                The standard for heavy modding (new blocks, dimensions, complex machines). Requires both client and server to have the mod installed.
              </div>
              <div>
                <strong className="text-white block mb-1">Fabric</strong> 
                Lightweight, fast modding toolchain. Often updates instantly to new MC versions. Requires both client and server installations for custom items.
              </div>
            </div>
            <div>
              <strong className="text-white block mb-1">Performance & Best Practices:</strong> 
              <ul className="list-none space-y-2 mt-2">
                <li className="flex gap-2"><span className="text-emerald-500">✓</span> Use asynchronous tasks for database or heavy network operations (never block the main thread).</li>
                <li className="flex gap-2"><span className="text-emerald-500">✓</span> Listeners: Avoid expensive logic in high-frequency events like <code>PlayerMoveEvent</code>.</li>
                <li className="flex gap-2"><span className="text-emerald-500">✓</span> Memory: Unregister listeners and tasks properly during <code>onDisable()</code> or when objects are destroyed.</li>
                <li className="flex gap-2"><span className="text-emerald-500">✓</span> Clean Code: Use Dependency Injection and separate Data, Logic, and Listeners.</li>
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  ), [framework, version, complexity, showDocs]);

  return (
    <GeneratorLayout
      title="Engenharia de Mods & Plugins"
      description="Gere ou otimize código (Refatoração, Clean Code e Tradução) com padrão SRE."
      placeholder="Ex: Crie um plugin de economia... ou Refatore considerando performance..."
      promptTemplates={[
        { 
          label: "💳 Economia Básica", 
          prompt: "Crie um plugin simples de economia com comandos /balance, /pay e /setmoney (admin).",
          description: "Utility template for a standard economy system. Includes basic balance tracking and admin commands."
        },
        { 
          label: "⚔️ Sistema de Clãs", 
          prompt: "Crie um plugin avançado de Clãs com chat isolado, tags e banco cooperativo.",
          description: "Gameplay enhancement adding factions, isolated chat, and cooperative banking mechanics."
        },
        { 
          label: "🪓 Machado do Thor", 
          prompt: "Crie um Item Customizado (Machado) que invoca raios ao clicar com botão direito.",
          description: "Content addition adding an overpowered mythic weapon with special interaction abilities."
        },
        { 
          label: "📊 Scoreboard Animado", 
          prompt: "Desenvolva uma Scoreboard lateral piscante mostrando ping, fps e saldo do jogador.",
          description: "Utility template for visual server information. Adds a sidebar with live player stats."
        }
      ]}
      endpointType="generate-mod"
      onGenerate={generateMod}
      onSaveCloud={handleSaveCloud}
      supportsEditing={true}
      extraControls={controls}
      renderOutput={(result, isGenerating) => {
        if (isGenerating) {
          return <Loader2 className="w-8 h-8 animate-spin text-sky-500 mx-auto mt-20" />;
        }
        return <CodeView code={result} language="java" />;
      }}
    />
  );
}

function CodeView({ code, language }: { code: string; language: string }) {
  const codeRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (codeRef.current) {
      Prism.highlightElement(codeRef.current);
    }
  }, [code, language]);

  return (
    <pre className="!bg-transparent !m-0 !p-0">
      <code ref={codeRef} className={`language-${language}`}>
        {code}
      </code>
    </pre>
  );
}
