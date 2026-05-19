import React, { useEffect, useRef, useCallback, useState } from 'react';
import * as skinview3d from 'skinview3d';
import { toast } from 'sonner';
import { cn } from '../lib/utils';
import { RotateCcw, Play, Pause, ZoomIn, ZoomOut, RefreshCw, MoveHorizontal } from 'lucide-react';

interface SkinViewer3DProps {
  skinUrl: string;
  modelType?: 'classic' | 'slim';
  autoRotate?: boolean;
  capeUrl?: string;
  earsUrl?: string;
}

export default function SkinViewer3D({ 
  skinUrl, 
  modelType = 'classic', 
  autoRotate: initialAutoRotate = true,
  capeUrl,
  earsUrl
}: SkinViewer3DProps) {
  const viewerContainer = useRef<HTMLDivElement>(null);
  const mountPoint = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<skinview3d.SkinViewer | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAutoRotating, setIsAutoRotating] = useState(initialAutoRotate);
  const [zoomLevel, setZoomLevel] = useState(70);

  // Memoized dispose for safety
  const safeDispose = useCallback(() => {
    try {
      if (viewerRef.current) {
        viewerRef.current.dispose();
        viewerRef.current = null;
      }
      if (mountPoint.current) {
        mountPoint.current.innerHTML = '';
      }
    } catch (e) {
      console.warn("Disposal failed:", e);
    }
  }, []);

  // Initialize Viewer
  useEffect(() => {
    if (!mountPoint.current) return;

    setIsLoading(true);
    setError(null);

    let viewer: skinview3d.SkinViewer | null = null;

    try {
      // Initialize with absolute precision and proper mount target
      viewer = new skinview3d.SkinViewer({
        canvas: document.createElement('canvas'),
        width: mountPoint.current.clientWidth || 300,
        height: mountPoint.current.clientHeight || 400,
      });

      // Configure viewer optics
      viewer.autoRotate = isAutoRotating;
      viewer.animation = new skinview3d.WalkingAnimation();
      viewer.animation.paused = !isAutoRotating;
      viewer.fov = zoomLevel;

      // Interaction Configuration
      viewer.controls.enableRotate = true;
      viewer.controls.enableZoom = true;
      viewer.controls.enablePan = false; 
      
      // Load initial texture buffer
      if (skinUrl) {
        const loadOptions: any = { 
          model: modelType === 'classic' ? 'default' : 'slim' 
        };
        
        const loadPromises: Promise<any>[] = [
          viewer.loadSkin(skinUrl, loadOptions)
        ];

        if (capeUrl) {
          loadPromises.push(viewer.loadCape(capeUrl));
        }

        Promise.all(loadPromises).then(() => {
          setIsLoading(false);
        }).catch(err => {
          console.error("Critical: Assets load failed", err);
          setError("Failed to synch engine assets");
          setIsLoading(false);
        });
      } else {
        setIsLoading(false);
      }

      viewerRef.current = viewer;
      mountPoint.current.appendChild(viewer.canvas);

      // Sincronizar zoom do scroll com o estado do React
      viewer.controls.addEventListener('change', () => {
        if (viewerRef.current) {
          const currentFov = viewerRef.current.fov;
          // Debounced or simple sync
          setZoomLevel(Math.round(currentFov));
        }
      });

      const resizeObserver = new ResizeObserver((entries) => {
        if (entries.length > 0 && viewerRef.current && mountPoint.current) {
          const { width, height } = entries[0].contentRect;
          if (width > 0 && height > 0) {
            viewerRef.current.setSize(width, height);
          }
        }
      });

      resizeObserver.observe(mountPoint.current);

      return () => {
        resizeObserver.disconnect();
        safeDispose();
      };
    } catch (err) {
      console.error("Viewer Initialization Fault:", err);
      setError("Viewer init failure");
      setIsLoading(false);
      return safeDispose;
    }
  }, []);

  // Dynamic state syncing for textures
  useEffect(() => {
    if (viewerRef.current) {
      setIsLoading(true);
      
      const loadPromises: Promise<any>[] = [];
      
      if (skinUrl) {
        loadPromises.push(viewerRef.current.loadSkin(skinUrl, { 
          model: modelType === 'classic' ? 'default' : 'slim' 
        }));
      }

      if (capeUrl) {
        loadPromises.push(viewerRef.current.loadCape(capeUrl));
      } else {
        viewerRef.current.loadCape(null as any);
      }

      Promise.all(loadPromises)
      .then(() => setIsLoading(false))
      .catch(err => {
        console.error("Hot-swap error:", err);
        setError("Update transmission failure");
        setIsLoading(false);
      });
    }
  }, [skinUrl, modelType, capeUrl]);

  // Interaction State Sync
  useEffect(() => {
    if (viewerRef.current) {
      viewerRef.current.autoRotate = isAutoRotating;
      if (viewerRef.current.animation) {
        viewerRef.current.animation.paused = !isAutoRotating;
        if (isAutoRotating) {
          viewerRef.current.animation.speed = 1.0;
        }
      }
    }
  }, [isAutoRotating]);

  useEffect(() => {
    if (viewerRef.current) {
      viewerRef.current.fov = zoomLevel;
    }
  }, [zoomLevel]);

  const handleResetCamera = () => {
    if (viewerRef.current) {
      viewerRef.current.controls.reset();
      // Synchronize FOV back to default
      const defaultFov = 70;
      viewerRef.current.fov = defaultFov;
      setZoomLevel(defaultFov);
      toast.info("Camera Reset", { 
        description: "Orientação e zoom restaurados para o padrão industrial.",
        icon: <RotateCcw className="w-3 h-3 text-sky-400" />
      });
    }
  };

  const handleZoom = (delta: number) => {
    setZoomLevel(prev => {
      const next = Math.min(110, Math.max(20, prev + delta));
      if (viewerRef.current) {
        viewerRef.current.fov = next;
      }
      return next;
    });
  };

  const toggleAutoRotate = () => {
    setIsAutoRotating(prev => !prev);
    toast.success(isAutoRotating ? "Auto-Rotate Paused" : "Auto-Rotate Active", {
      description: isAutoRotating ? "Controle manual habilitado." : "Iniciando giro orbital sistêmico.",
      duration: 1500
    });
  };

  return (
    <div 
      ref={viewerContainer} 
      className="w-full h-[400px] md:h-[500px] overflow-hidden rounded-2xl border border-neutral-800 bg-neutral-950/50 relative group shadow-[inset_0_0_50px_rgba(0,0,0,0.5)]"
    >
      {/* HUD Layers */}
      <div className="absolute inset-x-0 top-0 p-5 flex justify-between items-start pointer-events-none z-20">
        <div className="flex flex-col gap-1.5 pointer-events-auto">
          <div className="flex items-center gap-2.5 bg-black/40 backdrop-blur-md px-3 py-1.5 rounded-lg border border-white/5">
            <div className={cn("w-2 h-2 rounded-full shadow-[0_0_10px_rgba(16,185,129,0.5)]", isLoading ? "bg-amber-500 animate-pulse" : "bg-emerald-500")} />
            <span className="text-[9px] font-mono font-bold text-neutral-300 uppercase tracking-[0.2em]">
              Core_System::{isLoading ? "Synchronizing" : "Operational"}
            </span>
          </div>
          {error && (
            <div className="bg-red-500/20 border border-red-500/40 px-3 py-1.5 rounded-lg text-[8px] text-red-400 font-mono uppercase tracking-widest backdrop-blur-md">
              Critical_Fail: {error}
            </div>
          )}
        </div>
        
        <div className="flex flex-col items-end gap-1.5">
           <div className="bg-black/40 backdrop-blur-md px-3 py-1.5 rounded-lg border border-white/5 flex flex-col items-end gap-0.5">
             <span className="text-[8px] font-mono font-bold text-neutral-500 uppercase tracking-widest">Physics_Engine: {modelType.toUpperCase()}</span>
             <span className="text-[8px] font-mono font-bold text-neutral-500 uppercase tracking-widest">Telemetry: {isAutoRotating ? "DYNAMIC" : "STATIC"}</span>
           </div>
        </div>
      </div>

      {/* Manual Controls Overlay */}
      <div className="absolute bottom-5 right-5 flex flex-col items-center gap-2 z-30 pointer-events-auto">
        <div className="flex flex-col gap-1 p-1 bg-black/60 backdrop-blur-xl border border-white/10 rounded-xl shadow-2xl">
          <button 
            onClick={() => handleZoom(-10)} 
            className="p-2 hover:bg-white/10 rounded-lg transition-colors text-neutral-400 hover:text-white"
            title="Zoom In"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          <button 
            onClick={() => handleZoom(10)} 
            className="p-2 hover:bg-white/10 rounded-lg transition-colors text-neutral-400 hover:text-white"
            title="Zoom Out"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <div className="h-px bg-white/5 mx-1" />
          <button 
            onClick={handleResetCamera} 
            className="p-2 hover:bg-white/10 rounded-lg transition-colors text-neutral-400 hover:text-white"
            title="Reset Camera"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>

        <button 
          onClick={toggleAutoRotate}
          className={cn(
            "p-3 rounded-xl transition-all shadow-2xl flex items-center justify-center border",
            isAutoRotating 
              ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-400" 
              : "bg-neutral-800/80 border-white/5 text-neutral-400 hover:text-white"
          )}
          title={isAutoRotating ? "Pause Rotation" : "Play Rotation"}
        >
          {isAutoRotating ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current ml-0.5" />}
        </button>
      </div>

      {/* Interaction Help */}
      <div className="absolute bottom-5 left-5 flex items-center gap-3 z-20 pointer-events-none opacity-40">
        <div className="flex items-center gap-2 text-[8px] font-mono font-bold text-neutral-500 uppercase tracking-widest bg-black/40 backdrop-blur-sm px-3 py-1.5 rounded-lg border border-white/5">
          <MoveHorizontal className="w-3 h-3" /> Drag to Rotate
        </div>
        <div className="flex items-center gap-2 text-[8px] font-mono font-bold text-neutral-500 uppercase tracking-widest bg-black/40 backdrop-blur-sm px-3 py-1.5 rounded-lg border border-white/5">
          <RefreshCw className="w-3 h-3" /> Scroll to Zoom
        </div>
      </div>

      {/* Canvas Mount Point */}
      <div 
        ref={mountPoint}
        className="absolute inset-0 flex items-center justify-center opacity-90 group-hover:opacity-100 transition-opacity duration-700 cursor-move"
      >
         {/* The canvas is injected here */}
      </div>

      {/* Grid Pattern Overlay */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(16,185,129,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(16,185,129,0.05)_1px,transparent_1px)] bg-[size:30px_30px] pointer-events-none opacity-40 mix-blend-overlay" />
      
      {isLoading && !error && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-[2px] z-30">
          <div className="flex flex-col items-center gap-6">
            <div className="w-16 h-16 border-2 border-emerald-500/10 border-t-emerald-500 rounded-full animate-spin shadow-[0_0_30px_rgba(16,185,129,0.2)]" />
            <div className="flex flex-col items-center gap-1">
              <span className="text-[10px] font-mono text-emerald-500/80 uppercase tracking-[0.5em] font-black animate-pulse">Loading_Model</span>
              <div className="w-32 h-0.5 bg-neutral-800 rounded-full overflow-hidden">
                <div className="h-full bg-emerald-500 w-full animate-pulse opacity-50" />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Vignette & Finishing */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,rgba(0,0,0,0.6)_100%)] pointer-events-none z-10" />
    </div>
  );
}
