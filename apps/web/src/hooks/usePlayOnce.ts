import { useState, useRef, useEffect, useCallback } from 'react';

export function stopAllSpeech() {
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    try {
      window.speechSynthesis.cancel();
    } catch {
      // ignore
    }
  }
}

export function usePlayOnce({
  onEnded,
}: {
  onEnded?: () => void;
} = {}) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [hasPlayed, setHasPlayed] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  
  const onEndedRef = useRef(onEnded);
  onEndedRef.current = onEnded;

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const timeoutRef = useRef<number | null>(null);
  const isPlayingRef = useRef(false);

  const cleanup = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.removeAttribute('src');
      audioRef.current = null;
    }
    stopAllSpeech();
    isPlayingRef.current = false;
  }, []);

  const resetState = useCallback(() => {
    cleanup();
    setIsPlaying(false);
    setHasPlayed(false);
    setIsLoading(false);
  }, [cleanup]);

  const speakPrompt = useCallback((text: string) => {
    if (typeof window === 'undefined') return;

    cleanup();
    setIsLoading(true);
    isPlayingRef.current = true;

    if (!('speechSynthesis' in window) || !text.trim()) {
      setIsLoading(false);
      setIsPlaying(false);
      setHasPlayed(true);
      isPlayingRef.current = false;
      onEndedRef.current?.();
      return;
    }

    try {
      window.speechSynthesis.cancel();
      // Chrome audio context un-pause trick
      if (window.speechSynthesis.paused) {
        window.speechSynthesis.resume();
      }

      const utterance = new SpeechSynthesisUtterance(text.trim());
      utterance.lang = 'en-US';
      utterance.rate = 0.90; // Natural, clear articulation speed
      utterance.pitch = 1.0;

      // Select natural English voice if available
      const voices = window.speechSynthesis.getVoices();
      const enVoice =
        voices.find((v) => (v.name.includes('Natural') || v.name.includes('Google') || v.name.includes('Jenny') || v.name.includes('Samantha') || v.name.includes('Guy')) && v.lang.startsWith('en')) ||
        voices.find((v) => v.lang.startsWith('en-US')) ||
        voices.find((v) => v.lang.startsWith('en'));

      if (enVoice) {
        utterance.voice = enVoice;
      }

      let ended = false;
      const finish = () => {
        if (ended) return;
        ended = true;
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        isPlayingRef.current = false;
        setIsPlaying(false);
        setIsLoading(false);
        setHasPlayed(true);
        onEndedRef.current?.();
      };

      utterance.onstart = () => {
        setIsLoading(false);
        setIsPlaying(true);
      };

      utterance.onend = finish;
      utterance.onerror = (err: any) => {
        // If utterance was intentionally cancelled or interrupted (e.g. unmounted/transitioned),
        // do NOT call finish() which would trigger onEnded and prematurely cascade phases!
        if (err?.error === 'canceled' || err?.error === 'interrupted') {
          ended = true;
          if (timeoutRef.current) clearTimeout(timeoutRef.current);
          isPlayingRef.current = false;
          setIsPlaying(false);
          setIsLoading(false);
          return;
        }
        console.warn('[speech] utterance event error:', err);
        finish();
      };

      // Chrome safety watchdog: calculate maximum expected seconds based on word count
      const words = text.trim().split(/\s+/).length;
      const maxMs = Math.max(3000, (words / 1.5) * 1000 + 4000);
      timeoutRef.current = window.setTimeout(() => {
        if (isPlayingRef.current && !ended) {
          console.log('[speech] watchdog timer triggered end of audio');
          stopAllSpeech();
          finish();
        }
      }, maxMs);

      window.speechSynthesis.speak(utterance);
    } catch (e) {
      console.error('[speech] speak error:', e);
      setIsLoading(false);
      setIsPlaying(false);
      setHasPlayed(true);
      isPlayingRef.current = false;
      onEndedRef.current?.();
    }
  }, [cleanup]);

  const playAudio = useCallback(async (audioUrl?: string, promptText?: string) => {
    if (promptText && promptText.trim()) {
      speakPrompt(promptText.trim());
      return;
    }

    if (!audioUrl) {
      setIsLoading(false);
      setIsPlaying(false);
      setHasPlayed(true);
      onEndedRef.current?.();
      return;
    }

    cleanup();
    setIsLoading(true);
    isPlayingRef.current = true;

    try {
      const audio = new Audio();
      audioRef.current = audio;

      audio.onplay = () => {
        setIsLoading(false);
        setIsPlaying(true);
      };

      const finish = () => {
        cleanup();
        setIsPlaying(false);
        setHasPlayed(true);
        onEndedRef.current?.();
      };

      audio.onended = finish;
      audio.onerror = () => {
        if (promptText && promptText.trim()) {
          speakPrompt(promptText.trim());
        } else {
          finish();
        }
      };

      audio.src = audioUrl;
      await audio.play();
    } catch {
      if (promptText && promptText.trim()) {
        speakPrompt(promptText.trim());
      } else {
        cleanup();
        setIsLoading(false);
        setIsPlaying(false);
        setHasPlayed(true);
        onEndedRef.current?.();
      }
    }
  }, [cleanup, speakPrompt]);

  useEffect(() => {
    return () => {
      cleanup();
    };
  }, [cleanup]);

  return {
    isPlaying,
    hasPlayed,
    isLoading,
    playAudio,
    speakPrompt,
    resetState,
    cleanup,
  };
}
