import React, { useCallback, useState, useMemo, useRef } from "react";
import GeneratorLayout from "./GeneratorLayout";
import { OfflineEngine } from "../services/OfflineEngine";
import { Loader2, Zap, Layers, Globe, Database, Map as MapIcon, Link, Server, Shield, Send, RotateCcw, RotateCw, Download, Cloud } from "lucide-react";
import { saveArtifact } from "../lib/db";
import { cn } from "../lib/utils";
import { toast } from "sonner";

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
  
  const [undoStack, setUndoStack] = useState<string[]>([]);
  const [redoStack, setRedoStack] = useState<string[]>([]);
  const [currentResult, setCurrentResult] = useState("");

  const onGenerateComplete = useCallback((result: string) => {
    if (currentResult) {
      setUndoStack(prev => [currentResult, ...prev].slice(0, 20));
    }
    setRedoStack([]);
    setCurrentResult(result);
  }, [currentResult]);

  const undo = useCallback(() => {
    if (undoStack.length === 0) return;
    const prev = undoStack[0];
    setRedoStack(r => [currentResult, ...r]);
    setCurrentResult(prev);
    setUndoStack(u => u.slice(1));
  }, [currentResult, undoStack]);

  const redo = useCallback(() => {
    if (redoStack.length === 0) return;
    const next = redoStack[0];
    setUndoStack(u => [currentResult, ...u]);
    setCurrentResult(next);
    setRedoStack(r => r.slice(1));
  }, [currentResult, redoStack]);

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

       if (!navigator.onLine) {
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
          setCurrentResult(result);
          return result;
       }

       const body = isEditMode 
         ? { prompt: contextPrompt, existingData, targetLanguage }
         : { prompt: contextPrompt };

       const res = await fetch(endpoint, {
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
  }, [engine, version, isProcessing, activePreset, complexity, density, verticality]);

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
    <div className="flex flex-col w-full gap-2 text-neutral-400 font-mono text-[10px]">
      <div className="flex flex-wrap items-center gap-4">
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
           <MapIcon className="w-3 h-3 text-emerald-500" />
           <span className="font-bold uppercase tracking-widest text-neutral-500">Preset</span>
           <select 
             value={activePreset}
             onChange={(e) => selectPreset(e.target.value)}
             className="bg-transparent outline-none text-emerald-400 font-bold ml-2 cursor-pointer"
           >
             <option value="" disabled className="bg-neutral-950">Select Terrain...</option>
             {TERRAIN_PRESETS.map(p => (
               <option key={p.id} value={p.id} className="bg-neutral-950">{p.label}</option>
             ))}
           </select>
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

         {currentResult && (
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
                onClick={() => copyToClipboard(currentResult)}
                className="p-1 text-emerald-500 hover:text-emerald-400 transition-colors"
                title="Copy Commands"
              >
                <Send className="w-3 h-3" />
              </button>
           </div>
         )}
      </div>

      {/* Advanced Generation Controls */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mt-2 bg-neutral-900/30 p-2 rounded-lg border border-neutral-800/50">
          <div className="flex flex-col gap-1 px-2">
            <div className="flex justify-between items-center px-1">
              <span className="uppercase font-bold tracking-tighter text-neutral-500 text-[9px]">Structural Complexity</span>
              <span className="text-emerald-500 text-[9px] font-bold">{complexity}%</span>
            </div>
            <input 
              type="range" min="0" max="100" value={complexity} 
              onChange={(e) => setComplexity(parseInt(e.target.value))}
              className="w-full h-1 bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
            />
          </div>
          <div className="flex flex-col gap-1 px-2 border-x border-neutral-800/50">
            <div className="flex justify-between items-center px-1">
              <span className="uppercase font-bold tracking-tighter text-neutral-500 text-[9px]">Atmospheric Density</span>
              <span className="text-emerald-500 text-[9px] font-bold">{density}%</span>
            </div>
            <input 
              type="range" min="0" max="100" value={density} 
              onChange={(e) => setDensity(parseInt(e.target.value))}
              className="w-full h-1 bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
            />
          </div>
          <div className="flex flex-col gap-1 px-2">
            <div className="flex justify-between items-center px-1">
              <span className="uppercase font-bold tracking-tighter text-neutral-500 text-[9px]">Vertical Bias</span>
              <span className="text-emerald-500 text-[9px] font-bold">{verticality}%</span>
            </div>
            <input 
              type="range" min="0" max="100" value={verticality} 
              onChange={(e) => setVerticality(parseInt(e.target.value))}
              className="w-full h-1 bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
            />
          </div>
      </div>
      
      {/* Visualizador de Cache do Terreno */}
      <div className="flex items-center justify-between bg-neutral-900/50 px-3 py-2 rounded-lg border border-neutral-800/80 mt-2">
        <div className="flex items-center gap-2">
          <Database className={cn("w-3.5 h-3.5 transition-colors", cacheStats.hits > 0 ? "text-emerald-500" : "text-neutral-500")} />
          <span className="uppercase tracking-widest font-bold text-neutral-500">LRU Cache System</span>
          
          {/* Hit History Sparkline */}
          <div className="flex items-center gap-0.5 ml-4 h-3">
             {cacheStats.history.map((hit, i) => (
               <div 
                 key={i} 
                 className={cn(
                   "w-1 h-full rounded-[1px] transition-all duration-500",
                   hit ? "bg-emerald-500 shadow-[0_0_5px_rgba(16,185,129,0.5)]" : "bg-red-500/30"
                 )} 
                 style={{ height: hit ? '100%' : '40%' }}
               />
             ))}
             {cacheStats.history.length === 0 && (
               <div className="text-[8px] text-neutral-700 italic">Awaiting operations...</div>
             )}
          </div>
        </div>
        <div className="flex items-center gap-4">
           <span className="text-neutral-400">Status: <span className={cn("font-bold", cacheStats.status.includes("Loaded") ? "text-emerald-400" : cacheStats.status.includes("Invalidate") || cacheStats.status.includes("Purge") ? "text-red-400" : "text-sky-400")}>{cacheStats.status}</span></span>
           <span className="text-neutral-400 border-l border-neutral-800 pl-4">Size: <span className="text-emerald-400 font-bold">{cacheStats.size}/5</span></span>
           <span className="text-neutral-400 border-l border-neutral-800 pl-4">Hits: <span className="text-emerald-400 font-bold">{cacheStats.hits}</span></span>
           <button 
             onClick={handleClearCache}
             className="ml-2 px-2 py-0.5 bg-red-500/10 hover:bg-red-500/20 text-red-500 text-[8px] font-bold border border-red-500/20 rounded uppercase transition-colors"
           >
             Purge Cache
           </button>
        </div>
      </div>
    </div>
  ), [engine, version, cacheStats, complexity, density, verticality, activePreset]);

  const renderOutput = useCallback((result: string, isGenerating: boolean) => {
    if (isGenerating) {
      return (
        <div className="flex flex-col items-center justify-center mt-20 space-y-4">
          <Loader2 className="w-10 h-10 animate-spin text-emerald-500" />
          <p className="text-[10px] font-mono font-bold text-neutral-500 animate-pulse uppercase tracking-[0.3em]">{cacheStats.status}</p>
        </div>
      );
    }
    return (
      <div className="prose prose-invert prose-emerald max-w-none p-4">
        <div className="flex items-center justify-between mb-4 border-b border-neutral-800 pb-2">
           <div className="flex items-center gap-2 text-[10px] font-mono font-bold text-neutral-600 uppercase tracking-widest">
              <Layers className="w-3 h-3" /> Structure_Manifest
           </div>
           <button 
             onClick={() => copyToClipboard(result)}
             className="px-3 py-1 bg-neutral-800 hover:bg-neutral-700 text-emerald-500 text-[10px] font-bold rounded-lg transition-all flex items-center gap-2 border border-emerald-500/20"
           >
             COPY_TO_SYSTEM
           </button>
           <button 
             onClick={() => setShowDeployment(!showDeployment)}
             className={cn(
               "px-3 py-1 text-[10px] font-bold rounded-lg transition-all flex items-center gap-2 shadow-[0_0_15px_rgba(16,185,129,0.2)] border",
               showDeployment ? "bg-emerald-500 text-neutral-950 border-emerald-400" : "bg-neutral-950 text-emerald-500 border-emerald-500/20 hover:bg-emerald-500/10"
             )}
           >
             <Link className="w-3 h-3" />
             DIRECT_IN_GAME
           </button>
        </div>
        
        {showDeployment && (
          <div className="bg-neutral-900/80 backdrop-blur-xl border border-emerald-500/30 rounded-2xl p-6 mb-4 animate-in fade-in slide-in-from-top-4 duration-500">
             <div className="flex items-center gap-3 mb-6">
                <Server className="w-5 h-5 text-emerald-500" />
                <h4 className="text-sm font-black text-white uppercase tracking-widest">Connect_Server_Bridge</h4>
             </div>
             
             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="space-y-2">
                  <label className="text-[9px] font-bold text-neutral-500 uppercase tracking-widest ml-1">Remote Host</label>
                  <input 
                    type="text" value={deployConfig.host} 
                    onChange={e => setDeployConfig({...deployConfig, host: e.target.value})}
                    className="w-full bg-black/40 border border-neutral-800 rounded-xl px-4 py-2.5 text-xs font-mono text-emerald-400 focus:outline-none focus:border-emerald-500/50"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[9px] font-bold text-neutral-500 uppercase tracking-widest ml-1">Port</label>
                  <input 
                    type="number" value={deployConfig.port} 
                    onChange={e => setDeployConfig({...deployConfig, port: parseInt(e.target.value)})}
                    className="w-full bg-black/40 border border-neutral-800 rounded-xl px-4 py-2.5 text-xs font-mono text-emerald-400 focus:outline-none focus:border-emerald-500/50"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[9px] font-bold text-neutral-500 uppercase tracking-widest ml-1">Agent Name</label>
                  <input 
                    type="text" value={deployConfig.username} 
                    onChange={e => setDeployConfig({...deployConfig, username: e.target.value})}
                    className="w-full bg-black/40 border border-neutral-800 rounded-xl px-4 py-2.5 text-xs font-mono text-emerald-400 focus:outline-none focus:border-emerald-500/50"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[9px] font-bold text-neutral-500 uppercase tracking-widest ml-1">Auth Scheme</label>
                  <select 
                    value={deployConfig.auth} 
                    onChange={e => setDeployConfig({...deployConfig, auth: e.target.value as any})}
                    className="w-full bg-black/40 border border-neutral-800 rounded-xl px-4 py-2.5 text-xs font-mono text-emerald-400 focus:outline-none focus:border-emerald-500/50 appearance-none"
                  >
                    <option value="offline">Offline/CRACKED</option>
                    <option value="mojang">Mojang Legacy</option>
                    <option value="microsoft">Microsoft/OAUTH</option>
                  </select>
                </div>
             </div>

             <div className="mt-8 flex items-center justify-between border-t border-neutral-800 pt-6">
                <div className="flex items-center gap-4">
                   <div className="flex items-center gap-2 px-3 py-1 bg-emerald-500/5 rounded-full border border-emerald-500/10">
                      <Shield className="w-3 h-3 text-emerald-500" />
                      <span className="text-[9px] font-black text-emerald-600 uppercase tracking-widest">Method: Automation Bot</span>
                   </div>
                   <p className="text-[9px] text-neutral-600 max-w-md leading-relaxed font-medium">
                     * O bot se conectará brevemente ao servidor, executará os comandos e desconectará. Certifique-se de que o bot tenha permissões de OP ou permissões para os comandos especificados.
                   </p>
                </div>
                <button 
                  onClick={handleDeploy}
                  disabled={deployLoading || !currentResult}
                  className="px-8 py-3 bg-emerald-500 text-black hover:bg-emerald-400 rounded-xl text-[10px] font-black transition-all active:scale-95 disabled:opacity-50 flex items-center gap-3 shadow-[0_0_30px_rgba(16,185,129,0.3)]"
                >
                  {deployLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  FINALIZE_DEPLOYMENT
                </button>
             </div>
          </div>
        )}
        <pre className="bg-neutral-950/50 backdrop-blur-sm text-emerald-400 p-6 rounded-xl overflow-x-auto font-mono text-xs leading-relaxed border border-neutral-800 shadow-inner group/code relative">
          <div className="absolute top-2 right-2 opacity-10 group-hover/code:opacity-40 transition-opacity uppercase text-[8px] font-bold pointer-events-none">Output_History</div>
          {result}
        </pre>
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
      onGenerateComplete={onGenerateComplete}
      onSaveCloud={handleSaveCloud}
      supportsEditing={true}
      extraControls={extraControls}
      parameters={{ engine, version, complexity, density, verticality, activePreset }}
      renderOutput={renderOutput}
    />
  );
}
