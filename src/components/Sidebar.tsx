import React from "react";
import { cn } from "../lib/utils";
import { ViewState } from "../App";
import {
  Brain,
  Map,
  FileCode2,
  Paintbrush,
  Settings,
  ChevronLeft,
  Users,
  Store,
  Shirt,
  Database,
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
    { id: "texture", label: "Textures & Items", icon: Paintbrush },
    { id: "skin", label: "Skin Forge 3D", icon: Shirt },
    { id: "storyteller", label: "Storyteller & NPCs", icon: Users },
    { id: "vault", label: "Cloud Vault (Beta)", icon: Database },
    { id: "integrations", label: "Export & Bedrock Store", icon: Store },
  ] as const;

  return (
    <aside
      className={cn(
        "bg-neutral-900 border-r border-neutral-800 flex flex-col transition-all duration-300 relative",
        isOpen ? "w-64" : "w-0 overflow-hidden md:w-20"
      )}
    >
      <div className="h-16 flex items-center px-6 border-b border-neutral-800 space-x-3">
        <div className="relative">
          <Brain className="w-7 h-7 text-emerald-500 flex-shrink-0" />
          <div className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-emerald-500 border-2 border-neutral-900 rounded-full animate-pulse" />
        </div>
        <span
          className={cn(
            "font-mono font-black text-lg tracking-tighter text-white whitespace-nowrap transition-all duration-500",
            !isOpen ? "md:scale-0 md:w-0" : "opacity-100"
          )}
        >
          MATRIX<span className="text-emerald-500">.</span>ENGINE
        </span>
      </div>

      <nav className="flex-1 p-3 space-y-1 overflow-y-auto custom-scrollbar">
        {navItems.map((item) => (
          <button
            key={item.id}
            onClick={() => setCurrentView(item.id)}
            className={cn(
              "w-full flex items-center px-4 py-3 rounded-xl text-[11px] font-mono font-bold uppercase tracking-widest transition-all group overflow-hidden relative",
              currentView === item.id
                ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shadow-[0_0_15px_rgba(16,185,129,0.1)]"
                : "text-neutral-500 hover:bg-neutral-800/50 hover:text-neutral-300"
            )}
            title={item.label}
          >
            {currentView === item.id && (
              <div className="absolute left-0 top-0 bottom-0 w-1 bg-emerald-500" />
            )}
            <item.icon
              className={cn(
                "w-4 h-4 flex-shrink-0 transition-all duration-300",
                currentView === item.id
                  ? "text-emerald-400 scale-110"
                  : "text-neutral-600 group-hover:text-emerald-500"
              )}
            />
            <span
              className={cn(
                "ml-3 whitespace-nowrap transition-opacity",
                !isOpen && "md:opacity-0"
              )}
            >
              {item.label}
            </span>
          </button>
        ))}
      </nav>

      <div className="p-4 border-t border-neutral-800">
        <button
          onClick={() => setCurrentView("settings")}
          className={cn(
            "w-full flex items-center px-3 py-3 rounded-lg text-sm font-medium transition-all group",
            currentView === "settings"
              ? "bg-emerald-500/10 text-emerald-400"
              : "text-neutral-400 hover:bg-neutral-800 hover:text-white"
          )}
        >
          <Settings className="w-5 h-5 flex-shrink-0" />
          <span
            className={cn(
              "ml-3 whitespace-nowrap transition-opacity",
              !isOpen && "md:opacity-0"
            )}
          >
            Settings
          </span>
        </button>
      </div>
    </aside>
  );
}
