'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

const MAX_ATTEMPTS = 5;
const LOCKOUT_DURATIONS = [60, 180, 300]; // seconds: 1 min, 3 min, 5 min
const STORAGE_KEY = 'nivo-pin-lockout';

interface LockoutState {
  failedAttempts: number;
  lockoutLevel: number; // 0 = first lockout (1min), 1 = second (3min), 2+ = third (5min)
  lockedUntil: number | null; // timestamp ms
}

function loadState(): LockoutState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      // If the lockout has already expired, reset attempts but keep level
      if (parsed.lockedUntil && Date.now() > parsed.lockedUntil) {
        return { failedAttempts: 0, lockoutLevel: parsed.lockoutLevel, lockedUntil: null };
      }
      return parsed;
    }
  } catch {}
  return { failedAttempts: 0, lockoutLevel: 0, lockedUntil: null };
}

function saveState(state: LockoutState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {}
}

export function usePinLockout() {
  const [state, setState] = useState<LockoutState>(loadState);
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Calculate remaining seconds from lockedUntil
  const updateRemaining = useCallback(() => {
    if (state.lockedUntil) {
      const diff = Math.max(0, Math.ceil((state.lockedUntil - Date.now()) / 1000));
      setRemainingSeconds(diff);
      if (diff === 0) {
        // Lockout expired — reset attempts, keep level
        const newState = { ...state, failedAttempts: 0, lockedUntil: null };
        setState(newState);
        saveState(newState);
      }
    } else {
      setRemainingSeconds(0);
    }
  }, [state]);

  // Timer to count down
  useEffect(() => {
    if (state.lockedUntil && Date.now() < state.lockedUntil) {
      updateRemaining();
      timerRef.current = setInterval(updateRemaining, 1000);
      return () => {
        if (timerRef.current) clearInterval(timerRef.current);
      };
    } else {
      setRemainingSeconds(0);
    }
  }, [state.lockedUntil, updateRemaining]);

  const isLocked = remainingSeconds > 0;

  const registerFailedAttempt = useCallback(() => {
    setState((prev) => {
      const newAttempts = prev.failedAttempts + 1;

      if (newAttempts >= MAX_ATTEMPTS) {
        // Activate lockout
        const levelIndex = Math.min(prev.lockoutLevel, LOCKOUT_DURATIONS.length - 1);
        const duration = LOCKOUT_DURATIONS[levelIndex] * 1000;
        const newState: LockoutState = {
          failedAttempts: newAttempts,
          lockoutLevel: prev.lockoutLevel + 1,
          lockedUntil: Date.now() + duration,
        };
        saveState(newState);
        return newState;
      }

      const newState = { ...prev, failedAttempts: newAttempts };
      saveState(newState);
      return newState;
    });
  }, []);

  const registerSuccess = useCallback(() => {
    const newState: LockoutState = { failedAttempts: 0, lockoutLevel: 0, lockedUntil: null };
    setState(newState);
    saveState(newState);
  }, []);

  const attemptsRemaining = MAX_ATTEMPTS - state.failedAttempts;

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return {
    isLocked,
    remainingSeconds,
    remainingFormatted: formatTime(remainingSeconds),
    attemptsRemaining: Math.max(0, attemptsRemaining),
    failedAttempts: state.failedAttempts,
    registerFailedAttempt,
    registerSuccess,
  };
}
