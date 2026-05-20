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

import { useTranslation } from "../context/LanguageContext";

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

const voxelTemplates = [
  { nameKey: "medievalVillage", promptKey: "medievalVillagePrompt", c: 75, d: 60, v: 40 },
  { nameKey: "abandonedFort", promptKey: "abandonedFortPrompt", c: 85, d: 50, v: 70 },
  { nameKey: "enchantedForest", promptKey: "enchantedForestPrompt", c: 90, d: 40, v: 80 }
];

// --- 3D Components ---

function StaticVoxelModel({ voxels, wireframe }: { voxels: Voxel[], wireframe: boolean }) {
  const groupRef = useRef<THREE.Group>(null);

  // Group reference for export logic
  useEffect(() => {
    if (groupRef.current) {
      (window as any)._currentVoxelObject = groupRef.current;
    }
    return () => { (window as any)._currentVoxelObject = null; };
  }, [voxels]);

  return (
    <group ref={groupRef}>
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

function VoxelModel({ voxels, wireframe }: { voxels: Voxel[], wireframe: boolean }) {
  return (
    <Float speed={2} rotationIntensity={0.2} floatIntensity={0.4}>
      <StaticVoxelModel voxels={voxels} wireframe={wireframe} />
    </Float>
  );
}

function Scene({ voxels, wireframe }: { voxels: Voxel[], wireframe: boolean }) {
  const ambientRef = useRef<THREE.AmbientLight>(null);
  const pointRef = useRef<THREE.PointLight>(null);

  useFrame((state) => {
    const t = state.clock.getElapsedTime();
    if (ambientRef.current) {
      ambientRef.current.intensity = 0.3 + Math.sin(t * 1.5) * 0.1;
    }
    if (pointRef.current) {
      pointRef.current.intensity = 0.6 + Math.sin(t * 2) * 0.3;
    }
  });

  return (
    <>
      <color attach="background" args={["#020202"]} />
      <PerspectiveCamera makeDefault position={[12, 12, 12]} />
      <OrbitControls makeDefault enableDamping dampingFactor={0.06} minDistance={2} maxDistance={150} />
      
      <ambientLight ref={ambientRef} intensity={0.4} />
      <spotLight position={[15, 20, 10]} angle={0.2} penumbra={1} intensity={1.5} castShadow shadow-mapSize={[1024, 1024]} />
      <pointLight ref={pointRef} position={[-15, -10, -15]} intensity={0.8} color="#00f2ff" />
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
        <ContactShadows 
          resolution={1024} 
          scale={30} 
          blur={2} 
          opacity={0.5} 
          far={15} 
          color="#000000" 
          position={[0, -0.1, 0]}
        />
      </Suspense>

      <GizmoHelper alignment="bottom-right" margin={[100, 100]}>
        <GizmoViewport axisColors={["#ff3653", "#00ec00", "#2ad1ff"]} labelColor="#fff" />
      </GizmoHelper>
    </>
  );
}

// --- Main UI Component ---

export default function VoxelLab() {
  const { t } = useTranslation();
  const [prompt, setPrompt] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [data, setData] = useState<VoxelData | null>(null);
  const [history, setHistory] = useState<VoxelData[]>([]);
  const [activeTab, setActiveTab] = useState<"inspect" | "layers" | "telemetry" | "history">("inspect");
  const [undoStack, setUndoStack] = useState<VoxelData[]>([]);
  const [redoStack, setRedoStack] = useState<VoxelData[]>([]);
  const [wireframe, setWireframe] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  
  // Generation Parameters
  const [complexity, setComplexity] = useState(65);
  const [density, setDensity] = useState(70);
  const [verticality, setVerticality] = useState(50);
  const [exportFormat, setExportFormat] = useState<"obj" | "stl">("obj");

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
          body: JSON.stringify({ 
            prompt,
            params: { complexity, density, verticality }
          }),
        });
        
        if (!response.ok) throw new Error(`Gateway Error: ${response.status}`);
        
        result = await response.json();
        if (result.error) throw new Error(result.error);
      } catch (e: any) {
        FrontLogger.warn("Voxel API Failure, falling back to Offline Engine", { error: e.message });
        toast.info(t.voxelLab.offlineProcessing, { description: t.voxelLab.offlineDesc });
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

      toast.success(t.voxelLab.syncedStructure, { 
        description: t.voxelLab.matrixCompiled.replace('{time}', newData.stats.generationTime?.toString() || '0')
      });
      setTelemetry(t => ({ ...t, status: "READY" }));
    } catch (err: any) {
      FrontLogger.error("VOXEL_GENERATION_FAULT", { error: err.message });
      toast.error(t.voxelLab.matrixFault, { description: err.message });
      setTelemetry(t => ({ ...t, status: "FAULT" }));
    } finally {
      setIsGenerating(false);
    }
  }, [prompt, isGenerating]);

  const exportOBJ = () => {
    const obj = (window as any)._currentVoxelObject;
    if (!obj) return toast.error(t.voxelLab.objectNotFound);
    try {
      GeometryEngine.exportToOBJ(obj, `${data?.name || 'voxel'}_export.obj`);
      toast.success(t.voxelLab.exportFinished, { description: t.voxelLab.objSuccess });
    } catch (e: any) {
      toast.error(t.voxelLab.exportFault, { description: e.message });
    }
  };

  const exportSTL = () => {
    const obj = (window as any)._currentVoxelObject;
    if (!obj) return toast.error(t.voxelLab.objectNotFound);
    try {
      GeometryEngine.exportToSTL(obj, `${data?.name || 'voxel'}_export.stl`);
      toast.success(t.voxelLab.exportFinished, { description: t.voxelLab.stlSuccess });
    } catch (e: any) {
      toast.error(t.voxelLab.exportFault, { description: e.message });
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

  const handleExport = () => {
    if (exportFormat === "obj") exportOBJ();
    else exportSTL();
  };

  const applyTemplate = (name: string, p: string, params: { c: number, d: number, v: number }) => {
    setPrompt(p);
    setComplexity(params.c);
    setDensity(params.d);
    setVerticality(params.v);
    toast.success(t.voxelLab.templateApplied.replace('{name}', name), { description: t.voxelLab.templateConfigured });
  };

  const saveSession = () => {
    if (!data) return toast.error(t.voxelLab.noDataSave);
    try {
      const session = {
        data,
        prompt,
        timestamp: Date.now()
      };
      localStorage.setItem("voxel_lab_session", JSON.stringify(session));
      toast.success(t.voxelLab.sessionSavedLocal, { description: t.voxelLab.sessionPersisted });
      FrontLogger.info("SESSION_PERSISTED_LOCAL");
    } catch (e: any) {
      toast.error(t.voxelLab.saveSessionFault);
    }
  };

  const saveToCloud = async () => {
    if (!data) return toast.error(t.voxelLab.noDataArchive);
    if (!auth.currentUser) return toast.error(t.voxelLab.authRequired, { description: t.voxelLab.loginToSave });

    const cloudId = toast.loading(t.voxelLab.archivingCloud);
    try {
      await saveArtifact('voxel', `Voxel: ${data.name}`, JSON.stringify(data));
      toast.success(t.voxelLab.archivedSuccess, { id: cloudId, description: t.voxelLab.archivedVault });
      FrontLogger.info("VOXEL_CLOUD_PERSISTENCE_SUCCESS");
    } catch (e: any) {
      toast.error(t.voxelLab.cloudFault, { id: cloudId, description: e.message });
      FrontLogger.error("VOXEL_CLOUD_PERSISTENCE_FAULT", { error: e.message });
    }
  };

  const loadSession = () => {
    try {
      const saved = localStorage.getItem("voxel_lab_session");
      if (!saved) return toast.error(t.voxelLab.noSessionFound);
      
      const session = JSON.parse(saved);
      setData(session.data);
      setPrompt(session.prompt);
      toast.success(t.voxelLab.sessionRestored, { description: t.voxelLab.matrixLoaded.replace('{name}', session.data.name) });
      FrontLogger.info("SESSION_LOADED_LOCAL");
    } catch (e: any) {
      toast.error(t.voxelLab.loadSessionFault);
    }
  };

  return (
    <div className="h-full flex flex-col gap-6 font-sans relative overflow-hidden p-4 md:p-6 lg:p-8">
      {/* Background Ambience */}
      <div className="absolute inset-0 pointer-events-none opacity-20 bg-[radial-gradient(circle_at_50%_-20%,var(--color-m3-primary),transparent_50%)]" />

      <div className="flex flex-col md:flex-row items-center justify-between gap-6 relative z-10 w-full max-w-7xl mx-auto">
        <div className="text-center md:text-left space-y-2">
          <div className="flex items-center justify-center md:justify-start gap-2 mb-3">
             <div className="px-3 py-1 bg-m3-primary-container border border-m3-primary/20 text-m3-on-primary-container text-[10px] font-black uppercase tracking-[0.2em] rounded-full shadow-m3-1 animate-pulse">
               {telemetry.status === "COMPUTING" ? t.voxelLab.computing : t.voxelLab.systemStatus}
             </div>
             <div className="px-3 py-1 bg-m3-surface-container-high border border-m3-outline-variant text-m3-on-surface-variant text-[10px] font-black uppercase tracking-[0.2em] rounded-full shadow-m3-1 backdrop-blur-xl">
               Voxel_Lab
             </div>
          </div>
          <h1 className="text-5xl md:text-6xl font-black text-m3-on-surface uppercase italic tracking-tighter leading-none">
            Laboratório <span className="text-m3-primary shadow-m3-2">Voxel</span>
          </h1>
          <p className="text-m3-on-surface-variant/60 text-sm font-black uppercase tracking-widest leading-none mt-2">
            {t.voxelLab.industrialEcosystem}
          </p>
        </div>

        <div className="flex items-center gap-3">
           <div className="hidden lg:flex items-center gap-6 px-6 py-3 border border-m3-outline-variant rounded-full bg-m3-surface-container-low/40 backdrop-blur-2xl shadow-m3-2 mr-2">
              <div className="flex flex-col items-center">
                <span className="text-[9px] font-black text-m3-on-surface-variant uppercase tracking-widest opacity-50">{t.voxelLab.fps}</span>
                <span className="text-sm font-black text-m3-primary font-mono tracking-tighter">{telemetry.fps}</span>
              </div>
              <div className="w-px h-8 bg-m3-outline-variant" />
              <div className="flex flex-col items-center">
                <span className="text-[9px] font-black text-m3-on-surface-variant uppercase tracking-widest opacity-50">{t.voxelLab.gpuBuffer}</span>
                <span className="text-sm font-black text-m3-secondary font-mono tracking-tighter">{telemetry.gpuMem}</span>
              </div>
           </div>
           
           <div className="flex gap-2">
             <div className="bg-m3-surface-container-high border border-m3-outline-variant rounded-2xl flex items-center p-1 shadow-m3-1">
                <button 
                  onClick={() => setExportFormat("obj")}
                  className={cn(
                    "px-3 py-1.5 rounded-xl text-[10px] font-black transition-all",
                    exportFormat === "obj" ? "bg-m3-primary text-m3-on-primary shadow-m3-2" : "text-m3-on-surface-variant hover:bg-m3-surface-variant"
                  )}
                >
                  OBJ
                </button>
                <button 
                  onClick={() => setExportFormat("stl")}
                  className={cn(
                    "px-3 py-1.5 rounded-xl text-[10px] font-black transition-all",
                    exportFormat === "stl" ? "bg-m3-primary text-m3-on-primary shadow-m3-2" : "text-m3-on-surface-variant hover:bg-m3-surface-variant"
                  )}
                >
                  STL
                </button>
             </div>

             {[
               { icon: Settings2, onClick: () => setShowSettings(!showSettings), title: t.voxelLab.settings, color: "text-m3-on-surface-variant" },
               { icon: FolderOpen, onClick: loadSession, title: t.voxelLab.openLocal, color: "text-m3-on-surface-variant" },
               { icon: Save, onClick: saveSession, title: t.voxelLab.saveLocal, color: "text-m3-on-surface-variant" }
             ].map((btn, i) => (
               <button 
                key={i}
                onClick={btn.onClick}
                className={cn(
                  "p-3.5 bg-m3-surface-container-high border border-m3-outline-variant rounded-2xl transition-all active:scale-90 shadow-m3-1 hover:border-m3-primary/50",
                  btn.color
                )}
                title={btn.title}
               >
                 <btn.icon className="w-5 h-5" />
               </button>
             ))}
           </div>

           <div className="relative group">
              <button 
                disabled={!data}
                onClick={handleExport}
                className="p-3.5 bg-m3-primary text-m3-on-primary rounded-2xl transition-all disabled:opacity-50 disabled:grayscale active:scale-95 shadow-m3-2 flex items-center gap-2 px-6"
              >
                <Download className="w-5 h-5" />
                <span className="text-[11px] font-black uppercase tracking-widest hidden sm:inline">{t.voxelLab.exportAs.replace('{format}', exportFormat.toUpperCase())}</span>
              </button>
              {data && (
                <div className="absolute right-0 top-full mt-3 w-56 p-2 bg-m3-surface-container-highest border border-m3-outline-variant rounded-[2rem] shadow-m3-4 opacity-0 group-hover:opacity-100 translate-y-2 group-hover:translate-y-0 transition-all pointer-events-none group-hover:pointer-events-auto z-50">
                   <button onClick={exportOBJ} className="w-full flex items-center gap-3 px-5 py-3 text-[11px] font-black text-m3-on-surface-variant hover:bg-m3-primary/10 hover:text-m3-primary transition-all rounded-xl">
                      <FileCode className="w-4 h-4" /> {t.voxelLab.exportMesh}
                   </button>
                   <button onClick={exportSTL} className="w-full flex items-center gap-3 px-5 py-3 text-[11px] font-black text-m3-on-surface-variant hover:bg-m3-secondary/10 hover:text-m3-secondary transition-all rounded-xl">
                      <BoxSelect className="w-4 h-4" /> {t.voxelLab.exportBinary}
                   </button>
                   <button onClick={saveToCloud} className="w-full flex items-center gap-3 px-5 py-3 text-[11px] font-black text-m3-on-surface-variant hover:bg-m3-primary/10 hover:text-m3-primary transition-all rounded-xl">
                      <Zap className="w-4 h-4" /> {t.voxelLab.archiveCloud}
                   </button>
                   <div className="h-px bg-m3-outline-variant my-1 px-4" />
                   <button onClick={() => toast.info(t.voxelLab.exportJson)} className="w-full flex items-center gap-3 px-5 py-3 text-[11px] font-black text-m3-on-surface-variant hover:bg-m3-tertiary/10 hover:text-m3-tertiary transition-all rounded-xl">
                      <FileJson className="w-4 h-4" /> {t.voxelLab.exportJson}
                   </button>
                </div>
              )}
           </div>
        </div>
      </div>

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-8 min-h-[600px] relative z-10">
        {/* Viewport Area */}
        <div className="lg:col-span-8 bg-black rounded-[3rem] border border-m3-outline-variant/30 overflow-hidden relative group shadow-m3-4">
          <Canvas shadows dpr={[1, 2]}>
            <Scene voxels={data?.voxels || []} wireframe={wireframe} />
          </Canvas>

          {/* Viewport Control Bar */}
          <div className="absolute top-8 right-8 flex flex-col gap-4">
             {[
               { icon: RotateCcw, onClick: undo, disabled: undoStack.length === 0, title: t.voxelLab.undo, color: "text-m3-on-surface-variant" },
               { icon: RotateCw, onClick: redo, disabled: redoStack.length === 0, title: t.voxelLab.redo, color: "text-m3-on-surface-variant" },
               { icon: Maximize, onClick: () => setWireframe(!wireframe), active: wireframe, title: t.voxelLab.wireframe, color: wireframe ? "bg-m3-primary text-m3-on-primary" : "text-m3-on-surface-variant" },
               { icon: Target, onClick: () => toast.info(t.voxelLab.inspect), title: t.voxelLab.inspect, color: "text-m3-on-surface-variant" }
             ].map((tool, i) => (
               <button 
                 key={i}
                 onClick={tool.onClick}
                 disabled={tool.disabled}
                 className={cn(
                   "p-3.5 rounded-2xl border backdrop-blur-2xl transition-all shadow-m3-2 active:scale-90 disabled:opacity-20",
                   tool.active ? "bg-m3-primary border-m3-primary shadow-m3-1" : "bg-m3-surface-container-low/60 border-m3-outline-variant hover:border-m3-primary/30",
                   tool.color
                 )}
                 title={tool.title}
               >
                 <tool.icon className="w-6 h-6" />
               </button>
             ))}
          </div>

          {/* Viewport HUD */}
          <div className="absolute top-8 left-8 pointer-events-none">
            <motion.div 
               initial={{ opacity: 0, x: -20 }}
               animate={{ opacity: 1, x: 0 }}
               className="p-8 bg-m3-surface-container-high/80 backdrop-blur-3xl border border-m3-outline-variant rounded-[2.5rem] space-y-6 min-w-[280px] shadow-m3-4"
            >
               <div className="flex items-center justify-between border-b border-m3-outline-variant/30 pb-4">
                 <div className="flex items-center gap-3">
                    <div className={cn("w-2.5 h-2.5 rounded-full shadow-m3-1 animate-pulse", telemetry.status === "READY" ? "bg-m3-primary" : "bg-m3-secondary")} />
                    <span className="text-[11px] font-black text-m3-on-surface-variant uppercase tracking-[0.25em]">{telemetry.status}</span>
                 </div>
                 <span className="text-[10px] font-mono text-m3-on-surface-variant/40 uppercase font-black">Link_Ativo</span>
               </div>
               
               <div className="space-y-2">
                 <div className="text-[10px] font-black text-m3-on-surface-variant uppercase tracking-widest opacity-40">{t.voxelLab.activeEntity}</div>
                 <div className="text-2xl font-black text-m3-on-surface truncate max-w-[220px] uppercase italic tracking-tighter leading-none">
                    {data?.name || "Null_Pointer"}
                 </div>
               </div>

               <div className="grid grid-cols-2 gap-8">
                 <div className="space-y-1">
                   <div className="text-[9px] font-black text-m3-on-surface-variant uppercase tracking-widest opacity-40">{t.voxelLab.polygons}</div>
                   <div className="text-base font-black text-m3-primary font-mono tracking-tighter">
                     {telemetry.triangles.toLocaleString()}
                   </div>
                 </div>
                 <div className="space-y-1">
                   <div className="text-[9px] font-black text-m3-on-surface-variant uppercase tracking-widest opacity-40">{t.voxelLab.latency}</div>
                   <div className="text-base font-black text-m3-secondary font-mono tracking-tighter">
                      {data?.stats.generationTime || 0}ms
                   </div>
                 </div>
               </div>

               <div className="pt-4 border-t border-m3-outline-variant/30">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-[9px] font-black text-m3-on-surface-variant uppercase tracking-widest opacity-40">{t.voxelLab.matrixLoad}</span>
                    <span className="text-[10px] font-black text-m3-primary">{(data?.voxels.length || 0) / 2.5}%</span>
                  </div>
                  <div className="h-2 bg-m3-surface-container rounded-full overflow-hidden shadow-inner p-0.5">
                     <motion.div 
                       initial={{ width: 0 }}
                       animate={{ width: `${Math.min(100, (data?.voxels.length || 0) / 2.5)}%` }}
                       className="h-full bg-m3-primary rounded-full shadow-m3-1"
                     />
                  </div>
               </div>
            </motion.div>
          </div>

          {!data && !isGenerating && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/40 backdrop-blur-[4px] pointer-events-none">
               <div className="p-10 bg-m3-surface-container/40 border border-m3-outline-variant rounded-[3rem] mb-6 relative shadow-m3-3">
                 <div className="absolute inset-0 border-2 border-m3-primary/20 rounded-[3rem] animate-ping opacity-30" />
                 <Box className="w-20 h-20 text-m3-on-surface-variant/20 animate-pulse" />
               </div>
               <div className="text-center space-y-2">
                 <p className="text-m3-on-surface-variant font-black text-xs uppercase tracking-[0.6em] opacity-40">{t.voxelLab.restMatrix}</p>
                 <p className="text-m3-primary/40 font-black text-[10px] uppercase tracking-widest">{t.voxelLab.waitingSync}</p>
               </div>
            </div>
          )}

          {isGenerating && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-m3-surface-container/90 backdrop-blur-2xl z-20">
               <div className="relative">
                 <div className="w-40 h-40 border-2 border-m3-primary/10 rounded-full animate-[spin_4s_linear_infinite]" />
                 <div className="absolute inset-0 border-t-4 border-m3-primary rounded-full animate-spin" />
                 <div className="absolute inset-6 border-r-4 border-m3-secondary rounded-full animate-[spin_2s_linear_infinite_reverse]" />
                 <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
                   <Cpu className="w-12 h-12 text-m3-primary animate-pulse" />
                 </div>
               </div>
               <div className="mt-12 flex flex-col items-center gap-3">
                 <p className="text-m3-primary font-black text-sm uppercase tracking-[0.5em] animate-pulse">{t.voxelLab.synthesizing}</p>
                 <span className="text-[10px] font-black text-m3-on-surface-variant/40 uppercase tracking-[0.2em]">{t.voxelLab.allocating}</span>
               </div>
            </div>
          )}
        </div>
        {/* Sidebar Controls */}
        <div className="lg:col-span-4 flex flex-col gap-6">
          {/* Prompt Entry */}
          <div className="p-2.5 bg-m3-surface-container-high border border-m3-outline-variant rounded-[2rem] flex items-center gap-3 focus-within:border-m3-primary/50 focus-within:shadow-m3-3 transition-all shadow-m3-2 group/input">
             <div className="pl-4">
               <Sparkles className="w-5 h-5 text-m3-primary opacity-40 group-focus-within/input:opacity-100 transition-opacity" />
             </div>
             <input 
               type="text" 
               placeholder={t.voxelLab.promptPlaceholder}
               className="flex-1 bg-transparent border-none outline-none py-4 text-sm text-m3-on-surface placeholder:text-m3-on-surface-variant/30 font-black uppercase tracking-tight"
               value={prompt}
               onChange={(e) => setPrompt(e.target.value)}
               onKeyDown={(e) => e.key === 'Enter' && generateVoxel()}
             />
             <button 
               onClick={generateVoxel}
               disabled={isGenerating || !prompt.trim()}
               className="p-5 bg-m3-primary text-m3-on-primary rounded-2xl hover:bg-m3-primary/90 disabled:opacity-50 disabled:grayscale transition-all active:scale-90 flex-shrink-0 shadow-m3-2"
             >
               <Play className="w-6 h-6 fill-current" />
             </button>
          </div>

          <div className="flex-1 bg-m3-surface-container-low border border-m3-outline-variant rounded-[3rem] flex flex-col overflow-hidden shadow-m3-3 relative group/sidebar">
             <div className="absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-m3-primary/5 to-transparent pointer-events-none" />
             
             <div className="flex border-b border-m3-outline-variant/30 p-4 gap-3 bg-m3-surface-container-low/40 backdrop-blur-xl relative z-10">
                {[
                  { id: "inspect", label: t.voxelLab.tabInspect, icon: Target },
                  { id: "history", label: t.voxelLab.tabHistory, icon: History },
                  { id: "layers", label: t.voxelLab.tabLayers, icon: Layers },
                  { id: "telemetry", label: t.voxelLab.tabTelemetry, icon: Activity }
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as any)}
                    className={cn(
                      "flex-1 flex flex-col items-center justify-center gap-2 py-4 rounded-2xl transition-all font-black text-[9px] uppercase tracking-widest",
                      activeTab === tab.id ? "bg-m3-primary-container text-m3-on-primary-container shadow-m3-1" : "text-m3-on-surface-variant/40 hover:text-m3-on-surface-variant hover:bg-m3-surface-container-high/40"
                    )}
                  >
                    <tab.icon className={cn("w-5 h-5", activeTab === tab.id ? "text-m3-primary" : "text-m3-on-surface-variant/40")} />
                    <span className="hidden xl:inline">{tab.label}</span>
                  </button>
                ))}
             </div>

             <div className="flex-1 overflow-y-auto p-8 custom-scrollbar relative z-10">                <AnimatePresence mode="wait">
                   {activeTab === "inspect" && (
                     <motion.div 
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="space-y-8"
                     >
                        {data ? (
                          <>
                            <div className="space-y-4 pb-10 border-b border-m3-outline-variant/30">
                               <div className="flex items-center justify-between">
                                 <h3 className="text-m3-on-surface font-black uppercase italic tracking-tighter text-3xl">{data.name}</h3>
                                 <div className="px-3 py-1 bg-m3-primary/10 border border-m3-primary/20 rounded-full text-m3-primary text-[10px] font-black uppercase tracking-widest shadow-m3-1">{t.voxelLab.verified}</div>
                               </div>
                               <p className="text-m3-on-surface-variant/70 text-sm leading-relaxed font-bold italic">"{data.description}"</p>
                            </div>
                            
                            <div className="grid grid-cols-2 gap-5">
                               {[
                                 { label: "Escala_X", val: data.stats.dimensions[0], color: "text-m3-primary", bg: "bg-m3-primary/5" },
                                 { label: "Escala_Y", val: data.stats.dimensions[1], color: "text-m3-secondary", bg: "bg-m3-secondary/5" },
                                 { label: "Escala_Z", val: data.stats.dimensions[2], color: "text-m3-tertiary", bg: "bg-m3-tertiary/5" },
                                 { label: t.voxelLab.fillRate, val: `${((data.stats.totalBlocks / (data.stats.dimensions[0] * data.stats.dimensions[1] * data.stats.dimensions[2] || 1)) * 100).toFixed(1)}%`, color: "text-m3-primary", bg: "bg-m3-primary/5" }
                               ].map((stat, i) => (
                                 <div key={i} className={cn("p-6 border border-m3-outline-variant/30 rounded-[2rem] hover:shadow-m3-2 transition-all group", stat.bg)}>
                                    <div className="text-[10px] font-black text-m3-on-surface-variant/40 uppercase mb-3 flex justify-between">
                                       <span>{stat.label}</span>
                                       <ChevronRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                                    </div>
                                    <div className={cn("text-3xl font-black italic", stat.color)}>{stat.val}</div>
                                 </div>
                               ))}
                            </div>

                            <div className="p-8 bg-m3-surface-container-high/40 border border-m3-outline-variant rounded-[2.5rem] space-y-6 shadow-m3-2">
                               <div className="flex items-center gap-3">
                                 <BarChart3 className="w-5 h-5 text-m3-secondary" />
                                 <span className="text-[11px] font-black text-m3-on-surface-variant uppercase tracking-[0.2em] opacity-60">{t.voxelLab.integrityReport}</span>
                               </div>
                               <div className="space-y-5">
                                  <div className="flex justify-between items-center text-xs">
                                     <span className="text-m3-on-surface-variant font-black uppercase opacity-40">{t.voxelLab.complexity}</span>
                                     <span className="text-m3-on-surface font-black uppercase tracking-widest">Procedural_Ops</span>
                                  </div>
                                  <div className="flex justify-between items-center text-xs">
                                     <span className="text-m3-on-surface-variant font-black uppercase opacity-40">{t.voxelLab.meshStatus}</span>
                                     <span className="text-m3-primary font-black uppercase tracking-widest">{t.voxelLab.nominal}</span>
                                  </div>
                               </div>
                            </div>
                          </>
                        ) : (
                          <div className="h-80 flex flex-col items-center justify-center text-center space-y-8 opacity-20 group-hover/sidebar:opacity-40 transition-opacity">
                             <div className="p-10 bg-m3-surface-container-high border border-m3-outline-variant rounded-[3rem] shadow-m3-1">
                               <Target className="w-20 h-20" />
                             </div>
                             <p className="text-[11px] font-black uppercase tracking-[0.5em] max-w-[240px] leading-relaxed">{t.voxelLab.emptySelection}</p>
                          </div>
                        )}
                     </motion.div>
                   )}
}

                         <motion.div 
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        className="space-y-4"
                      >
                         <h4 className="text-[10px] font-mono text-neutral-600 font-black uppercase tracking-widest flex items-center gap-2 mb-4">
                           <History className="w-4 h-4" />
                           {t.voxelLab.snapshotLogs}
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
                                        {h.stats.totalBlocks} {t.voxelLab.totalBlocks} • {h.stats.generationTime || 0}ms
                                      </div>
                                   </div>
                                </div>
                                <div className={cn("w-2 h-2 rounded-full transition-all", data?.name === h.name ? "bg-emerald-500 animate-pulse" : "bg-neutral-800")} />
                              </button>
                            ))}
                            {history.length === 0 && (
                              <div className="text-[10px] font-mono text-neutral-700 uppercase p-12 border border-dashed border-neutral-800 rounded-3xl text-center space-y-4">
                                 <Database className="w-10 h-10 mx-auto opacity-20" />
                                 <p className="tracking-widest">{t.voxelLab.cacheEmpty}</p>
                              </div>
                            )}
                         </div>

                         <div className="mt-8 space-y-4">
                            <h4 className="text-[10px] font-mono text-neutral-600 font-black uppercase tracking-widest flex items-center gap-2 mb-4">
                              <Sparkles className="w-4 h-4" />
                              {t.voxelLab.structuralTemplates}
                            </h4>
                            <div className="grid grid-cols-1 gap-2">
                               {voxelTemplates.map((tm, i) => {
                                 const name = t.voxelLab[tm.nameKey as keyof typeof t.voxelLab] as string;
                                 const p = t.voxelLab[tm.promptKey as keyof typeof t.voxelLab] as string;
                                 return (
                                   <button
                                     key={i}
                                     onClick={() => applyTemplate(name, p, { c: tm.c, d: tm.d, v: tm.v })}
                                     className="flex items-center justify-between p-4 bg-m3-surface-container-low border border-m3-outline-variant rounded-2xl hover:bg-m3-surface-container transition-all group"
                                   >
                                     <div className="flex flex-col items-start gap-1">
                                        <span className="text-[10px] font-black uppercase text-m3-on-surface-variant group-hover:text-m3-primary transition-colors">{name}</span>
                                        <span className="text-[9px] text-m3-on-surface-variant/40 truncate max-w-[150px]">{p}</span>
                                     </div>
                                     <ChevronRight className="w-4 h-4 text-m3-on-surface-variant/20 group-hover:text-m3-primary group-hover:translate-x-1 transition-all" />
                                   </button>
                                 );
                            })}
                         </div>
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
                             { name: t.voxelLab.layerBase, color: "text-emerald-500" },
                             { name: t.voxelLab.layerPrimary, color: "text-sky-500" },
                             { name: t.voxelLab.layerEffects, color: "text-amber-500" },
                             { name: t.voxelLab.layerParticles, color: "text-violet-500" }
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
                <div className="p-10 space-y-8 h-[450px] overflow-y-auto custom-scrollbar">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                       <div className="p-6 bg-m3-surface-container-low border border-m3-outline-variant rounded-[2rem] space-y-4 relative group hover:border-m3-primary/30 transition-all shadow-m3-2">
                          <label className="text-[10px] font-mono text-neutral-400 uppercase font-black tracking-widest flex items-center gap-2">
                            <div className="w-1 h-1 bg-sky-500 rounded-full" />
                            Complexidade_Estrutural
                            <div className="group-hover:opacity-100 opacity-0 transition-opacity ml-auto">
                              <span title="Define o nível de detalhamento e subdivisões da malha voxel.">
                                <Info className="w-3.5 h-3.5 text-m3-primary" />
                              </span>
                            </div>
                          </label>
                          <input 
                            type="range" 
                            min="10" max="100" 
                            value={complexity} 
                            onChange={(e) => setComplexity(Number(e.target.value))}
                            className="w-full h-1.5 bg-neutral-900 rounded-full appearance-none cursor-pointer accent-m3-primary" 
                          />
                          <div className="flex justify-between text-[9px] font-mono text-neutral-600">
                            <span>MÍNIMA</span>
                            <span className="text-m3-primary font-black">{complexity}%</span>
                            <span>MÁXIMA</span>
                          </div>
                       </div>

                       <div className="p-6 bg-m3-surface-container-low border border-m3-outline-variant rounded-[2rem] space-y-4 relative group hover:border-m3-secondary/30 transition-all shadow-m3-2">
                          <label className="text-[10px] font-mono text-neutral-400 uppercase font-black tracking-widest flex items-center gap-2">
                            <div className="w-1 h-1 bg-emerald-500 rounded-full" />
                            Densidade_Material
                            <div className="group-hover:opacity-100 opacity-0 transition-opacity ml-auto">
                              <span title="Controla a solidez e o preenchimento interno da estrutura.">
                                <Info className="w-3.5 h-3.5 text-m3-secondary" />
                              </span>
                            </div>
                          </label>
                          <input 
                            type="range" 
                            min="10" max="100" 
                            value={density} 
                            onChange={(e) => setDensity(Number(e.target.value))}
                            className="w-full h-1.5 bg-neutral-900 rounded-full appearance-none cursor-pointer accent-m3-secondary" 
                          />
                          <div className="flex justify-between text-[9px] font-mono text-neutral-600">
                            <span>ESPARSO</span>
                            <span className="text-m3-secondary font-black">{density}%</span>
                            <span>SÓLIDO</span>
                          </div>
                       </div>

                       <div className="p-6 bg-m3-surface-container-low border border-m3-outline-variant rounded-[2rem] space-y-4 relative group hover:border-m3-tertiary/30 transition-all shadow-m3-2 lg:col-span-2">
                          <label className="text-[10px] font-mono text-neutral-400 uppercase font-black tracking-widest flex items-center gap-2">
                            <div className="w-1 h-1 bg-amber-500 rounded-full" />
                            Verticalidade_Link
                            <div className="group-hover:opacity-100 opacity-0 transition-opacity ml-auto">
                              <span title="Aumenta a ênfase em estruturas verticais e torres.">
                                <Info className="w-3.5 h-3.5 text-m3-tertiary" />
                              </span>
                            </div>
                          </label>
                          <input 
                            type="range" 
                            min="0" max="100" 
                            value={verticality} 
                            onChange={(e) => setVerticality(Number(e.target.value))}
                            className="w-full h-1.5 bg-neutral-900 rounded-full appearance-none cursor-pointer accent-m3-tertiary" 
                          />
                          <div className="flex justify-between text-[9px] font-mono text-neutral-600">
                            <span>HORIZONTAL</span>
                            <span className="text-m3-tertiary font-black">{verticality}%</span>
                            <span>VERTICAIS</span>
                          </div>
                       </div>
                    </div>

                    <div className="grid grid-cols-2 gap-8 pt-6">
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
