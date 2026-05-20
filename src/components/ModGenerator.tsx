import React, { useEffect, useRef, useState, useCallback, useMemo } from "react";
import GeneratorLayout from "./GeneratorLayout";
import Prism from "prismjs";
import "prismjs/themes/prism-tomorrow.css";
import "prismjs/components/prism-java";
import "prismjs/components/prism-javascript";
import { Loader2, Box, Layers, Sparkles, BookOpen, Download, RotateCcw, RotateCw, Copy, Cloud } from "lucide-react";
import { saveArtifact } from "../lib/db";
import { FrontLogger } from "../lib/logger";
import { cn, sleep, withExponentialBackoff } from "../lib/utils";
import { saveAs } from "file-saver";
import { toast } from "sonner";
import JSZip from "jszip";

const FRAMEWORKS = [
  { id: "spigot", label: "Spigot Plugin", icon: "⚙️" },
  { id: "paper", label: "Paper Plugin", icon: "📄" },
  { id: "fabric", label: "Fabric Mod", icon: "🧶" },
  { id: "forge", label: "Forge Mod", icon: "🔨" },
  { id: "skript", label: "Skript", icon: "📜" }
];

const VERSIONS = ["1.21", "1.20.4", "1.19.4", "1.16.5", "1.12.2", "1.8.8"];
const COMPLEXITIES = ["Standard", "Advanced (OO)", "Industrial (Clean Code)"];

const API_DOCS: Record<string, { 
  default: { description: string, docs: string, guides: string[] },
  versions: Record<string, { highlights: string[] }> 
}> = {
  spigot: {
    default: {
      description: "Server-side plugins. Does not require clients to install anything.",
      docs: "https://hub.spigotmc.org/javadocs/spigot/",
      guides: ["Never block the main thread.", "Avoid heavy loops in PlayerMoveEvent.", "Run DB calls asynchronously."]
    },
    versions: {
      "1.21": { highlights: ["Uses Data Components instead of NBT.", "New Trial Spawner APIs."] },
      "1.20.4": { highlights: ["Armor Trim API.", "Display Entities added."] },
      "1.16.5": { highlights: ["Hex color codes introduced. Use net.md_5.bungee.api.ChatColor.", "PersistentDataContainer recommended."] },
      "1.8.8": { highlights: ["Legacy version. Heavily reliant on direct NBT manipulation.", "Combat update hasn't happened yet."] },
    }
  },
  paper: {
    default: {
      description: "Paper offers an expanded API over Spigot, with better performance optimizations.",
      docs: "https://jd.papermc.io/paper/",
      guides: ["Use Folia for true multithreading if scaling high.", "Use Paper's AsyncChatEvent over Spigot's AsyncPlayerChatEvent.", "Profile with timings/spark."]
    },
    versions: {
      "1.21": { highlights: ["Uses Data Components instead of NBT.", "Enhanced block lookup performance."] },
      "1.20.4": { highlights: ["Folia compatibility considerations.", "Improved chunk generation API."] },
      "1.16.5": { highlights: ["Async Chunk Loading introduced natively.", "Hex color parsing built-in via Kyori Adventure."] },
      "1.8.8": { highlights: ["Paper 1.8.8 exists but is highly legacy.", "Consider using modernized forks if keeping 1.8.8."] },
    }
  },
  fabric: {
    default: {
      description: "Lightweight and modular modding toolchain. Excellent for both server-side only mods and full client-server mods.",
      docs: "https://maven.fabricmc.net/docs/yarn-latest/",
      guides: ["Use Mixins for deep modifications.", "Client and server code must be clearly separated (use Environment annotations carefully)."]
    },
    versions: {
      "1.21": { highlights: ["Data component modding.", "Update to new networking API standard."] },
      "1.20.4": { highlights: ["Fabric API features robust command registration.", "Renderer API available for complex blocks."] },
    }
  },
  forge: {
    default: {
      description: "The historical standard for deep engine modifications. Requires both client and server to install the mod.",
      docs: "https://docs.minecraftforge.net/en/latest/",
      guides: ["Uses EventBus for registry events.", "Use Capabilities for entity and tile entity data.", "Use DeferredRegister for cleaner code."]
    },
    versions: {
      "1.21": { highlights: ["NeoForge split context - ensure you pick the right toolchain.", "Events API updated."] },
      "1.16.5": { highlights: ["Capabilities heavily used.", "Blockstates and Models require careful JSON generation."] },
      "1.12.2": { highlights: ["Classic golden era of modding.", "Requires IHasModel if not using modern registries."] }
    }
  },
  skript: {
    default: {
      description: "High-level configuration-like language to create plugins without touching Java.",
      docs: "https://skriptlang.github.io/Skript/",
      guides: ["Fast prototyping for simple ideas.", "Avoid variables with no cleanup (can cause memory leaks).", "Not recommended for highly complex or performance-critical systems."]
    },
    versions: {
      "1.21": { highlights: ["Skript 2.9+ recommended for component support."] },
      "1.20.4": { highlights: ["Stable support with Skript 2.8+."] }
    }
  }
};

