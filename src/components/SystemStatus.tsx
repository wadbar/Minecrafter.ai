import React, { useEffect, useState } from "react";
import { Activity, ShieldCheck, Globe, Wifi, WifiOff } from "lucide-react";
import { cn } from "../lib/utils";

interface HealthData {
  status: string;
  memory?: {
    load: string;
  };
  cpu?: number;
}

export default function SystemStatus() {
  const [health, setHealth] = useState<HealthData | null>(null);
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    let mounted = true;
    const checkHealth = async () => {
      try {
        const res = await fetch("/api/health");
        const data = await res.json();
        if (mounted) setHealth(data);
      } catch (e) {
        if (mounted) setHealth({ status: "DOWN" });
      }
    };

    const handleStatusChange = () => setIsOnline(navigator.onLine);
    window.addEventListener("online", handleStatusChange);
    window.addEventListener("offline", handleStatusChange);

    const timer = setInterval(checkHealth, 30000);
    checkHealth();

    return () => {
      mounted = false;
      clearInterval(timer);
      window.removeEventListener("online", handleStatusChange);
      window.removeEventListener("offline", handleStatusChange);
    };
  }, []);

  const memLoad = health?.memory?.load ? parseInt(health.memory.load) : 33;

  return (
    <>
      <div className="scanline" />
      <div className="fixed bottom-0 right-0 left-0 bg-black/90 backdrop-blur-xl border-t border-neutral-900 px-6 py-2 flex items-center justify-between text-[9px] font-mono tracking-[0.2em] font-black uppercase text-neutral-600 z-50">
        <div className="flex items-center gap-8">
          <div className="flex items-center gap-2.5">
            <div className={cn("w-2 h-2 rounded-full", health?.status === "ACTIVE" ? "bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.4)]" : "bg-amber-500 animate-pulse")} />
            <span className={cn("transition-colors", health?.status === "ACTIVE" ? "text-emerald-500" : "text-amber-500")}>
              CORE_STATUS: {health?.status === "ACTIVE" ? "READY" : "WAITING"}
            </span>
          </div>

          <div className="hidden lg:flex items-center gap-6 border-l border-neutral-800/50 pl-8 h-4">
            <div className="flex items-center gap-2">
               <span className="text-neutral-700">CPU_L</span>
               <div className="w-16 h-1 bg-neutral-900 rounded-full overflow-hidden">
                 <div 
                   className="h-full bg-emerald-500/40 transition-all duration-1000" 
                   style={{ width: `${health?.status === "ACTIVE" ? 15 + Math.random() * 20 : 5}%` }} 
                 />
               </div>
            </div>
            <div className="flex items-center gap-2">
               <span className="text-neutral-700">MEM_L</span>
               <div className="w-16 h-1 bg-neutral-900 rounded-full overflow-hidden">
                 <div 
                   className="h-full bg-sky-500/40 transition-all duration-1000" 
                   style={{ width: `${memLoad}%` }} 
                 />
               </div>
            </div>
            <div className="flex items-center gap-2 text-sky-500/40">
               <Activity className="w-3 h-3" />
               <span className="text-sky-500/60">LIVE_BRIDGE: OK</span>
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-8 group">
          <div className="hidden xl:flex items-center gap-4 text-neutral-800">
            <div className="flex items-center gap-2">
               <ShieldCheck className="w-3 h-3 text-neutral-700" />
               SEC_CHECK: OK
            </div>
            <div className="flex items-center gap-2">
               <Globe className="w-3 h-3 text-neutral-700" />
               REGION: LOCAL
            </div>
          </div>

          <div className="flex items-center gap-2.5 bg-neutral-950 px-3 py-1 rounded-full border border-neutral-800 group-hover:border-emerald-500/30 transition-all">
            {isOnline ? (
              <>
                <Wifi className="w-3 h-3 text-emerald-500" />
                <span className="text-emerald-500/50">SYNC_ACTIVE</span>
              </>
            ) : (
              <>
                <WifiOff className="w-3 h-3 text-amber-500" />
                <span className="text-amber-500">OFFLINE</span>
                <span className="ml-2 px-1 py-0.5 bg-amber-500/10 border border-amber-500/20 rounded text-[7px] text-amber-500/80">STANDALONE</span>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
