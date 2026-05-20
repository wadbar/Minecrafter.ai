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
import CommandPalette from "./components/CommandPalette";
import ErrorBoundary from "./components/ErrorBoundary";
import SystemStatus from "./components/SystemStatus";
import { AuthProvider } from "./lib/firebase";
import { ThemeProvider, useTheme } from "./context/ThemeContext";
import { LanguageProvider, useTranslation } from "./context/LanguageContext";
import { cn } from "./lib/utils";
import { Moon, Sun, Languages } from "lucide-react";

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

function AppContent() {
  const [currentView, setCurrentView] = useState<ViewState>("dashboard");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [telemetry, setTelemetry] = useState({ cpu: 42, load: 22 });
  const { theme, toggleTheme } = useTheme();
  const { t, language, setLanguage } = useTranslation();

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

    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setCommandPaletteOpen(prev => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('sys-navigate', handleNavigation);
      window.removeEventListener('VOICE_RECOGNITION_READY', handleVoiceReady);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  // Lazy loading fallback skeleton
  const LoadingFallback = () => (
    <div className="flex h-full w-full items-center justify-center text-m3-on-surface-variant font-mono text-sm animate-pulse">
      {t.common.loadingModule}
    </div>
  );

  return (
    <div className="flex flex-col h-screen bg-m3-background text-m3-on-background overflow-hidden font-sans selection:bg-m3-primary/30">
      <CommandPalette 
        isOpen={commandPaletteOpen} 
        onClose={() => setCommandPaletteOpen(false)} 
        onNavigate={setCurrentView} 
      />
      
      {/* M3 Header / Title Bar */}
      <div className="h-10 bg-m3-surface text-m3-on-surface border-b border-m3-outline-variant flex items-center justify-between px-4 z-50 shrink-0 select-none">
        <div className="flex items-center gap-4">
          <div className="flex gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-red-500/40" />
            <div className="w-2.5 h-2.5 rounded-full bg-amber-500/40" />
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500/40" />
          </div>
          <div className="h-4 w-px bg-m3-outline-variant" />
          <span className="text-[10px] font-bold uppercase tracking-widest opacity-70">{t.common.industrialSolutions}</span>
        </div>
        
        <div className="flex items-center gap-4">
          <button 
            onClick={() => setLanguage(language === "en" ? "pt" : "en")}
            className="flex items-center gap-2 p-1.5 px-3 rounded-full hover:bg-m3-surface-variant text-m3-on-surface-variant transition-colors group"
            title={language === "en" ? "Translate to Portuguese" : "Traduzir para Inglês"}
          >
            <Languages className="w-4 h-4 group-hover:rotate-12 transition-transform" />
            <span className="text-[10px] font-bold uppercase">{language}</span>
          </button>
          <button 
            onClick={toggleTheme}
            className="p-1.5 rounded-full hover:bg-m3-surface-variant text-m3-on-surface-variant transition-colors"
          >
            {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
          <div className="flex items-center gap-2 px-2 py-0.5 bg-m3-secondary-container text-m3-on-secondary-container rounded-full text-[9px] font-bold uppercase tracking-tight">
             <div className="w-1.5 h-1.5 rounded-full bg-m3-primary animate-pulse" />
             <span>Core v2.4.0</span>
          </div>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden relative">
        <Toaster theme={theme as any} position="bottom-right" closeButton richColors />
        <Sidebar
          isOpen={sidebarOpen}
          setIsOpen={setSidebarOpen}
          currentView={currentView}
          setCurrentView={setCurrentView}
        />
        <main className="flex-1 overflow-y-auto relative bg-m3-surface">
          <header className="sticky top-0 z-40 flex h-16 items-center px-4 md:px-6 bg-m3-surface/80 backdrop-blur-md border-b border-m3-outline-variant justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className={cn(
                  "p-2 rounded-full transition-transform active:scale-90",
                  sidebarOpen ? "text-m3-primary" : "text-m3-on-surface-variant hover:bg-m3-surface-variant"
                )}
                aria-label="Toggle Menu"
              >
                <Menu className={cn("w-6 h-6 transition-transform duration-300", sidebarOpen && "rotate-90")} />
              </button>
              <div className="flex flex-col">
                <span className="text-sm font-bold text-m3-on-surface capitalize tracking-wide">
                  {t.views[currentView]}
                </span>
              </div>
            </div>

            <div className="hidden md:flex items-center gap-6 text-[10px] font-medium text-m3-on-surface-variant uppercase tracking-wider">
               <div className="flex flex-col items-end">
                  <span className="opacity-60">{t.common.engineCpu}</span>
                  <span className="text-m3-primary font-bold">{telemetry.cpu}°C</span>
               </div>
               <div className="flex flex-col items-end">
                  <span className="opacity-60">{t.common.runtimeLoad}</span>
                  <span className="text-m3-on-surface font-bold">{telemetry.load}%</span>
               </div>
            </div>
          </header>
          
          <div className="p-4 md:p-8 max-w-7xl mx-auto min-h-full">
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
  );
}

export default function App() {
  return (
    <AuthProvider>
      <LanguageProvider>
        <ThemeProvider>
          <AppContent />
        </ThemeProvider>
      </LanguageProvider>
    </AuthProvider>
  );
}
