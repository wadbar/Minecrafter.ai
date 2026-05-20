import React, { useCallback, useState, useMemo, useRef } from "react";
import GeneratorLayout from "./GeneratorLayout";
import { OfflineEngine } from "../services/OfflineEngine";
import { Loader2, Zap, Layers, Globe, Database, Map as MapIcon, Link, Server, Shield, Send, RotateCcw, RotateCw, Download, Cloud, History, Trash2 } from "lucide-react";
import { saveArtifact } from "../lib/db";
import { cn } from "../lib/utils";
import { toast } from "sonner";
import { usePersistentHistory } from "../hooks/usePersistentHistory";

class LRUCache<K, V> {
  private max: number;
  private ttl: number;
  private cache: Map<K, { value: V; timestamp: number }>;

  constructor(max = 5, ttl = 3600000) {
    this.max = max;
    this.ttl = ttl;
    this.cache = new Map();
  }

  private isExpired(timestamp: number): boolean {
    return Date.now() - timestamp > this.ttl;
  }

  get(key: K): V | undefined {
    const entry = this.cache.get(key);
    if (!entry) return undefined;

    if (this.isExpired(entry.timestamp)) {
      this.cache.delete(key);
      return undefined;
    }

    // Refresh entry position (move to end for LRU)
    this.cache.delete(key);
    this.cache.set(key, entry);
    return entry.value;
  }

  set(key: K, val: V) {
    // Proactive selective cleanup
    if (this.cache.has(key)) {
      this.cache.delete(key);
    } else if (this.cache.size >= this.max) {
      // Check for any expired entries first to avoid evicting useful data
      let deleted = false;
      for (const [k, entry] of this.cache.entries()) {
        if (this.isExpired(entry.timestamp)) {
          this.cache.delete(k);
          deleted = true;
          break; // Stop after first cleanup to keep it fast
        }
      }

      // If no expired found, evict oldest (first in Map)
      if (!deleted) {
        const oldestEntry = this.cache.keys().next().value;
        if (oldestEntry !== undefined) this.cache.delete(oldestEntry);
      }
    }
    
    this.cache.set(key, { value: val, timestamp: Date.now() });
  }

  clear() {
    this.cache.clear();
  }
  
  get size() {
    // Only return non-expired count
    let count = 0;
    const now = Date.now();
    for (const entry of this.cache.values()) {
      if (now - entry.timestamp <= this.ttl) {
        count++;
      }
    }
    return count;
  }
}

const ENGINES = [
  { id: "worldedit", label: "WorldEdit //set", icon: "📐" },
  { id: "datapack", label: "Datapack (mcfunction)", icon: "📦" },
  { id: "vanilla", label: "Vanilla Commands", icon: "🕹️" }
];

const VERSIONS = ["1.21+", "1.20.x", "1.19.x", "1.18.x"];

const TERRAIN_PRESETS = [
  { 
    id: "flat", 
    label: "Flat World", 
    prompt: "Gere uma estrutura de mundo plano com camadas específicas de grama, terra e rocha, incluindo vilas e fortalezas raras.",
    description: "Mundo perfeitamente plano com camadas customizadas.",
    params: { complexity: 20, density: 10, verticality: 0 }
  },
  { 
    id: "archipelago", 
    label: "Island Archipelago", 
    prompt: "Crie um arquipélago tropical com biomas variados em ilhas separadas, recifes de coral e estruturas de pirâmides oceânicas.",
    description: "Grupo de ilhas tropicais com biomas oceânicos.",
    params: { complexity: 65, density: 40, verticality: 30 }
  },
  { 
    id: "mountains", 
    label: "Mountainous Region", 
    prompt: "Gere uma região de montanhas colossais com picos nevados, cavernas profundas e vilarejos encravados nos desfiladeiros.",
    description: "Relevo extremo com picos elevados e vales profundos.",
    params: { complexity: 80, density: 70, verticality: 95 }
  },
  { 
    id: "canyons", 
    label: "Canyon Lands", 
    prompt: "Crie um bioma de cânions profundos com estética badlands, depósitos de minério visíveis nas paredes e rios subterrâneos.",
    description: "Cânions áridos com estratigrafia detalhada.",
    params: { complexity: 75, density: 85, verticality: 60 }
  },
  { 
    id: "floating", 
    label: "Floating Islands", 
    prompt: "Gere um mapa de ilhas flutuantes com pontes conectando-as, biomas flutuantes únicos e segredos escondidos no vazio entre elas.",
    description: "Mundo de ilhas suspensas no vazio.",
    params: { complexity: 90, density: 30, verticality: 100 }
  }
];

