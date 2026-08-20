import { useEffect, useRef, useState } from "react";
import { Volume2, VolumeX } from "lucide-react";
import voiceAsset from "@/assets/teacher-voice.mp3.asset.json";

const shapes = [
  { h: 6, y: 83 },
  { h: 14, y: 79 },
  { h: 3, y: 84 },
  { h: 18, y: 77 },
  { h: 6, y: 83 },
  { h: 10, y: 81 },
];

const MIN_SPEAK_MS = 3000;

const SpeakingAvatar = ({ speaking }: { speaking: boolean }) => {
  const mouthRef = useRef<SVGRectElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [muted, setMuted] = useState(false);
  const [active, setActive] = useState(false);
  const startedAtRef = useRef<number>(0);

  useEffect(() => {
    if (!audioRef.current) {
      const a = new Audio(voiceAsset.url);
      a.loop = true;
      a.volume = 0.6;
      audioRef.current = a;
    }
    audioRef.current.muted = muted;
  }, [muted]);

  // Keep the animation/sound alive for at least MIN_SPEAK_MS
  useEffect(() => {
    if (speaking) {
      startedAtRef.current = Date.now();
      setActive(true);
      return;
    }
    if (!active) return;
    const remaining = MIN_SPEAK_MS - (Date.now() - startedAtRef.current);
    if (remaining <= 0) {
      setActive(false);
      return;
    }
    const id = setTimeout(() => setActive(false), remaining);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [speaking]);

  useEffect(() => {
    const a = audioRef.current;
    if (!active) {
      mouthRef.current?.setAttribute("height", "7");
      mouthRef.current?.setAttribute("y", "82");
      if (a) {
        a.pause();
        a.currentTime = 0;
      }
      return;
    }
    if (a) {
      a.currentTime = 0;
      a.play().catch(() => {
        /* autoplay blocked until user interacts */
      });
    }
    let i = 0;
    const id = setInterval(() => {
      const s = shapes[i % shapes.length];
      mouthRef.current?.setAttribute("height", String(s.h));
      mouthRef.current?.setAttribute("y", String(s.y));
      i++;
    }, 180);
    return () => clearInterval(id);
  }, [active]);

  useEffect(() => {
    return () => {
      audioRef.current?.pause();
    };
  }, []);

  return (
    <div className="flex justify-center py-4">
      <div className="relative w-40 h-40 rounded-full bg-muted border border-border flex items-center justify-center">
        <svg width="130" height="130" viewBox="0 0 120 120">
          <ellipse cx="30" cy="70" rx="14" ry="16" fill="#8a6a4f" />
          <ellipse cx="90" cy="70" rx="14" ry="16" fill="#8a6a4f" />
          <circle cx="60" cy="62" r="42" fill="#a4805f" />
          <ellipse cx="60" cy="70" rx="26" ry="22" fill="#e6c9a8" />
          <circle cx="46" cy="48" r="8" fill="#e6c9a8" />
          <circle cx="74" cy="48" r="8" fill="#e6c9a8" />
          <circle cx="46" cy="60" r="6" fill="#2c2c2a" />
          <circle cx="74" cy="60" r="6" fill="#2c2c2a" />
          <circle cx="35" cy="58" r="10" fill="none" stroke="#444441" strokeWidth="2.5" />
          <circle cx="85" cy="58" r="10" fill="none" stroke="#444441" strokeWidth="2.5" />
          <line x1="45" y1="58" x2="75" y2="58" stroke="#444441" strokeWidth="2.5" />
          <ellipse cx="60" cy="72" rx="5" ry="4" fill="#7a5c42" />
          <rect ref={mouthRef} x="46" y="82" width="28" height="7" rx="3.5" fill="#5a3f2b" />
        </svg>
        <button
          type="button"
          onClick={() => setMuted((m) => !m)}
          aria-label={muted ? "Ton einschalten" : "Ton ausschalten"}
          className="absolute bottom-1 right-1 rounded-full bg-background/80 border border-border p-1.5 hover:bg-background transition-colors"
        >
          {muted ? (
            <VolumeX className="w-4 h-4 text-muted-foreground" />
          ) : (
            <Volume2 className="w-4 h-4 text-foreground" />
          )}
        </button>
      </div>
    </div>
  );
};

export default SpeakingAvatar;
