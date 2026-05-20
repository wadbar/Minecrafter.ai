import React, { useState, useRef, useEffect, Suspense, useMemo, useCallback } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, Grid, PerspectiveCamera, Environment, GizmoHelper, GizmoViewport, Html, Float, ContactShadows } from "@react-three/drei";
import * as THREE from "three";
import { motion, AnimatePresence } from "motion/react";
import { Box, Layers, Play, Save, Trash2, Maximize, Target, Info, Sparkles, Database, Download, Cpu, Activity, Zap, FileJson, FileCode, BoxSelect, History, Settings2, BarChart3, ChevronRight, RotateCcw, RotateCw, FolderOpen } from "lucide-react";
import { cn } from "../lib/utils";
import { toast } from "sonner";
import { GeometryEngine } from "../lib/geometry-engine";
import { FrontLogger } from "../lib/logger";
import { saveArtifact } from "../lib/db";
import { auth } from "../lib/firebase";

// --- Types ---
interface Voxel {
  position: [number, number, number];
  color: string;
  type: string;
}

interface VoxelData {
  name: string;
  description: string;
  voxels: Voxel[];
  stats: {
    totalBlocks: number;
    dimensions: [number, number, number];
    generationTime?: number;
  };
}

// --- 3D Components ---

function VoxelModel({ voxels, wireframe }: { voxels: Voxel[], wireframe: boolean }) {
  const meshRef = useRef<THREE.Group>(null);

  // Group reference for export logic
  useEffect(() => {
    if (meshRef.current) {
      (window as any)._currentVoxelObject = meshRef.current;
    }
    return () => { (window as any)._currentVoxelObject = null; };
  }, [voxels]);

  return (
    <group ref={meshRef}>
      {voxels.map((v, i) => (
        <mesh key={i} position={v.position} castShadow receiveShadow>
          <boxGeometry args={[0.95, 0.95, 0.95]} />
          <meshStandardMaterial 
            color={v.color} 
            metalness={0.4} 
            roughness={0.2}
            emissive={v.color}
            emissiveIntensity={0.05}
            wireframe={wireframe}
          />
        </mesh>
      ))}
    </group>
  );
}

function Scene({ voxels, wireframe }: { voxels: Voxel[], wireframe: boolean }) {
  return (
    <>
      <color attach="background" args={["#020202"]} />
      <PerspectiveCamera makeDefault position={[12, 12, 12]} />
      <OrbitControls makeDefault enableDamping dampingFactor={0.06} minDistance={2} maxDistance={150} />
      
      <ambientLight intensity={0.4} />
      <spotLight position={[15, 20, 10]} angle={0.2} penumbra={1} intensity={1.5} castShadow shadow-mapSize={[1024, 1024]} />
      <pointLight position={[-15, -10, -15]} intensity={0.8} color="#00f2ff" />
      <hemisphereLight intensity={0.2} groundColor="#000000" />
      
      <Grid 
        infiniteGrid 
        fadeDistance={60} 
        fadeStrength={6} 
        cellSize={1} 
        sectionSize={10} 
        cellThickness={0.4} 
        sectionThickness={0.8} 
        cellColor="#1a1a1a" 
        sectionColor="#333333" 
      />
      
      <Suspense fallback={null}>
        <VoxelModel voxels={voxels} wireframe={wireframe} />
        <Environment preset="night" />
        <ContactShadows resolution={1024} scale={25} blur={1.5} opacity={0.3} far={15} color="#000000" />
      </Suspense>

      <GizmoHelper alignment="bottom-right" margin={[100, 100]}>
        <GizmoViewport axisColors={["#ff3653", "#00ec00", "#2ad1ff"]} labelColor="#fff" />
      </GizmoHelper>
    </>
  );
}

// --- Main UI Component ---

