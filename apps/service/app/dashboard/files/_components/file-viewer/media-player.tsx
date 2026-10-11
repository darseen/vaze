import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatDuration } from "@/utils";
import type { FileWithUrl } from "@repo/types";
import {
  LoaderCircle,
  Maximize,
  Minimize,
  Music,
  Pause,
  Play,
  RotateCcw,
  RotateCw,
  Volume2,
  VolumeX,
} from "lucide-react";
import {
  useEffect,
  useEffectEvent,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode,
  type RefObject,
  type SyntheticEvent,
} from "react";
import { NoPreview } from "./status";

const SKIP_SECONDS = 10;
const ARROW_SECONDS = 5;
const IDLE_MS = 2500;

type MediaEvent = SyntheticEvent<HTMLMediaElement>;

// carried from file to file, so a muted viewer stays muted
const preferences = { volume: 1, muted: false };

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

function bufferedEnd(media: HTMLMediaElement) {
  const { buffered, currentTime } = media;
  for (let i = 0; i < buffered.length; i++) {
    if (buffered.start(i) <= currentTime && currentTime <= buffered.end(i)) {
      return buffered.end(i);
    }
  }
  return 0;
}

function useMedia(
  ref: RefObject<HTMLMediaElement | null>,
  {
    toggleFullscreen,
    onShortcut,
  }: { toggleFullscreen?: () => void; onShortcut?: () => void } = {},
) {
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [buffered, setBuffered] = useState(0);
  const [volume, setVolume] = useState(preferences.volume);
  const [muted, setMuted] = useState(preferences.muted);
  const [waiting, setWaiting] = useState(true);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const media = ref.current;
    if (!media) return;
    media.volume = preferences.volume;
    media.muted = preferences.muted;
  }, [ref]);

  // `timeupdate` fires about four times a second, too coarse for a short clip
  useEffect(() => {
    if (!playing) return;

    let frame = requestAnimationFrame(function tick() {
      if (ref.current) setTime(ref.current.currentTime);
      frame = requestAnimationFrame(tick);
    });

    return () => cancelAnimationFrame(frame);
  }, [playing, ref]);

  const toggle = () => {
    const media = ref.current;
    if (!media) return;
    if (media.paused || media.ended) media.play().catch(() => {});
    else media.pause();
  };

  const seek = (to: number) => {
    const media = ref.current;
    if (!media || !Number.isFinite(media.duration)) return;
    media.currentTime = clamp(to, 0, media.duration);
    setTime(media.currentTime);
  };

  const skip = (by: number) => seek((ref.current?.currentTime ?? 0) + by);

  const changeVolume = (to: number) => {
    const media = ref.current;
    if (!media) return;
    media.volume = to;
    media.muted = to === 0;
  };

  const toggleMute = () => {
    const media = ref.current;
    if (!media) return;
    media.muted = !media.muted;
    if (!media.muted && media.volume === 0) media.volume = 0.5;
  };

  const handleShortcut = useEffectEvent((event: globalThis.KeyboardEvent) => {
    if (event.defaultPrevented || event.altKey || event.ctrlKey) return;
    if (event.metaKey) return;

    const target = event.target as Element;
    if (target.closest("input, textarea, select")) return;

    // in fullscreen there is no file list to step through, so arrows seek
    const fullscreen = document.fullscreenElement !== null;

    switch (event.key.toLowerCase()) {
      case " ":
        // a focused button takes the space bar as its own click
        if (target.closest("button, a")) return;
        toggle();
        break;
      case "k":
        toggle();
        break;
      case "j":
        skip(-SKIP_SECONDS);
        break;
      case "l":
        skip(SKIP_SECONDS);
        break;
      case "m":
        toggleMute();
        break;
      case "f":
        if (!toggleFullscreen) return;
        toggleFullscreen();
        break;
      case "arrowleft":
        if (!fullscreen) return;
        skip(-ARROW_SECONDS);
        break;
      case "arrowright":
        if (!fullscreen) return;
        skip(ARROW_SECONDS);
        break;
      default:
        return;
    }

    event.preventDefault();
    onShortcut?.();
  });

  useEffect(() => {
    const listener = (event: globalThis.KeyboardEvent) => handleShortcut(event);
    document.addEventListener("keydown", listener);
    return () => document.removeEventListener("keydown", listener);
  }, []);

  const events = {
    onPlay: (event: MediaEvent) => {
      setPlaying(true);
      // one thing plays at a time, including a card's audio behind the viewer
      for (const other of document.querySelectorAll<HTMLMediaElement>(
        "audio, video",
      )) {
        if (other !== event.currentTarget) other.pause();
      }
    },
    onPause: () => setPlaying(false),
    onTimeUpdate: (event: MediaEvent) =>
      setTime(event.currentTarget.currentTime),
    onDurationChange: (event: MediaEvent) => {
      const { duration } = event.currentTarget;
      setDuration(Number.isFinite(duration) ? duration : 0);
    },
    onProgress: (event: MediaEvent) =>
      setBuffered(bufferedEnd(event.currentTarget)),
    onVolumeChange: (event: MediaEvent) => {
      const { volume, muted } = event.currentTarget;
      preferences.volume = volume;
      preferences.muted = muted;
      setVolume(volume);
      setMuted(muted);
    },
    onWaiting: () => setWaiting(true),
    onCanPlay: () => setWaiting(false),
    onPlaying: () => setWaiting(false),
    onError: () => setFailed(true),
  };

  return {
    playing,
    time,
    duration,
    buffered,
    volume,
    muted,
    waiting,
    failed,
    events,
    toggle,
    seek,
    skip,
    changeVolume,
    toggleMute,
  };
}

