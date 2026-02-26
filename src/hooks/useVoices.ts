import { useState, useEffect, useCallback, useRef } from 'react';

export interface VoiceInfo {
  voice: SpeechSynthesisVoice;
  label: string;
}

const PREFERRED_VOICE = 'Microsoft Zira Desktop';

/**
 * Hook to load available English speech synthesis voices.
 * Returns the voice list, the selected voice, and a setter.
 * Defaults to Microsoft Zira Desktop if available.
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
      const englishVoices = allVoices.filter((v) => v.lang.startsWith('en'));

      const voiceInfos: VoiceInfo[] = englishVoices.map((v) => ({
        voice: v,
        label: `${v.name} (${v.lang})`,
      }));

      setVoices(voiceInfos);

      if (voiceInfos.length > 0 && !selectedVoiceRef.current) {
        // Try to find saved voice first
        if (savedVoiceName) {
          const saved = voiceInfos.find((v) => v.voice.name === savedVoiceName);
          if (saved) {
            setSelectedVoice(saved.voice);
            return;
          }
        }

        // Try to find Zira
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
    preferredVoiceName: PREFERRED_VOICE,
  };
}
