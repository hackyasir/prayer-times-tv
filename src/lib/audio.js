// ── Audio: prayer beep ───────────────────────────────────────────────────────
// Module-scoped singleton: one Audio element is lazily created on first use,
// then reused for every beep. This is important because browsers block
// HTMLAudioElement.play() unless the page has received a user gesture, so we
// need a stable element to "prime" (silently play+pause inside the first user
// interaction). Once primed, all subsequent .play() calls succeed — even from
// background timers like the iqamah trigger.
//
// Why module scope rather than React state: the audio singleton needs to
// survive React re-renders. State would re-create the Audio object each render
// and break the unlock contract.

let _beepAudio = null;
let _audioUnlocked = false;

function _getBeep() {
  if (!_beepAudio) {
    _beepAudio = new Audio(`${import.meta.env.BASE_URL || '/'}sounds/beep.mp3`);
    _beepAudio.preload = 'auto';
    _beepAudio.volume = 0.7;
  }
  return _beepAudio;
}

/**
 * Unlock the audio context by silently playing+pausing the beep inside a user
 * gesture handler. Must be called from a real user event (click/keypress/touch);
 * the browser will reject the .play() promise otherwise.
 *
 * Safe to call multiple times — no-ops once unlocked.
 */
export function primeAudio() {
  if (_audioUnlocked) return;
  try {
    const a = _getBeep();
    a.muted = true;
    const p = a.play();
    if (p && typeof p.then === 'function') {
      p.then(() => {
        a.pause();
        a.currentTime = 0;
        a.muted = false;
        _audioUnlocked = true;
      }).catch(() => { /* still blocked — try again next gesture */ });
    } else {
      a.pause(); a.currentTime = 0; a.muted = false; _audioUnlocked = true;
    }
  } catch { /* ignore */ }
}

/**
 * Play the beep sound. Used at adhan and iqamah times for each prayer.
 * Silently logs failures (autoplay block) — see primeAudio for prevention.
 */
export function playBeep() {
  try {
    const a = _getBeep();
    a.currentTime = 0;
    const p = a.play();
    if (p && typeof p.catch === 'function') {
      p.catch(e => console.warn('Beep autoplay blocked:', e));
    }
  } catch (e) {
    console.warn('Beep failed:', e);
  }
}

/** Whether the audio has been unlocked (true after a successful primeAudio()). */
export function isAudioUnlocked() {
  return _audioUnlocked;
}
