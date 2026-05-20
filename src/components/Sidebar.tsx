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
  Box,
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
    { id: "voxellab", label: "Laboratório Voxel", icon: Box },
    { id: "scripthub", label: "Script Factory", icon: Terminal },
    { id: "texture", label: "Textures & Items", icon: Paintbrush },
    { id: "skin", label: "Skin Forge 3D", icon: Shirt },
    { id: "storyteller", label: "Storyteller & NPCs", icon: Users },
    { id: "vault", label: "Cloud Vault (Beta)", icon: Database },
    { id: "integrations", label: "Export & Bedrock Store", icon: Store },
  ] as const;

  const [hoveredItem, setHoveredItem] = React.useState<string | null>(null);
  const [recentViewIds, setRecentViewIds] = React.useState<string[]>([]);

  // Track recent views
  useEffect(() => {
    const saved = localStorage.getItem("recent_views");
    if (saved) {
      try {
        setRecentViewIds(JSON.parse(saved));
      } catch (e) {
        console.error("Failed to parse recent views");
      }
    }
  }, []);

  useEffect(() => {
    if (currentView === "settings") return; // Skip settings from history

    setRecentViewIds(prev => {
      const filtered = prev.filter(id => id !== currentView);
      const updated = [currentView, ...filtered].slice(0, 4);
      localStorage.setItem("recent_views", JSON.stringify(updated));
      return updated;
    });
  }, [currentView]);

  useEffect(() => {
    if (isOpen && typeof window !== 'undefined' && window.innerWidth < 768) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [isOpen]);

  const handleNavClick = (id: ViewState) => {
    setCurrentView(id);
    if (window.innerWidth < 768) {
      setIsOpen(false);
    }
  };

  // Close on mobile when clicking outside is already handled by backdrop
  
  return (
    <>
      {/* Backdrop for mobile - Optimized for immediate interaction */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
            className="fixed inset-0 bg-black/70 backdrop-blur-[4px] z-[60] md:hidden touch-none"
            onClick={() => setIsOpen(false)}
            aria-hidden="true"
          />
        )}
      </AnimatePresence>

      <motion.aside
        initial={false}
        animate={{ 
          width: isOpen ? 280 : (typeof window !== 'undefined' && window.innerWidth < 768 ? 0 : 80),
          x: isOpen ? 0 : (typeof window !== 'undefined' && window.innerWidth < 768 ? -280 : 0)
        }}
        transition={{ 
          type: "spring", 
          stiffness: 350, 
          damping: 38,
          mass: 0.8
        }}
        className={cn(
          "bg-m3-surface text-m3-on-surface border-r border-m3-outline-variant flex flex-col fixed md:relative inset-y-0 left-0 z-[70] overflow-hidden transition-colors duration-300",
          !isOpen && "md:shadow-none"
        )}
      >
        {/* Header / Logo Section */}
        <div className="h-16 flex items-center justify-between px-6 border-b border-m3-outline-variant">
          <div className="flex items-center overflow-hidden">
            <div className="relative flex-shrink-0 flex items-center justify-center">
              <Brain className="w-8 h-8 text-m3-primary" />
            </div>
            <motion.span
              animate={{ opacity: isOpen ? 1 : 0, x: isOpen ? 0 : -10 }}
              className={cn(
                "ml-4 font-bold text-lg tracking-tight text-m3-on-surface whitespace-nowrap",
                !isOpen && "pointer-events-none"
              )}
            >
              Craft<span className="text-m3-primary">Engine</span>
            </motion.span>
          </div>

          <button
            onClick={() => setIsOpen(false)}
            className="p-2 rounded-full hover:bg-m3-surface-variant text-m3-on-surface-variant md:hidden transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Content */}
        <nav className="flex-1 p-3 mt-4 space-y-1 overflow-y-auto scrollbar-none relative z-10">
          {navItems.map((item) => {
            const isActive = currentView === item.id;
            return (
              <motion.button
                layout
                key={item.id}
                onClick={() => handleNavClick(item.id as ViewState)}
                onMouseEnter={() => setHoveredItem(item.id)}
                onMouseLeave={() => setHoveredItem(null)}
                className={cn(
                  "w-full flex items-center h-12 rounded-full text-sm font-bold tracking-wide group relative transition-colors",
                  isOpen ? "px-4" : "px-0 justify-center mx-auto max-w-[56px]",
                  isActive
                    ? "bg-m3-secondary-container text-m3-on-secondary-container"
                    : "text-m3-on-surface-variant hover:bg-m3-surface-variant"
                )}
              >
                {/* Custom Tooltip */}
                <AnimatePresence>
                  {!isOpen && hoveredItem === item.id && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.9, x: 5 }}
                      animate={{ opacity: 1, scale: 1, x: 16 }}
                      exit={{ opacity: 0, scale: 0.9, x: 5 }}
                      className="absolute left-full px-4 py-2 bg-m3-surface text-m3-on-surface text-[11px] font-bold uppercase tracking-widest rounded-lg shadow-m3-2 border border-m3-outline-variant whitespace-nowrap z-[100] pointer-events-none"
                    >
                      {item.label}
                    </motion.div>
                  )}
                </AnimatePresence>

                <item.icon
                  className={cn(
                    "w-5 h-5 flex-shrink-0 transition-all duration-300 relative z-10",
                    isActive ? "text-m3-on-secondary-container" : "text-m3-on-surface-variant"
                  )}
                />
                
                {isOpen && (
                  <motion.span
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="ml-4 whitespace-nowrap relative z-10"
                  >
                    {item.label}
                  </motion.span>
                )}
              </motion.button>
            );
          })}
        </nav>

        {/* Footer actions */}
        <div className="mt-auto p-3 flex flex-col gap-2">
          {/* Settings button */}
          <motion.button
            layout
            onClick={() => handleNavClick("settings")}
            className={cn(
              "w-full flex items-center h-12 rounded-full text-sm font-bold tracking-wide group relative transition-colors",
              isOpen ? "px-4" : "px-0 justify-center mx-auto max-w-[56px]",
              currentView === "settings"
                ? "bg-m3-secondary-container text-m3-on-secondary-container"
                : "text-m3-on-surface-variant hover:bg-m3-surface-variant"
            )}
          >
            <Settings className={cn(
              "w-5 h-5 flex-shrink-0 transition-transform duration-500",
              currentView === "settings" ? "rotate-90" : "group-hover:rotate-45"
            )} />
            {isOpen && <span className="ml-4">Ajustes</span>}
          </motion.button>

          {/* Desktop Toggle Button */}
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="hidden md:flex items-center justify-center w-full h-12 rounded-full bg-m3-surface-variant/30 hover:bg-m3-surface-variant text-m3-on-surface-variant transition-all group"
          >
            {isOpen ? (
              <ChevronLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
            ) : (
              <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            )}
          </button>
        </div>
      </motion.aside>

    </>
  );
}
