import { useState, useEffect } from 'react';

export interface NetworkConfig {
  host: string;
  port: number;
  username: string;
  auth: string;
}

const DEFAULT_CONFIG: NetworkConfig = {
  host: "localhost",
  port: 25565,
  username: "AI_Studio_Agent",
  auth: "offline"
};

export function useNetworkConfig() {
  const [config, setConfig] = useState<NetworkConfig>(() => {
    try {
      const saved = localStorage.getItem("mc_global_config");
      return saved ? JSON.parse(saved) : DEFAULT_CONFIG;
    } catch (e) {
      console.error("Failed to parse network config", e);
      return DEFAULT_CONFIG;
    }
  });

  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === "mc_global_config" && e.newValue) {
        try {
          setConfig(JSON.parse(e.newValue));
        } catch (err) {
          console.error("Storage change parse error", err);
        }
      }
    };

    const handleCustomUpdate = () => {
      try {
        const saved = localStorage.getItem("mc_global_config");
        if (saved) setConfig(JSON.parse(saved));
      } catch (err) {
        console.error("Custom event parse error", err);
      }
    };

    window.addEventListener("storage", handleStorageChange);
    window.addEventListener("mc_config_updated", handleCustomUpdate);
    return () => {
      window.removeEventListener("storage", handleStorageChange);
      window.removeEventListener("mc_config_updated", handleCustomUpdate);
    };
  }, []);

  const saveConfig = (newConfig: Partial<NetworkConfig>) => {
    setConfig(prev => {
      const updated = { ...prev, ...newConfig };
      try {
        localStorage.setItem("mc_global_config", JSON.stringify(updated));
        window.dispatchEvent(new Event("mc_config_updated"));
      } catch (e) {
        console.error("Failed to save network config", e);
      }
      return updated;
    });
  };

  return { config, saveConfig };
}
