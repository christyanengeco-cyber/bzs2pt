import { useRef } from "react";
import type { VideoEncontrado } from "@/lib/parser";

/** Mount with a key for the citation so each new verse gets one initial seek. */
export function ReferenceVideo({ video }: { video: VideoEncontrado }) {
  const posicionado = useRef(false);
  const posicionar = (elemento: HTMLVideoElement) => {
    if (posicionado.current || video.inicio == null || !Number.isFinite(video.inicio)) return;
    try {
      elemento.currentTime = video.inicio;
      posicionado.current = Math.abs(elemento.currentTime - video.inicio) < 0.1;
    } catch {
      // Some mobile players only accept seeking once playback is ready.
    }
  };
  return (
    <video
      src={video.mp4}
      controls
      playsInline
      preload="metadata"
      onLoadedMetadata={(e) => posicionar(e.currentTarget)}
      onCanPlay={(e) => posicionar(e.currentTarget)}
      onPlay={(e) => posicionar(e.currentTarget)}
      className="w-full rounded-lg bg-background"
      aria-label={video.titulo}
    />
  );
}