type Media = ReturnType<typeof useMedia>;

function Slider({
  label,
  value,
  max,
  step,
  valueText,
  buffered,
  onChange,
  className,
}: {
  label: string;
  value: number;
  max: number;
  /** How far one arrow key press moves. */
  step: number;
  valueText: string;
  buffered?: number;
  onChange: (value: number) => void;
  className?: string;
}) {
  const [dragging, setDragging] = useState(false);
  const disabled = max <= 0;
  const percent = (part: number) =>
    disabled ? 0 : clamp(part / max, 0, 1) * 100;

  const valueAt = (event: PointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    return clamp((event.clientX - rect.left) / rect.width, 0, 1) * max;
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const targets: Record<string, number> = {
      ArrowLeft: value - step,
      ArrowDown: value - step,
      ArrowRight: value + step,
      ArrowUp: value + step,
      Home: 0,
      End: max,
    };
    const next: number | undefined = targets[event.key];
    if (next === undefined || disabled) return;

    // the viewer would otherwise take the arrows to switch files
    event.preventDefault();
    event.stopPropagation();
    onChange(clamp(next, 0, max));
  };

  return (
    <div
      role="slider"
      tabIndex={disabled ? -1 : 0}
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={value}
      aria-valuetext={valueText}
      aria-disabled={disabled || undefined}
      onKeyDown={handleKeyDown}
      onPointerDown={(event) => {
        if (event.button !== 0 || disabled) return;
        event.currentTarget.setPointerCapture(event.pointerId);
        setDragging(true);
        onChange(valueAt(event));
      }}
      onPointerMove={(event) => {
        if (dragging) onChange(valueAt(event));
      }}
      onLostPointerCapture={() => setDragging(false)}
      className={cn(
        "group/slider relative flex h-5 cursor-pointer touch-none items-center outline-none",
        className,
      )}
    >
      <div className="bg-foreground/25 relative h-1 w-full overflow-hidden rounded-full transition-[height] group-hover/slider:h-1.5">
        {buffered !== undefined && (
          <div
            className="bg-foreground/30 absolute inset-y-0 left-0"
            style={{ width: `${percent(buffered)}%` }}
          />
        )}
        <div
          className="bg-foreground absolute inset-y-0 left-0"
          style={{ width: `${percent(value)}%` }}
        />
      </div>
      <div
        className={cn(
          "bg-foreground ring-foreground/40 absolute size-3 -translate-x-1/2 rounded-full shadow transition-transform group-hover/slider:scale-100 group-focus-visible/slider:scale-100 group-focus-visible/slider:ring-4",
          dragging ? "scale-100" : "scale-0",
        )}
        style={{ left: `${percent(value)}%` }}
      />
    </div>
  );
}

function SkipIcon({ forward = false }: { forward?: boolean }) {
  const Icon = forward ? RotateCw : RotateCcw;

  return (
    <span className="relative flex">
      <Icon className="size-6" strokeWidth={1.75} />
      <span className="absolute inset-0 flex items-center justify-center text-[8px] font-bold">
        {SKIP_SECONDS}
      </span>
    </span>
  );
}

function ControlButton({
  label,
  shortcut,
  onClick,
  children,
}: {
  label: string;
  shortcut: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={onClick}
      aria-label={label}
      title={`${label} (${shortcut})`}
      className="[&_svg:not([class*='size-'])]:size-5"
    >
      {children}
    </Button>
  );
}

