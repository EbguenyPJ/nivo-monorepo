'use client';

import { useState, useEffect, useCallback } from 'react';
import { Badge, toast } from '@nivo/ui';
import {
  Delete, Check, Loader2, X, User, Monitor, Lock,
} from 'lucide-react';
import { usePosSessionStore } from '@/store/posSessionStore';
import { useBranchStore } from '@/store/branchStore';
import { apiClient } from '@/lib/api';
import { usePinLockout } from '../hooks/usePinLockout';

interface SwitchCashierDialogProps {
  open: boolean;
  onClose: () => void;
  onSwitched: () => void;
}

export function SwitchCashierDialog({ open, onClose, onSwitched }: SwitchCashierDialogProps) {
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [shaking, setShaking] = useState(false);
  const [verifying, setVerifying] = useState(false);

  const { session, posEmployee, cashRegister, switchCashier } = usePosSessionStore();
  const { selectedBranchId } = useBranchStore();
  const { isLocked, remainingFormatted, attemptsRemaining, registerFailedAttempt, registerSuccess } = usePinLockout();

  const MAX_PIN_LENGTH = 6;

  // Reset state when dialog opens
  useEffect(() => {
    if (open) {
      setPin('');
      setError('');
      setShaking(false);
      setVerifying(false);
    }
  }, [open]);

  // ─── Submit PIN → switch immediately ───────────────────────

  const submitPin = useCallback(async () => {
    if (pin.length < 4 || !selectedBranchId || !session || verifying || isLocked) return;

    setVerifying(true);
    setError('');
    try {
      // Verify the PIN to identify the employee
      const response = await apiClient.post('/pos/verify-pin', {
        pin_code: pin,
        branch_id: selectedBranchId,
      });
      const result = response.data;
      const emp = result.employee;
      registerSuccess();

      // Same employee → nothing to do
      if (emp.id === posEmployee?.id) {
        toast({ title: 'Ya estas operando esta caja' });
        onClose();
        return;
      }

      // Switch operator on the current session (no close/reopen, no amount)
      await switchCashier(session.id, emp.id);
      usePosSessionStore.setState({ posEmployee: emp });
      toast({
        title: 'Cajero cambiado',
        description: `Ahora opera: ${emp.name}`,
      });
      onSwitched();
    } catch (err: any) {
      const msg = err.response?.data?.message || 'PIN invalido';
      // Only count failed attempts for actual PIN errors (401), not other errors
      if (err.response?.status === 401) {
        registerFailedAttempt();
      }
      setError(msg);
      setShaking(true);
      setTimeout(() => {
        setShaking(false);
        setPin('');
      }, 500);
    } finally {
      setVerifying(false);
    }
  }, [pin, selectedBranchId, session, verifying, isLocked, posEmployee, switchCashier, registerSuccess, registerFailedAttempt, onClose, onSwitched]);

  // ─── Keyboard handler ──────────────────────────────────────

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!open || verifying || isLocked) return;
      if (e.key >= '0' && e.key <= '9') {
        setPin((p) => (p.length < MAX_PIN_LENGTH ? p + e.key : p));
        setError('');
      } else if (e.key === 'Backspace') {
        setPin((p) => p.slice(0, -1));
        setError('');
      } else if (e.key === 'Enter') {
        e.preventDefault();
        submitPin();
      } else if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, verifying, isLocked, submitPin, onClose]);

  // ─── Numpad press ──────────────────────────────────────────

  const handleNumpad = (digit: string) => {
    if (verifying || isLocked) return;
    if (digit === 'back') {
      setPin((p) => p.slice(0, -1));
      setError('');
    } else if (digit === 'enter') {
      submitPin();
    } else {
      setPin((p) => (p.length < MAX_PIN_LENGTH ? p + digit : p));
      setError('');
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-background/80 backdrop-blur-sm"
        onClick={onClose}
      />

      <div className={`relative z-10 w-full max-w-sm mx-4 ${shaking ? 'animate-shake' : ''}`}>
        <div className="rounded-2xl bg-card border border-border shadow-2xl p-8">
          {/* Close button */}
          <button
            type="button"
            onClick={onClose}
            className="absolute top-4 right-4 p-2 rounded-lg hover:bg-muted text-muted-foreground transition-colors"
          >
            <X className="h-4 w-4" />
          </button>

          {/* Header */}
          <div className="text-center mb-6">
            <h1 className="text-xl font-bold text-foreground">Cambiar Cajero</h1>
            <div className="flex items-center justify-center gap-2 mt-2">
              {cashRegister && (
                <Badge variant="outline" className="text-xs px-2 py-1 gap-1">
                  <Monitor className="h-3 w-3" />
                  {cashRegister.name}
                </Badge>
              )}
              {posEmployee && (
                <Badge variant="secondary" className="text-xs px-2 py-1 gap-1">
                  <User className="h-3 w-3" />
                  {posEmployee.name}
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Ingresa el PIN del nuevo cajero
            </p>
          </div>

          {/* PIN dots or lockout */}
          {isLocked ? (
            <div className="text-center mb-6">
              <div className="mx-auto w-10 h-10 rounded-full bg-destructive/10 flex items-center justify-center mb-2">
                <Lock className="h-5 w-5 text-destructive" />
              </div>
              <p className="text-sm font-medium text-destructive mb-1">Demasiados intentos</p>
              <p className="text-xl font-bold text-foreground tabular-nums">{remainingFormatted}</p>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-center gap-3 mb-4 h-6">
                {Array.from({ length: MAX_PIN_LENGTH }).map((_, i) => (
                  <div
                    key={i}
                    className={`w-4 h-4 rounded-full transition-all duration-150 ${
                      i < pin.length
                        ? 'bg-primary scale-110'
                        : 'bg-muted-foreground/20 border border-muted-foreground/30'
                    }`}
                  />
                ))}
              </div>

              {error && (
                <div className="text-center mb-4">
                  <p className="text-sm text-destructive font-medium">{error}</p>
                  {attemptsRemaining <= 3 && attemptsRemaining > 0 && (
                    <p className="text-xs text-muted-foreground mt-1">
                      {attemptsRemaining} {attemptsRemaining === 1 ? 'intento restante' : 'intentos restantes'}
                    </p>
                  )}
                </div>
              )}
            </>
          )}

          {/* Numpad */}
          <div className="grid grid-cols-3 gap-3 max-w-[240px] mx-auto">
            {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => handleNumpad(d)}
                disabled={verifying || isLocked}
                className="h-14 w-full rounded-xl bg-muted/50 hover:bg-muted text-xl font-semibold text-foreground transition-all duration-100 active:scale-95 disabled:opacity-50"
              >
                {d}
              </button>
            ))}
            <button
              type="button"
              onClick={() => handleNumpad('back')}
              disabled={verifying || isLocked}
              className="h-14 w-full rounded-xl bg-muted/50 hover:bg-muted flex items-center justify-center text-muted-foreground transition-all duration-100 active:scale-95 disabled:opacity-50"
            >
              <Delete className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={() => handleNumpad('0')}
              disabled={verifying || isLocked}
              className="h-14 w-full rounded-xl bg-muted/50 hover:bg-muted text-xl font-semibold text-foreground transition-all duration-100 active:scale-95 disabled:opacity-50"
            >
              0
            </button>
            <button
              type="button"
              onClick={() => handleNumpad('enter')}
              disabled={verifying || isLocked || pin.length < 4}
              className="h-14 w-full rounded-xl bg-primary hover:bg-primary/90 flex items-center justify-center text-primary-foreground transition-all duration-100 active:scale-95 disabled:opacity-50"
            >
              {verifying ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Check className="h-5 w-5" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Shake animation */}
      <style jsx global>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          10%, 30%, 50%, 70%, 90% { transform: translateX(-6px); }
          20%, 40%, 60%, 80% { transform: translateX(6px); }
        }
        .animate-shake {
          animation: shake 0.5s ease-in-out;
        }
      `}</style>
    </div>
  );
}
