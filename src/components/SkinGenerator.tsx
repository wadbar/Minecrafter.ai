import React, { useState, useMemo, useCallback } from "react";
import GeneratorLayout from "./GeneratorLayout";
import { OfflineEngine } from "../services/OfflineEngine";
import { Download as DownloadIcon, Accessibility, Monitor, User, BookOpen, Sliders, Loader2, Shirt, Trash2, CheckCircle2, RotateCcw, PlusCircle, CloudUpload, History } from "lucide-react";
import SkinViewer3D from "./SkinViewer3D";
import { saveAs } from "file-saver";
import { toast } from "sonner";
import { saveArtifact } from "../lib/db";
import { cn, sleep, withExponentialBackoff } from "../lib/utils";
import { useAuth } from "../lib/firebase";
import { usePersistentHistory } from "../hooks/usePersistentHistory";

export default function SkinGenerator() {
  const { user } = useAuth();
  const { history, addHistory, removeHistory } = usePersistentHistory('skin', 20);
  const [activeTab, setActiveTab] = useState<"viewport" | "history">("viewport");
  
  const [modelType, setModelType] = useState<"classic" | "slim">("classic");
  const [compilationMode, setCompilationMode] = useState<"rapido" | "otimizado" | "debug">("otimizado");
  const [palette, setPalette] = useState("Default");
  const [customColor, setCustomColor] = useState("#555555");
  const [useCape, setUseCape] = useState(false);
  const [autoRotate, setAutoRotate] = useState(true);
  const [showDocs, setShowDocs] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(true);
  const [detailLevel, setDetailLevel] = useState(60);
  const [colorIntensity, setColorIntensity] = useState(60);
  const [stylization, setStylization] = useState(50);
  const [contrast, setContrast] = useState(50);
  const [patternScale, setPatternScale] = useState(50);
  const [ditherLevel, setDitherLevel] = useState(20);
  const [currentSkinUrl, setCurrentSkinUrl] = useState<string | null>("https://textures.minecraft.net/texture/31cf464973347fd5fd7546654e95f082e6ef920c812d348003f90b8ff4f0ed83"); // Steve default texture
  const [isExporting, setIsExporting] = useState(false);
  const [lastBasePrompt, setLastBasePrompt] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [externalSkinUrl, setExternalSkinUrl] = useState("");
  const [externalCapeUrl, setExternalCapeUrl] = useState("");
  const [skinInputError, setSkinInputError] = useState(false);
  const [capeInputError, setCapeInputError] = useState(false);
  const [telemetryLogs, setTelemetryLogs] = useState<{id: string, msg: string, type: 'info' | 'warn' | 'success'}[]>([]);
  const [isSavingCloud, setIsSavingCloud] = useState(false);


  const handleSaveCloud = async () => {
    const skinToSave = (externalSkinUrl && !skinInputError) ? externalSkinUrl : currentSkinUrl;
    if (!skinToSave) return;
    
    if (!user) {
      toast.info("Authentication Required", { description: "Sign in to enable Cloud Vault features." });
      return;
    }
    
    setIsSavingCloud(true);
    try {
      const config = {
        detailLevel, colorIntensity, stylization, contrast, patternScale, ditherLevel, modelType, useCape, palette, customColor
      };
      await saveArtifact(
        'skin', 
        `Skin Forge [${modelType.toUpperCase()}]: ${lastBasePrompt ? lastBasePrompt.slice(0, 30) : "Manual_Import"}...`, 
        skinToSave, 
        config
      );
      toast.success("Artifact stored in Cloud Vault.");
    } catch (err: any) {
      toast.error("Vault Failure", { description: err?.message || "Failed to save." });
    } finally {
      setIsSavingCloud(false);
    }
  };

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
        
        await Promise.race([
          new Promise((resolve, reject) => {
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
          }),
          sleep(5000).then(() => Promise.reject(new Error("Timeout")))
        ]);
        
        if (active) setError(false);
      } catch (e) {
        if (active) setError(true);
      }
    };

    let validationTimer: any = null;
    const triggerValidation = async () => {
       await sleep(800);
       if (!active) return;
       validate(externalSkinUrl, 'skin', setSkinInputError);
       validate(externalCapeUrl, 'cape', setCapeInputError);
    };
    triggerValidation();

    return () => {
      active = false;
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
        if (parsed.compilationMode) setCompilationMode(parsed.compilationMode);
      } catch (e) {
        console.warn("Restore failed:", e);
      }
    }
  }, []);

  React.useEffect(() => {
    localStorage.setItem("skin_forge_state", JSON.stringify({
      modelType,
      detailLevel,
      compilationMode,
      history
    }));
  }, [modelType, detailLevel, compilationMode, history]);

  const generateSkin = async (prompt: string, _existingData?: string, _targetLanguage?: string) => {
    return await executeGeneration(prompt);
  };

  const executeGeneration = async (prompt: string, bypassParams?: any) => {
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
      addLog(`Initializing Generation Pipeline (Mode: ${compilationMode.toUpperCase()})...`, "info");
      
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
        addHistory(activePrompt, url, config);
      };

      if (!navigator.onLine) {
        addLog("Network connection lost. Activating Standalone Engine.", "warn");
        addLog("Executing mapping via Procedural Core.", "info");
        
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
      
      let res;
      let data;
      try {
        res = await withExponentialBackoff(async () => {
          const response = await fetch("/api/generate-skin", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ prompt: enhancedPrompt, modelType: config.modelType }),
            signal: abortController.signal
          });
          if (!response.ok) {
            const errorMessages: Record<number, string> = {
              400: "Parâmetros de geração inválidos.",
              429: "Limite de requisições excedido. Aguarde um momento.",
              500: "Erro interno no servidor.",
              503: "O motor de geração está sobrecarregado."
            };
            throw new Error(errorMessages[response.status] || `Falha de comunicação (Status: ${response.status})`);
          }
          return response;
        }, 3, 2000);
        data = await res.json();
        if (data.error) throw new Error(data.error);
      } catch(e: any) {
        addLog(`Remote generation unavailable (${e.message}). Triggering Offline Procedural Engine.`, "warn");
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
        addLog("Skin synthesized locally via fallback.", "success");
        setIsProcessing(false);
        return result;
      }
      
      addLog("Assets received. Finalizing mapping.", "info");
      setCurrentSkinUrl(data.result);
      updateHistory(data.result);
      addLog("Synthesis confirmed.", "success");

      // ARTIFACT_PERSISTENCE: Archiving Artifact to CloudVault
      if (user) {
        try {
          // Attempting deep archival of the generated artifact
          await saveArtifact('skin', `Skin Forge [${config.modelType.toUpperCase()}]: ${activePrompt.slice(0, 30)}...`, data.result, config);
          addLog("Artifact persisted to Cloud Vault.", "success");
        } catch (e) {
          addLog("Cloud persistence offline. Local buffer only.", "warn");
        }
      }

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
    <div className="flex flex-col w-full gap-4 text-m3-on-surface-variant font-medium text-[11px]">
      <div className="flex flex-wrap items-center gap-4">
         {/* Model Type Selector */}
         <div className="flex bg-m3-surface-container rounded-full p-1 border border-m3-outline-variant">
            <button 
              onClick={() => setModelType("classic")}
              className={cn(
                "px-4 py-2 rounded-full transition-all text-xs font-bold flex items-center gap-2",
                modelType === "classic" ? "bg-m3-secondary-container text-m3-on-secondary-container" : "hover:bg-m3-surface-variant font-bold"
              )}
            >
              <Accessibility className="w-3.5 h-3.5" /> Clássico
            </button>
            <button 
              onClick={() => setModelType("slim")}
              className={cn(
                "px-4 py-2 rounded-full transition-all text-xs font-bold flex items-center gap-2",
                modelType === "slim" ? "bg-m3-secondary-container text-m3-on-secondary-container" : "hover:bg-m3-surface-variant font-bold"
              )}
            >
               Esguio
            </button>
         </div>

         {/* Feature Chips */}
         <button 
            onClick={() => setUseCape(!useCape)}
            className={cn(
              "flex items-center gap-3 px-4 h-10 rounded-full border transition-all text-xs font-bold",
              useCape 
                ? "bg-m3-tertiary-container text-m3-on-tertiary-container border-m3-tertiary shadow-m3-1" 
                : "border-m3-outline text-m3-on-surface-variant hover:bg-m3-surface-variant"
            )}
         >
           <Shirt className="w-4 h-4" /> Capa: {useCape ? "Ativa" : "Desligada"}
         </button>

         <div className="flex items-center gap-2">
            <div className="relative group">
              <input 
                type="text" 
                placeholder="Asset Skin (URL)" 
                value={externalSkinUrl}
                onChange={(e) => setExternalSkinUrl(e.target.value)}
                className={cn(
                  "bg-m3-surface border h-10 rounded-xl px-4 text-xs font-medium text-m3-on-surface focus:outline-none w-32 focus:ring-2 focus:ring-m3-primary/30 transition-all",
                  skinInputError ? "border-m3-error text-m3-error" : "border-m3-outline focus:border-m3-primary"
                )}
              />
              {skinInputError && externalSkinUrl && <div className="absolute -bottom-4 left-2 text-[8px] text-m3-error font-bold uppercase">Erro de Asset</div>}
            </div>
            {(externalSkinUrl || externalCapeUrl) && (
              <button 
                onClick={() => { setExternalSkinUrl(""); setExternalCapeUrl(""); setSkinInputError(false); setCapeInputError(false); }}
                className="text-m3-error hover:bg-m3-error-container p-2 rounded-full transition-colors"
                title="Limpar Assets"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
         </div>

         <button 
            onClick={() => setAutoRotate(!autoRotate)}
            className={cn(
              "flex items-center gap-2 px-4 h-10 rounded-full border transition-all text-xs font-bold",
              autoRotate 
                ? "bg-m3-secondary-container text-m3-on-secondary-container border-m3-secondary shadow-m3-1" 
                : "border-m3-outline text-m3-on-surface-variant hover:bg-m3-surface-variant"
            )}
         >
           <Monitor className="w-4 h-4" /> Auto-Rotação
         </button>

         <div className="h-6 w-[1px] bg-m3-outline-variant mx-1" />

         {/* Compile Mode Selector */}
         <div className="ml-auto flex bg-m3-surface-container rounded-full p-1 border border-m3-outline-variant">
            <button 
              onClick={() => {
                setCompilationMode("rapido");
                setDetailLevel(30);
                setColorIntensity(50);
                setStylization(30);
                setContrast(40);
                setPatternScale(70);
                setDitherLevel(0);
                toast.success("Modo Rápido Ativado");
              }}
              className={cn(
                "px-4 py-2 rounded-full transition-all text-[10px] font-black uppercase tracking-wider",
                compilationMode === "rapido" ? "bg-m3-tertiary text-m3-on-tertiary" : "text-m3-on-surface-variant hover:bg-m3-surface-variant"
              )}
            >
              Rápido
            </button>
            <button 
              onClick={() => {
                setCompilationMode("otimizado");
                setDetailLevel(60);
                setColorIntensity(60);
                setStylization(50);
                setContrast(50);
                setPatternScale(50);
                setDitherLevel(20);
                toast.success("Modo Otimizado Ativado");
              }}
              className={cn(
                "px-4 py-2 rounded-full transition-all text-[10px] font-black uppercase tracking-wider",
                compilationMode === "otimizado" ? "bg-m3-primary text-m3-on-primary" : "text-m3-on-surface-variant hover:bg-m3-surface-variant"
              )}
            >
              Otimizado
            </button>
            <button 
              onClick={() => {
                setCompilationMode("debug");
                setDetailLevel(100);
                setColorIntensity(100);
                setStylization(80);
                setContrast(80);
                setPatternScale(100);
                setDitherLevel(50);
                toast.success("Modo Debug Ativado");
              }}
              className={cn(
                "px-4 py-2 rounded-full transition-all text-[10px] font-black uppercase tracking-wider",
                compilationMode === "debug" ? "bg-m3-error text-m3-on-error" : "text-m3-on-surface-variant hover:bg-m3-surface-variant"
              )}
            >
              Debug
            </button>
         </div>

         <div className="flex gap-2 ml-2">
            <button 
               onClick={() => { setShowAdvanced(!showAdvanced); setShowDocs(false); }}
               className={cn(
                 "flex items-center gap-2 h-10 px-4 rounded-full border font-bold text-xs transition-all",
                 showAdvanced 
                   ? "bg-m3-secondary-container text-m3-on-secondary-container border-m3-secondary" 
                   : "border-m3-outline text-m3-on-surface-variant hover:bg-m3-surface-variant"
               )}
             >
               <Sliders className="w-4 h-4" /> Ajustes
             </button>
             <button 
               onClick={() => { setShowDocs(!showDocs); setShowAdvanced(false); }}
               className={cn(
                 "flex items-center gap-2 h-10 px-4 rounded-full border font-bold text-xs transition-all",
                 showDocs 
                   ? "bg-m3-secondary-container text-m3-on-secondary-container border-m3-secondary" 
                   : "border-m3-outline text-m3-on-surface-variant hover:bg-m3-surface-variant"
               )}
             >
               <BookOpen className="w-4 h-4" /> Guia
             </button>
          </div>
      </div>
      
      {showAdvanced && (
        <div className="bg-m3-surface-container-low border border-m3-outline-variant p-6 rounded-[2rem] text-sm animate-in fade-in slide-in-from-top-4 mt-2 shadow-m3-2">
          <div className="flex items-center justify-between mb-6">
            <h4 className="text-m3-on-surface font-black uppercase tracking-widest flex items-center gap-3">
              <Sliders className="w-5 h-5 text-m3-primary" /> 
              Parâmetros de Refinamento
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
                }}
                className="text-[10px] font-bold uppercase px-4 py-2 bg-m3-surface border border-m3-outline rounded-full text-m3-on-surface-variant hover:bg-m3-surface-variant transition-all focus:ring-2 ring-m3-primary"
              >
                Aleatório
              </button>
              <button 
                onClick={() => {
                  setDetailLevel(50);
                  setColorIntensity(50);
                  setStylization(50);
                  setContrast(50);
                  setPatternScale(50);
                  setDitherLevel(0);
                }}
                className="text-[10px] font-bold uppercase px-4 py-2 bg-m3-surface border border-m3-outline rounded-full text-m3-on-surface-variant hover:bg-m3-surface-variant transition-all focus:ring-2 ring-m3-primary"
              >
                Resetar
              </button>
            </div>
          </div>

          <div className="mt-8 p-6 bg-m3-surface rounded-2xl border border-m3-outline-variant shadow-inner">
             <div className="flex items-center gap-3 mb-4">
                <div className="w-1.5 h-4 bg-m3-primary rounded-full" />
                <h5 className="text-[11px] font-black uppercase tracking-widest text-m3-on-surface">Paleta de Frequências</h5>
             </div>

             <div className="flex flex-wrap gap-3">
                {[
                  { name: "Default", colors: ["#555", "#888", "#aaa"] },
                  { name: "Obsidian", colors: ["#0a0a0a", "#1a1a1a", "#333"] },
                  { name: "Solaris", colors: ["#ff9900", "#ffcc00", "#550000"] },
                  { name: "Aether", colors: ["#00f2ff", "#0066ff", "#ffffff"] },
                  { name: "Toxic", colors: ["#39ff14", "#004400", "#ffffff"] },
                  { name: "Frost", colors: ["#e0ffff", "#1e90ff", "#ffffff"] },
                ].map((p) => (
                  <button 
                    key={p.name}
                    onClick={() => setPalette(p.name)}
                    className={cn(
                      "flex items-center gap-3 p-3 rounded-xl border transition-all hover:bg-m3-surface-variant group/palette",
                      palette === p.name ? "bg-m3-secondary-container border-m3-secondary" : "bg-m3-surface border-m3-outline-variant"
                    )}
                  >
                    <div className="flex -space-x-1.5">
                       {p.colors.map((c, idx) => (
                         <div key={idx} className="w-4 h-4 rounded-full border border-m3-on-surface/10" style={{ backgroundColor: c }} />
                       ))}
                    </div>
                    <span className="text-[10px] font-bold text-m3-on-surface group-hover/palette:text-m3-primary transition-colors">
                      {p.name}
                    </span>
                  </button>
                ))}
                
                {/* Custom Color Picker */}
                <div className="flex items-center gap-3 p-3 rounded-xl border border-m3-outline-variant bg-m3-surface">
                  <div className="relative w-6 h-6 rounded-full border border-m3-outline overflow-hidden">
                    <input 
                      type="color" 
                      value={customColor} 
                      onChange={(e) => {
                        setCustomColor(e.target.value);
                        setPalette("Custom");
                      }}
                      className="absolute inset-x-[-100%] inset-y-[-100%] w-[300%] h-[300%] cursor-pointer border-none p-0 bg-transparent scale-150"
                    />
                  </div>
                  <span className="text-[10px] font-bold text-m3-on-surface-variant">Customizado</span>
                </div>
             </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 text-m3-on-surface-variant">
            {[
              { label: "Nível de Detalhe", value: detailLevel, setter: setDetailLevel, color: "m3-primary", hint: "Granularidade da superfície." },
              { label: "Intensidade de Cor", value: colorIntensity, setter: setColorIntensity, color: "m3-secondary", hint: "Saturação da matriz de pigmento." },
              { label: "Estilização", value: stylization, setter: setStylization, color: "m3-tertiary", hint: "Desvio artístico da base." },
              { label: "Contraste", value: contrast, setter: setContrast, color: "m3-primary", hint: "Equilíbrio entre luz e sombras." },
              { label: "Escala de Padrão", value: patternScale, setter: setPatternScale, color: "m3-secondary", hint: "Dimensão das texturas procedurais." },
              { label: "Dither (Ruído)", value: ditherLevel, setter: setDitherLevel, color: "m3-tertiary", hint: "Transições retro-pixeladas." },
            ].map((param, i) => (
              <div key={i} className="space-y-3">
                <div className="flex justify-between items-center px-1">
                  <label className="uppercase font-bold text-[10px] tracking-widest text-m3-on-surface-variant">{param.label}</label>
                  <span className={cn("font-bold text-xs px-2 py-0.5 rounded-full bg-m3-surface", `text-${param.color}`)}>{param.value}%</span>
                </div>
                <input 
                  type="range" min="0" max="100" 
                  value={param.value} 
                  onChange={e => param.setter(Number(e.target.value))}
                  className={cn(
                    "w-full h-10 accent-m3-primary appearance-none cursor-pointer bg-transparent",
                    "[&::-webkit-slider-runnable-track]:h-2 [&::-webkit-slider-runnable-track]:rounded-full [&::-webkit-slider-runnable-track]:bg-m3-surface-variant",
                    "[&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:rounded-full md:[&::-webkit-slider-thumb]:-translate-y-1.5 [&::-webkit-slider-thumb]:bg-m3-primary [&::-webkit-slider-thumb]:shadow-m3-1 [&::-webkit-slider-thumb]:transition-all active:[&::-webkit-slider-thumb]:scale-125"
                  )} 
                />
                <p className="text-[9px] text-m3-on-surface-variant/60 uppercase font-black tracking-tighter pl-1">{param.hint}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {showDocs && (
        <div className="bg-m3-surface-container border border-m3-outline-variant p-6 rounded-[2rem] text-sm animate-in fade-in slide-in-from-top-4 mt-2 shadow-m3-2">
          <h4 className="text-m3-primary font-black mb-6 uppercase tracking-widest flex items-center gap-3">
            <BookOpen className="w-5 h-5" /> 
            Guia de Estilos e Keywords
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-6">
              <div className="p-4 bg-m3-surface rounded-2xl border border-m3-outline-variant">
                <strong className="text-m3-on-surface block mb-2 font-black text-xs uppercase tracking-wider">Cyberpunk & Sci-Fi</strong> 
                <p className="text-m3-on-surface-variant text-[11px] leading-relaxed">
                  Utilize: <code>implantes cibernéticos</code>, <code>visor neon brilhante</code>, <code>exoesqueleto tático</code>, <code>detalhes holográficos</code>.
                </p>
                <div className="mt-3 p-3 bg-m3-secondary-container/30 rounded-xl border border-m3-secondary/20">
                  <span className="text-m3-secondary font-black mb-1 block uppercase text-[9px] tracking-widest">Exemplo de Prompt</span>
                  <p className="text-m3-on-secondary-container text-xs italic italic tracking-tight italic">"Um netrunner futurista com visor azul brilhante, braço robótico de cromo e jaqueta tática iluminada"</p>
                </div>
              </div>
              <div className="p-4 bg-m3-surface rounded-2xl border border-m3-outline-variant">
                <strong className="text-m3-on-surface block mb-2 font-black text-xs uppercase tracking-wider">Fantasia & Medieval</strong> 
                <p className="text-m3-on-surface-variant text-[11px] leading-relaxed">
                  Tente: <code>cavaleiro negro corrompido</code>, <code>capa de ranger élfico</code>, <code>armadura dourada ornamentada</code>, <code>runas místicas</code>.
                </p>
                <div className="mt-3 p-3 bg-m3-tertiary-container/30 rounded-xl border border-m3-tertiary/20">
                  <span className="text-m3-tertiary font-black mb-1 block uppercase text-[9px] tracking-widest">Exemplo de Prompt</span>
                   <p className="text-m3-on-tertiary-container text-xs italic italic tracking-tight italic">"Um druida élfico ancestral vestindo túnicas de musgo verde, olhos esmeralda brilhantes e coroa de galhos"</p>
                </div>
              </div>
            </div>
            <div className="p-6 bg-m3-surface-container-high rounded-2xl border border-m3-outline-variant">
               <strong className="text-m3-on-surface block mb-4 font-black text-xs uppercase tracking-wider">Outras Categorias:</strong> 
               <ul className="list-none space-y-6">
                  <li className="flex flex-col gap-2">
                    <div className="flex gap-2 items-center"><div className="w-1.5 h-1.5 bg-m3-primary rounded-full"/><span className="text-m3-primary font-black uppercase text-[10px] tracking-widest">Retro Sci-fi</span></div>
                    <p className="text-[11px] text-m3-on-surface-variant">Trajes espaciais, capacetes de bolha, listras laranjas, estética dos anos 80.</p>
                  </li>
                  <li className="flex flex-col gap-2">
                    <div className="flex gap-2 items-center"><div className="w-1.5 h-1.5 bg-m3-secondary rounded-full"/><span className="text-m3-secondary font-black uppercase text-[10px] tracking-widest">Steampunk</span></div>
                    <p className="text-[11px] text-m3-on-surface-variant">Goggles de latão, sobretudos de couro, membros mecânicos, cartolas.</p>
                  </li>
                  <li className="flex flex-col gap-2">
                    <div className="flex gap-2 items-center"><div className="w-1.5 h-1.5 bg-m3-tertiary rounded-full"/><span className="text-m3-tertiary font-black uppercase text-[10px] tracking-widest">Streetwear</span></div>
                    <p className="text-[11px] text-m3-on-surface-variant">Hoodies oversized, sneakers cano alto, correntes, máscaras.</p>
                  </li>
               </ul>
            </div>
          </div>
          
          <div className="mt-8 pt-6 border-t border-m3-outline-variant">
            <strong className="text-m3-on-surface block mb-4 font-black text-xs uppercase tracking-[0.2em] opacity-60">⚡ Keywords Recomendadas para Detalhes:</strong>
            <div className="flex flex-wrap gap-2">
              {[
                "olhos brilhantes", "encapuzado", "capa rasgada", "placas metálicas", 
                "goggles", "mascarado", "chifres", "cyborg", "demoníaco", "angelical", 
                "cinto tático", "jaqueta puffer", "braço robótico", "morto-vivo"
              ].map((k, i) => (
                <span 
                  key={i} 
                  className="px-4 py-2 rounded-full text-[10px] font-bold bg-m3-secondary-container text-m3-on-secondary-container border border-m3-secondary/20 hover:bg-m3-secondary hover:text-m3-on-secondary transition-colors cursor-default"
                >
                  {k}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  ), [modelType, compilationMode, autoRotate, useCape, showDocs, showAdvanced, detailLevel, colorIntensity, stylization, contrast, patternScale, ditherLevel, externalSkinUrl, externalCapeUrl]);

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
      <div className="flex flex-col gap-6 w-full max-w-6xl mx-auto">
        <div className="flex gap-2">
          <button 
            onClick={() => setActiveTab("viewport")}
            className={cn(
              "px-6 py-2 rounded-full text-[10px] font-black uppercase tracking-[0.2em] transition-all",
              activeTab === "viewport" ? "bg-m3-primary text-m3-on-primary shadow-m3-1" : "bg-m3-surface-container text-m3-on-surface-variant hover:bg-m3-surface-variant"
            )}
          >
            Viewport 3D
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

        {activeTab === "history" ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-in fade-in slide-in-from-top-4">
             {history.map((item) => (
                <div 
                  key={item.id} 
                  className="bg-m3-surface-container p-4 rounded-3xl border border-m3-outline-variant hover:border-m3-primary/50 transition-all cursor-pointer group relative"
                  onClick={() => {
                    setCurrentSkinUrl(item.result);
                    if (item.parameters) {
                      const params = item.parameters as any;
                      setModelType(params.modelType);
                      setDetailLevel(params.detailLevel);
                      setUseCape(params.useCape);
                      setPalette(params.palette);
                    }
                    window.dispatchEvent(new CustomEvent('set-builder-prompt', { detail: item.prompt }));
                    setActiveTab("viewport");
                  }}
                >
                  <div className="aspect-square bg-m3-surface-container-highest rounded-2xl mb-4 overflow-hidden flex items-center justify-center">
                    <img src={item.result} alt="History Skin" className="pixelated w-32 h-32" referrerPolicy="no-referrer" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-m3-on-surface font-bold truncate">"{item.prompt}"</p>
                    <div className="flex justify-between items-center text-[9px] font-black uppercase tracking-widest text-m3-on-surface-variant/40">
                      <span>{(item.parameters as any)?.modelType}</span>
                      <span>{new Date(item.timestamp).toLocaleDateString()}</span>
                    </div>
                  </div>
                  <button 
                    onClick={(e) => { e.stopPropagation(); removeHistory(item.id); }}
                    className="absolute top-2 right-2 p-2 text-m3-error opacity-0 group-hover:opacity-100 transition-all hover:bg-m3-error-container rounded-full"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
             ))}
             {history.length === 0 && (
               <div className="col-span-full py-20 text-center opacity-30 uppercase font-black tracking-widest text-xs">Vazio. Gere algo novo para indexar.</div>
             )}
          </div>
        ) : (
          <div className={cn(
            "flex flex-col lg:flex-row gap-12 items-center justify-center p-8 w-full h-full transition-all duration-500",
            isGenerating ? "opacity-50 grayscale" : "opacity-100"
          )}>
            {/* 3D Interactive Viewer */}
            <div className="flex-1 flex flex-col items-center justify-center gap-6 w-full lg:w-1/2">
               <div className="flex items-center gap-3 bg-m3-surface-container-high px-4 py-2 rounded-full border border-m3-outline-variant text-m3-primary font-bold text-[10px] tracking-[0.2em] uppercase shadow-m3-1">
                  <User className="w-4 h-4" /> Modelo: <span className="text-m3-on-surface">{modelType.toUpperCase()}</span>
               </div>
               
               <div className="relative group w-full aspect-[4/5] max-w-[400px]">
                 {isGenerating && (
                   <div className="absolute inset-0 z-20 flex items-center justify-center bg-m3-surface/60 backdrop-blur-md rounded-2xl border border-m3-primary/20">
                     <div className="flex flex-col items-center gap-4">
                        <div className="relative">
                          <Loader2 className="w-12 h-12 animate-spin text-m3-primary" />
                          <div className="absolute inset-0 blur-lg bg-m3-primary/20 animate-pulse" />
                        </div>
                        <span className="text-xs font-bold text-m3-primary animate-pulse uppercase tracking-[0.4em]">Gerando Pixels...</span>
                     </div>
                   </div>
                 )}
                 <div className="absolute -inset-8 bg-m3-primary/5 blur-[100px] rounded-full opacity-0 group-hover:opacity-60 transition-opacity duration-1000" />
                 <SkinViewer3D 
                   skinUrl={skinToDisplay} 
                   modelType={modelType} 
                   autoRotate={autoRotate} 
                   capeUrl={(externalCapeUrl && !capeInputError) ? externalCapeUrl : (useCape ? "https://textures.minecraft.net/texture/235338386f91ad18485293297a7a13d705c56c2fbd401a88b5ba805b5f25a3d" : undefined)} 
                 />
                 
                 <div className="absolute bottom-4 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity bg-m3-surface-container-highest/60 backdrop-blur-sm px-4 py-2 rounded-full border border-m3-outline-variant text-[9px] text-m3-on-surface-variant font-bold uppercase tracking-widest pointer-events-none">
                    Arraste para Girar • Scroll para Zoom
                 </div>
               </div>

               {telemetryLogs.length > 0 && (
                 <div className="w-full max-w-[400px] bg-m3-surface-container-low border border-m3-outline-variant rounded-2xl p-4 font-mono text-[10px] space-y-2 overflow-hidden animate-in fade-in slide-in-from-bottom-2 shadow-inner">
                   <div className="flex items-center justify-between mb-2 text-m3-on-surface-variant border-b border-m3-outline-variant pb-2">
                     <span className="font-black uppercase tracking-widest text-[9px]">Audit_Telemetria</span>
                     <span className="text-[8px] opacity-60">Status: ATIVO</span>
                   </div>
                   {telemetryLogs.map((log) => (
                     <div key={log.id} className="flex gap-2 animate-in slide-in-from-left-2">
                       <span className="text-m3-on-surface-variant/40">[{new Date().toTimeString().split(' ')[0]}]</span>
                       <span className={cn(
                         "font-bold uppercase tracking-tight",
                         log.type === 'info' ? 'text-m3-secondary' : log.type === 'success' ? 'text-m3-primary' : 'text-m3-error'
                       )}>
                         {log.type === 'info' ? '>>' : log.type === 'success' ? 'OK' : '!!'} {log.msg}
                       </span>
                     </div>
                   ))}
                 </div>
               )}

               <div className="flex flex-col gap-3 w-full max-w-[400px]">
                 <button
                   onClick={() => handleDownload(skinToDisplay)}
                   disabled={isExporting}
                   className={cn(
                     "flex w-full justify-center items-center gap-4 h-14 bg-m3-primary hover:bg-m3-primary/90 active:scale-95 transition-all rounded-full text-m3-on-primary font-bold text-sm uppercase tracking-[0.15em] shadow-m3-2 group relative overflow-hidden",
                     isExporting && "opacity-50 cursor-not-allowed shadow-none"
                   )}
                 >
                   {isExporting ? <Loader2 className="w-5 h-5 animate-spin" /> : <DownloadIcon className="w-5 h-5 relative z-10 group-hover:translate-y-0.5 transition-transform" />}
                   <span className="relative z-10">{isExporting ? "Exportando..." : "Baixar Binário Skin"}</span>
                 </button>

                 <button
                   onClick={handleSaveCloud}
                   disabled={isSavingCloud}
                   data-action="save"
                   className={cn(
                     "flex w-full justify-center items-center gap-4 h-12 bg-m3-surface-container-high hover:bg-m3-surface-variant active:scale-95 transition-all rounded-full text-m3-on-surface font-bold text-xs uppercase tracking-[0.1em] border border-m3-outline-variant group relative",
                     isSavingCloud && "opacity-50 cursor-not-allowed"
                   )}
                 >
                   {isSavingCloud ? <Loader2 className="w-4 h-4 animate-spin" /> : <CloudUpload className="w-4 h-4 relative z-10 group-hover:-translate-y-1 transition-transform" />}
                   <span className="relative z-10">{isSavingCloud ? "Salvando..." : "Salvar no Cloud Vault"}</span>
                 </button>
               </div>
            </div>

            {/* Flat Texture & Exporter */}
            <div className="flex-1 flex flex-col items-center justify-center gap-8 w-full lg:w-1/2 border-t lg:border-t-0 lg:border-l border-m3-outline-variant pt-8 lg:pt-0 lg:pl-12">
              <div className="space-y-2 text-center">
                <h3 className="text-m3-on-surface-variant font-black text-[11px] tracking-widest uppercase opacity-70">Projeto_UV_Map</h3>
                <p className="text-[10px] text-m3-on-surface-variant/40 italic">"Estrutura fundamental da malha"</p>
              </div>
              <div className="relative p-6 bg-m3-surface-container rounded-3xl shadow-m3-3 border border-m3-outline-variant group/texture transition-all hover:shadow-m3-4">
                <img 
                  src={skinToDisplay} 
                  alt="Flat Texture" 
                  className="pixelated w-48 h-48 sm:w-64 sm:h-64 rounded-xl border border-m3-outline-variant shadow-inner transition-transform group-hover/texture:scale-[1.02]" 
                  referrerPolicy="no-referrer"
                />
              </div>
            </div>
          </div>
        )}
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

    // Action Commands explicitly in SkinGenerator
    if (cmd.includes("generate skin") || cmd.includes("gerar skin")) {
      // Trigger global generate via GeneratorLayout or DOM shortcut
      const genBtn = document.querySelector('[data-action="generate-button"]') as HTMLButtonElement | null;
      if (genBtn) genBtn.click();
      toast.success("Comando Executado", { description: "Iniciando geração de skin." });
      handled = true;
    }

    if (cmd.includes("save skin") || cmd.includes("salvar skin") || cmd.includes("guardar skin")) {
      handleSaveCloud();
      handled = true;
    }

    return handled;
  }, [handleSaveCloud]);

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
      onSaveCloud={async (title, result) => await saveArtifact("skin", title, result, { modelType, palette, detailLevel, colorIntensity, stylization, contrast, patternScale, ditherLevel, useCape })}
      renderOutput={outputContent}
      onVoiceCommand={handleVoiceCommand}
      parameters={{ modelType, palette, detailLevel, colorIntensity, stylization, contrast, patternScale, ditherLevel, useCape }}
    />
  );
}