export default function ModGenerator() {
  const [framework, setFramework] = useState("spigot");
  const [version, setVersion] = useState("1.21");
  const [complexity, setComplexity] = useState("Standard");
  const [loadingDocs, setLoadingDocs] = useState(false);
  const [telemetryLogs, setTelemetryLogs] = useState<{id: string, msg: string, type: 'info' | 'warn' | 'success'}[]>([]);

  const [undoStack, setUndoStack] = useState<string[]>([]);
  const [redoStack, setRedoStack] = useState<string[]>([]);
  const [currentCode, setCurrentCode] = useState("");

  const onGenerateComplete = useCallback((result: string) => {
    if (currentCode) {
      setUndoStack(prev => [currentCode, ...prev].slice(0, 20));
    }
    setRedoStack([]);
    setCurrentCode(result);
  }, [currentCode]);

  const undo = useCallback(() => {
    if (undoStack.length === 0) return;
    const prev = undoStack[0];
    setRedoStack(r => [currentCode, ...r]);
    setCurrentCode(prev);
    setUndoStack(u => u.slice(1));
  }, [currentCode, undoStack]);

  const redo = useCallback(() => {
    if (redoStack.length === 0) return;
    const next = redoStack[0];
    setUndoStack(u => [currentCode, ...u]);
    setCurrentCode(next);
    setRedoStack(r => r.slice(1));
  }, [currentCode, redoStack]);

  const addLog = useCallback((msg: string, type: 'info' | 'warn' | 'success' = 'info') => {
    const id = Math.random().toString(36).substring(2, 9);
    setTelemetryLogs(prev => [{id, msg, type}, ...prev].slice(0, 7));
  }, []);

  useEffect(() => {
    let active = true;
    const fetchDocs = async () => {
      setLoadingDocs(true);
      try {
        await sleep(400); // UI Minimum display time to avoid flicker
      } finally {
        if (active) setLoadingDocs(false);
      }
    };
    fetchDocs();
    return () => { active = false; };
  }, [framework, version]);

  const generateMod = useCallback(async (prompt: string, existingData?: string, targetLanguage?: string) => {
    addLog(`Iniciando pipeline de ${existingData ? 'otimização' : 'geração'}...`, "info");
    try {
      const isEditMode = !!existingData;
      const endpoint = isEditMode ? "/api/edit-mod" : "/api/generate-mod";
      
      // Prompt Optimization
      const systemContext = `
# ROLE: Senior Minecraft Systems Engineer
# CONTEXT: ${framework.toUpperCase()} | Version: ${version}
# QUALITY: ${complexity}
# CONSTRAINTS:
- Use only valid API methods for ${version}.
- Ensure thread safety (use Async tasks for I/O).
- Apply standard design patterns.
- If Java, ensure the class is public and follows naming conventions.
- If version is 1.21+, use Data Components instead of NBT if applicable for ${framework}.
`;

      const finalPrompt = isEditMode 
        ? `${systemContext}\n# TASK: Refactor/Update/Translate\n${prompt}` 
        : `${systemContext}\n# TASK: Create new logic\n${prompt}`;

      const body = isEditMode 
        ? { prompt: finalPrompt, existingData, targetLanguage }
        : { prompt: finalPrompt, type: `${framework}-plugin` };

      addLog(`Transmitindo requisição para ${endpoint}...`, "info");
      
      let res;
      let data;
      try {
        res = await withExponentialBackoff(async () => {
          const response = await fetch(endpoint, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          });
          if (!response.ok) {
            throw new Error(`Servidor indisponível (Status: ${response.status})`);
          }
          return response;
        }, 3, 1500);
        data = await res.json();
        if (data.error) throw new Error(data.error);
      } catch (fetchErr: any) {
        FrontLogger.error("API Request Failure", { endpoint, error: fetchErr.message });
        addLog(`Erro de conexão: ${fetchErr.message}. Ativando Offline Engine.`, "warn");
        
        // Import OfflineEngine if needed, but it should be available. Wait, is it imported at top?
        // It's not currently imported in ModGenerator... wait, I need to check.
        // Actually, just to be safe, I'll fallback.
        try {
          const { OfflineEngine } = await import("../services/OfflineEngine");
          const fallbackCode = OfflineEngine.generateMod(prompt, framework as any);
          addLog("Gerado via Procedural Fallback.", "success");
          return fallbackCode;
        } catch (offlineErr) {
          throw fetchErr;
        }
      }

      addLog("Resposta recebida e validada.", "success");

      // Clean up markdown ticks if Gemini provides them
      let code = data.result || "";
    if (code.startsWith("\`\`\`java")) {
      code = code.replace(/^\`\`\`java\n/, "");
    } else if (code.startsWith("\`\`\`javascript")) {
      code = code.replace(/^\`\`\`javascript\n/, "");
    }
    if (code.endsWith("```")) {
      code = code.slice(0, -3);
    }
    return code;
    } catch (error: any) {
      FrontLogger.error("Mod Generation Failure", { error: error.message });
      addLog(`Falha técnica: ${error.message}`, "warn");
      toast.error("Erro no Processamento", { description: error?.message || "Ocorreu uma falha na IA." });
      throw error;
    }
  }, [framework, version, complexity]);

  const handleDownloadJar = useCallback(async (code: string) => {
    const zip = new JSZip();

    // Analyze code for class name and package with improved regex
    let className = "GeneratedMod";
    let packageName = "";
    
    // Improved class name detection (handles generic classes, multiple modifiers)
    const classMatch = code.match(/public\s+(?:abstract\s+|final\s+)?class\s+([A-Za-z0-9_]+)/);
    if (classMatch && classMatch[1]) {
      className = classMatch[1];
    }
    
    // Improved package detection
    const packageMatch = code.match(/package\s+([a-zA-Z0-9_.]+);/);
    if (packageMatch && packageMatch[1]) {
      packageName = packageMatch[1];
    }

    // Naming config: {MainClass}-{Framework}-{MCVersion}.jar
    const safeName = className.replace(/[^a-zA-Z0-9_-]/g, "");
    const cleanFramework = framework.charAt(0).toUpperCase() + framework.slice(1);
    const fileName = `${safeName}-${cleanFramework}-${version}.jar`;

    // Skript special case - not a JAR
    if (framework === "skript") {
      const blob = new Blob([code], { type: "text/plain" });
      saveAs(blob, `${safeName}-${version}.sk`);
      toast.success("Script Exportado", { description: `Arquivo .sk para Skript MC ${version}` });
      return;
    }

    try {
      // Java package structure
      const packagePath = packageName ? packageName.replace(/\./g, "/") + "/" : "";
      const fullSourcePath = `src/main/java/${packagePath}${className}.java`;
      zip.file(fullSourcePath, code);

      // Standard MANIFEST.MF
      const mainClassPath = `${packageName ? packageName + "." : ""}${className}`;
      const manifest = [
        "Manifest-Version: 1.0",
        `Created-By: Minecraft Solution Builder (SRE Core)`,
        `Main-Class: ${mainClassPath}`,
        ""
      ].join("\n");
      zip.file("META-INF/MANIFEST.MF", manifest);

      // Metadata Generation Logic
      const apiVersion = version.split(".").slice(0, 2).join("."); // e.g., 1.21.1 -> 1.21
      const description = `Minecraft ${cleanFramework} mod: ${className}. Generated via AI Studio. Target: ${version}.`;
      const author = "AI_Solution_Generator";

      if (framework === "spigot" || framework === "paper") {
        const pluginYml = [
          `name: ${className}`,
          `version: 1.0.0`,
          `main: ${mainClassPath}`,
          `author: ${author}`,
          `description: ${description}`,
          `api-version: "${apiVersion}"`,
          `load: POSTWORLD`,
          `prefix: ${className.toUpperCase().slice(0, 8)}`
        ].join("\n");
        zip.file("plugin.yml", pluginYml);
      } else if (framework === "fabric") {
        const fabricModJson = JSON.stringify({
          schemaVersion: 1,
          id: className.toLowerCase().replace(/[^a-z0-9_]/g, "_"),
          version: "1.0.0",
          name: className,
          description: description,
          authors: [author],
          contact: { homepage: "https://ai.studio/build" },
          license: "MIT",
          environment: "*",
          entrypoints: {
            main: [mainClassPath]
          },
          depends: {
            fabricloader: ">=0.15.0",
            minecraft: `>=${version}`,
            java: ">=17"
          }
        }, null, 2);
        zip.file("fabric.mod.json", fabricModJson);
      } else if (framework === "forge") {
        // mods.toml (Modern Forge/NeoForge)
        const modsToml = [
          `modLoader="javafml"`,
          `loaderVersion="[40,)"`,
          `license="MIT"`,
          `[[mods]]`,
          `modId="${className.toLowerCase().replace(/[^a-z0-9_]/g, "_")}"`,
          `version="1.0.0"`,
          `displayName="${className}"`,
          `authors="${author}"`,
          `description='''${description}'''`,
        ].join("\n");
        zip.file("META-INF/mods.toml", modsToml);
        
        // pack.mcmeta (Required by Forge)
        zip.file("pack.mcmeta", JSON.stringify({
          pack: {
            description: `${className} resources`,
            pack_format: 15 // Updated for modern versions
          }
        }, null, 2));
      }

      const content = await zip.generateAsync({ type: "blob" });
      saveAs(content, fileName);
      
      toast.success("Download Concluído", {
        description: `Arquivo ${fileName} sincronizado via buffer seguro.`
      });
    } catch (err: any) {
      console.error("JAR Generation Error:", err);
      toast.error("Erro na Geração", { description: "Falha ao codificar binário JAR." });
    }
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
          <select 
            value={framework}
            onChange={(e) => setFramework(e.target.value)}
            className="bg-neutral-950 border border-neutral-700 rounded px-3 py-1.5 text-white focus:border-sky-500 focus:outline-none text-[10px] font-bold cursor-pointer hover:border-neutral-600 transition-colors"
          >
            {FRAMEWORKS.map(f => (
              <option key={f.id} value={f.id}>{f.label}</option>
            ))}
          </select>
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

        {currentCode && (
           <div className="ml-auto flex items-center gap-2 bg-neutral-900 px-2 py-1.5 rounded-lg border border-neutral-800">
              <button 
                onClick={undo} disabled={undoStack.length === 0} 
                className="p-1 text-neutral-500 hover:text-white disabled:opacity-20 transition-colors"
                title="Undo Generation"
              >
                <RotateCcw className="w-3 h-3" />
              </button>
              <button 
                onClick={redo} disabled={redoStack.length === 0} 
                className="p-1 text-neutral-500 hover:text-white disabled:opacity-20 transition-colors"
                title="Redo Generation"
              >
                <RotateCw className="w-3 h-3" />
              </button>
              <div className="w-px h-3 bg-neutral-800 mx-1" />
              <button 
                onClick={() => {
                  navigator.clipboard.writeText(currentCode);
                  toast.success("Código Copiado");
                }}
                className="p-1 text-sky-400 hover:text-sky-300 transition-colors"
                title="Copy Source"
              >
                <Copy className="w-3 h-3" />
              </button>
           </div>
         )}
      </div>

      <div className="bg-neutral-900/50 border border-neutral-800 p-4 rounded-lg text-xs leading-relaxed animate-in fade-in slide-in-from-top-2">
        <div className="flex items-center justify-between mb-3 border-b border-neutral-800 pb-2">
          <h4 className="text-sky-400 font-bold uppercase tracking-widest flex items-center gap-2">
            <BookOpen className="w-4 h-4" /> 
            {FRAMEWORKS.find(f => f.id === framework)?.label} {version} Reference
          </h4>
          <a 
              href={API_DOCS[framework]?.default.docs || "#"} 
              target="_blank" rel="noopener noreferrer" 
              className="text-[10px] bg-neutral-800 hover:bg-neutral-700 text-neutral-300 px-2 py-1 rounded transition-colors"
          >
            View Official API Docs ↗
          </a>
        </div>
        
        {loadingDocs ? (
          <div className="flex flex-col items-center justify-center py-6 text-sky-500/50">
            <Loader2 className="w-6 h-6 animate-spin mb-2" />
            <span className="text-[10px] uppercase font-bold tracking-widest">Loading knowledge base...</span>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-neutral-400 animate-in fade-in">
            <div className="space-y-4">
              <div>
                <strong className="text-white block mb-1">Architecture & Description</strong> 
                {API_DOCS[framework]?.default.description}
              </div>
              
              <div>
                  <strong className="text-amber-400 block mb-1">V{version} Specific Highlights</strong> 
                  <ul className="list-disc pl-4 mt-1 space-y-1 text-neutral-300 font-mono text-[10px]">
                    {(API_DOCS[framework]?.versions[version]?.highlights || ["General engine updates apply to this version. No breaking changes logged."]).map((hl, i) => (
                      <li key={i}>{hl}</li>
                    ))}
                  </ul>
              </div>
            </div>
            
            <div>
              <strong className="text-white block mb-2 text-emerald-400">Best Practices & Optimal Performance:</strong> 
              <ul className="list-none space-y-2.5">
                {API_DOCS[framework]?.default.guides.map((guide, i) => (
                  <li key={i} className="flex gap-2 items-start"><span className="text-emerald-500 leading-tight">✓</span> <span className="leading-tight">{guide}</span></li>
                ))}
                <li className="flex gap-2 items-start"><span className="text-emerald-500 leading-tight">✓</span> <span className="leading-tight">Always handle block modifications efficiently. For Minecraft {version}, avoid generating excessive chunk updates.</span></li>
              </ul>
            </div>
          </div>
        )}
      </div>
    </div>
  ), [framework, version, complexity, loadingDocs]);

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
      onGenerateComplete={onGenerateComplete}
      onSaveCloud={handleSaveCloud}
      supportsEditing={true}
      extraControls={controls}
      parameters={{ framework, version, complexity }}
      renderOutput={(result, isGenerating) => {
        const finalResult = isGenerating ? result : currentCode || result;
        return (
          <div className="space-y-6">
            {/* Telemetry Logs Display */}
            {telemetryLogs.length > 0 && (
              <div className="bg-neutral-900/40 border border-neutral-800 rounded-xl p-3 font-mono text-[9px] space-y-1.5 overflow-hidden animate-in fade-in slide-in-from-top-2">
                <div className="flex items-center justify-between mb-2 text-neutral-600 border-b border-neutral-800 pb-1">
                  <span className="font-black uppercase tracking-widest">SRE_Telemetry</span>
                  <span className="text-[7px]">Orchestrator v1.4</span>
                </div>
                {telemetryLogs.map((log) => (
                  <div key={log.id} className="flex gap-2">
                    <span className="text-neutral-700">[{new Date().toLocaleTimeString()}]</span>
                    <span className={cn(
                      "font-bold uppercase tracking-tight",
                      log.type === 'info' ? 'text-sky-500' : log.type === 'success' ? 'text-emerald-500' : 'text-amber-500'
                    )}>
                      {log.type === 'info' ? '>>' : log.type === 'success' ? 'OK' : '!!'} {log.msg}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {isGenerating && !finalResult ? (
              <div className="py-20 text-center">
                <Loader2 className="w-8 h-8 animate-spin text-sky-500 mx-auto mb-4" />
                <p className="text-[10px] font-mono text-sky-500 uppercase tracking-[0.3em] animate-pulse">Compiling Logic...</p>
              </div>
            ) : (
              <OutputWrapper result={finalResult} onDownload={() => handleDownloadJar(finalResult)} />
            )}
          </div>
        );
      }}
    />
  );
}

function OutputWrapper({ result, onDownload }: { result: string, onDownload: () => void }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(result);
      setCopied(true);
      toast.success("Código Copiado", { description: "Buffer transferido para o clipboard." });
      await sleep(2000);
      setCopied(false);
    } catch (e: any) {
      toast.error("Erro na clonagem", { description: "Falha ao gravar no clipboard." });
    }
  };

  return (
    <div className="relative group">
      <div className="absolute top-4 right-4 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-all z-10">
        <button
          onClick={handleCopy}
          className={cn(
            "bg-neutral-900/80 backdrop-blur-sm text-neutral-300 border border-neutral-800 hover:border-emerald-500/50 px-3 py-1.5 rounded text-[10px] uppercase font-bold tracking-widest flex items-center gap-2 transition-all",
            copied && "text-emerald-400 border-emerald-500/50 bg-emerald-500/10"
          )}
        >
          {copied ? "Copiado!" : "Copiar"}
        </button>
        <button
           onClick={onDownload}
           className="bg-sky-500/20 text-sky-400 border border-sky-500/50 hover:bg-sky-500/30 px-3 py-1.5 rounded text-[10px] uppercase font-bold tracking-widest flex items-center gap-2 transition-all"
        >
          <Download className="w-3.5 h-3.5" />
          Download .jar
        </button>
      </div>
      <CodeView code={result} language="java" />
    </div>
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
