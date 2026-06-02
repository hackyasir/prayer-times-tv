/* @vitest-environment jsdom */
// ── SettingsContext.test.jsx ─────────────────────────────────────────────
//
// Tests cover src/context/SettingsContext.jsx — the central settings store.
//
// CRITICAL focus areas:
//   - Legacy `chimeEnabled` → `chimeAdhan`/`chimeIqamah` migration
//   - Legacy `eid` array → `eidFitr`/`eidAdha` migration (with label-based
//     kind guessing, preserving time/enabled)
//   - Draft/applied separation (drafts don't affect "live" settings until
//     applyDrafts() is called)
//   - localStorage persistence (settings survive a remount)
//   - useSettings() throws when used outside the provider (programmer error)
//
// These migrations are the kind of thing that breaks silently — a user
// upgrades, their saved config gets misinterpreted, and they don't notice
// until Eid week. Tests here are the safety net.

import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { SettingsProvider, useSettings, DEFAULTS } from '../SettingsContext.jsx';
import { STORAGE_KEY } from '../../lib/constants.js';

// Tiny wrapper that mounts the provider for hook tests.
const wrapper = ({ children }) => <SettingsProvider>{children}</SettingsProvider>;

describe('SettingsProvider — default state', () => {
  it('loads DEFAULTS when localStorage is empty', () => {
    const { result } = renderHook(() => useSettings(), { wrapper });
    expect(result.current.applied.method).toBe(DEFAULTS.method);
    expect(result.current.applied.shadow).toBe(DEFAULTS.shadow);
  });

  it('drafts and applied start identical', () => {
    const { result } = renderHook(() => useSettings(), { wrapper });
    expect(result.current.drafts).toEqual(result.current.applied);
  });

  it('default eidFitr has only the 1st slot enabled', () => {
    const { result } = renderHook(() => useSettings(), { wrapper });
    expect(result.current.applied.eidFitr[0].enabled).toBe(true);
    expect(result.current.applied.eidFitr[1].enabled).toBe(false);
    expect(result.current.applied.eidFitr[2].enabled).toBe(false);
  });

  it('default eidDaysBefore is 7 days (one week of pre-Eid banner)', () => {
    const { result } = renderHook(() => useSettings(), { wrapper });
    expect(result.current.applied.eidDaysBefore).toBe(7);
  });
});

describe('SettingsProvider — localStorage persistence', () => {
  it('reads pre-saved settings from localStorage on mount', () => {
    // Stash a known config BEFORE mounting the provider.
    const saved = { ...DEFAULTS, method: 'Dubai', shadow: 2, hijriOffset: 1 };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));

    const { result } = renderHook(() => useSettings(), { wrapper });
    expect(result.current.applied.method).toBe('Dubai');
    expect(result.current.applied.shadow).toBe(2);
    expect(result.current.applied.hijriOffset).toBe(1);
  });

  it('updateApplied persists changes to localStorage', () => {
    const { result } = renderHook(() => useSettings(), { wrapper });
    act(() => {
      result.current.updateApplied({ method: 'Tehran' });
    });
    expect(result.current.applied.method).toBe('Tehran');
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    expect(saved.method).toBe('Tehran');
  });

  it('updateDrafts does NOT persist (drafts are local until applied)', () => {
    const { result } = renderHook(() => useSettings(), { wrapper });
    act(() => {
      result.current.updateDrafts({ method: 'Karachi' });
    });
    expect(result.current.drafts.method).toBe('Karachi');
    // Drafts changed; applied did not.
    expect(result.current.applied.method).toBe(DEFAULTS.method);
    // localStorage should NOT have the draft value.
    const saved = localStorage.getItem(STORAGE_KEY);
    expect(saved).toBeNull();
  });

  it('applyDrafts commits drafts to applied and persists', () => {
    const { result } = renderHook(() => useSettings(), { wrapper });
    act(() => {
      result.current.updateDrafts({ method: 'Qatar' });
    });
    act(() => {
      result.current.applyDrafts();
    });
    expect(result.current.applied.method).toBe('Qatar');
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    expect(saved.method).toBe('Qatar');
  });
});

describe('SettingsProvider — draft / applied separation', () => {
  it('updateDrafts accepts partial object', () => {
    const { result } = renderHook(() => useSettings(), { wrapper });
    act(() => {
      result.current.updateDrafts({ method: 'Kuwait', shadow: 2 });
    });
    expect(result.current.drafts.method).toBe('Kuwait');
    expect(result.current.drafts.shadow).toBe(2);
  });

  it('updateDrafts accepts a function (previous-state update)', () => {
    const { result } = renderHook(() => useSettings(), { wrapper });
    act(() => {
      result.current.updateDrafts((prev) => ({ ...prev, method: 'Egypt' }));
    });
    expect(result.current.drafts.method).toBe('Egypt');
  });

  it('beginEditing resets drafts to current applied snapshot', () => {
    const { result } = renderHook(() => useSettings(), { wrapper });
    // Step 1: modify drafts but don't apply
    act(() => {
      result.current.updateDrafts({ method: 'Singapore' });
    });
    expect(result.current.drafts.method).toBe('Singapore');
    // Step 2: beginEditing should snap drafts back to applied (DEFAULTS).
    act(() => {
      result.current.beginEditing();
    });
    expect(result.current.drafts.method).toBe(DEFAULTS.method);
  });
});

