import React, { useState, useMemo, useCallback } from "react";
import GeneratorLayout from "./GeneratorLayout";
import { OfflineEngine } from "../services/OfflineEngine";
import { Download as DownloadIcon, Accessibility, Monitor, User, BookOpen, Sliders, Loader2, Shirt, Trash2, CheckCircle2, RotateCcw, PlusCircle } from "lucide-react";
import SkinViewer3D from "./SkinViewer3D";
import { saveAs } from "file-saver";
import { toast } from "sonner";
import { saveArtifact } from "../lib/db";
import { cn } from "../lib/utils";

interface SkinHistoryItem {
  url: string;
  params: {
    prompt: string;
    modelType: "classic" | "slim";
    detailLevel: number;
    colorIntensity: number;
    stylization: number;
    contrast: number;
    patternScale: number;
    ditherLevel: number;
    useCape: boolean;
    palette: string;
    customColor?: string;
  }
}

export default function SkinGenerator() {
  const [modelType, setModelType] = useState<"classic" | "slim">("classic");
  const [palette, setPalette] = useState("Default");
  const [customColor, setCustomColor] = useState("#555555");
  const [useCape, setUseCape] = useState(false);
  const [autoRotate, setAutoRotate] = useState(true);
  const [showDocs, setShowDocs] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [detailLevel, setDetailLevel] = useState(50);
  const [colorIntensity, setColorIntensity] = useState(50);
  const [stylization, setStylization] = useState(50);
  const [contrast, setContrast] = useState(50);
  const [patternScale, setPatternScale] = useState(50);
  const [ditherLevel, setDitherLevel] = useState(0);
  const [currentSkinUrl, setCurrentSkinUrl] = useState<string | null>("https://textures.minecraft.net/texture/31cf464973347fd5fd7546654e95f082e6ef920c812d348003f90b8ff4f0ed83"); // Steve default texture
  const [history, setHistory] = useState<SkinHistoryItem[]>([]);
  const [isExporting, setIsExporting] = useState(false);
  const [lastBasePrompt, setLastBasePrompt] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [externalSkinUrl, setExternalSkinUrl] = useState("");
  const [externalCapeUrl, setExternalCapeUrl] = useState("");
  const [skinInputError, setSkinInputError] = useState(false);
  const [capeInputError, setCapeInputError] = useState(false);
  const [telemetryLogs, setTelemetryLogs] = useState<{id: string, msg: string, type: 'info' | 'warn' | 'success'}[]>([]);

  const addLog = useCallback((msg: string, type: 'info' | 'warn' | 'success' = 'info') => {
    const id = Math.random().toString(36).substring(2, 9);
    setTelemetryLogs(prev => [{id, msg, type}, ...prev].slice(0, 8));
  }, []);

  // Validation Logic for External Assets
  React.useEffect(() => {
    let active = true;
    const validate = async (url: string, type: 'skin' | 'cape', setError: (v: boolean) => void) => {
      if (!url) {
        setError(false);
        return;
      }
      
      try {
        const parsed = new URL(url);
        if (!parsed.protocol.startsWith('http')) throw new Error("Invalid Protocol");
        
        const img = new Image();
        img.crossOrigin = "anonymous";
        
        await new Promise((resolve, reject) => {
          img.onload = () => {
            if (!active) return resolve(false);
            if (type === 'skin') {
               const validDimensions = (img.width === 64 && (img.height === 64 || img.height === 32));
               if (!validDimensions) {
                 console.warn(`Asset rejected: Skin dimensions are ${img.width}x${img.height}, expected 64x64 or 64x32.`);
               }
            }
            resolve(true);
          };
          img.onerror = () => reject(new Error("Image inaccessible"));
          img.src = url;
          setTimeout(() => reject(new Error("Timeout")), 5000);
        });
        
        if (active) setError(false);
      } catch (e) {
        if (active) setError(true);
      }
    };

    const timer = setTimeout(() => {
      validate(externalSkinUrl, 'skin', setSkinInputError);
      validate(externalCapeUrl, 'cape', setCapeInputError);
    }, 800);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [externalSkinUrl, externalCapeUrl]);

  // Deep Persistence & Initialization
  React.useEffect(() => {
    const saved = localStorage.getItem("skin_forge_state");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.modelType) setModelType(parsed.modelType);
        if (parsed.detailLevel) setDetailLevel(parsed.detailLevel);
        if (parsed.history) setHistory(parsed.history);
      } catch (e) {
        console.warn("Restore failed:", e);
      }
    }
  }, []);

  React.useEffect(() => {
    localStorage.setItem("skin_forge_state", JSON.stringify({
      modelType,
      detailLevel,
      history
    }));
  }, [modelType, detailLevel, history]);

  const generateSkin = async (prompt: string, _existingData?: string, _targetLanguage?: string) => {
    return await executeGeneration(prompt);
  };

  const executeGeneration = async (prompt: string, bypassParams?: Partial<SkinHistoryItem['params']>) => {
    // Pipeline Lock: Prevent concurrent generation requests from corrupting the state
    if (isProcessing) {
      toast.warning("Operação em andamento", { description: "Aguarde a conclusão do processamento anterior." });
      return;
    }

    const activePrompt = bypassParams?.prompt || prompt;
    if (!activePrompt || activePrompt.trim().length === 0) {
      toast.error("Prompt Vazio", { description: "Por favor, descreva a skin que você deseja gerar." });
      return;
    }

    const abortController = new AbortController();

    try {
      setIsProcessing(true);
      setTelemetryLogs([]);
      addLog("Initializing Generation Pipeline...", "info");
      
      setLastBasePrompt(activePrompt);
      
      const config = {
        detailLevel: bypassParams?.detailLevel ?? detailLevel,
        colorIntensity: bypassParams?.colorIntensity ?? colorIntensity,
        stylization: bypassParams?.stylization ?? stylization,
        contrast: bypassParams?.contrast ?? contrast,
        patternScale: bypassParams?.patternScale ?? patternScale,
        ditherLevel: bypassParams?.ditherLevel ?? ditherLevel,
        modelType: bypassParams?.modelType ?? modelType,
        useCape: bypassParams?.useCape ?? useCape,
        palette: bypassParams?.palette ?? palette,
        customColor: bypassParams?.customColor ?? customColor,
      };

      addLog("Constructing transformation parameters...", "info");
      
      const enhancedPrompt = `Minecraft 64x64 skin template texture for: ${activePrompt}. 
Execution Parameters:
- Complexity: ${config.detailLevel}% 
- Palette Vibrance: ${config.colorIntensity}%
- Chromatic Profile: ${config.palette}
- Custom Hex Influence: ${config.customColor}
- Stylization: ${config.stylization}%
- Dynamic Range (Contrast): ${config.contrast}%
- Pattern Scale: ${config.patternScale}%
- Dither Density: ${config.ditherLevel}%
Architecture: Traditional 2D Minecraft layout (64x64). High-fidelity pixel art.`;
      
      const updateHistory = (url: string) => {
        const newItem: SkinHistoryItem = {
          url,
          params: {
            prompt: activePrompt,
            ...config
          }
        };
        setHistory(prev => [newItem, ...prev.filter(h => h.url !== url).slice(0, 5)]);
      };

      if (!navigator.onLine) {
        addLog("Network connection lost. Activating Standalone Engine.", "warn");
        addLog("Simulating mapping via Procedural Core.", "info");
        
        const result = OfflineEngine.generateSkin(enhancedPrompt, { 
          detailLevel: config.detailLevel, 
          colorIntensity: config.colorIntensity,
          contrast: config.contrast,
          ditherLevel: config.ditherLevel,
          stylization: config.stylization,
          patternScale: config.patternScale
        });
        
        setCurrentSkinUrl(result);
        updateHistory(result);
        addLog("Skin synthesized locally.", "success");
        return result;
      }

      addLog("Transmitting request to Remote Cluster...", "info");
      
      const res = await fetch("/api/generate-skin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: enhancedPrompt, modelType: config.modelType }),
        signal: abortController.signal
      });
      
      if (!res.ok) {
        const errorMessages: Record<number, string> = {
          400: "Parâmetros de geração inválidos.",
          429: "Limite de requisições excedido. Aguarde um momento.",
          500: "Erro interno no servidor.",
          503: "O motor de geração está sobrecarregado."
        };
        throw new Error(errorMessages[res.status] || `Falha de comunicação (Status: ${res.status})`);
      }
      
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      
      addLog("Assets received. Finalizing mapping.", "info");
      setCurrentSkinUrl(data.result);
      updateHistory(data.result);
      addLog("Synthesis confirmed.", "success");
      return data.result;
    } catch (error: any) {
      if (error.name === 'AbortError') {
        addLog("Process Aborted.", "warn");
      } else {
        addLog(`Pipeline Fault: ${error?.message || "Fault"}`, "warn");
        toast.error("Falha ao gerar skin", { description: error?.message || "Erro na conexão com o sistema." });
      }
      throw error;
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDownload = async (imgUrl: string) => {
    setIsExporting(true);
    const toastId = toast.loading("Preparando exportação binária...");
    
    try {
      const canvas = document.createElement("canvas");
      canvas.width = 64;
      canvas.height = 64;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Canvas context initialization failed");

      const img = new Image();
      img.crossOrigin = "anonymous";
      
      const imgLoadPromise = new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = () => reject(new Error("Image stream interrupted"));
        img.src = imgUrl;
      });

      await imgLoadPromise;
      
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(img, 0, 0, 64, 64);
      
      canvas.toBlob((blob) => {
        if (blob) {
          saveAs(blob, `skin_${modelType}_${Date.now()}.png`);
          toast.success("Skin exportada com sucesso!", { 
            id: toastId,
            description: `Modelo ${modelType} 64x64 sincronizado localmente.` 
          });
        } else {
          throw new Error("Blob encoding failure");
        }
        setIsExporting(false);
      }, "image/png");

    } catch (error: any) {
      setIsExporting(false);
      toast.error("Exportação falhou", { 
        id: toastId,
        description: error?.message || "Erro durante o processamento de imagem." 
      });
    }
  };

  const extraControls = useMemo(() => (
    <div className="flex flex-col w-full gap-2 text-neutral-400 font-mono text-[10px]">
      <div className="flex flex-wrap items-center gap-4">
         <div className="flex items-center gap-2 bg-neutral-900 px-3 py-1.5 rounded-lg border border-neutral-800">
           <Accessibility className="w-3.5 h-3.5 text-emerald-500" />
           <span className="font-bold uppercase tracking-widest text-neutral-500">Model Type</span>
           <div className="flex gap-1 ml-2">
             <button 
               onClick={() => setModelType("classic")}
               className={cn(
                 "px-2 py-1 rounded transition-all text-[9px] font-black border",
                 modelType === "classic" ? "bg-emerald-500/20 text-emerald-500 border-emerald-500/30 shadow-[0_0_8px_rgba(16,185,129,0.2)]" : "bg-neutral-800/50 border-neutral-800 text-neutral-500 hover:text-white"
               )}
             >
               CLASSIC
             </button>
             <button 
               onClick={() => setModelType("slim")}
               className={cn(
                 "px-2 py-1 rounded transition-all text-[9px] font-black border",
                 modelType === "slim" ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30 shadow-[0_0_8px_rgba(16,185,129,0.2)]" : "bg-neutral-800/50 border-neutral-800 text-neutral-500 hover:text-white"
               )}
             >
               SLIM
             </button>
           </div>
         </div>

         <div className="flex items-center gap-2 bg-neutral-900 px-3 py-1.5 rounded-lg border border-neutral-800">
           <Shirt className="w-3.5 h-3.5 text-purple-500" />
           <span className="font-bold uppercase tracking-widest text-neutral-500">Vanity</span>
           <button 
              onClick={() => setUseCape(!useCape)}
              className={cn(
                "px-2 py-1 rounded transition-all ml-2 text-[9px] font-black",
                useCape ? "bg-purple-500/20 text-purple-400 border border-purple-500/30" : "hover:text-white"
              )}
           >
             CAPE: {useCape ? "ACTIVE" : "NONE"}
           </button>
         </div>

         <div className="flex items-center gap-2 bg-neutral-900 px-3 py-1.5 rounded-lg border border-neutral-800">
           <PlusCircle className="w-3.5 h-3.5 text-orange-500" />
           <span className="font-bold uppercase tracking-widest text-neutral-500">External Assets</span>
           <div className="flex gap-2 ml-2">
              <div className="relative">
                <input 
                  type="text" 
                  placeholder="Skin URL..." 
                  value={externalSkinUrl}
                  onChange={(e) => setExternalSkinUrl(e.target.value)}
                  className={cn(
                    "bg-neutral-950 border rounded px-2 py-1 text-[9px] font-mono text-neutral-300 focus:outline-none w-24 lg:w-32 transition-colors",
                    skinInputError ? "border-red-500/50 text-red-400 bg-red-500/5" : "border-neutral-800 focus:border-orange-500/50"
                  )}
                />
                {skinInputError && externalSkinUrl && <div className="absolute -bottom-3 left-0 text-[7px] text-red-500 font-bold uppercase">Invalid_Skin</div>}
              </div>
              <div className="relative">
                <input 
                  type="text" 
                  placeholder="Cape URL..." 
                  value={externalCapeUrl}
                  onChange={(e) => setExternalCapeUrl(e.target.value)}
                  className={cn(
                    "bg-neutral-950 border rounded px-2 py-1 text-[9px] font-mono text-neutral-300 focus:outline-none w-24 lg:w-32 transition-colors",
                    capeInputError ? "border-red-500/50 text-red-400 bg-red-500/5" : "border-neutral-800 focus:border-orange-500/50"
                  )}
                />
                {capeInputError && externalCapeUrl && <div className="absolute -bottom-3 left-0 text-[7px] text-red-500 font-bold uppercase">Invalid_Cape</div>}
              </div>
              {(externalSkinUrl || externalCapeUrl) && (
                <button 
                  onClick={() => { setExternalSkinUrl(""); setExternalCapeUrl(""); setSkinInputError(false); setCapeInputError(false); }}
                  className="text-neutral-600 hover:text-red-400 p-1 transition-colors"
                  title="Clear external assets"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              )}
           </div>
         </div>

         <div className="flex items-center gap-2 bg-neutral-900 px-3 py-1.5 rounded-lg border border-neutral-800">
           <Monitor className="w-3.5 h-3.5 text-sky-500" />
           <span className="font-bold uppercase tracking-widest text-neutral-500">Auto-Rotation</span>
           <button 
              onClick={() => setAutoRotate(!autoRotate)}
              className={cn(
                "px-3 py-1 rounded transition-all ml-2 text-[9px] font-black border",
                autoRotate ? "bg-sky-500/20 text-sky-400 border-sky-500/30 shadow-[0_0_8px_rgba(14,165,233,0.2)]" : "bg-neutral-800/50 border-neutral-800 text-neutral-500 hover:text-white"
              )}
           >
             {autoRotate ? "ACTIVE" : "PAUSED"}
           </button>
         </div>

         {/* Documentation Toggle */}
         <div className="ml-auto flex gap-2">
           <button 
              onClick={() => { setShowAdvanced(!showAdvanced); setShowDocs(false); }}
              className={cn(
                "flex items-center gap-2 p-1.5 px-3 rounded-lg border transition-colors",
                showAdvanced 
                  ? "bg-amber-500/20 border-amber-500/50 text-amber-400" 
                  : "bg-neutral-900/50 border-neutral-800 text-neutral-400 hover:bg-neutral-800"
              )}
            >
              <Sliders className="w-3.5 h-3.5" />
              <span className="uppercase tracking-widest font-bold text-[10px]">Tuning</span>
            </button>
            <button 
              onClick={() => { setShowDocs(!showDocs); setShowAdvanced(false); }}
              className={cn(
                "flex items-center gap-2 p-1.5 px-3 rounded-lg border transition-colors",
                showDocs 
                  ? "bg-purple-500/20 border-purple-500/50 text-purple-400" 
                  : "bg-neutral-900/50 border-neutral-800 text-neutral-400 hover:bg-neutral-800"
              )}
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span className="uppercase tracking-widest font-bold text-[10px]">Styles</span>
            </button>
          </div>
      </div>
      
      {showAdvanced && (
        <div className="bg-neutral-900/50 border border-neutral-800 p-4 rounded-lg text-xs animate-in fade-in slide-in-from-top-2 mt-2">
          <div className="flex items-center justify-between mb-4 pb-2 border-b border-neutral-800/50">
            <h4 className="text-amber-400 font-bold uppercase tracking-widest flex items-center gap-2">
              <Sliders className="w-4 h-4" /> 
              Advanced Tuning Parameters
            </h4>
            <div className="flex gap-2">
              <button 
                onClick={() => {
                  setDetailLevel(Math.floor(Math.random() * 101));
                  setColorIntensity(Math.floor(Math.random() * 101));
                  setStylization(Math.floor(Math.random() * 101));
                  setContrast(Math.floor(Math.random() * 101));
                  setPatternScale(Math.floor(Math.random() * 101));
                  setDitherLevel(Math.floor(Math.random() * 101));
                  toast.success("RNG Balanced", { description: "Randomized all weightings." });
                }}
                className="text-[8px] font-black uppercase tracking-widest text-neutral-500 hover:text-sky-400 transition-colors px-2 py-1 bg-neutral-950 border border-neutral-800 rounded-md"
              >
                Randomize
              </button>
              <button 
                onClick={() => {
                  setDetailLevel(50);
                  setColorIntensity(50);
                  setStylization(50);
                  setContrast(50);
                  setPatternScale(50);
                  setDitherLevel(0);
                  toast.info("Factory Reset", { description: "Restored nominal parameter baseline." });
                }}
                className="text-[8px] font-black uppercase tracking-widest text-neutral-500 hover:text-red-400 transition-colors px-2 py-1 bg-neutral-950 border border-neutral-800 rounded-md"
              >
                Reset
              </button>
            </div>
          </div>

          {/* Quick Presets */}
          <div className="flex flex-wrap gap-2 mb-6 p-2 bg-neutral-950/50 rounded-xl border border-neutral-800">
             <div className="text-[8px] font-black uppercase tracking-widest text-neutral-600 self-center px-2 border-r border-neutral-800 mr-1">Presets</div>
             {[
               { name: "Super Flat", detail: 10, intensity: 40, style: 20, cont: 30, scale: 30, dither: 0, color: "text-blue-400", bg: "bg-blue-500/10" },
               { name: "High Detail", detail: 90, intensity: 60, style: 40, cont: 60, scale: 40, dither: 20, color: "text-emerald-400", bg: "bg-emerald-500/10" },
               { name: "Neon Vibrant", detail: 60, intensity: 95, style: 80, cont: 85, scale: 50, dither: 10, color: "text-pink-400", bg: "bg-pink-500/10" },
               { name: "Retro Pixel", detail: 40, intensity: 50, style: 30, cont: 70, scale: 80, dither: 90, color: "text-amber-400", bg: "bg-amber-500/10" },
               { name: "Brutalist", detail: 80, intensity: 20, style: 10, cont: 95, scale: 100, dither: 50, color: "text-neutral-300", bg: "bg-neutral-100/10" }
             ].map((p, i) => (
               <button 
                key={i}
                onClick={() => {
                  setDetailLevel(p.detail);
                  setColorIntensity(p.intensity);
                  setStylization(p.style);
                  setContrast(p.cont);
                  setPatternScale(p.scale);
                  setDitherLevel(p.dither);
                  toast.info(`Preset: ${p.name}`, { description: "Parameters calibrated." });
                }}
                className={cn("px-3 py-1.5 rounded-lg text-[9px] font-bold uppercase tracking-widest transition-all hover:scale-105 active:scale-95 border border-transparent hover:border-white/10", p.color, p.bg)}
               >
                 {p.name}
               </button>
             ))}
          </div>
          
          {/* Color Palettes Section */}
          <div className="mb-8 p-4 bg-neutral-950/50 rounded-xl border border-neutral-800">
             <div className="flex items-center gap-2 mb-4">
                <div className="w-1 h-3 bg-sky-500 rounded-full" />
                <h5 className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400">Color Presets</h5>
             </div>

             <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-3">
                {[
                  { name: "Default", colors: ["#555", "#888", "#aaa"] },
                  { name: "Obsidian", colors: ["#0a0a0a", "#1a1a1a", "#333"] },
                  { name: "Solaris", colors: ["#ff9900", "#ffcc00", "#550000"] },
                  { name: "Aether", colors: ["#00f2ff", "#0066ff", "#ffffff"] },
                  { name: "Toxic", colors: ["#39ff14", "#004400", "#ffffff"] },
                  { name: "Royal", colors: ["#800080", "#ffd700", "#ffffff"] },
                  { name: "Frost", colors: ["#e0ffff", "#1e90ff", "#ffffff"] },
                ].map((p) => (
                  <button 
                    key={p.name}
                    onClick={() => {
                      setPalette(p.name);
                      toast.success(`Palette Linked: ${p.name}`, { 
                        description: "Color settings adjusted for specific profiles.",
                        icon: <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                      });
                    }}
                    className={cn(
                      "flex flex-col items-center gap-2 p-2 rounded-lg border transition-all hover:bg-neutral-900 group/palette",
                      palette === p.name ? "bg-sky-500/10 border-sky-500/40" : "bg-black/20 border-neutral-800"
                    )}
                  >
                    <div className="flex -space-x-1.5">
                       {p.colors.map((c, idx) => (
                         <div key={idx} className="w-4 h-4 rounded-full border border-black shadow-sm" style={{ backgroundColor: c }} />
                       ))}
                    </div>
                    <span className={cn(
                      "text-[8px] font-black uppercase tracking-widest",
                      palette === p.name ? "text-sky-400" : "text-neutral-600 group-hover/palette:text-neutral-400"
                    )}>
                      {p.name}
                    </span>
                  </button>
                ))}
                
                {/* Custom Color Picker */}
                <div className="flex flex-col items-center gap-2 p-2 rounded-lg border border-neutral-800 bg-black/20 group/custom">
                  <div className="relative w-7 h-7 rounded-full border border-neutral-700 overflow-hidden shadow-inner">
                    <input 
                      type="color" 
                      value={customColor} 
                      onChange={(e) => {
                        setCustomColor(e.target.value);
                        setPalette("Custom");
                      }}
                      className="absolute inset-x-[-50%] inset-y-[-50%] w-[200%] h-[200%] cursor-pointer border-none p-0 bg-transparent"
                    />
                  </div>
                  <span className={cn(
                    "text-[8px] font-black uppercase tracking-widest",
                    palette === "Custom" ? "text-amber-400" : "text-neutral-600 group-hover/custom:text-neutral-400"
                  )}>
                    Custom
                  </span>
                </div>
             </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-6 text-neutral-400">
            {/* Column 1: Core Rendering */}
            <div className="space-y-4">
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <label className="uppercase font-bold text-[9px] tracking-[0.2em] text-neutral-500">Detail Level</label>
                  <div className="flex items-center gap-2">
                    <input 
                      type="number" min="0" max="100" 
                      value={detailLevel} 
                      onChange={e => setDetailLevel(Number(e.target.value))}
                      className="w-12 bg-neutral-950 border border-neutral-800 rounded px-1 py-0.5 text-[10px] font-mono text-emerald-400 focus:outline-none focus:border-emerald-500/50"
                    />
                    <span className="text-emerald-400 font-mono text-[10px]">%</span>
                  </div>
                </div>
                <input 
                  type="range" min="0" max="100" 
                  value={detailLevel} 
                  onChange={e => setDetailLevel(Number(e.target.value))}
                  className="w-full accent-emerald-500 h-1 bg-neutral-800 rounded-lg appearance-none cursor-pointer" 
                />
                <p className="text-[8px] text-neutral-600 leading-tight uppercase font-bold tracking-tighter">Micro-noise & surface granularity control.</p>
              </div>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <label className="uppercase font-bold text-[9px] tracking-[0.2em] text-neutral-500">Stylization Strength</label>
                  <div className="flex items-center gap-2">
                    <input 
                      type="number" min="0" max="100" 
                      value={stylization} 
                      onChange={e => setStylization(Number(e.target.value))}
                      className="w-12 bg-neutral-950 border border-neutral-800 rounded px-1 py-0.5 text-[10px] font-mono text-purple-400 focus:outline-none focus:border-purple-500/50"
                    />
                    <span className="text-purple-400 font-mono text-[10px]">%</span>
                  </div>
                </div>
                <input 
                  type="range" min="0" max="100" 
                  value={stylization} 
                  onChange={e => setStylization(Number(e.target.value))}
                  className="w-full accent-purple-500 h-1 bg-neutral-800 rounded-lg appearance-none cursor-pointer" 
                />
                <p className="text-[8px] text-neutral-600 leading-tight uppercase font-bold tracking-tighter">Artistic deviation from realism baseline.</p>
              </div>
            </div>

            {/* Column 2: Color & Optics */}
            <div className="space-y-4">
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <label className="uppercase font-bold text-[9px] tracking-[0.2em] text-neutral-500">Color Palette Intensity</label>
                  <div className="flex items-center gap-2">
                    <input 
                      type="number" min="0" max="100" 
                      value={colorIntensity} 
                      onChange={e => setColorIntensity(Number(e.target.value))}
                      className="w-12 bg-neutral-950 border border-neutral-800 rounded px-1 py-0.5 text-[10px] font-mono text-sky-400 focus:outline-none focus:border-sky-500/50"
                    />
                    <span className="text-sky-400 font-mono text-[10px]">%</span>
                  </div>
                </div>
                <input 
                  type="range" min="0" max="100" 
                  value={colorIntensity} 
                  onChange={e => setColorIntensity(Number(e.target.value))}
                  className="w-full accent-sky-500 h-1 bg-neutral-800 rounded-lg appearance-none cursor-pointer" 
                />
                <p className="text-[8px] text-neutral-600 leading-tight uppercase font-bold tracking-tighter">Saturation and intensity of the pigment matrix.</p>
              </div>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <label className="uppercase font-bold text-[9px] tracking-[0.2em] text-neutral-500">Contrast Ratio</label>
                  <div className="flex items-center gap-2">
                    <input 
                      type="number" min="0" max="100" 
                      value={contrast} 
                      onChange={e => setContrast(Number(e.target.value))}
                      className="w-12 bg-neutral-950 border border-neutral-800 rounded px-1 py-0.5 text-[10px] font-mono text-amber-400 focus:outline-none focus:border-amber-500/50"
                    />
                    <span className="text-amber-400 font-mono text-[10px]">%</span>
                  </div>
                </div>
                <input 
                  type="range" min="0" max="100" 
                  value={contrast} 
                  onChange={e => setContrast(Number(e.target.value))}
                  className="w-full accent-amber-500 h-1 bg-neutral-800 rounded-lg appearance-none cursor-pointer" 
                />
                <p className="text-[8px] text-neutral-600 leading-tight uppercase font-bold tracking-tighter">Adjusts the intensity of highlights and shadows.</p>
              </div>
            </div>

            {/* Column 3: Material & Texture */}
            <div className="space-y-4">
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <label className="uppercase font-bold text-[9px] tracking-[0.2em] text-neutral-500">Pattern Scale</label>
                  <div className="flex items-center gap-2">
                    <input 
                      type="number" min="0" max="100" 
                      value={patternScale} 
                      onChange={e => setPatternScale(Number(e.target.value))}
                      className="w-12 bg-neutral-950 border border-neutral-800 rounded px-1 py-0.5 text-[10px] font-mono text-pink-400 focus:outline-none focus:border-pink-500/50"
                    />
                    <span className="text-pink-400 font-mono text-[10px]">%</span>
                  </div>
                </div>
                <input 
                  type="range" min="0" max="100" 
                  value={patternScale} 
                  onChange={e => setPatternScale(Number(e.target.value))}
                  className="w-full accent-pink-500 h-1 bg-neutral-800 rounded-lg appearance-none cursor-pointer" 
                />
                <p className="text-[8px] text-neutral-600 leading-tight uppercase font-bold tracking-tighter">Size of procedural textures and patterns.</p>
              </div>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <label className="uppercase font-bold text-[9px] tracking-[0.2em] text-neutral-500">Dither Level</label>
                  <div className="flex items-center gap-2">
                    <input 
                      type="number" min="0" max="100" 
                      value={ditherLevel} 
                      onChange={e => setDitherLevel(Number(e.target.value))}
                      className="w-12 bg-neutral-950 border border-neutral-800 rounded px-1 py-0.5 text-[10px] font-mono text-emerald-400 focus:outline-none focus:border-emerald-500/50"
                    />
                    <span className="text-emerald-400 font-mono text-[10px]">%</span>
                  </div>
                </div>
                <input 
                  type="range" min="0" max="100" 
                  value={ditherLevel} 
                  onChange={e => setDitherLevel(Number(e.target.value))}
                  className="w-full accent-emerald-500 h-1 bg-neutral-800 rounded-lg appearance-none cursor-pointer" 
                />
                <p className="text-[8px] text-neutral-600 leading-tight uppercase font-bold tracking-tighter">Retro-pixelated color transition blending.</p>
              </div>
            </div>

          </div>
        </div>
      )}

      {showDocs && (
        <div className="bg-neutral-900/50 border border-neutral-800 p-4 rounded-lg text-xs text-neutral-400 leading-relaxed animate-in fade-in slide-in-from-top-2 mt-2">
          <h4 className="text-purple-400 font-bold mb-3 uppercase tracking-widest flex items-center gap-2">
            <BookOpen className="w-4 h-4" /> 
            Skin Generation Keyword Guide
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-3">
              <div>
                <strong className="text-white block mb-1">Cyberpunk & Sci-Fi</strong> 
                Use keywords like <code>cybernetic implants</code>, <code>neon green glowing visor</code>, <code>tactical exoskeleton</code>, <code>holographic details</code> to get high-tech looks.
                <div className="mt-2 text-neutral-500 bg-neutral-950/50 p-2 rounded">
                  <span className="text-purple-500/70 font-semibold mb-1 block uppercase text-[9px] tracking-widest">Example Prompt</span>
                  "A futuristic netrunner with a glowing blue visor, chrome robotic arm, and glowing tactical jacket"
                </div>
              </div>
              <div>
                <strong className="text-white block mb-1">Fantasy & Medieval</strong> 
                Try words like <code>corrupted dark knight</code>, <code>elven ranger cloak</code>, <code>gilded golden armor</code>, <code>mystical runes</code>.
                <div className="mt-2 text-neutral-500 bg-neutral-950/50 p-2 rounded">
                  <span className="text-purple-500/70 font-semibold mb-1 block uppercase text-[9px] tracking-widest">Example Prompt</span>
                  "An ancient elven druid wearing green mossy robes, glowing emerald eyes, and antler crown"
                </div>
              </div>
            </div>
            <div>
               <strong className="text-white block mb-1">Other Styles:</strong> 
               <ul className="list-none space-y-3 mt-2">
                  <li className="flex flex-col gap-1">
                    <div className="flex gap-2"><span className="text-purple-500 font-bold">Retro Sci-fi</span> Space suits, bubble helmets, orange stripes, 80s aesthetics.</div>
                    <div className="text-[10px] text-neutral-500 italic">Ex: "1980s astronaut with orange and white spacesuit, gold mirrored visor"</div>
                  </li>
                  <li className="flex flex-col gap-1">
                    <div className="flex gap-2"><span className="text-purple-500 font-bold">Steampunk</span> Brass goggles, leather coats, clockwork limbs, top hats.</div>
                    <div className="text-[10px] text-neutral-500 italic">Ex: "Victorian inventor with brass goggles, leather longcoat, and mechanical arm"</div>
                  </li>
                  <li className="flex flex-col gap-1">
                    <div className="flex gap-2"><span className="text-purple-500 font-bold">Streetwear</span> Oversized hoodies, high-top sneakers, chains, masks.</div>
                    <div className="text-[10px] text-neutral-500 italic">Ex: "Urban skater wearing oversized black hoodie, gold chains, and oni mask"</div>
                  </li>
               </ul>
            </div>
          </div>
          
          <div className="mt-4 pt-4 border-t border-neutral-800">
            <strong className="text-white block mb-2">⚡ Recommended Keywords for Detail:</strong>
            <div className="flex flex-wrap gap-2">
              {[
                "glowing eyes", "hooded", "tattered cape", "metallic plates", 
                "goggles", "masked", "horns", "cyborg", "demon", "angelic", 
                "tactical belt", "puffer jacket", "robotic arm", "undead"
              ].map((k, i) => (
                <span 
                  key={i} 
                  className="px-2 py-1 rounded text-[10px] font-mono bg-purple-500/20 text-purple-400 border border-purple-500/30"
                >
                  {k}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  ), [modelType, autoRotate, useCape, showDocs, showAdvanced, detailLevel, colorIntensity, stylization, contrast, patternScale, ditherLevel, externalSkinUrl, externalCapeUrl]);

  const handleRegenerate = (item: SkinHistoryItem) => {
    toast.promise(executeGeneration(item.params.prompt, item.params), {
      loading: "Gerando nova versão...",
      success: "Skin regenerada com sucesso!",
      error: "Falha na regeneração"
    });
  };

  const handleUseAsBase = (item: SkinHistoryItem) => {
    setCurrentSkinUrl(item.url);
    setDetailLevel(item.params.detailLevel);
    setColorIntensity(item.params.colorIntensity);
    setStylization(item.params.stylization);
    setContrast(item.params.contrast || 50);
    setPatternScale(item.params.patternScale || 50);
    setDitherLevel(item.params.ditherLevel || 0);
    setModelType(item.params.modelType);
    setUseCape(item.params.useCape || false);
    setPalette(item.params.palette || "Default");
    if (item.params.customColor) setCustomColor(item.params.customColor);
    window.dispatchEvent(new CustomEvent('set-builder-prompt', { detail: item.params.prompt }));
    toast.success("Blueprint Carregado", { 
      description: "Parâmetros e prompt restaurados para edição.",
      icon: <PlusCircle className="w-4 h-4 text-emerald-500" />
    });
  };

  const handleDeleteHistory = (idx: number) => {
    setHistory(prev => prev.filter((_, i) => i !== idx));
    toast.info("Fragmento Deletado", { description: "Setor de memória limpo." });
  };

  const outputContent = useCallback((result: string | null, isGenerating: boolean) => {
    const skinToDisplay = (externalSkinUrl && !skinInputError) ? externalSkinUrl : (result || currentSkinUrl);
    if (!skinToDisplay) return null;

    if (skinToDisplay && !skinToDisplay.startsWith("data:image") && !skinToDisplay.startsWith("http")) {
        return (
            <div className="text-red-400 p-4 border border-red-500/20 bg-red-500/10 rounded-lg">
                Formato inesperado gerado pela IA. Tente reescrever o prompt. (Erro de pipeline)
            </div>
        );
    }

    return (
      <div className={cn(
        "flex flex-col lg:flex-row gap-12 items-center justify-center p-8 w-full h-full max-w-6xl mx-auto transition-all duration-500",
        isGenerating ? "opacity-50 grayscale" : "opacity-100"
      )}>
        {/* 3D Interactive Viewer */}
        <div className="flex-1 flex flex-col items-center justify-center gap-6 w-full lg:w-1/2">
           <div className="flex items-center gap-3 bg-neutral-900/50 px-4 py-2 rounded-full border border-neutral-800 text-emerald-400 font-mono text-[10px] tracking-[0.2em] font-bold uppercase shadow-[0_0_15px_rgba(16,185,129,0.1)]">
              <User className="w-4 h-4" /> Model_Type: <span className="text-white">{modelType.toUpperCase()}</span>
           </div>
           
           <div className="relative group w-full aspect-[4/5] max-w-[400px]">
             {isGenerating && (
               <div className="absolute inset-0 z-20 flex items-center justify-center bg-neutral-950/60 backdrop-blur-md rounded-2xl border border-emerald-500/20">
                 <div className="flex flex-col items-center gap-4">
                    <div className="relative">
                      <Loader2 className="w-12 h-12 animate-spin text-emerald-500" />
                      <div className="absolute inset-0 blur-lg bg-emerald-500/20 animate-pulse" />
                    </div>
                    <span className="text-xs font-mono text-emerald-500 animate-pulse uppercase tracking-[0.4em] font-black">Processing_Pixels...</span>
                 </div>
               </div>
             )}
             <div className="absolute -inset-8 bg-emerald-500/5 blur-[100px] rounded-full opacity-0 group-hover:opacity-60 transition-opacity duration-1000" />
             <SkinViewer3D 
               skinUrl={skinToDisplay} 
               modelType={modelType} 
               autoRotate={autoRotate} 
               capeUrl={(externalCapeUrl && !capeInputError) ? externalCapeUrl : (useCape ? "https://textures.minecraft.net/texture/235338386f91ad18485293297a7a13d705c56c2fbd401a88b5ba805b5f25a3d" : undefined)} 
             />
             
             {/* Interaction Hint Overlay */}
             <div className="absolute bottom-4 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity bg-black/60 backdrop-blur-sm px-3 py-1 rounded-full border border-white/10 text-[9px] text-white/50 font-mono uppercase tracking-widest pointer-events-none">
                Drag to Rotate • Scroll to Zoom
             </div>
           </div>

           {/* Real-time Telemetry Section */}
           {telemetryLogs.length > 0 && (
             <div className="w-full max-w-[400px] bg-black/40 border border-neutral-800 rounded-xl p-3 font-mono text-[9px] space-y-1.5 overflow-hidden animate-in fade-in slide-in-from-bottom-2">
               <div className="flex items-center justify-between mb-2 text-neutral-600 border-b border-neutral-800 pb-1">
                 <span className="font-black uppercase tracking-widest">Process_Telemetry</span>
                 <span className="text-[7px]">v2.4_Audit</span>
               </div>
               {telemetryLogs.map((log) => (
                 <div key={log.id} className="flex gap-2 animate-in slide-in-from-left-1">
                   <span className="text-neutral-700">[{new Date().toTimeString().split(' ')[0]}]</span>
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

           <button
             onClick={() => handleDownload(skinToDisplay)}
             disabled={isExporting}
             className={cn(
               "flex items-center gap-4 px-10 py-4 bg-emerald-600 hover:bg-emerald-500 active:scale-95 transition-all rounded-xl text-white font-bold text-sm uppercase tracking-[0.2em] shadow-[0_0_35px_rgba(16,185,129,0.4)] border border-emerald-400/30 group relative overflow-hidden",
               isExporting && "opacity-50 cursor-not-allowed"
             )}
           >
             <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
             {isExporting ? <Loader2 className="w-5 h-5 animate-spin" /> : <DownloadIcon className="w-5 h-5 relative z-10 group-hover:animate-bounce" />}
             <span className="relative z-10">{isExporting ? "Exporting..." : "Export_Binary_Skin"}</span>
           </button>
        </div>

        {/* Flat Texture & Exporter */}
        <div className="flex-1 flex flex-col items-center justify-center gap-8 w-full lg:w-1/2 border-t lg:border-t-0 lg:border-l border-neutral-800/50 pt-8 lg:pt-0 lg:pl-12">
          <div className="space-y-2 text-center">
            <h3 className="text-neutral-500 font-mono text-[10px] tracking-widest uppercase font-bold">UV_Map_Layout</h3>
            <p className="text-[10px] text-neutral-700 font-mono italic">"The blueprint of existence"</p>
          </div>
          
          <div className="relative p-2 bg-neutral-800 rounded-xl shadow-2xl border border-neutral-700/50 group/texture">
            <div 
              className="w-64 h-64 bg-neutral-950 rounded-lg overflow-hidden cursor-crosshair"
              style={{
                backgroundImage: `url("${skinToDisplay}")`,
                backgroundSize: '100% 100%',
                backgroundRepeat: 'no-repeat',
                imageRendering: 'pixelated'
              }}
            />
            <div className="absolute -top-3 -right-3 w-10 h-10 bg-emerald-500 rounded-full flex items-center justify-center border-4 border-neutral-950 text-white font-bold text-[12px] shadow-lg">
              OK
            </div>
            <div className="absolute inset-0 bg-emerald-500/10 opacity-0 group-hover/texture:opacity-100 transition-opacity pointer-events-none" />
          </div>
          
          <div className="flex flex-col gap-4 w-full max-w-[320px]">
            <div className="grid grid-cols-2 gap-3">
              <div className="p-4 bg-neutral-900/50 border border-neutral-800 rounded-xl text-center">
                <div className="text-neutral-600 text-[8px] font-bold uppercase mb-1 tracking-tighter">Bit_Depth</div>
                <div className="text-emerald-500 font-mono text-sm">8-BIT</div>
              </div>
              <div className="p-4 bg-neutral-900/50 border border-neutral-800 rounded-xl text-center">
                <div className="text-neutral-600 text-[8px] font-bold uppercase mb-1 tracking-tighter">Buffer_Mode</div>
                <div className="text-emerald-500 font-mono text-sm">RGBA</div>
              </div>
            </div>
            
            <div className="p-4 bg-neutral-900/50 border border-neutral-800 rounded-xl flex items-center justify-between px-6">
               <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">Dimension</span>
               <span className="text-emerald-400 font-mono text-xs font-bold">64 x 64 PX</span>
            </div>

            {/* History Buffer */}
            {history.length > 0 && (
              <div className="pt-6 border-t border-neutral-900 mt-2">
                <div className="flex items-center justify-between mb-4">
                   <div className="flex items-center gap-2">
                     <span className="text-[10px] font-mono font-black text-neutral-600 uppercase tracking-[0.3em]">Temporal_Buffer</span>
                     <div className="px-1.5 py-0.5 rounded bg-neutral-900 text-neutral-500 text-[8px] font-bold">{history.length}/6</div>
                   </div>
                   <button 
                     onClick={() => {
                        setHistory([]);
                        toast.info("Buffer Purged", { description: "Memory sectors cleared successfully." });
                     }} 
                     className="text-[9px] text-neutral-700 hover:text-red-500 transition-colors uppercase font-black tracking-widest flex items-center gap-1 group"
                   >
                     <Trash2 className="w-3 h-3 group-hover:scale-110 transition-transform" />
                     Clear
                   </button>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  {history.map((item, idx) => {
                    const isCurrent = currentSkinUrl === item.url;
                    return (
                      <div key={idx} className="relative group/hist">
                        <button 
                          onClick={() => handleUseAsBase(item)}
                          className={cn(
                            "w-full aspect-square rounded-xl border bg-neutral-950 p-2 transition-all hover:scale-105 active:scale-95 overflow-hidden",
                            isCurrent ? "border-emerald-500/50 bg-emerald-500/5 ring-1 ring-emerald-500/20" : "border-neutral-800 hover:border-neutral-700"
                          )}
                        >
                          <img src={item.url} className="w-full h-full object-contain [image-rendering:pixelated] drop-shadow-lg" alt={`History ${idx}`} />
                          {isCurrent && (
                            <div className="absolute top-1 right-1">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                            </div>
                          )}
                          <div className="absolute inset-0 bg-emerald-500/10 opacity-0 group-hover/hist:opacity-100 transition-opacity" />
                        </button>
                        
                        {/* Action Overlay */}
                        <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 flex items-center gap-1 opacity-0 group-hover/hist:opacity-100 transition-all translate-y-2 group-hover/hist:translate-y-0 z-20">
                           <button 
                             onClick={(e) => { e.stopPropagation(); handleRegenerate(item); }}
                             className="p-1 px-1.5 bg-sky-500 hover:bg-sky-400 text-white rounded shadow-lg transition-colors flex items-center gap-1"
                             title="Regenerate with same settings"
                           >
                             <RotateCcw className="w-2.5 h-2.5" />
                             <span className="text-[7px] font-bold uppercase">Regen</span>
                           </button>
                           <button 
                             onClick={(e) => { e.stopPropagation(); handleUseAsBase(item); }}
                             className="p-1 px-1.5 bg-emerald-500 hover:bg-emerald-400 text-white rounded shadow-lg transition-colors flex items-center gap-1"
                             title="Load as base for editing"
                           >
                             <PlusCircle className="w-2.5 h-2.5" />
                             <span className="text-[7px] font-bold uppercase">Base</span>
                           </button>
                           <button 
                             onClick={(e) => { e.stopPropagation(); handleDeleteHistory(idx); }}
                             className="p-1 bg-red-500 hover:bg-red-400 text-white rounded shadow-lg transition-colors"
                             title="Delete"
                           >
                             <Trash2 className="w-2.5 h-2.5" />
                           </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }, [currentSkinUrl, modelType, autoRotate, useCape, history, externalSkinUrl, externalCapeUrl]);

  const handleVoiceCommand = useCallback((command: string) => {
    const cmd = command.toLowerCase();
    let handled = false;

    // Model Type Commands
    if (cmd.includes("modelo clássico") || cmd.includes("physique classic") || cmd.includes("model classic") || cmd.includes("corpo normal")) {
      setModelType("classic");
      toast.info("Comando de Voz", { description: "Troca de modelo para CLASSIC via neural link." });
      handled = true;
    } else if (cmd.includes("modelo slim") || cmd.includes("physique slim") || cmd.includes("model slim") || cmd.includes("corpo fino")) {
      setModelType("slim");
      toast.info("Comando de Voz", { description: "Troca de modelo para SLIM via neural link." });
      handled = true;
    }
    
    // Rotation Commands
    if (cmd.includes("ativar rotação") || cmd.includes("ligar rotação") || cmd.includes("enable auto rotate") || cmd.includes("ativar o girar")) {
      setAutoRotate(true);
      toast.info("Comando de Voz", { description: "Renderização dinâmica reativada." });
      handled = true;
    } else if (cmd.includes("desativar rotação") || cmd.includes("desligar rotação") || cmd.includes("disable auto rotate") || cmd.includes("parar de girar")) {
      setAutoRotate(false);
      handled = true;
      toast.info("Comando de Voz", { description: "Estabilização de câmera ativada." });
    }

    return handled;
  }, []);

  return (
    <GeneratorLayout
      title="Skin Forge 3D"
      description="Geração instantânea de Skins 64x64 por Inteligência Artificial com preview 3D."
      placeholder="Ex: Um cavaleiro sombrio com armadura de ouro místico e capa rasgada..."
      promptTemplates={[
        { label: "🥷 Ninja Cyberpunk", prompt: "A futuristic cyberpunk ninja with glowing neon green visor, dark tactical suit, metallic armor plates." },
        { label: "🤴 Rei Decaído", prompt: "A corrupted undead king with a broken crown, skeletal face, tattered crimson cape, dark iron armor." },
        { label: "👩‍🚀 Astronauta Retrô", prompt: "A retro sci-fi space explorer, white suit with orange stripes, gold tinted helmet visor." }
      ]}
      endpointType=""
      extraControls={extraControls}
      onGenerate={generateSkin}
      onSaveCloud={async (title, result) => await saveArtifact("skin", title, result)}
      renderOutput={outputContent}
      onVoiceCommand={handleVoiceCommand}
    />
  );
}
