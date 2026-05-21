// ── useAudioUnlock — listen for first user gesture, unlock audio ────────────
//
// Browsers block audio.play() until the page receives a user gesture
// (click/keypress/touch). This hook listens globally on window for the first
// such gesture, calls primeAudio() to unlock the singleton, and reports back
// once unlocked so the UI can hide the "Tap to enable" banner.
//
// The listeners auto-remove once audioReady=true so we don't run them forever.

import { useState, useEffect } from 'react';
import { primeAudio, isAudioUnlocked } from '../lib/audio.js';

export default function useAudioUnlock() {
  const [audioReady, setAudioReady] = useState(() => isAudioUnlocked());

  useEffect(() => {
    if (audioReady) return;
    const onGesture = () => {
      primeAudio();
      // Wait a tick for the play() promise to resolve, then re-check
      setTimeout(() => {
        if (isAudioUnlocked()) setAudioReady(true);
      }, 200);
    };
    window.addEventListener('pointerdown', onGesture, { passive: true });
    window.addEventListener('keydown', onGesture, { passive: true });
    window.addEventListener('touchstart', onGesture, { passive: true });
    return () => {
      window.removeEventListener('pointerdown', onGesture);
      window.removeEventListener('keydown', onGesture);
      window.removeEventListener('touchstart', onGesture);
    };
  }, [audioReady]);

  return { audioReady, setAudioReady };
}
