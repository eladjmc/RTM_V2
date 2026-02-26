import { useState, useEffect, useCallback, useRef } from 'react';

export interface VoiceInfo {
  voice: SpeechSynthesisVoice;
  label: string;
}

/**
 * Hook to load available English speech synthesis voices.
 * Defaults to saved → Zira → first English voice.
 */
export function useVoices(savedVoiceName?: string) {
  const [voices, setVoices] = useState<VoiceInfo[]>([]);
  const [selectedVoice, setSelectedVoice] = useState<SpeechSynthesisVoice | null>(null);

  const selectedVoiceRef = useRef(selectedVoice);

  useEffect(() => {
    selectedVoiceRef.current = selectedVoice;
  }, [selectedVoice]);

  useEffect(() => {
    const handleVoicesChanged = () => {
      const allVoices = speechSynthesis.getVoices();
      const englishVoices = allVoices
        .filter((v) => v.lang.startsWith('en'))
        .sort((a, b) => a.name.localeCompare(b.name));

      const voiceInfos: VoiceInfo[] = englishVoices.map((v) => ({
        voice: v,
        label: `${v.name} (${v.lang})`,
      }));

      setVoices(voiceInfos);

      if (voiceInfos.length > 0 && !selectedVoiceRef.current) {
        // Try saved voice first
        if (savedVoiceName) {
          const saved = voiceInfos.find((v) => v.voice.name === savedVoiceName);
          if (saved) {
            setSelectedVoice(saved.voice);
            return;
          }
        }

        // Try Zira (Windows desktop)
        const zira = voiceInfos.find((v) =>
          v.voice.name.toLowerCase().includes('zira')
        );
        if (zira) {
          setSelectedVoice(zira.voice);
          return;
        }

        // Fallback to first English voice
        setSelectedVoice(voiceInfos[0].voice);
      }
    };

    // Load voices initially
    handleVoicesChanged();
    speechSynthesis.addEventListener('voiceschanged', handleVoicesChanged);
    return () => {
      speechSynthesis.removeEventListener('voiceschanged', handleVoicesChanged);
    };
  }, [savedVoiceName]);

  const selectVoice = useCallback(
    (voiceName: string) => {
      const found = voices.find((v) => v.voice.name === voiceName);
      if (found) {
        setSelectedVoice(found.voice);
      }
    },
    [voices]
  );

  return {
    voices,
    selectedVoice,
    selectVoice,
    isSupported: 'speechSynthesis' in window,
  };
}
