import { useEffect } from 'react';

interface MediaSessionMetadata {
  title?: string;
  artist?: string;
  album?: string;
  artworkUrl?: string;
}

interface MediaSessionControls {
  play: () => void;
  pause: () => void;
  skipForward: () => void;
  skipBackward: () => void;
  /** Rewind ~20s within current track (lock screen seekbackward) */
  seekBack?: () => void;
  /** Forward ~20s within current track (lock screen seekforward) */
  seekForward?: () => void;
}

/**
 * Wires lock-screen / notification media controls when server playback is active.
 */
export function useMediaSession(
  enabled: boolean,
  metadata: MediaSessionMetadata,
  controls: MediaSessionControls,
  isPlaying: boolean,
) {
  useEffect(() => {
    if (!enabled || !('mediaSession' in navigator)) return;

    const artwork = metadata.artworkUrl
      ? [{ src: metadata.artworkUrl, sizes: '512x512', type: 'image/jpeg' }]
      : [];

    navigator.mediaSession.metadata = new MediaMetadata({
      title: metadata.title ?? 'Reading',
      artist: metadata.artist ?? 'RTM Reader',
      album: metadata.album,
      artwork,
    });

    const handlers: Array<[MediaSessionAction, (() => void) | undefined]> = [
      ['play', controls.play],
      ['pause', controls.pause],
      ['previoustrack', controls.skipBackward],
      ['nexttrack', controls.skipForward],
      ['seekbackward', controls.seekBack],
      ['seekforward', controls.seekForward],
    ];

    for (const [action, handler] of handlers) {
      if (!handler) continue;
      try {
        navigator.mediaSession.setActionHandler(action, handler);
      } catch {
        // Some browsers reject unsupported actions
      }
    }

    return () => {
      for (const [action] of handlers) {
        try {
          navigator.mediaSession.setActionHandler(action, null);
        } catch {
          // ignore
        }
      }
    };
  }, [
    enabled,
    metadata.title,
    metadata.artist,
    metadata.album,
    metadata.artworkUrl,
    controls.play,
    controls.pause,
    controls.skipForward,
    controls.skipBackward,
    controls.seekBack,
    controls.seekForward,
  ]);

  useEffect(() => {
    if (!enabled || !('mediaSession' in navigator)) return;
    navigator.mediaSession.playbackState = isPlaying ? 'playing' : 'paused';
  }, [enabled, isPlaying]);
}