export default function MapGenerator() {
  const { history, addHistory, removeHistory } = usePersistentHistory('map', 15);
  const [activeTab, setActiveTab] = useState<"manifest" | "history">("manifest");
  const [engine, setEngine] = useState("worldedit");
  const [version, setVersion] = useState("1.21+");
  const [activePreset, setActivePreset] = useState("");
  const [complexity, setComplexity] = useState(50);
  const [density, setDensity] = useState(50);
  const [verticality, setVerticality] = useState(50);
  const [cacheStats, setCacheStats] = useState({ hits: 0, status: "Idle", size: 0, history: [] as boolean[] });
  const [isProcessing, setIsProcessing] = useState(false);
  const [showDeployment, setShowDeployment] = useState(false);
  const [deployLoading, setDeployLoading] = useState(false);
  const [currentResult, setCurrentResult] = useState("");

  const [deployConfig, setDeployConfig] = useState(() => {
    const saved = localStorage.getItem("mc_global_config");
    return saved ? JSON.parse(saved) : {
      host: "localhost",
      port: 25565,
      username: "Player_Agent",
      auth: "offline" as "offline" | "mojang" | "microsoft"
    };
  });

  // Listen for config updates from Integrations
  React.useEffect(() => {
    const syncConfig = () => {
      const saved = localStorage.getItem("mc_global_config");
      if (saved) setDeployConfig(JSON.parse(saved));
    };
    window.addEventListener("mc_config_updated", syncConfig);
    return () => window.removeEventListener("mc_config_updated", syncConfig);
  }, []);

  // Persistence - State Recovery Logic
  React.useEffect(() => {
    const saved = localStorage.getItem('mc-map-prefs');
    if (saved) {
      try {
        const prefs = JSON.parse(saved);
        if (prefs.engine) setEngine(prefs.engine);
        if (prefs.version) setVersion(prefs.version);
        if (prefs.complexity !== undefined) setComplexity(prefs.complexity);
        if (prefs.density !== undefined) setDensity(prefs.density);
        if (prefs.verticality !== undefined) setVerticality(prefs.verticality);
      } catch (e) {
        console.error("State recovery failed:", e);
      }
    }
    
    // Cleanup reference: ensure no dangling background tasks on unmount
    return () => {
      // Logic for canceling pending generation could be added here if needed
    };
  }, []);

  React.useEffect(() => {
    localStorage.setItem('mc-map-prefs', JSON.stringify({
      engine, version, complexity, density, verticality
    }));
  }, [engine, version, complexity, density, verticality]);

  const chunkCache = useRef(new LRUCache<string, string>(5));
  const lastPromptRef = useRef<string>("");

  const handleClearCache = () => {
    chunkCache.current.clear();
    setCacheStats(prev => ({ ...prev, hits: 0, size: 0, history: [], status: "Purge Complete" }));
    toast.success("Cache Purged", { description: "Local cache has been cleared." });
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      toast.success("Copiado para a Área de Transferência", { description: "Comandos prontos para injeção no Minecraft." });
    });
  };

  const handleSaveCloud = useCallback(async (title: string, result: string) => {
    await saveArtifact("map", title, result);
  }, []);

  const selectPreset = (id: string) => {
    const preset = TERRAIN_PRESETS.find(p => p.id === id);
    if (preset) {
      setActivePreset(id);
      if (preset.params) {
        setComplexity(preset.params.complexity);
        setDensity(preset.params.density);
        setVerticality(preset.params.verticality);
      }
      window.dispatchEvent(new CustomEvent('set-builder-prompt', { detail: preset.prompt }));
      toast.success(`Preset Ativado: ${preset.label}`, { 
        description: "Parâmetros de geração ajustados automaticamente.",
        icon: <Zap className="w-4 h-4 text-amber-500" />
      });
    }
  };

  // Global state sync for prompt persistence
  React.useEffect(() => {
    const handleSetPrompt = (e: any) => {
      // Logic for syncing or reacting to prompt changes if needed
    };
    window.addEventListener('set-builder-prompt', handleSetPrompt);
    return () => window.removeEventListener('set-builder-prompt', handleSetPrompt);
  }, []);

  const generateMap = useCallback(async (prompt: string, existingData?: string, targetLanguage?: string) => {
     if (isProcessing) {
       toast.warning("Neural Link Busy", { description: "Please wait for the current stream to stabilize." });
       return "";
     }

     const isEditMode = !!existingData;
     const endpoint = isEditMode ? "/api/edit-map" : "/api/generate-map";
     
     const contextPrompt = `[ENGINE: ${engine.toUpperCase()}] [VERSION: ${version}] [COMPLEXITY: ${complexity}%] [DENSITY: ${density}%] [VERTICALITY: ${verticality}%] ${prompt}`;
     
     const cacheKey = `map_chunk_${engine}_${version}_${complexity}_${density}_${verticality}_${prompt.trim()}`;

     const trimmedPrompt = prompt.trim();
     if (!isEditMode && lastPromptRef.current && lastPromptRef.current !== trimmedPrompt) {
        chunkCache.current.clear();
        setCacheStats(prev => ({ 
          ...prev, 
          status: "System Purged (New Intent Detected)", 
          size: 0 
        }));
     }
     if (!isEditMode) {
       lastPromptRef.current = trimmedPrompt;
     }

     const cachedResult = chunkCache.current.get(cacheKey);
     if (!isEditMode && cachedResult) {
        setCacheStats(prev => ({ 
          ...prev, 
          hits: prev.hits + 1, 
          status: "Loaded from LRU Cache", 
          size: chunkCache.current.size,
          history: [...prev.history, true].slice(-20)
        }));
        setCurrentResult(cachedResult);
        return cachedResult;
     }

     try {
       setIsProcessing(true);
       setCacheStats(prev => ({ ...prev, status: "Generating New Chunks..." }));

       const body = isEditMode 
         ? { prompt: contextPrompt, existingData, targetLanguage }
         : { prompt: contextPrompt };

       let res;
       try {
         res = await fetch(endpoint, {
           method: "POST",
           headers: { "Content-Type": "application/json" },
           body: JSON.stringify(body),
         });

         if (!res.ok) {
           let errorMessage = `Nexus Error: ${res.status}`;
           try {
             const errorData = await res.json();
             if (errorData.error) errorMessage = errorData.error;
           } catch {
             if (res.status === 400) errorMessage = "Prompt rejection: The matrix cannot process this request structure.";
             if (res.status === 429) errorMessage = "Neural link saturated: Too many requests. Wait for cooldown.";
             if (res.status >= 500) errorMessage = "Core system failure: Server-side architecture is unstable.";
           }
           throw new Error(errorMessage);
         }
       } catch (fetchErr: any) {
         toast.info("Processamento Local Ativado", { description: "Gerando estrutura procedural baseada em templates offline." });
         const result = OfflineEngine.generateMap(prompt, activePreset, { complexity, density, verticality });
         if (!isEditMode) {
           chunkCache.current.set(cacheKey, result);
           setCacheStats(prev => ({ 
             ...prev, 
             status: "Offline Result Optimized", 
             size: chunkCache.current.size,
             history: [...prev.history, false].slice(-20)
           }));
         }
         setIsProcessing(false);
         addHistory(prompt, result, { engine, version, complexity, density, verticality, activePreset });
         setCurrentResult(result);
         return result;
       }

       const data = await res.json();
       if (data.error) throw new Error(data.error);

       if (!isEditMode) {
         chunkCache.current.set(cacheKey, data.result);
         setCacheStats(prev => ({ 
           ...prev, 
           status: "Chunks Cached Successfully", 
           size: chunkCache.current.size,
           history: [...prev.history, false].slice(-20)
         }));
       }

       setIsProcessing(false);
       addHistory(prompt, data.result, { engine, version, complexity, density, verticality, activePreset });
       setCurrentResult(data.result);
       return data.result;
     } catch (error: any) {
       setIsProcessing(false);
       setCacheStats(prev => ({ 
         ...prev, 
         status: "Signal Lost (Error)",
         history: [...prev.history, false].slice(-20)
       }));
       throw error;
     }
  }, [engine, version, isProcessing, activePreset, complexity, density, verticality, addHistory]);

  const handleDeploy = async () => {
    if (!currentResult) {
      toast.error("Result Empty", { description: "Generate a map architecture before attempting deployment." });
      return;
    }

    setDeployLoading(true);
    try {
      // Parse commands (lines starting with / or common command patterns)
      const commands = currentResult.split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0 && (line.startsWith('/') || line.match(/^[a-z]+ /i)));

      if (commands.length === 0) {
        throw new Error("No executable commands detected in the current manifest.");
      }

      const res = await fetch("/api/deploy-to-minecraft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...deployConfig,
          commands
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || data.logs?.[data.logs.length - 1] || "Deployment link failure.");
      }

      toast.success("Integration Active", { 
        description: `Successfully injected ${commands.length} instructions into the world.`,
        duration: 5000 
      });
      setShowDeployment(false);
    } catch (e: any) {
      toast.error("Integration Rejected", { description: e.message });
    } finally {
      setDeployLoading(false);
    }
  };

  const extraControls = useMemo(() => (
    <div className="flex flex-col w-full gap-3 text-m3-on-surface-variant font-mono text-[11px]">
      <div className="flex flex-wrap items-center gap-4">
         <div className="flex items-center gap-2 bg-m3-surface-container-low px-4 py-2 rounded-full border border-m3-outline-variant shadow-m3-1 text-[10px]">
           <Zap className="w-3.5 h-3.5 text-m3-secondary" />
           <span className="font-black uppercase tracking-widest opacity-50 text-m3-on-surface-variant">Motor</span>
           <div className="flex gap-1 ml-1.5">
              {ENGINES.map(eg => (
                <button 
                  key={eg.id}
                  onClick={() => setEngine(eg.id)}
                  className={cn(
                    "px-2.5 py-0.5 rounded-full transition-all font-bold",
                    engine === eg.id ? "bg-m3-primary text-m3-on-primary shadow-m3-1" : "hover:bg-m3-surface-variant"
                  )}
                >
                  {eg.label.split(" ")[0]}
                </button>
              ))}
           </div>
         </div>

         <div className="flex items-center gap-2 bg-m3-surface-container-low px-4 py-2 rounded-full border border-m3-outline-variant shadow-m3-1 text-[10px]">
           <MapIcon className="w-3.5 h-3.5 text-m3-primary" />
           <span className="font-black uppercase tracking-widest opacity-50 text-m3-on-surface-variant">Cenário</span>
           <select 
             value={activePreset}
             onChange={(e) => selectPreset(e.target.value)}
             className="bg-transparent outline-none text-m3-primary font-black ml-1.5 cursor-pointer appearance-none"
           >
             <option value="" disabled className="bg-m3-surface-container">Selecionar...</option>
             {TERRAIN_PRESETS.map(p => (
               <option key={p.id} value={p.id} className="bg-m3-surface-container">{p.label}</option>
             ))}
           </select>
         </div>

         <div className="flex items-center gap-2 bg-m3-surface-container-low px-4 py-2 rounded-full border border-m3-outline-variant shadow-m3-1 text-[10px]">
           <Globe className="w-3.5 h-3.5 text-m3-secondary" />
           <span className="font-black uppercase tracking-widest opacity-50 text-m3-on-surface-variant">Versão</span>
           <select 
             value={version}
             onChange={(e) => setVersion(e.target.value)}
             className="bg-transparent outline-none text-m3-secondary font-black ml-1.5 cursor-pointer appearance-none"
           >
             {VERSIONS.map(v => <option key={v} value={v} className="bg-m3-surface-container">{v}</option>)}
           </select>
         </div>

         {currentResult && (
           <div className="ml-auto flex items-center gap-2 bg-m3-surface-container-high px-2 py-1.5 rounded-full border border-m3-outline-variant shadow-m3-1">
              <button 
                onClick={() => copyToClipboard(currentResult)}
                className="p-1.5 text-m3-primary hover:bg-m3-primary/10 rounded-full transition-all"
                title="Copiar Comandos"
              >
                <Send className="w-4 h-4" />
              </button>
           </div>
         )}
      </div>

      {/* Advanced Generation Controls */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-3 bg-m3-surface-container-highest/30 p-5 rounded-3xl border border-m3-outline-variant/50">
          {[
            { label: "Complexidade Estrutural", val: complexity, set: setComplexity, color: "text-m3-primary" },
            { label: "Densidade Atmosférica", val: density, set: setDensity, color: "text-m3-secondary" },
            { label: "Viés Vertical", val: verticality, set: setVerticality, color: "text-m3-primary" }
          ].map((slider, idx) => (
            <div key={idx} className={cn("flex flex-col gap-2", idx === 1 && "md:border-x border-m3-outline-variant/30 md:px-6")}>
              <div className="flex justify-between items-center px-1">
                <span className="uppercase font-black tracking-widest text-m3-on-surface-variant opacity-60 text-[9px]">{slider.label}</span>
                <span className={cn("text-[10px] font-black", slider.color)}>{slider.val}%</span>
              </div>
              <input 
                type="range" min="0" max="100" value={slider.val} 
                onChange={(e) => slider.set(parseInt(e.target.value))}
                className="w-full h-1.5 bg-m3-surface-container rounded-full appearance-none cursor-pointer accent-m3-primary"
              />
            </div>
          ))}
      </div>
      
      {/* Visualizador de Cache do Terreno */}
      <div className="flex items-center justify-between bg-m3-surface-container/40 p-4 rounded-3xl border border-m3-outline-variant/60 mt-3 shadow-inner">
        <div className="flex items-center gap-3">
          <Database className={cn("w-4 h-4 transition-colors", cacheStats.hits > 0 ? "text-m3-primary" : "text-m3-on-surface-variant/40")} />
          <span className="uppercase tracking-[0.15em] font-black text-m3-on-surface-variant text-[9px] opacity-70">Sistema LRU Cache</span>
          
          {/* Hit History Sparkline */}
          <div className="flex items-center gap-1 ml-4 h-4">
             {cacheStats.history.map((hit, i) => (
               <div 
                 key={i} 
                 className={cn(
                   "w-1.5 h-full rounded-full transition-all duration-700",
                   hit ? "bg-m3-primary shadow-m3-1" : "bg-m3-on-surface-variant/10"
                 )} 
                 style={{ height: hit ? '100%' : '40%' }}
               />
             ))}
             {cacheStats.history.length === 0 && (
               <div className="text-[9px] text-m3-on-surface-variant/40 italic">Aguardando operações...</div>
             )}
          </div>
        </div>
        <div className="flex items-center gap-6">
           <div className="flex flex-col items-end">
              <span className="text-[8px] uppercase font-black opacity-40">Status_Link</span>
              <span className={cn("font-black text-[10px]", cacheStats.status.includes("Loaded") ? "text-m3-primary" : cacheStats.status.includes("Invalidate") || cacheStats.status.includes("Purge") ? "text-m3-error" : "text-m3-secondary")}>{cacheStats.status}</span>
           </div>
           <div className="w-px h-6 bg-m3-outline-variant" />
           <div className="flex flex-col items-center">
              <span className="text-[8px] uppercase font-black opacity-40">Setores</span>
              <span className="text-m3-on-surface font-black text-[10px]">{cacheStats.size}/5</span>
           </div>
           <div className="flex flex-col items-center">
              <span className="text-[8px] uppercase font-black opacity-40">Hits</span>
              <span className="text-m3-primary font-black text-[10px]">{cacheStats.hits}</span>
           </div>
           <button 
             onClick={handleClearCache}
             className="ml-2 px-4 py-1.5 bg-m3-error-container text-m3-on-error-container text-[9px] font-black border border-m3-error/20 rounded-full uppercase transition-all hover:bg-m3-error/10 hover:border-m3-error/40 active:scale-95"
           >
             Purgar Cache
           </button>
        </div>
      </div>
    </div>
  ), [engine, version, cacheStats, complexity, density, verticality, activePreset]);

  const renderOutput = useCallback((result: string, isGenerating: boolean) => {
    if (isGenerating) {
      return (
        <div className="flex flex-col items-center justify-center mt-20 space-y-8 animate-in fade-in duration-700">
          <div className="relative">
            <Loader2 className="w-12 h-12 animate-spin text-m3-primary" />
            <div className="absolute inset-0 blur-xl bg-m3-primary/20 animate-pulse" />
          </div>
          <p className="text-[11px] font-black text-m3-primary animate-pulse uppercase tracking-[0.4em]">{cacheStats.status}</p>
        </div>
      );
    }
    return (
      <div className="p-8 lg:p-10 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-1000">
          <div className="flex flex-col gap-3">
            <div className="flex gap-2">
              <button 
                onClick={() => setActiveTab("manifest")}
                className={cn(
                  "px-6 py-2 rounded-full text-[10px] font-black uppercase tracking-[0.2em] transition-all",
                  activeTab === "manifest" ? "bg-m3-primary text-m3-on-primary shadow-m3-1" : "bg-m3-surface-container text-m3-on-surface-variant hover:bg-m3-surface-variant"
                )}
              >
                Manifesto Estrutural
              </button>
              <button 
                onClick={() => setActiveTab("history")}
                className={cn(
                  "px-6 py-2 rounded-full text-[10px] font-black uppercase tracking-[0.2em] transition-all flex items-center gap-2",
                  activeTab === "history" ? "bg-m3-primary text-m3-on-primary shadow-m3-1" : "bg-m3-surface-container text-m3-on-surface-variant hover:bg-m3-surface-variant"
                )}
              >
                <History className="w-3 h-3" /> Histórico ({history.length})
              </button>
            </div>

            {activeTab === "history" && (
              <div className="grid gap-4 animate-in fade-in slide-in-from-top-4">
                 {history.map((item) => (
                   <div 
                    key={item.id} 
                    className="flex items-center justify-between p-4 bg-m3-surface-container border border-m3-outline-variant rounded-[2rem] hover:border-m3-primary/30 transition-all cursor-pointer group"
                    onClick={() => {
                      setCurrentResult(item.result);
                      if (item.parameters) {
                        const params = item.parameters as any;
                        setEngine(params.engine);
                        setVersion(params.version);
                        setComplexity(params.complexity);
                        setDensity(params.density);
                        setVerticality(params.verticality);
                      }
                      window.dispatchEvent(new CustomEvent('set-builder-prompt', { detail: item.prompt }));
                      setActiveTab("manifest");
                    }}
                   >
                     <div className="flex flex-col gap-1 pl-4">
                        <span className="text-[9px] font-black uppercase text-m3-primary tracking-widest">{(item.parameters as any)?.engine} {(item.parameters as any)?.version}</span>
                        <p className="text-xs text-m3-on-surface truncate max-w-xl font-mono">"{item.prompt}"</p>
                        <span className="text-[8px] text-m3-on-surface-variant/40 font-mono italic">{new Date(item.timestamp).toLocaleString()}</span>
                     </div>
                     <button 
                        onClick={(e) => { e.stopPropagation(); removeHistory(item.id); }}
                        className="p-3 text-m3-error opacity-0 group-hover:opacity-100 transition-all hover:bg-m3-error-container rounded-full"
                     >
                        <Trash2 className="w-4 h-4" />
                     </button>
                   </div>
                 ))}
                 {history.length === 0 && (
                   <div className="py-20 text-center opacity-30 uppercase font-black tracking-widest text-xs">Sem registros históricos.</div>
                 )}
              </div>
            )}

            {activeTab === "manifest" && (
              <>
                <div className="flex items-center justify-between mb-2">
                   <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-m3-surface-container rounded-2xl flex items-center justify-center border border-m3-outline-variant shadow-m3-1">
                        <Layers className="w-5 h-5 text-m3-primary" />
                      </div>
                      <div>
                        <h4 className="text-[10px] font-black text-m3-on-surface-variant uppercase tracking-[0.2em] opacity-50">Manifesto Estrutural</h4>
                        <div className="flex items-center gap-2">
                           <div className="w-1.5 h-1.5 rounded-full bg-m3-primary animate-pulse" />
                           <span className="text-[11px] font-bold text-m3-on-surface">Pronto para Injeção</span>
                        </div>
                      </div>
                   </div>
                   
                   <div className="flex items-center gap-3">
                     <button 
                       onClick={() => copyToClipboard(result)}
                       className="h-10 px-6 bg-m3-surface-container-high hover:bg-m3-surface-variant text-m3-primary text-[10px] font-black rounded-full transition-all flex items-center gap-2 shadow-m3-1 border border-m3-outline-variant"
                     >
                       Copiar Manifesto
                     </button>
                     <button 
                       onClick={() => setShowDeployment(!showDeployment)}
                       className={cn(
                         "h-10 px-6 text-[10px] font-black rounded-full transition-all flex items-center gap-2 shadow-m3-2 border",
                         showDeployment ? "bg-m3-primary text-m3-on-primary border-m3-primary" : "bg-m3-surface-container-highest text-m3-primary border-m3-outline-variant hover:bg-m3-primary/10"
                       )}
                     >
                       <Link className="w-4 h-4" />
                       Sincronização Direta
                     </button>
                   </div>
                </div>

                <div className="relative group/code">
                  <div className="absolute -top-3 left-6 z-10">
                     <div className="bg-m3-surface-container-highest text-m3-on-surface-variant border border-m3-outline-variant px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest shadow-m3-1">
                        Output_Buffer
                     </div>
                  </div>
                  <pre className="bg-m3-surface-container-low text-m3-primary p-8 pt-10 rounded-[2rem] overflow-x-auto font-mono text-xs leading-relaxed border border-m3-outline-variant shadow-inner relative transition-colors group-hover/code:bg-m3-surface-container-lowest">
                    <div className="absolute top-4 right-6 opacity-20 transition-opacity uppercase text-[9px] font-black pointer-events-none tracking-widest">Procedural_Generation_Manifest</div>
                    {result}
                  </pre>
                </div>
              </>
            )}
          </div>
      </div>
    );
  }, [cacheStats]);

  return (
    <GeneratorLayout
      title="Arquitetura de Terrenos & Estruturas"
      description="Gere ou otimize Datapacks, Comandos e estruturas complexas com traduções."
      placeholder="Ex: Crie uma arena... ou Reduza o lag deste loop de comandos e traduza..."
      promptTemplates={[
        ...TERRAIN_PRESETS.map(p => ({ label: `🗺️ ${p.label}`, prompt: p.prompt, description: p.description })),
        { label: "🏟️ Arena PvP com Kits", prompt: "Crie um script de Command Blocks que gera uma arena PvP de pedra infinita e equipa full iron em quem entrar.", description: "Estrutura e lógica Vanilla para Arena PvP básica." },
        { label: "🩸 Sistema de Sangramento", prompt: "Faça um Datapack que aplica efeito de Wither quando um player recebe dano de flecha.", description: "Lógica avançada usando Datapacks e NBT data." },
        { label: "🌳 Gerador de Árvore Gigante", prompt: "Escreva comandos estruturais que criam uma árvore colossal em coordenadas estáticas com baús de tesouro no topo.", description: "Estrutura massiva gerada proceduralmente via blocos de comando." },
        { label: "✨ Chão Mágico", prompt: "Um sistema command-block que transforma grama em vidro colorido por baixo dos pés de quem tem a tag 'vip'.", description: "Lógica de movimentação em tempo real (Execute at)." }
      ]}
      endpointType="generate-map"
      onGenerate={generateMap}
      onSaveCloud={handleSaveCloud}
      supportsEditing={true}
      extraControls={extraControls}
      parameters={{ engine, version, complexity, density, verticality, activePreset }}
      renderOutput={renderOutput}
    />
  );
}
