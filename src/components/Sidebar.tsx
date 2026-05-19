import React, { useEffect } from "react";
import { cn } from "../lib/utils";
import { ViewState } from "../App";
import { motion, AnimatePresence } from "motion/react";
import {
  Brain,
  Map,
  FileCode2,
  Paintbrush,
  Settings,
  ChevronLeft,
  ChevronRight,
  Users,
  Store,
  Shirt,
  Database,
  X,
  Menu,
  Terminal,
} from "lucide-react";

interface SidebarProps {
  isOpen: boolean;
  setIsOpen: (o: boolean) => void;
  currentView: ViewState;
  setCurrentView: (v: ViewState) => void;
}

export default function Sidebar({
  isOpen,
  setIsOpen,
  currentView,
  setCurrentView,
}: SidebarProps) {
  const navItems = [
    { id: "dashboard", label: "Dashboard", icon: Brain },
    { id: "map", label: "Map & Terrain", icon: Map },
    { id: "mod", label: "Mods & Plugins", icon: FileCode2 },
    { id: "scripthub", label: "Script Factory", icon: Terminal },
    { id: "texture", label: "Textures & Items", icon: Paintbrush },
    { id: "skin", label: "Skin Forge 3D", icon: Shirt },
    { id: "storyteller", label: "Storyteller & NPCs", icon: Users },
    { id: "vault", label: "Cloud Vault (Beta)", icon: Database },
    { id: "integrations", label: "Export & Bedrock Store", icon: Store },
  ] as const;

  const handleNavClick = (id: ViewState) => {
    setCurrentView(id);
    if (window.innerWidth < 768) {
      setIsOpen(false);
    }
  };

  // Close on mobile when clicking outside is already handled by backdrop
  
  return (
    <>
      {/* Backdrop for mobile */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-md z-[60] md:hidden"
            onClick={() => setIsOpen(false)}
          />
        )}
      </AnimatePresence>

      <aside
        className={cn(
          "bg-neutral-950 border-r border-neutral-900 flex flex-col transition-[width] duration-300 ease-in-out fixed md:relative inset-y-0 left-0 z-[70]",
          isOpen ? "w-72 translate-x-0" : "w-0 -translate-x-full md:translate-x-0 md:w-24 overflow-hidden"
        )}
      >
        {/* Header / Logo Section */}
        <div className="h-20 flex items-center justify-between px-6 border-b border-neutral-900 bg-black/40">
          <div className="flex items-center overflow-hidden">
            <div className="relative flex-shrink-0 flex items-center justify-center">
              <div className="absolute inset-0 bg-emerald-500/10 blur-2xl rounded-full animate-pulse" />
              <Brain className="w-10 h-10 text-emerald-500 relative z-10 drop-shadow-[0_0_15px_rgba(16,185,129,0.8)]" />
              <div className="absolute -top-1 -right-1 flex gap-1 z-20">
                <div className="w-2 h-2 bg-emerald-400 rounded-full animate-ping shadow-[0_0_8px_rgba(16,185,129,1)]" />
                <div className="w-2 h-2 bg-sky-400 rounded-full animate-pulse shadow-[0_0_8px_rgba(14,165,233,1)]" style={{ animationDelay: '500ms' }} />
              </div>
            </div>
            <motion.span
              animate={{ opacity: isOpen ? 1 : 0, x: isOpen ? 0 : -20 }}
              className={cn(
                "ml-5 font-mono font-black text-2xl tracking-tighter text-white whitespace-nowrap",
                !isOpen && "pointer-events-none"
              )}
            >
              MINE<span className="text-emerald-500 drop-shadow-[0_0_8px_rgba(16,185,129,1)]">.</span>CRAFTER
            </motion.span>
          </div>

          {/* Mobile close button */}
          <button
            onClick={() => setIsOpen(false)}
            className="p-2 -mr-2 rounded-xl hover:bg-white/5 text-neutral-500 md:hidden transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Navigation Content */}
        <nav className="flex-1 p-4 mt-6 space-y-2 overflow-y-auto custom-scrollbar relative z-10">
          {navItems.map((item) => {
            const isActive = currentView === item.id;
            return (
              <button
                key={item.id}
                onClick={() => handleNavClick(item.id as ViewState)}
                className={cn(
                  "w-full flex items-center py-3.5 rounded-xl text-[10px] sm:text-[11px] font-mono font-bold uppercase tracking-[0.25em] transition-all group relative border-2",
                  isOpen ? "px-5" : "px-0 justify-center",
                  isActive
                    ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30 shadow-[0_0_25px_rgba(16,185,129,0.2)]"
                    : "border-transparent text-neutral-600 hover:bg-neutral-900 hover:text-neutral-300"
                )}
                title={item.label}
              >
                {/* Active Indicator Glow */}
                {isActive && (
                  <motion.div 
                    layoutId="active-nav-glow"
                    className="absolute inset-0 bg-emerald-500/5 rounded-xl" 
                  />
                )}
                
                {isActive && (
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1.5 h-6 bg-emerald-500 rounded-r-full shadow-[0_0_15px_rgba(16,185,129,1)]" />
                )}

                <item.icon
                  className={cn(
                    "w-5 h-5 flex-shrink-0 transition-all duration-500 relative z-10",
                    isActive
                      ? "text-emerald-400 scale-125 drop-shadow-[0_0_8px_rgba(16,185,129,0.9)]"
                      : "text-neutral-700 group-hover:text-emerald-500 group-hover:scale-110"
                  )}
                />
                
                <AnimatePresence mode="wait">
                  {isOpen && (
                    <motion.span
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -10 }}
                      className="ml-4 whitespace-nowrap relative z-10 block"
                    >
                      {item.label}
                    </motion.span>
                  )}
                </AnimatePresence>
              </button>
            );
          })}
        </nav>

        {/* Footer actions */}
        <div className="mt-auto p-4 flex flex-col gap-3">
          {/* Environment Status Badge */}
          <div className={cn(
            "p-4 rounded-2xl bg-neutral-900/30 border border-neutral-800/50 space-y-2 mb-2 transition-all",
            !isOpen && "p-2 opacity-60"
          )}>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]" />
              {isOpen && <span className="text-[10px] font-black text-neutral-300 uppercase tracking-tighter">HOST_NODE_ACTIVE</span>}
            </div>
            {isOpen && (
              <div className="text-[8px] font-mono text-neutral-600 leading-none uppercase">
                Runtime: Linux_Standard<br/>
                Host: Windows_NT_10.0
              </div>
            )}
            {!isOpen && (
              <div className="flex justify-center">
                 <Terminal className="w-3 h-3 text-neutral-700" />
              </div>
            )}
          </div>

          {/* Settings button */}
          <button
            onClick={() => handleNavClick("settings")}
            className={cn(
              "w-full flex items-center py-4 rounded-xl text-xs font-bold uppercase tracking-widest transition-all group border-2",
              isOpen ? "px-5" : "px-0 justify-center",
              currentView === "settings"
                ? "bg-sky-500/10 text-sky-400 border-sky-500/30"
                : "border-transparent text-neutral-600 hover:bg-neutral-900 hover:text-white"
            )}
            title="Settings"
          >
            <Settings className={cn(
              "w-5 h-5 flex-shrink-0 transition-all duration-300",
              currentView === "settings" ? "rotate-90 scale-110" : "group-hover:rotate-45"
            )} />
            <AnimatePresence>
              {isOpen && (
                <motion.span
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  className="ml-4"
                >
                  Settings
                </motion.span>
              )}
            </AnimatePresence>
          </button>

          {/* Desktop Toggle Button */}
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="hidden md:flex items-center justify-center w-full py-3.5 rounded-xl border border-neutral-800/80 bg-black/40 hover:bg-neutral-900 hover:border-neutral-700 text-neutral-600 hover:text-neutral-400 transition-all group"
          >
            {isOpen ? (
              <div className="flex items-center gap-3 text-[10px] font-mono font-black uppercase tracking-[0.2em] group-hover:text-emerald-500 transition-colors">
                <ChevronLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
                <span>CLOSE_SIDEBAR</span>
              </div>
            ) : (
              <ChevronRight className="w-6 h-6 group-hover:text-emerald-500 group-hover:translate-x-0.5 transition-all" />
            )}
          </button>
        </div>
      </aside>
    </>
  );
}
