import React, { useState, useEffect, Suspense, lazy } from "react";
import {
  MapIcon,
  Pickaxe,
  Palette,
  Terminal,
  Settings,
  Menu,
} from "lucide-react";
import { Toaster } from 'sonner';
import Sidebar from "./components/Sidebar";
import Dashboard from "./components/Dashboard";
import ErrorBoundary from "./components/ErrorBoundary";
import SystemStatus from "./components/SystemStatus";
import { AuthProvider } from "./lib/firebase";
import { cn } from "./lib/utils";

// Lazy loading heavy generator components for performance optimization
const MapGenerator = lazy(() => import("./components/MapGenerator"));
const ModGenerator = lazy(() => import("./components/ModGenerator"));
const TextureGenerator = lazy(() => import("./components/TextureGenerator"));
const SkinGenerator = lazy(() => import("./components/SkinGenerator"));
const StorytellerGenerator = lazy(() => import("./components/StorytellerGenerator"));
const Integrations = lazy(() => import("./components/Integrations"));
const CloudVault = lazy(() => import("./components/CloudVault"));
const SystemSettings = lazy(() => import("./components/SystemSettings"));
const ScriptHub = lazy(() => import("./components/ScriptHub"));
const VoxelLab = lazy(() => import("./components/VoxelLab"));

export type ViewState = "dashboard" | "map" | "mod" | "texture" | "skin" | "storyteller" | "scripthub" | "integrations" | "vault" | "settings" | "voxellab";