function Controls({ media, extra }: { media: Media; extra?: ReactNode }) {
  const silent = media.muted || media.volume === 0;

  return (
    <div className="flex flex-col gap-1">
      <Slider
        label="Seek"
        value={media.time}
        max={media.duration}
        step={ARROW_SECONDS}
        buffered={media.buffered}
        valueText={`${formatDuration(media.time)} of ${formatDuration(media.duration)}`}
        onChange={media.seek}
      />

      <div className="flex items-center gap-1">
        <ControlButton
          label={media.playing ? "Pause" : "Play"}
          shortcut="K"
          onClick={media.toggle}
        >
          {media.playing ? (
            <Pause className="fill-current" />
          ) : (
            <Play className="fill-current" />
          )}
        </ControlButton>
        <ControlButton
          label={`Back ${SKIP_SECONDS} seconds`}
          shortcut="J"
          onClick={() => media.skip(-SKIP_SECONDS)}
        >
          <SkipIcon />
        </ControlButton>
        <ControlButton
          label={`Forward ${SKIP_SECONDS} seconds`}
          shortcut="L"
          onClick={() => media.skip(SKIP_SECONDS)}
        >
          <SkipIcon forward />
        </ControlButton>
        <ControlButton
          label={silent ? "Unmute" : "Mute"}
          shortcut="M"
          onClick={media.toggleMute}
        >
          {silent ? <VolumeX /> : <Volume2 />}
        </ControlButton>
        {/* phones set volume with their own buttons */}
        <Slider
          label="Volume"
          value={media.muted ? 0 : media.volume}
          max={1}
          step={0.1}
          valueText={`${Math.round((media.muted ? 0 : media.volume) * 100)}%`}
          onChange={media.changeVolume}
          className="mr-2 hidden w-20 sm:flex"
        />
        <span className="text-foreground/80 ml-1 text-xs whitespace-nowrap tabular-nums">
          {formatDuration(media.time)} / {formatDuration(media.duration)}
        </span>
        <div className="ml-auto">{extra}</div>
      </div>
    </div>
  );
}

type FullscreenVideo = HTMLVideoElement & {
  webkitEnterFullscreen?: () => void;
};

export function VideoPlayer({ file }: { file: FileWithUrl }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const idleTimer = useRef<number | undefined>(undefined);
  const [active, setActive] = useState(true);
  const [fullscreen, setFullscreen] = useState(false);

  const wake = () => {
    setActive(true);
    window.clearTimeout(idleTimer.current);
    idleTimer.current = window.setTimeout(() => setActive(false), IDLE_MS);
  };

  const toggleFullscreen = () => {
    const container = containerRef.current;
    if (!container) return;

    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    } else if (document.fullscreenEnabled) {
      container.requestFullscreen().catch(() => {});
    } else {
      // iPhone Safari can only fullscreen the video element itself
      (videoRef.current as FullscreenVideo | null)?.webkitEnterFullscreen?.();
    }
  };

  const media = useMedia(videoRef, { toggleFullscreen, onShortcut: wake });

  useEffect(() => {
    const onChange = () =>
      setFullscreen(document.fullscreenElement === containerRef.current);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  useEffect(() => () => window.clearTimeout(idleTimer.current), []);

  if (media.failed) {
    return <NoPreview file={file} message="This video can't be played here" />;
  }

  const idle = media.playing && !active;

  return (
    <div
      ref={containerRef}
      onPointerMove={wake}
      onPointerDown={wake}
      onPointerLeave={() => {
        window.clearTimeout(idleTimer.current);
        setActive(false);
      }}
      className={cn("relative size-full bg-black", idle && "cursor-none")}
    >
      <video
        ref={videoRef}
        src={`/${file.url}`}
        autoPlay
        playsInline
        {...media.events}
        onPlay={(event) => {
          media.events.onPlay(event);
          wake();
        }}
        onClick={media.toggle}
        onDoubleClick={toggleFullscreen}
        className="size-full object-contain"
      />

      {media.waiting && (
        <LoaderCircle className="pointer-events-none absolute top-1/2 left-1/2 size-10 -translate-x-1/2 -translate-y-1/2 animate-spin text-white/80" />
      )}

      <div
        className={cn(
          "absolute inset-x-0 bottom-0 bg-linear-to-t from-black/80 to-transparent px-3 pt-12 pb-2 transition-opacity duration-300 has-[:focus-visible]:opacity-100",
          idle && "pointer-events-none opacity-0",
        )}
      >
        <Controls
          media={media}
          extra={
            <ControlButton
              label={fullscreen ? "Exit fullscreen" : "Fullscreen"}
              shortcut="F"
              onClick={toggleFullscreen}
            >
              {fullscreen ? <Minimize /> : <Maximize />}
            </ControlButton>
          }
        />
      </div>
    </div>
  );
}

export function AudioPlayer({ file }: { file: FileWithUrl }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const media = useMedia(audioRef);

  if (media.failed) {
    return <NoPreview file={file} message="This audio can't be played here" />;
  }

  return (
    <div className="flex size-full flex-col items-center justify-center gap-10 px-4">
      <div className="bg-muted flex size-40 items-center justify-center rounded-3xl shadow-lg">
        <Music
          className={cn(
            "text-muted-foreground size-16",
            media.playing && "animate-pulse",
          )}
        />
      </div>
      <audio ref={audioRef} src={`/${file.url}`} autoPlay {...media.events} />
      <div className="w-full max-w-xl">
        <Controls media={media} />
      </div>
    </div>
  );
}