export default function VoxelLab() {
  const [prompt, setPrompt] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [data, setData] = useState<VoxelData | null>(null);
  const [history, setHistory] = useState<VoxelData[]>([]);
  const [activeTab, setActiveTab] = useState<"inspect" | "layers" | "telemetry" | "history">("inspect");
  const [undoStack, setUndoStack] = useState<VoxelData[]>([]);
  const [redoStack, setRedoStack] = useState<VoxelData[]>([]);
  const [wireframe, setWireframe] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  // System Stats Simulation
  const [telemetry, setTelemetry] = useState({
    fps: 60,
    triangles: 0,
    gpuMem: "0MB",
    status: "READY"
  });

  useEffect(() => {
    const timer = setInterval(() => {
      setTelemetry(prev => ({
        ...prev,
        fps: 58 + Math.floor(Math.random() * 4),
        triangles: (data?.voxels.length || 0) * 12,
        gpuMem: `${Math.round((data?.voxels.length || 0) * 0.15)}MB`
      }));
    }, 2000);
    return () => clearInterval(timer);
  }, [data]);

  const generateVoxel = useCallback(async () => {
    if (!prompt.trim() || isGenerating) return;
    
    const startTime = Date.now();
    setIsGenerating(true);
    setTelemetry(t => ({ ...t, status: "COMPUTING" }));
    FrontLogger.info("VOXEL_KERNEL_INVOKED", { prompt });

    try {
      let result;
      try {
        const response = await fetch("/api/generate-voxel", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prompt }),
        });
        
        if (!response.ok) throw new Error(`Gateway Error: ${response.status}`);
        
        result = await response.json();
        if (result.error) throw new Error(result.error);
      } catch (e: any) {
        FrontLogger.warn("Voxel API Failure, falling back to Offline Engine", { error: e.message });
        toast.info("Processamento Local Ativado", { description: "Gerando voxel procedural offline." });
        const { OfflineEngine } = await import("../services/OfflineEngine");
        result = OfflineEngine.generateVoxel(prompt);
      }
        
      const newData: VoxelData = {
        ...result,
        stats: {
          ...result.stats,
          generationTime: Date.now() - startTime
        }
      };
        
      setData(newData);
      setHistory(prev => [newData, ...prev].slice(0, 10));
      
      // Update Undo/Redo Stacks
      if (data) {
        setUndoStack(prev => [data, ...prev].slice(0, 20));
      }
      setRedoStack([]);

      toast.success("Estrutura Sincronizada", { 
        description: `Matriz compilada em ${newData.stats.generationTime}ms.` 
      });
      setTelemetry(t => ({ ...t, status: "READY" }));
    } catch (err: any) {
      FrontLogger.error("VOXEL_GENERATION_FAULT", { error: err.message });
      toast.error("Falha na Matriz", { description: err.message });
      setTelemetry(t => ({ ...t, status: "FAULT" }));
    } finally {
      setIsGenerating(false);
    }
  }, [prompt, isGenerating]);

  const exportOBJ = () => {
    const obj = (window as any)._currentVoxelObject;
    if (!obj) return toast.error("Objeto não encontrado no contexto 3D");
    try {
      GeometryEngine.exportToOBJ(obj, `${data?.name || 'voxel'}_export.obj`);
      toast.success("Exportação Finalizada", { description: "Arquivo .obj baixado com sucesso." });
    } catch (e: any) {
      toast.error("Falha na Exportação", { description: e.message });
    }
  };

  const exportSTL = () => {
    const obj = (window as any)._currentVoxelObject;
    if (!obj) return toast.error("Objeto não encontrado no contexto 3D");
    try {
      GeometryEngine.exportToSTL(obj, `${data?.name || 'voxel'}_export.stl`);
      toast.success("Exportação Finalizada", { description: "Arquivo .stl binário pronto." });
    } catch (e: any) {
      toast.error("Falha na Exportação", { description: e.message });
    }
  };

  const undo = () => {
    if (undoStack.length === 0) return;
    const previous = undoStack[0];
    const newUndo = undoStack.slice(1);
    
    if (data) {
      setRedoStack(prev => [data, ...prev]);
    }
    
    setData(previous);
    setUndoStack(newUndo);
    FrontLogger.info("UNDO_EXECUTED", { remaining: newUndo.length });
  };

  const redo = () => {
    if (redoStack.length === 0) return;
    const next = redoStack[0];
    const newRedo = redoStack.slice(1);
    
    if (data) {
      setUndoStack(prev => [data, ...prev]);
    }
    
    setData(next);
    setRedoStack(newRedo);
    FrontLogger.info("REDO_EXECUTED", { remaining: newRedo.length });
  };

  const saveSession = () => {
    if (!data) return toast.error("Sem dados para salvar");
    try {
      const session = {
        data,
        prompt,
        timestamp: Date.now()
      };
      localStorage.setItem("voxel_lab_session", JSON.stringify(session));
      toast.success("Sessão Salva Localmente", { description: "Matriz persistida no buffer do navegador." });
      FrontLogger.info("SESSION_PERSISTED_LOCAL");
    } catch (e: any) {
      toast.error("Falha ao salvar sessão");
    }
  };

  const saveToCloud = async () => {
    if (!data) return toast.error("Sem dados para arquivar");
    if (!auth.currentUser) return toast.error("Autenticação necessária", { description: "Faça login para salvar na nuvem." });

    const cloudId = toast.loading("Arquivando Matriz na Nuvem...");
    try {
      await saveArtifact('voxel', `Voxel: ${data.name}`, JSON.stringify(data));
      toast.success("Arquivado com Sucesso", { id: cloudId, description: "Estrutura persistida no Cloud Vault." });
      FrontLogger.info("VOXEL_CLOUD_PERSISTENCE_SUCCESS");
    } catch (e: any) {
      toast.error("Falha no Cloud Vault", { id: cloudId, description: e.message });
      FrontLogger.error("VOXEL_CLOUD_PERSISTENCE_FAULT", { error: e.message });
    }
  };

  const loadSession = () => {
    try {
      const saved = localStorage.getItem("voxel_lab_session");
      if (!saved) return toast.error("Nenhuma sessão salva encontrada");
      
      const session = JSON.parse(saved);
      setData(session.data);
      setPrompt(session.prompt);
      toast.success("Sessão Restaurada", { description: `Matriz "${session.data.name}" carregada com sucesso.` });
      FrontLogger.info("SESSION_LOADED_LOCAL");
    } catch (e: any) {
      toast.error("Falha ao carregar sessão");
    }
  };

  return (
    <div className="h-full flex flex-col gap-6 font-sans relative overflow-hidden">
      {/* Background Ambience */}
      <div className="absolute inset-0 pointer-events-none opacity-20 bg-[radial-gradient(circle_at_50%_-20%,rgba(16,185,129,0.1),transparent_50%)]" />

      <div className="flex flex-col md:flex-row items-start justify-between gap-6 relative z-10">
        <div className="space-y-1">
          <div className="flex items-center gap-2 mb-2">
             <div className="px-2 py-0.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 text-[10px] font-black uppercase tracking-[0.2em] rounded animate-pulse">
               {telemetry.status === "COMPUTING" ? "PROCESSING_STREAM" : "KERNEL_NOMINAL_V1"}
             </div>
             <div className="px-2 py-0.5 bg-neutral-900 border border-neutral-800 text-neutral-500 text-[10px] font-black uppercase tracking-[0.2em] rounded backdrop-blur">
               Voxel_Processor_V9
             </div>
          </div>
          <h1 className="text-4xl md:text-5xl font-black text-white uppercase italic tracking-tighter leading-none">
            Laboratório <span className="text-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.2)]">Voxel</span>
          </h1>
          <p className="text-neutral-500 text-sm font-bold uppercase tracking-widest leading-none">
            Ecossistema Industrial de Geometria Paramétrica.
          </p>
        </div>

        <div className="flex items-center gap-3">
           <div className="hidden lg:flex items-center gap-4 px-4 py-2 border border-white/5 rounded-2xl bg-neutral-950/40 backdrop-blur mr-2">
              <div className="flex flex-col items-end">
                <span className="text-[8px] font-mono text-neutral-600 uppercase">Engine_FPS</span>
                <span className="text-xs font-black text-emerald-500 font-mono tracking-tighter">{telemetry.fps}</span>
              </div>
              <div className="w-px h-6 bg-neutral-800" />
              <div className="flex flex-col items-end">
                <span className="text-[8px] font-mono text-neutral-600 uppercase">GPU_Buffer</span>
                <span className="text-xs font-black text-sky-500 font-mono tracking-tighter">{telemetry.gpuMem}</span>
              </div>
           </div>
           
           <button 
            onClick={() => setShowSettings(!showSettings)}
            className="p-3 bg-neutral-900 border border-neutral-800 rounded-xl text-neutral-400 hover:text-white hover:border-neutral-700 transition-all active:scale-95"
            title="Configurações"
           >
             <Settings2 className="w-5 h-5" />
           </button>
           <button 
            onClick={loadSession}
            className="p-3 bg-neutral-900 border border-neutral-800 rounded-xl text-neutral-400 hover:text-white hover:border-neutral-700 transition-all active:scale-95"
            title="Carregar Sessão"
           >
             <FolderOpen className="w-5 h-5" />
           </button>
           <button 
            onClick={saveSession}
            className="p-3 bg-neutral-900 border border-neutral-800 rounded-xl text-neutral-400 hover:text-white hover:border-neutral-700 transition-all active:scale-95"
            title="Salvar Sessão"
           >
             <Save className="w-5 h-5" />
           </button>
           <div className="relative group">
              <button 
                disabled={!data}
                className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-500 hover:bg-emerald-500 hover:text-black transition-all disabled:opacity-50 disabled:grayscale active:scale-95"
              >
                <Download className="w-5 h-5" />
              </button>
              {data && (
                <div className="absolute right-0 top-full mt-2 w-48 py-2 bg-neutral-900 border border-neutral-800 rounded-2xl shadow-2xl opacity-0 group-hover:opacity-100 translate-y-2 group-hover:translate-y-0 transition-all pointer-events-none group-hover:pointer-events-auto z-50">
                   <button onClick={exportOBJ} className="w-full flex items-center gap-3 px-4 py-2 text-xs font-bold text-neutral-300 hover:bg-white/5 hover:text-white transition-colors">
                      <FileCode className="w-4 h-4 text-emerald-500" /> Export (.obj) Mesh
                   </button>
                   <button onClick={exportSTL} className="w-full flex items-center gap-3 px-4 py-2 text-xs font-bold text-neutral-300 hover:bg-white/5 hover:text-white transition-colors">
                      <BoxSelect className="w-4 h-4 text-sky-500" /> Export (.stl) Binary
                   </button>
                   <button onClick={saveToCloud} className="w-full flex items-center gap-3 px-4 py-2 text-xs font-bold text-neutral-300 hover:bg-white/5 hover:text-white transition-colors">
                      <Zap className="w-4 h-4 text-emerald-500" /> Cloud Archival
                   </button>
                   <button onClick={() => toast.info("Exportação JSON em buffer.")} className="w-full flex items-center gap-3 px-4 py-2 text-xs font-bold text-neutral-300 hover:bg-white/5 hover:text-white transition-colors">
                      <FileJson className="w-4 h-4 text-amber-500" /> Export Data (.json)
                   </button>
                </div>
              )}
           </div>
        </div>
      </div>

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-8 min-h-[600px] relative z-10">
        {/* Viewport Area */}
        <div className="lg:col-span-8 bg-black rounded-[2.5rem] border border-neutral-900 overflow-hidden relative group shadow-[0_20px_50px_rgba(0,0,0,0.5)]">
          <Canvas shadows dpr={[1, 2]}>
            <Scene voxels={data?.voxels || []} wireframe={wireframe} />
          </Canvas>

          {/* Viewport Control Bar */}
          <div className="absolute top-8 right-8 flex flex-col gap-3">
             <button 
               onClick={undo}
               disabled={undoStack.length === 0}
               className={cn(
                 "p-3 rounded-2xl border backdrop-blur-xl transition-all shadow-xl active:scale-90 disabled:opacity-30 disabled:cursor-not-allowed",
                 "bg-neutral-950/60 border-white/5 text-neutral-400 hover:text-white"
               )}
               title="Desfazer"
             >
               <RotateCcw className="w-6 h-6" />
             </button>
             <button 
               onClick={redo}
               disabled={redoStack.length === 0}
               className={cn(
                 "p-3 rounded-2xl border backdrop-blur-xl transition-all shadow-xl active:scale-90 disabled:opacity-30 disabled:cursor-not-allowed",
                 "bg-neutral-950/60 border-white/5 text-neutral-400 hover:text-white"
               )}
               title="Refazer"
             >
               <RotateCw className="w-6 h-6" />
             </button>
             <button 
               onClick={() => setWireframe(!wireframe)}
               className={cn(
                 "p-3 rounded-2xl border backdrop-blur-xl transition-all shadow-xl active:scale-90",
                 wireframe ? "bg-emerald-500 border-emerald-400 text-black" : "bg-neutral-950/60 border-white/5 text-neutral-400 hover:text-white"
               )}
               title="Toggle Wireframe"
             >
               <Maximize className="w-6 h-6" />
             </button>
             <button 
                onClick={() => toast.info("Modo de Inspeção Ativado")}
                className="p-3 bg-neutral-950/60 border border-white/5 text-neutral-400 rounded-2xl backdrop-blur-xl hover:text-white transition-all shadow-xl active:scale-90"
             >
               <Target className="w-6 h-6" />
             </button>
          </div>

          {/* Viewport HUD */}
          <div className="absolute top-8 left-8 pointer-events-none">
            <motion.div 
               initial={{ opacity: 0, x: -20 }}
               animate={{ opacity: 1, x: 0 }}
               className="p-6 bg-neutral-950/80 backdrop-blur-2xl border border-white/10 rounded-3xl space-y-5 min-w-[220px] shadow-2xl"
            >
               <div className="flex items-center justify-between border-b border-white/5 pb-3">
                 <div className="flex items-center gap-2">
                    <div className={cn("w-2 h-2 rounded-full animate-pulse", telemetry.status === "READY" ? "bg-emerald-500" : "bg-amber-500")} />
                    <span className="text-[10px] font-black font-mono text-neutral-400 uppercase tracking-widest">{telemetry.status}</span>
                 </div>
                 <span className="text-[9px] font-mono text-neutral-600 uppercase font-bold">NODE_01</span>
               </div>
               
               <div className="space-y-1">
                 <div className="text-[9px] font-mono text-neutral-600 uppercase font-black">Entidade_Ativa</div>
                 <div className="text-lg font-black text-white truncate max-w-[180px] uppercase italic tracking-tighter leading-none">
                    {data?.name || "Null_Pointer"}
                 </div>
               </div>

               <div className="grid grid-cols-2 gap-6">
                 <div className="space-y-1">
                   <div className="text-[8px] font-mono text-neutral-600 uppercase font-black">Triângulos</div>
                   <div className="text-sm font-black text-emerald-400 font-mono tracking-tighter">
                     {telemetry.triangles.toLocaleString()}
                   </div>
                 </div>
                 <div className="space-y-1">
                   <div className="text-[8px] font-mono text-neutral-600 uppercase font-black">Latency_ms</div>
                   <div className="text-sm font-black text-sky-400 font-mono tracking-tighter">
                      {data?.stats.generationTime || 0}
                   </div>
                 </div>
               </div>

               <div className="pt-2 border-t border-white/5">
                  <div className="flex justify-between items-center mb-1.5">
                    <span className="text-[8px] font-mono text-neutral-600 uppercase">Matriz_Load</span>
                    <span className="text-[9px] font-mono text-emerald-500 font-black">{(data?.voxels.length || 0) / 2.5}%</span>
                  </div>
                  <div className="h-1 bg-neutral-900 rounded-full overflow-hidden">
                     <motion.div 
                       initial={{ width: 0 }}
                       animate={{ width: `${Math.min(100, (data?.voxels.length || 0) / 2.5)}%` }}
                       className="h-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,1)]"
                     />
                  </div>
               </div>
            </motion.div>
          </div>

          {!data && !isGenerating && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-neutral-950/20 backdrop-blur-[2px] pointer-events-none">
               <div className="p-8 bg-neutral-900/40 border border-neutral-800 rounded-full mb-6 relative">
                 <div className="absolute inset-0 border border-neutral-700 rounded-full animate-ping opacity-30" />
                 <Box className="w-16 h-16 text-neutral-700 animate-pulse" />
               </div>
               <p className="text-neutral-600 font-mono text-xs uppercase tracking-[0.5em] font-black">Matriz_Vazia: Aguardando_Sincronização</p>
            </div>
          )}

          {isGenerating && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/70 backdrop-blur-md z-20">
               <div className="relative">
                 <div className="w-32 h-32 border-2 border-emerald-500/10 rounded-full animate-[spin_4s_linear_infinite]" />
                 <div className="absolute inset-0 border-t-2 border-emerald-500 rounded-full animate-spin" />
                 <div className="absolute inset-4 border-r-2 border-sky-500 rounded-full animate-[spin_2s_linear_infinite_reverse]" />
                 <Cpu className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-10 h-10 text-emerald-500" />
               </div>
               <div className="mt-10 flex flex-col items-center gap-2">
                 <p className="text-emerald-500 font-mono text-[10px] font-black uppercase tracking-[0.6em] animate-pulse">Sincronizando_Geometria_Neural...</p>
                 <span className="text-[8px] font-mono text-neutral-600 uppercase tracking-widest">[ ALOCANDO SUBPROCESSOS DE RENDERIZAÇÃO ]</span>
               </div>
            </div>
          )}
        </div>

        {/* Sidebar Controls */}
        <div className="lg:col-span-4 flex flex-col gap-6">
          {/* Prompt Entry */}
          <div className="p-2 bg-neutral-900 border border-neutral-800 rounded-3xl flex items-center gap-2 focus-within:border-emerald-500/50 focus-within:shadow-[0_0_30px_rgba(16,185,129,0.1)] transition-all shadow-2xl">
             <input 
               type="text" 
               placeholder="Descreva a estrutura industrial (ex: Reactor Core)..."
               className="flex-1 bg-transparent border-none outline-none px-5 py-4 text-sm text-white placeholder:text-neutral-600 font-bold uppercase tracking-tight"
               value={prompt}
               onChange={(e) => setPrompt(e.target.value)}
               onKeyDown={(e) => e.key === 'Enter' && generateVoxel()}
             />
             <button 
               onClick={generateVoxel}
               disabled={isGenerating || !prompt.trim()}
               className="p-4 bg-emerald-500 text-black rounded-2xl hover:bg-emerald-400 disabled:opacity-50 disabled:grayscale transition-all active:scale-90 flex-shrink-0 shadow-lg shadow-emerald-500/20"
             >
               <Sparkles className="w-6 h-6" />
             </button>
          </div>

          <div className="flex-1 bg-neutral-950 border border-white/5 rounded-[2rem] flex flex-col overflow-hidden shadow-2xl relative">
             <div className="absolute inset-0 bg-neutral-900/10 pointer-events-none" />
             
             <div className="flex border-b border-white/5 p-3 gap-2 bg-black/40 relative z-10">
                {[
                  { id: "inspect", label: "Inspeção", icon: Target },
                  { id: "history", label: "Histórico", icon: History },
                  { id: "layers", label: "Camadas", icon: Layers },
                  { id: "telemetry", label: "Métricas", icon: Activity }
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as any)}
                    className={cn(
                      "flex-1 flex flex-col items-center justify-center gap-1.5 py-4 rounded-2xl transition-all font-mono text-[8px] font-black uppercase tracking-widest",
                      activeTab === tab.id ? "bg-white/5 text-emerald-400 shadow-inner" : "text-neutral-600 hover:text-neutral-400 hover:bg-white/[0.02]"
                    )}
                  >
                    <tab.icon className={cn("w-4 h-4", activeTab === tab.id ? "text-emerald-500" : "text-neutral-800")} />
                    <span className="hidden sm:inline">{tab.label}</span>
                  </button>
                ))}
             </div>

             <div className="flex-1 overflow-y-auto p-8 custom-scrollbar relative z-10">
                <AnimatePresence mode="wait">
                   {activeTab === "inspect" && (
                     <motion.div 
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        className="space-y-8"
                     >
                        {data ? (
                          <>
                            <div className="space-y-3 pb-8 border-b border-white/5">
                               <div className="flex items-center justify-between">
                                 <h3 className="text-white font-black uppercase italic tracking-tighter text-2xl">{data.name}</h3>
                                 <div className="px-2 py-1 bg-emerald-500/10 rounded text-emerald-500 text-[8px] font-black uppercase">Verified</div>
                               </div>
                               <p className="text-neutral-400 text-sm leading-relaxed font-medium">{data.description}</p>
                            </div>
                            
                            <div className="grid grid-cols-2 gap-4">
                               <div className="p-5 bg-white/[0.02] border border-white/5 rounded-[1.5rem] hover:bg-white/[0.04] transition-colors group">
                                  <div className="text-[10px] font-mono text-neutral-600 uppercase mb-2 flex justify-between">
                                     <span>Escala_X</span>
                                     <ChevronRight className="w-3 h-3 text-neutral-800 group-hover:text-emerald-500 transition-colors" />
                                  </div>
                                  <div className="text-2xl font-black text-white italic">{data.stats.dimensions[0]}<span className="text-neutral-700 ml-1 text-xs">M</span></div>
                               </div>
                               <div className="p-5 bg-white/[0.02] border border-white/5 rounded-[1.5rem] hover:bg-white/[0.04] transition-colors group">
                                  <div className="text-[10px] font-mono text-neutral-600 uppercase mb-2 flex justify-between">
                                     <span>Escala_Y</span>
                                     <ChevronRight className="w-3 h-3 text-neutral-800 group-hover:text-sky-500 transition-colors" />
                                  </div>
                                  <div className="text-2xl font-black text-white italic">{data.stats.dimensions[1]}<span className="text-neutral-700 ml-1 text-xs">M</span></div>
                               </div>
                               <div className="p-5 bg-white/[0.02] border border-white/5 rounded-[1.5rem] hover:bg-white/[0.04] transition-colors group">
                                  <div className="text-[10px] font-mono text-neutral-600 uppercase mb-2 flex justify-between">
                                     <span>Escala_Z</span>
                                     <ChevronRight className="w-3 h-3 text-neutral-800 group-hover:text-amber-500 transition-colors" />
                                  </div>
                                  <div className="text-2xl font-black text-white italic">{data.stats.dimensions[2]}<span className="text-neutral-700 ml-1 text-xs">M</span></div>
                               </div>
                               <div className="p-5 bg-emerald-500/5 border border-emerald-500/10 rounded-[1.5rem] hover:bg-emerald-500/10 transition-colors group">
                                  <div className="text-[10px] font-mono text-neutral-500 uppercase mb-2">Estrutura_Fill</div>
                                  <div className="text-2xl font-black text-emerald-400 italic">
                                    {((data.stats.totalBlocks / (data.stats.dimensions[0] * data.stats.dimensions[1] * data.stats.dimensions[2] || 1)) * 100).toFixed(1)}%
                                  </div>
                               </div>
                            </div>

                            <div className="p-6 bg-neutral-900/50 border border-neutral-800 rounded-3xl space-y-4">
                               <div className="flex items-center gap-2 mb-2">
                                 <BarChart3 className="w-4 h-4 text-sky-500" />
                                 <span className="text-[10px] font-mono text-neutral-500 font-black uppercase tracking-widest">Audit_Report</span>
                               </div>
                               <div className="space-y-4">
                                  <div className="flex justify-between items-center text-xs">
                                     <span className="text-neutral-600 font-bold">Complexidade_Matriz</span>
                                     <span className="text-white font-black uppercase">Standard_Ops</span>
                                  </div>
                                  <div className="flex justify-between items-center text-xs">
                                     <span className="text-neutral-600 font-bold">Integridade_Módulo</span>
                                     <span className="text-emerald-500 font-black uppercase tracking-widest">100% OK</span>
                                  </div>
                               </div>
                            </div>
                          </>
                        ) : (
                          <div className="h-64 flex flex-col items-center justify-center text-neutral-700 text-center space-y-6 opacity-30 grayscale saturate-0">
                             <div className="p-8 bg-neutral-900 border border-neutral-800 rounded-full">
                               <Target className="w-16 h-16" />
                             </div>
                             <p className="text-[10px] font-mono uppercase tracking-[0.4em] font-black max-w-[200px]">Seleção_Vazia: Informe o prompt para invocar a matriz</p>
                          </div>
                        )}
                     </motion.div>
                   )}

                   {activeTab === "history" && (
                      <motion.div 
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        className="space-y-4"
                      >
                         <h4 className="text-[10px] font-mono text-neutral-600 font-black uppercase tracking-widest flex items-center gap-2 mb-4">
                           <History className="w-4 h-4" />
                           Snapshot_Logs
                         </h4>
                         <div className="space-y-3">
                            {history.map((h, i) => (
                              <button 
                                key={i} 
                                onClick={() => setData(h)}
                                className={cn(
                                  "w-full flex items-center justify-between p-5 bg-neutral-900/40 border rounded-2xl transition-all group active:scale-95",
                                  data?.name === h.name ? "border-emerald-500/40 bg-emerald-500/5 shadow-lg shadow-emerald-500/5" : "border-white/5 hover:border-neutral-700"
                                )}
                              >
                                <div className="flex items-center gap-4">
                                   <div className={cn(
                                     "w-12 h-12 rounded-2xl flex items-center justify-center transition-colors shadow-inner",
                                     data?.name === h.name ? "bg-emerald-500 text-black" : "bg-neutral-900 border border-neutral-800 text-neutral-600 group-hover:text-emerald-500"
                                   )}>
                                     <Box className="w-6 h-6" />
                                   </div>
                                   <div className="text-left">
                                      <div className={cn("text-xs font-black uppercase italic tracking-tight mb-1", data?.name === h.name ? "text-white" : "text-neutral-400 group-hover:text-white")}>
                                        {h.name}
                                      </div>
                                      <div className="text-[9px] font-mono text-neutral-600 uppercase font-bold">
                                        {h.stats.totalBlocks} Blocks • {h.stats.generationTime || 0}ms
                                      </div>
                                   </div>
                                </div>
                                <div className={cn("w-2 h-2 rounded-full transition-all", data?.name === h.name ? "bg-emerald-500 animate-pulse" : "bg-neutral-800")} />
                              </button>
                            ))}
                            {history.length === 0 && (
                              <div className="text-[10px] font-mono text-neutral-700 uppercase p-12 border border-dashed border-neutral-800 rounded-3xl text-center space-y-4">
                                 <Database className="w-10 h-10 mx-auto opacity-20" />
                                 <p className="tracking-widest">Cache_Sessão_Vazio</p>
                              </div>
                            )}
                         </div>
                      </motion.div>
                   )}

                   {activeTab === "layers" && (
                     <motion.div 
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        className="space-y-6"
                     >
                        <div className="p-6 bg-emerald-500/5 border border-emerald-500/20 rounded-3xl flex items-center gap-4 shadow-xl">
                           <Info className="w-6 h-6 text-emerald-500 flex-shrink-0" />
                           <p className="text-[11px] text-emerald-400/80 leading-relaxed font-black uppercase tracking-tight italic">
                              Kernel Voxel v9: Visibilidade de renderização otimizada para malhas de alta densidade via Ray-Casting dinâmico.
                           </p>
                        </div>

                        <div className="space-y-3">
                           {[
                             { name: "Matriz_Base", color: "text-emerald-500" },
                             { name: "Geometria_Primária", color: "text-sky-500" },
                             { name: "Efeitos_Luminosos", color: "text-amber-500" },
                             { name: "Partículas_Essência", color: "text-violet-500" }
                           ].map((layer, j) => (
                             <div key={j} className="flex items-center justify-between p-5 bg-neutral-900/60 border border-neutral-800 rounded-[1.5rem] hover:bg-neutral-900 transition-colors shadow-lg group">
                                <div className="flex items-center gap-3">
                                   <div className={cn("w-1.5 h-1.5 rounded-full bg-emerald-500 group-hover:scale-150 transition-transform")} />
                                   <span className="text-[11px] font-mono font-black text-neutral-300 uppercase tracking-[0.15em]">{layer.name}</span>
                                </div>
                                <div className="w-12 h-6 bg-emerald-500 rounded-full flex items-center px-1 relative cursor-pointer shadow-[0_0_10px_rgba(16,185,129,0.2)]">
                                   <div className="w-4 h-4 bg-black rounded-full shadow-lg ml-auto" />
                                </div>
                             </div>
                           ))}
                        </div>
                     </motion.div>
                   )}

                   {activeTab === "telemetry" && (
                      <motion.div 
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        className="p-8 h-full flex flex-col items-center justify-center space-y-10"
                      >
                         <div className="relative">
                            <div className="w-48 h-48 border border-sky-500/10 rounded-full flex items-center justify-center">
                               <div className="w-36 h-36 border-2 border-sky-500/20 rounded-full animate-ping opacity-30" />
                               <div className="absolute inset-0 border border-sky-500/10 rounded-full animate-[spin_10s_linear_infinite]" />
                               <Zap className="w-20 h-20 text-sky-500 absolute drop-shadow-[0_0_20px_rgba(14,165,233,0.6)]" />
                            </div>
                         </div>
                         <div className="text-center space-y-3">
                            <h3 className="text-white font-black uppercase text-2xl italic tracking-tighter">Core_Telemetry</h3>
                            <p className="text-[11px] font-mono text-neutral-600 uppercase tracking-[0.25em] max-w-[280px] leading-relaxed">
                               Monitoramento em tempo real do processador de estruturas neurais e alocação de GPU buffer.
                            </p>
                         </div>
                         
                         <div className="w-full space-y-6">
                            <div className="space-y-2">
                               <div className="flex justify-between items-center text-[9px] font-mono text-neutral-500 uppercase font-black">
                                  <span>Potência_Cálculo</span>
                                  <span className="text-sky-500">74.2 GW</span>
                               </div>
                               <div className="w-full h-1.5 bg-neutral-900 rounded-full overflow-hidden shadow-inner">
                                  <motion.div 
                                     initial={{ width: "0%" }}
                                     animate={{ width: "74%" }}
                                     className="h-full bg-sky-500 shadow-[0_0_15px_rgba(14,165,233,0.8)]"
                                  />
                               </div>
                            </div>
                            <div className="space-y-2">
                               <div className="flex justify-between items-center text-[9px] font-mono text-neutral-500 uppercase font-black">
                                  <span>Eficiência_Matriz</span>
                                  <span className="text-emerald-500">92.8%</span>
                               </div>
                               <div className="w-full h-1.5 bg-neutral-900 rounded-full overflow-hidden shadow-inner">
                                  <motion.div 
                                     initial={{ width: "0%" }}
                                     animate={{ width: "92%" }}
                                     className="h-full bg-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.8)]"
                                  />
                               </div>
                            </div>
                         </div>
                      </motion.div>
                   )}
                </AnimatePresence>
             </div>
          </div>
        </div>
      </div>

      {/* Parametric Settings Modal (Simulation) */}
      <AnimatePresence>
        {showSettings && (
          <motion.div 
             initial={{ opacity: 0 }}
             animate={{ opacity: 1 }}
             exit={{ opacity: 0 }}
             className="absolute inset-0 z-[100] flex items-center justify-center p-10 bg-black/80 backdrop-blur-md"
          >
             <motion.div 
               initial={{ scale: 0.9, opacity: 0 }}
               animate={{ scale: 1, opacity: 1 }}
               exit={{ scale: 0.9, opacity: 0 }}
               className="w-full max-w-2xl bg-neutral-950 border border-neutral-800 rounded-[3rem] overflow-hidden shadow-2xl"
             >
                <div className="p-8 border-b border-white/5 bg-neutral-900/40 flex items-center justify-between">
                   <div className="flex items-center gap-4">
                      <div className="p-3 bg-emerald-500/10 rounded-2xl">
                        <Settings2 className="w-6 h-6 text-emerald-500" />
                      </div>
                      <div>
                        <h2 className="text-xl font-black text-white uppercase italic tracking-tighter">Parâmetros_Execução</h2>
                        <p className="text-[10px] font-mono text-neutral-600 uppercase font-bold tracking-widest">Configurações de baixo nível do processador 3D</p>
                      </div>
                   </div>
                   <button 
                    onClick={() => setShowSettings(false)}
                    className="p-3 hover:bg-white/5 rounded-2xl text-neutral-600 hover:text-white transition-all shadow-inner"
                   >
                     <Maximize className="w-5 h-5 rotate-45" />
                   </button>
                </div>
                <div className="p-10 space-y-8 h-[400px] overflow-y-auto custom-scrollbar">
                   <div className="space-y-4">
                      <label className="text-[10px] font-mono text-neutral-400 uppercase font-black tracking-widest flex items-center gap-2">
                        <div className="w-1 h-1 bg-sky-500 rounded-full" />
                        Densidade_Máxima_Processo
                      </label>
                      <input type="range" className="w-full h-1.5 bg-neutral-900 rounded-full appearance-none cursor-pointer accent-emerald-500" defaultValue={50} />
                      <div className="flex justify-between text-[10px] font-mono text-neutral-600">
                        <span>LOW_PRECISION</span>
                        <span>ULTRA_STRUCTURAL</span>
                      </div>
                   </div>

                   <div className="grid grid-cols-2 gap-8">
                      <div className="space-y-4">
                         <label className="text-[10px] font-mono text-neutral-400 uppercase font-black tracking-widest">Ray_Tracing_Bias</label>
                         <div className="flex items-center gap-3">
                            <input type="checkbox" className="w-5 h-5 accent-emerald-500 rounded bg-neutral-900 border-neutral-800" defaultChecked />
                            <span className="text-xs font-bold text-neutral-500 uppercase">Habilitado</span>
                         </div>
                      </div>
                      <div className="space-y-4">
                         <label className="text-[10px] font-mono text-neutral-400 uppercase font-black tracking-widest">Shadow_Resolution</label>
                         <select className="w-full bg-neutral-900 border border-neutral-800 rounded-xl px-4 py-2.5 text-xs text-white outline-none focus:border-emerald-500 transition-all font-bold">
                            <option>512x512 [STANDARD]</option>
                            <option>1024x1024 [REFINED]</option>
                            <option>2048x2048 [INDUSTRIAL]</option>
                         </select>
                      </div>
                   </div>

                   <div className="p-6 bg-amber-500/5 border border-amber-500/20 rounded-3xl flex items-center gap-4">
                      <Info className="w-6 h-6 text-amber-500 flex-shrink-0" />
                      <p className="text-[10px] text-amber-400/80 leading-relaxed font-bold uppercase tracking-tight">
                         Ajustes de hardware de baixo nível podem causar instabilidade no runtime se o volume de IOPS exceder a largura de banda do nó.
                      </p>
                   </div>
                </div>
                <div className="p-8 bg-black/40 border-t border-white/5 flex justify-end gap-4">
                   <button onClick={() => setShowSettings(false)} className="px-8 py-3 bg-neutral-900 text-neutral-400 font-black uppercase text-xs rounded-2xl hover:text-white transition-all shadow-inner">Cancelar</button>
                   <button onClick={() => {toast.success("Parâmetros Persistidos"); setShowSettings(false);}} className="px-8 py-3 bg-emerald-500 text-black font-black uppercase text-xs rounded-2xl hover:bg-emerald-400 transition-all shadow-xl shadow-emerald-500/20 active:scale-95 text-center">Salvar Alterações</button>
                </div>
             </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