export default function App() {
  const [currentView, setCurrentView] = useState<ViewState>("dashboard");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [telemetry, setTelemetry] = useState({ cpu: 42, load: 22 });

  useEffect(() => {
    // Initial state based on screen size
    const isDesktop = window.innerWidth >= 1024;
    setSidebarOpen(isDesktop);

    const handleResize = () => {
      if (window.innerWidth >= 1024) {
        setSidebarOpen(true);
      } else if (window.innerWidth < 768) {
        setSidebarOpen(false);
      }
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    const fetchTelemetry = async () => {
      try {
        const res = await fetch("/api/health");
        const data = await res.json();
        
        let memoryLoad = 0;
        let cpuLoad = 0;
        
        if (data.memory) {
          memoryLoad = parseInt(data.memory.load);
          if (data.memory.system) {
             cpuLoad = data.memory.system.cpuLoad;
          }
        }
        
        setTelemetry(prev => ({
          ...prev,
          cpu: cpuLoad || (40 + Math.floor(Math.random() * 5)),
          load: memoryLoad
        }));
      } catch (err) {
        setTelemetry(prev => ({
          ...prev,
          cpu: 40,
          load: 0
        }));
      }
    };
    
    fetchTelemetry();
    const interval = setInterval(fetchTelemetry, 15000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const handleNavigation = (e: any) => {
      if (e.detail) {
        setCurrentView(e.detail as ViewState);
      }
    };
    
    const handleVoiceReady = () => {
      console.log("[Service Stream] VOICE_RECOGNITION_READY event received.");
      setTelemetry(prev => ({ ...prev, voiceActive: true }));
    };

    window.addEventListener('sys-navigate', handleNavigation);
    window.addEventListener('VOICE_RECOGNITION_READY', handleVoiceReady);

    return () => {
      window.removeEventListener('sys-navigate', handleNavigation);
      window.removeEventListener('VOICE_RECOGNITION_READY', handleVoiceReady);
    };
  }, []);

  // Lazy loading fallback skeleton
  const LoadingFallback = () => (
    <div className="flex h-full w-full items-center justify-center text-neutral-500 font-mono text-sm animate-pulse">
      [ CARREGANDO MÓDULO DE EXECUÇÃO... ]
    </div>
  );

  return (
    <AuthProvider>
      <div className="flex flex-col h-screen bg-neutral-950 overflow-hidden font-sans selection:bg-emerald-500/30 industrial-bg">
        {/* Desktop Title Bar (Chromium Shell Simulation) */}
        <div className="h-8 bg-black border-b border-white/5 flex items-center justify-between px-4 z-50 shrink-0 select-none">
          <div className="flex items-center gap-4">
            <div className="flex gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-red-500/20 border border-red-500/40 hover:bg-red-500 transition-colors" />
              <div className="w-2.5 h-2.5 rounded-full bg-amber-500/20 border border-amber-500/40 hover:bg-amber-500 transition-colors" />
              <div className="w-2.5 h-2.5 rounded-full bg-emerald-500/20 border border-emerald-500/40 hover:bg-emerald-500 transition-colors" />
            </div>
            <div className="h-3 w-px bg-neutral-800" />
            <span className="text-[10px] font-black uppercase tracking-[0.3em] text-neutral-600">Industrial Solutions Builder Core</span>
          </div>
          <div className="flex items-center gap-5 text-[9px] font-bold text-neutral-600 uppercase tracking-[0.2em]">
            <div className="flex items-center gap-1.5 px-2 py-0.5 bg-neutral-900 rounded border border-neutral-800">
               <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_5px_rgba(16,185,129,1)]" />
               <span className="text-emerald-500/80">SANDBOX_VM_ACTIVE</span>
            </div>
            <span className="hover:text-emerald-500 transition-colors cursor-default">File</span>
            <span className="hover:text-emerald-500 transition-colors cursor-default">Processor</span>
            <span className="hover:text-emerald-500 transition-colors cursor-default underline decoration-emerald-500/30 underline-offset-4">Sys_Dev</span>
          </div>
        </div>

        <div className="flex flex-1 overflow-hidden relative">
          <Toaster theme="dark" position="bottom-right" />
          <Sidebar
            isOpen={sidebarOpen}
            setIsOpen={setSidebarOpen}
            currentView={currentView}
            setCurrentView={setCurrentView}
          />
        <main className="flex-1 overflow-y-auto relative">
        <header className="sticky top-0 z-40 flex h-20 items-center px-4 md:px-8 bg-neutral-950/50 backdrop-blur-xl border-b border-neutral-900/50 justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className={cn(
                "p-2.5 rounded-xl transition-all active:scale-90 group relative overflow-hidden",
                sidebarOpen ? "bg-emerald-500/10 text-emerald-500" : "bg-neutral-900 text-neutral-400 hover:text-white"
              )}
              aria-label="Toggle Menu"
            >
              <Menu className={cn("w-6 h-6 transition-transform duration-500", sidebarOpen && "rotate-180")} />
              {/* Pulse effect when closed on mobile */}
              {!sidebarOpen && (
                <div className="absolute inset-0 border border-emerald-500/20 rounded-xl animate-pulse md:hidden" />
              )}
            </button>
            <div className="flex flex-col">
              <div className="font-mono text-[9px] font-black tracking-[0.4em] uppercase text-neutral-700 mb-0.5 leading-none">Solutions_Builder</div>
              <div className="font-mono text-sm font-black text-emerald-500 uppercase tracking-widest drop-shadow-[0_0_8px_rgba(16,185,129,0.4)]">
                {currentView}
              </div>
            </div>
          </div>

          <div className="hidden md:flex items-center gap-8 font-mono text-[9px] font-bold text-neutral-600 uppercase tracking-widest">
             <div className="flex flex-col items-end">
                <span className="text-neutral-700">CPU_Core_Temp</span>
                <span className="text-emerald-500">{telemetry.cpu}°C [STABLE]</span>
             </div>
             <div className="flex flex-col items-end">
                <span className="text-neutral-700">Process_Load</span>
                <span className="text-sky-500">{telemetry.load}% [NOMINAL]</span>
             </div>
             <div className="flex flex-col items-end">
                <span className="text-neutral-700">Uptime_Link</span>
                <span className="text-amber-500">99.99%</span>
             </div>
          </div>
        </header>
        <div className="p-6 md:p-10 max-w-7xl mx-auto h-full">
          <ErrorBoundary>
            <Suspense fallback={<LoadingFallback />}>
              {currentView === "dashboard" && <Dashboard setCurrentView={setCurrentView} />}
              {currentView === "map" && <MapGenerator />}
              {currentView === "mod" && <ModGenerator />}
              {currentView === "texture" && <TextureGenerator />}
              {currentView === "skin" && <SkinGenerator />}
              {currentView === "storyteller" && <StorytellerGenerator />}
              {currentView === "voxellab" && <VoxelLab />}
              {currentView === "scripthub" && <ScriptHub />}
              {currentView === "integrations" && <Integrations />}
              {currentView === "vault" && <CloudVault />}
              {currentView === "settings" && <SystemSettings />}
            </Suspense>
          </ErrorBoundary>
        </div>
      </main>
      <SystemStatus />
      </div>
     </div>
    </AuthProvider>
  );
}
