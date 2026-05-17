import React, { useEffect, useState } from "react";
import { Activity, ShieldCheck, Globe, Wifi, WifiOff } from "lucide-react";
import { cn } from "../lib/utils";

export default function SystemStatus() {
  const [health, setHealth] = useState<any>(null);
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const checkHealth = async () => {
      try {
        const res = await fetch("/api/health");
        const data = await res.json();
        setHealth(data);
      } catch (e) {
        setHealth({ status: "ERROR" });
      }
    };

    const handleStatusChange = () => setIsOnline(navigator.onLine);
    window.addEventListener("online", handleStatusChange);
    window.addEventListener("offline", handleStatusChange);

    const timer = setInterval(checkHealth, 30000);
    checkHealth();

    return () => {
      clearInterval(timer);
      window.removeEventListener("online", handleStatusChange);
      window.removeEventListener("offline", handleStatusChange);
    };
  }, []);

  return (
    <div className="fixed bottom-0 right-0 left-0 bg-black/90 backdrop-blur-xl border-t border-neutral-900 px-6 py-2.5 flex items-center justify-between text-[9px] font-mono tracking-[0.2em] font-black uppercase text-neutral-600 z-50">
      <div className="flex items-center gap-8">
        <div className="flex items-center gap-2.5">
          <div className={cn("w-2.5 h-2.5 rounded-full", health?.status === "UP" ? "bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.4)]" : "bg-amber-500 animate-pulse")} />
          <span className={health?.status === "UP" ? "text-emerald-500/80" : "text-amber-500"}>Core: {health?.status === "UP" ? "NOMINAL" : "DEGRADED"}</span>
          {health?.circuits?.geminiPro !== "CLOSED" && health?.circuits && (
            <span className="ml-2 px-1.5 py-0.5 bg-amber-500/10 text-amber-500 border border-amber-500/20 rounded">CIRCUIT_BYPASS</span>
          )}
        </div>
        <div className="hidden lg:flex items-center gap-2.5 border-l border-neutral-800 pl-8 h-4">
          <ShieldCheck className="w-3.5 h-3.5 text-sky-500/50" />
          SRE_PROTOCOL: <span className="text-sky-500">MATRIX-LEVEL</span>
        </div>
      </div>
      
      <div className="flex items-center gap-8 group">
        {health?.traceId && (
          <div className="hidden xl:block text-neutral-800 hover:text-neutral-500 transition-colors cursor-help">LINK_ID: {health.traceId.slice(0, 12)}</div>
        )}
        <div className="flex items-center gap-2.5 bg-neutral-950 px-3 py-1 rounded-full border border-neutral-900 group-hover:border-emerald-500/30 transition-all">
          {isOnline ? (
            <>
              <Wifi className="w-3 h-3 text-emerald-500" />
              <span className="text-neutral-400">EDGE_SYNC_OK</span>
            </>
          ) : (
            <>
              <WifiOff className="w-3 h-3 text-red-500" />
              <span className="text-red-500">OFFLINE_MODE</span>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
