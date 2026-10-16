import { createAudioPlayer, type AudioPlayer } from "expo-audio";
import { create } from "zustand";

let stopCurrent: (() => void) | null = null;

/** One thing plays at a time: claiming playback stops whatever had it. */
export function claimPlayback(stop: () => void) {
  if (stopCurrent && stopCurrent !== stop) stopCurrent();
  stopCurrent = stop;
}

export function releasePlayback(stop: () => void) {
  if (stopCurrent === stop) stopCurrent = null;
}

type CardAudioState = {
  /** The file loaded into the cards' shared player. */
  fileId: string | null;
  playing: boolean;
  progress: number;
  failed: Record<string, true>;
  toggle: (
    fileId: string,
    source: { uri: string; headers: Record<string, string> },
  ) => void;
  stop: () => void;
};

let player: AudioPlayer | null = null;

const pauseCards = () => player?.pause();

// the cards share one player, so a folder of songs holds one decoder
function cardPlayer() {
  if (player) return player;
  player = createAudioPlayer(null, { updateInterval: 250 });

  player.addListener("playbackStatusUpdate", (status) => {
    const { fileId } = useCardAudio.getState();
    if (!fileId) return;

    if (status.error) {
      useCardAudio.setState((state) => ({
        playing: false,
        progress: 0,
        failed: { ...state.failed, [fileId]: true },
      }));
      return;
    }

    useCardAudio.setState({
      playing: status.playing,
      progress: status.didJustFinish
        ? 0
        : status.duration > 0
          ? status.currentTime / status.duration
          : 0,
    });
  });

  return player;
}

export const useCardAudio = create<CardAudioState>()((set, get) => ({
  fileId: null,
  playing: false,
  progress: 0,
  failed: {},

  toggle: (fileId, source) => {
    const audio = cardPlayer();

    if (get().fileId === fileId && audio.isLoaded) {
      if (audio.playing) {
        audio.pause();
        return;
      }
      if (audio.duration > 0 && audio.currentTime >= audio.duration) {
        audio.seekTo(0);
      }
    } else {
      audio.replace(source);
      set({ fileId, progress: 0 });
    }

    claimPlayback(pauseCards);
    audio.play();
  },

  stop: () => {
    player?.pause();
    releasePlayback(pauseCards);
  },
}));
