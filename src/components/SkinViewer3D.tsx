import React, { useEffect, useRef } from 'react';
import * as skinview3d from 'skinview3d';

interface SkinViewer3DProps {
  skinUrl: string;
}

export default function SkinViewer3D({ skinUrl }: SkinViewer3DProps) {
  const viewerContainer = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<skinview3d.SkinViewer | null>(null);

  useEffect(() => {
    if (viewerContainer.current && !viewerRef.current) {
      viewerRef.current = new skinview3d.SkinViewer({
        canvas: document.createElement('canvas'),
        width: 300,
        height: 400,
        skin: skinUrl,
      });

      // Add animation
      viewerRef.current.animation = new skinview3d.WalkingAnimation();

      viewerContainer.current.appendChild(viewerRef.current.canvas);
    } else if (viewerRef.current) {
      viewerRef.current.loadSkin(skinUrl);
    }

    return () => {
      // Disposing helps prevent memory leaks if component unmounts
      if (viewerRef.current && viewerContainer.current) {
        viewerRef.current.dispose();
        viewerContainer.current.innerHTML = '';
        viewerRef.current = null;
      }
    };
  }, [skinUrl]);

  return <div ref={viewerContainer} className="overflow-hidden rounded-xl border border-neutral-800 bg-neutral-900/50 flex items-center justify-center cursor-move" title="Arraste para rotacionar" />;
}
