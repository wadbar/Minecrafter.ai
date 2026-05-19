import { useState, useRef, useEffect } from "react";
import { io } from "socket.io-client";

export interface AIGeneratorOptions {
  endpointType: string;
  onComplete?: () => void;
  onError?: (err: Error) => void;
}

export function useAIGenerator(options: AIGeneratorOptions) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [streamData, setStreamData] = useState("");
  const [error, setError] = useState<string | null>(null);
  const socketRef = useRef<any>(null);

  const startGeneration = (payload: any) => {
    setIsGenerating(true);
    setStreamData("");
    setError(null);

    // Conectar ao WebSocket - Removido hardcode de localhost para compatibilidade em ambientes cloud/proxy
    const socket = io({
      reconnectionAttempts: 5,
      timeout: 10000,
      transports: ["websocket", "polling"]
    });
    socketRef.current = socket;

    socket.on("connect", () => {
      console.log("Subsystem Socket Established:", socket.id);
      socket.emit("generate-stream", {
        endpointType: options.endpointType,
        ...payload,
      });
    });

    socket.on("stream-chunk", (data: { chunk: string }) => {
      setStreamData((prev) => prev + data.chunk);
    });

    socket.on("stream-complete", () => {
      setIsGenerating(false);
      if (options.onComplete) options.onComplete();
      socket.disconnect();
    });

    socket.on("stream-error", (data: { error: string }) => {
      setError(data.error);
      setIsGenerating(false);
      if (options.onError) options.onError(new Error(data.error));
      socket.disconnect();
    });

    socket.on("connect_error", (err) => {
      console.error("Subsystem Socket Connection Error:", err);
      setError("Falha de conexão com a infraestrutura principal.");
      setIsGenerating(false);
      if (options.onError) options.onError(err);
      socket.disconnect();
    });
  };

  const stopGeneration = () => {
    if (socketRef.current) {
      socketRef.current.removeAllListeners();
      socketRef.current.disconnect();
      socketRef.current = null;
    }
    setIsGenerating(false);
  };

  // Lifecycle hardening: Ensure no ghost sockets on unmount
  useEffect(() => {
    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, []);

  return {
    isGenerating,
    streamData,
    error,
    startGeneration,
    stopGeneration,
  };
}
