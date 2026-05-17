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

// Lazy loading heavy generator components for performance optimization
const MapGenerator = lazy(() => import("./components/MapGenerator"));
const ModGenerator = lazy(() => import("./components/ModGenerator"));
const TextureGenerator = lazy(() => import("./components/TextureGenerator"));
const SkinGenerator = lazy(() => import("./components/SkinGenerator"));
const StorytellerGenerator = lazy(() => import("./components/StorytellerGenerator"));
const Integrations = lazy(() => import("./components/Integrations"));
const CloudVault = lazy(() => import("./components/CloudVault"));
const MatrixSettings = lazy(() => import("./components/MatrixSettings"));

export type ViewState = "dashboard" | "map" | "mod" | "texture" | "skin" | "storyteller" | "integrations" | "vault" | "settings";

export default function App() {
  const [currentView, setCurrentView] = useState<ViewState>("dashboard");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [telemetry, setTelemetry] = useState({ cpu: 42, load: 22 });

  useEffect(() => {
    const interval = setInterval(() => {
      setTelemetry(prev => ({
        ...prev,
        cpu: 40 + Math.floor(Math.random() * 5),
        load: 18 + Math.floor(Math.random() * 8)
      }));
    }, 15000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const handleNavigation = (e: any) => {
      if (e.detail) {
        setCurrentView(e.detail as ViewState);
      }
    };
    
    const handleVoiceReady = () => {
      console.log("[Matrix Stream] VOICE_RECOGNITION_READY event received.");
      setTelemetry(prev => ({ ...prev, voiceActive: true }));
    };

    window.addEventListener('matrix-navigate', handleNavigation);
    window.addEventListener('VOICE_RECOGNITION_READY', handleVoiceReady);

    return () => {
      window.removeEventListener('matrix-navigate', handleNavigation);
      window.removeEventListener('VOICE_RECOGNITION_READY', handleVoiceReady);
    };
  }, []);

  // Lazy loading fallback skeleton
  const LoadingFallback = () => (
    <div className="flex h-full w-full items-center justify-center text-neutral-500 font-mono text-sm animate-pulse">
      [ CARREGANDO MÓDULO NEURAL... ]
    </div>
  );

  return (
    <AuthProvider>
      <div className="flex h-screen bg-neutral-950 text-neutral-50 overflow-hidden font-sans selection:bg-emerald-500/30 matrix-bg">
        <Toaster theme="dark" position="bottom-right" />
        <Sidebar
          isOpen={sidebarOpen}
          setIsOpen={setSidebarOpen}
          currentView={currentView}
          setCurrentView={setCurrentView}
        />
        <main className="flex-1 overflow-y-auto relative">
        <header className="sticky top-0 z-10 flex h-16 items-center px-6 bg-neutral-950/80 backdrop-blur-md border-b border-neutral-900 justify-between">
          <div className="flex items-center">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-2 -ml-2 rounded-lg hover:bg-neutral-800 transition-colors"
            >
              <Menu className="w-5 h-5 text-neutral-500" />
            </button>
            <div className="ml-6 flex flex-col">
              <div className="font-mono text-[10px] font-bold tracking-[0.3em] uppercase text-neutral-600 mb-0.5 leading-none">Matrix_View</div>
              <div className="font-mono text-xs font-bold text-emerald-500 uppercase tracking-widest">{currentView}</div>
            </div>
          </div>

          <div className="hidden md:flex items-center gap-8 font-mono text-[9px] font-bold text-neutral-600 uppercase tracking-widest">
             <div className="flex flex-col items-end">
                <span className="text-neutral-700">CPU_Core_Temp</span>
                <span className="text-emerald-500">{telemetry.cpu}°C [STABLE]</span>
             </div>
             <div className="flex flex-col items-end">
                <span className="text-neutral-700">Neural_Load</span>
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
              {currentView === "integrations" && <Integrations />}
              {currentView === "vault" && <CloudVault />}
              {currentView === "settings" && <MatrixSettings />}
            </Suspense>
          </ErrorBoundary>
        </div>
      </main>
      <SystemStatus />
      </div>
    </AuthProvider>
  );
}