describe('SettingsProvider — legacy migrations', () => {
  describe('chimeEnabled → chimeAdhan + chimeIqamah', () => {
    it('migrates chimeEnabled=true to both new fields', () => {
      const legacy = { ...DEFAULTS, chimeEnabled: true };
      delete legacy.chimeAdhan;
      delete legacy.chimeIqamah;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(legacy));

      const { result } = renderHook(() => useSettings(), { wrapper });
      expect(result.current.applied.chimeAdhan).toBe(true);
      expect(result.current.applied.chimeIqamah).toBe(true);
    });

    it('migrates chimeEnabled=false to both new fields as false', () => {
      const legacy = { ...DEFAULTS, chimeEnabled: false };
      delete legacy.chimeAdhan;
      delete legacy.chimeIqamah;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(legacy));

      const { result } = renderHook(() => useSettings(), { wrapper });
      expect(result.current.applied.chimeAdhan).toBe(false);
      expect(result.current.applied.chimeIqamah).toBe(false);
    });

    it('does NOT migrate when new fields already exist (new wins)', () => {
      const mixed = {
        ...DEFAULTS,
        chimeEnabled: true,
        chimeAdhan: false,
        chimeIqamah: false,
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(mixed));

      const { result } = renderHook(() => useSettings(), { wrapper });
      // New fields are preserved; legacy chimeEnabled is ignored.
      expect(result.current.applied.chimeAdhan).toBe(false);
      expect(result.current.applied.chimeIqamah).toBe(false);
    });
  });

  describe('eid array → eidFitr + eidAdha', () => {
    it('migrates a Fitr-labeled eid array to eidFitr', () => {
      const legacy = {
        ...DEFAULTS,
        eid: [
          { time: '08:30', iqamah: 25, enabled: true, label: 'Eid ul-Fitr' },
          { time: '09:30', iqamah: 25, enabled: false, label: 'Eid ul-Fitr' },
          { time: '', iqamah: 20, enabled: false, label: 'Eid ul-Fitr' },
        ],
      };
      delete legacy.eidFitr;
      delete legacy.eidAdha;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(legacy));

      const { result } = renderHook(() => useSettings(), { wrapper });
      // eidFitr should have the migrated values.
      expect(result.current.applied.eidFitr[0]).toEqual({
        time: '08:30',
        enabled: true,
      });
      expect(result.current.applied.eidFitr[1]).toEqual({
        time: '09:30',
        enabled: false,
      });
      // eidAdha should fall back to DEFAULTS (untouched).
      expect(result.current.applied.eidAdha).toEqual(DEFAULTS.eidAdha);
    });

    it('migrates an Adha-labeled eid array to eidAdha', () => {
      const legacy = {
        ...DEFAULTS,
        eid: [{ time: '07:00', iqamah: 20, enabled: true, label: 'Eid ul-Adha' }],
      };
      delete legacy.eidFitr;
      delete legacy.eidAdha;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(legacy));

      const { result } = renderHook(() => useSettings(), { wrapper });
      expect(result.current.applied.eidAdha[0]).toEqual({
        time: '07:00',
        enabled: true,
      });
      // eidFitr falls back to DEFAULTS.
      expect(result.current.applied.eidFitr).toEqual(DEFAULTS.eidFitr);
    });

    it('strips the `label` field during migration (no longer needed)', () => {
      const legacy = {
        ...DEFAULTS,
        eid: [{ time: '08:00', iqamah: 20, enabled: true, label: 'Eid ul-Fitr' }],
      };
      delete legacy.eidFitr;
      delete legacy.eidAdha;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(legacy));

      const { result } = renderHook(() => useSettings(), { wrapper });
      expect(result.current.applied.eidFitr[0]).not.toHaveProperty('label');
    });

    it('preserves the enabled flag during migration', () => {
      const legacy = {
        ...DEFAULTS,
        eid: [
          { time: '08:00', iqamah: 20, enabled: true, label: 'Eid ul-Fitr' },
          { time: '09:00', iqamah: 20, enabled: false, label: 'Eid ul-Fitr' },
        ],
      };
      delete legacy.eidFitr;
      delete legacy.eidAdha;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(legacy));

      const { result } = renderHook(() => useSettings(), { wrapper });
      expect(result.current.applied.eidFitr[0].enabled).toBe(true);
      expect(result.current.applied.eidFitr[1].enabled).toBe(false);
    });

    it('defaults guessed kind to Fitr when label is missing/ambiguous', () => {
      const legacy = {
        ...DEFAULTS,
        eid: [{ time: '08:00', iqamah: 20, enabled: true }], // no label
      };
      delete legacy.eidFitr;
      delete legacy.eidAdha;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(legacy));

      const { result } = renderHook(() => useSettings(), { wrapper });
      // Defaults to Fitr when label doesn't include "adha".
      expect(result.current.applied.eidFitr[0].time).toBe('08:00');
      expect(result.current.applied.eidAdha).toEqual(DEFAULTS.eidAdha);
    });

    it('does NOT migrate when both new fields already exist (new wins)', () => {
      const mixed = {
        ...DEFAULTS,
        eid: [{ time: '06:00', iqamah: 15, enabled: true, label: 'Eid ul-Fitr' }],
        // New fields present — should take precedence.
        eidFitr: [{ time: '08:00', enabled: true }],
        eidAdha: [{ time: '07:30', enabled: true }],
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(mixed));

      const { result } = renderHook(() => useSettings(), { wrapper });
      // Pre-existing eidFitr is preserved; legacy eid is ignored.
      expect(result.current.applied.eidFitr[0].time).toBe('08:00');
    });
  });
});

describe('useSettings — outside provider', () => {
  it('throws an explicit error when called without a SettingsProvider', () => {
    // Capture console.error so the expected throw doesn't pollute test output.
    // (React logs the error before re-throwing.)
    const originalError = console.error;
    console.error = () => { };
    try {
      expect(() => renderHook(() => useSettings())).toThrow(/outside.*SettingsProvider/i);
    } finally {
      console.error = originalError;
    }
  });
});
