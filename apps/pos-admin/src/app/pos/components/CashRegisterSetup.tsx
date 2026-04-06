'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Button, Input, Badge, toast } from '@nivo/ui';
import {
  Lock, MapPin, ArrowLeft, Delete, Check, DollarSign, User,
  ArrowRight, Loader2, Clock, Monitor,
} from 'lucide-react';
import Link from 'next/link';
import { usePosSessionStore } from '@/store/posSessionStore';
import { useBranchStore } from '@/store/branchStore';
import { usePinLockout } from '../hooks/usePinLockout';

interface CashRegisterInfo {
  id: string;
  name: string;
}

interface RegisterSessionInfo {
  cash_register_id: string;
  cash_register_name: string;
  employee_id: string;
  employee_name: string;
  session_id: string;
  opened_at: string;
  opening_amount: number;
}

interface CashRegisterSetupProps {
  onReady: () => void;
}

type Step = 'pin' | 'register' | 'amount';

export function CashRegisterSetup({ onReady }: CashRegisterSetupProps) {
  const [step, setStep] = useState<Step>('pin');
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [shaking, setShaking] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [openingAmount, setOpeningAmount] = useState('0');
  const [opening, setOpening] = useState(false);

  // Register selection state
  const [cashRegisters, setCashRegisters] = useState<CashRegisterInfo[]>([]);
  const [registerSessions, setRegisterSessions] = useState<RegisterSessionInfo[]>([]);
  const [selectedRegister, setSelectedRegister] = useState<CashRegisterInfo | null>(null);
  const [selectedRegisterSession, setSelectedRegisterSession] = useState<RegisterSessionInfo | null>(null);

  const { verifyPin, openSession, switchCashier, posEmployee } = usePosSessionStore();
  const { selectedBranchId, selectedBranchName } = useBranchStore();
  const { isLocked, remainingFormatted, attemptsRemaining, registerFailedAttempt, registerSuccess } = usePinLockout();
  const amountInputRef = useRef<HTMLInputElement>(null);

  const MAX_PIN_LENGTH = 6;

  // ─── PIN input via keyboard ─────────────────────────────────

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (step !== 'pin' || verifying || isLocked) return;
      if (e.key >= '0' && e.key <= '9') {
        setPin((p) => (p.length < MAX_PIN_LENGTH ? p + e.key : p));
        setError('');
      } else if (e.key === 'Backspace') {
        setPin((p) => p.slice(0, -1));
        setError('');
      } else if (e.key === 'Enter') {
        e.preventDefault();
      }
    },
    [step, verifying],
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  // ─── Submit PIN ────────────────────────────────────────────

  // Helper: take over an existing register session (just switch operator, no amount)
  const takeOverRegister = useCallback(async (regSession: RegisterSessionInfo, employeeName: string) => {
    try {
      await switchCashier(regSession.session_id, posEmployee!.id);
      toast({
        title: 'Caja activa',
        description: `Bienvenido, ${employeeName}`,
      });
      onReady();
    } catch (err: any) {
      toast({
        title: 'Error',
        description: err.response?.data?.message || 'No se pudo tomar la caja',
        variant: 'destructive',
      });
    }
  }, [switchCashier, posEmployee, onReady]);

  const submitPin = useCallback(async () => {
    if (pin.length < 4 || !selectedBranchId || verifying || isLocked) return;

    setVerifying(true);
    setError('');
    try {
      const result = await verifyPin(pin, selectedBranchId);
      registerSuccess();

      // Store register data for next steps
      setCashRegisters(result.cash_registers);
      setRegisterSessions(result.register_sessions);

      if (result.has_active_session && result.session) {
        // This employee already has an open session (is the current operator) → go straight to POS
        toast({ title: 'Caja activa', description: `Bienvenido, ${result.employee.name}` });
        onReady();
      } else if (result.cash_registers.length === 1) {
        // Only one register → auto-select
        const reg = result.cash_registers[0];
        const regSession = result.register_sessions.find(
          (rs) => rs.cash_register_id === reg.id,
        );

        setSelectedRegister(reg);

        if (regSession) {
          // Register already has an open session → just switch operator (no amount needed)
          await takeOverRegister(regSession, result.employee.name);
        } else {
          // Register is free → need to open with initial amount
          setSelectedRegisterSession(null);
          setStep('amount');
          setTimeout(() => amountInputRef.current?.focus(), 100);
        }
      } else {
        // Multiple registers → show register selection
        setStep('register');
      }
    } catch (err: any) {
      registerFailedAttempt();
      setError(err.response?.data?.message || 'PIN invalido');
      setShaking(true);
      setTimeout(() => {
        setShaking(false);
        setPin('');
      }, 500);
    } finally {
      setVerifying(false);
    }
  }, [pin, selectedBranchId, verifying, isLocked, verifyPin, registerSuccess, registerFailedAttempt, takeOverRegister, onReady]);

  // Listen for Enter on PIN
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (step === 'pin' && e.key === 'Enter') {
        submitPin();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [step, submitPin]);

  // ─── Numpad press ──────────────────────────────────────────

  const handleNumpad = (digit: string) => {
    if (verifying) return;
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

  // ─── Select a cash register ────────────────────────────────

  const handleSelectRegister = async (reg: CashRegisterInfo) => {
    const regSession = registerSessions.find(
      (rs) => rs.cash_register_id === reg.id,
    );

    setSelectedRegister(reg);

    if (regSession && regSession.employee_id === posEmployee?.id) {
      // Same employee returning to their register → go straight to POS
      toast({ title: 'Caja activa', description: `Bienvenido de nuevo, ${posEmployee.name}` });
      onReady();
      return;
    }

    if (regSession) {
      // Register already has an open session by another employee → switch operator directly
      await takeOverRegister(regSession, posEmployee?.name || 'Cajero');
      return;
    }

    // Register is free → need opening amount
    setSelectedRegisterSession(null);
    setStep('amount');
    setTimeout(() => amountInputRef.current?.focus(), 100);
  };

  // ─── Open session (fresh — register has no active session) ──

  const handleOpenSession = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!posEmployee || !selectedBranchId || !selectedRegister || opening) return;

    setOpening(true);
    try {
      {
        await openSession(
          selectedBranchId,
          parseFloat(openingAmount) || 0,
          posEmployee.id,
          selectedRegister.id,
        );
        toast({
          title: 'Caja abierta',
          description: `Turno iniciado con $${(parseFloat(openingAmount) || 0).toFixed(2)} de fondo`,
        });
      }
      onReady();
    } catch (err: any) {
      toast({
        title: 'Error',
        description: err.response?.data?.message || 'No se pudo abrir la caja',
        variant: 'destructive',
      });
    } finally {
      setOpening(false);
    }
  };

  // ─── PIN dots display ──────────────────────────────────────

  const renderPinDots = () => {
    const dots = [];
    for (let i = 0; i < MAX_PIN_LENGTH; i++) {
      dots.push(
        <div
          key={i}
          className={`w-4 h-4 rounded-full transition-all duration-150 ${
            i < pin.length
              ? 'bg-primary scale-110'
              : 'bg-muted-foreground/20 border border-muted-foreground/30'
          }`}
        />,
      );
    }
    return dots;
  };

  // ─── Render ────────────────────────────────────────────────

  return (
    <div className="h-screen flex items-center justify-center bg-background relative">
      {/* Background pattern */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-primary/5" />

      {step === 'pin' ? (
        /* ─── PIN Step ──────────────────────────────────────── */
        <div className={`relative z-10 w-full max-w-sm mx-4 ${shaking ? 'animate-shake' : ''}`}>
          <div className="rounded-2xl bg-card/80 backdrop-blur-xl border border-border/50 shadow-2xl p-8">
            {/* Header */}
            <div className="text-center mb-8">
              <div className="mx-auto w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                <Lock className="h-7 w-7 text-primary" />
              </div>
              <h1 className="text-2xl font-bold text-foreground">Desbloquear Caja</h1>
              <p className="text-sm text-muted-foreground mt-1">Ingresa tu PIN para iniciar</p>
            </div>

            {/* Branch indicator */}
            <div className="flex items-center justify-center gap-2 mb-8">
              <Badge variant="outline" className="text-xs px-3 py-1.5">
                <MapPin className="h-3 w-3 mr-1.5" />
                {selectedBranchName || 'Sin sucursal'}
              </Badge>
            </div>

            {/* PIN dots or lockout */}
            {isLocked ? (
              <div className="text-center mb-8">
                <div className="mx-auto w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center mb-3">
                  <Lock className="h-6 w-6 text-destructive" />
                </div>
                <p className="text-sm font-medium text-destructive mb-1">Demasiados intentos fallidos</p>
                <p className="text-2xl font-bold text-foreground tabular-nums">{remainingFormatted}</p>
                <p className="text-xs text-muted-foreground mt-1">Intenta de nuevo cuando termine el bloqueo</p>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-center gap-3 mb-4 h-6">
                  {renderPinDots()}
                </div>

                {/* Error message */}
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

          {/* Back link */}
          <div className="text-center mt-6">
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              Volver al Dashboard
            </Link>
          </div>
        </div>
      ) : step === 'register' ? (
        /* ─── Register Selection Step ───────────────────────── */
        <div className="relative z-10 w-full max-w-sm mx-4">
          <div className="rounded-2xl bg-card/80 backdrop-blur-xl border border-border/50 shadow-2xl p-8">
            {/* Header */}
            <div className="text-center mb-6">
              <div className="mx-auto w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                <Monitor className="h-7 w-7 text-primary" />
              </div>
              <h1 className="text-2xl font-bold text-foreground">Selecciona tu Caja</h1>
              <div className="flex items-center justify-center gap-2 mt-2">
                <User className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">{posEmployee?.name}</span>
              </div>
            </div>

            {/* Register list */}
            <div className="space-y-3 mb-6">
              {cashRegisters.map((reg) => {
                const regSession = registerSessions.find(
                  (rs) => rs.cash_register_id === reg.id,
                );
                const isOwnSession = regSession && regSession.employee_id === posEmployee?.id;
                const isOccupied = !!regSession && !isOwnSession;

                return (
                  <button
                    key={reg.id}
                    type="button"
                    onClick={() => handleSelectRegister(reg)}
                    className={`w-full rounded-xl border p-4 text-left transition-all duration-150 hover:shadow-md active:scale-[0.98] ${
                      isOccupied
                        ? 'border-amber-500/30 bg-amber-500/5 hover:bg-amber-500/10'
                        : isOwnSession
                          ? 'border-primary/30 bg-primary/5 hover:bg-primary/10'
                          : 'border-border hover:bg-muted/50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                          isOccupied
                            ? 'bg-amber-500/10'
                            : isOwnSession
                              ? 'bg-primary/10'
                              : 'bg-muted'
                        }`}>
                          <Monitor className={`h-5 w-5 ${
                            isOccupied
                              ? 'text-amber-500'
                              : isOwnSession
                                ? 'text-primary'
                                : 'text-muted-foreground'
                          }`} />
                        </div>
                        <div>
                          <p className="font-semibold text-foreground">{reg.name}</p>
                          {isOwnSession ? (
                            <p className="text-xs text-primary font-medium">Tu sesion activa</p>
                          ) : isOccupied ? (
                            <p className="text-xs text-amber-600 dark:text-amber-400">
                              Operada por: {regSession!.employee_name}
                            </p>
                          ) : (
                            <p className="text-xs text-muted-foreground">Disponible</p>
                          )}
                        </div>
                      </div>
                      <ArrowRight className="h-4 w-4 text-muted-foreground" />
                    </div>
                    {isOccupied && regSession && (
                      <div className="mt-2 pt-2 border-t border-amber-500/20 flex items-center gap-3 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {new Date(regSession.opened_at).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                        <span className="flex items-center gap-1">
                          <DollarSign className="h-3 w-3" />
                          ${Number(regSession.opening_amount).toFixed(2)}
                        </span>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Back button */}
            <Button
              variant="outline"
              size="lg"
              className="w-full h-12 rounded-xl"
              onClick={() => {
                setStep('pin');
                setPin('');
              }}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Volver
            </Button>
          </div>
        </div>
      ) : (
        /* ─── Amount Step (only shown when register has NO active session) */
        <div className="relative z-10 w-full max-w-sm mx-4">
          <div className="rounded-2xl bg-card/80 backdrop-blur-xl border border-border/50 shadow-2xl p-8">
            {/* Header */}
            <div className="text-center mb-6">
              <div className="mx-auto w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                <DollarSign className="h-7 w-7 text-primary" />
              </div>
              <h1 className="text-2xl font-bold text-foreground">Apertura de Caja</h1>
            </div>

            {/* Employee, branch & register info */}
            <div className="flex flex-col items-center gap-2 mb-6">
              <div className="flex items-center gap-2 text-sm">
                <User className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium text-foreground">{posEmployee?.name || 'Cajero'}</span>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-xs px-3 py-1.5">
                  <MapPin className="h-3 w-3 mr-1.5" />
                  {selectedBranchName}
                </Badge>
                {selectedRegister && (
                  <Badge variant="secondary" className="text-xs px-3 py-1.5">
                    <Monitor className="h-3 w-3 mr-1.5" />
                    {selectedRegister.name}
                  </Badge>
                )}
              </div>
            </div>

            {/* Amount input */}
            <form onSubmit={handleOpenSession}>
              <div className="mb-6">
                <label className="block text-sm font-medium text-center text-muted-foreground mb-3">
                  Fondo de Caja Inicial (Efectivo en cajon)
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-2xl font-bold text-muted-foreground">
                    $
                  </span>
                  <Input
                    ref={amountInputRef}
                    type="number"
                    min="0"
                    step="0.01"
                    value={openingAmount}
                    onChange={(e) => setOpeningAmount(e.target.value)}
                    className="h-16 text-3xl font-bold text-center pl-10 pr-4 rounded-xl"
                    autoFocus
                  />
                </div>
                <p className="text-xs text-muted-foreground text-center mt-2">
                  Ingresa la cantidad de efectivo con la que inicias tu turno.
                </p>
              </div>

              <div className="space-y-3">
                <Button
                  type="submit"
                  size="lg"
                  disabled={opening}
                  className="w-full h-14 text-base font-bold rounded-xl gap-2"
                >
                  {opening ? (
                    <>
                      <Loader2 className="h-5 w-5 animate-spin" />
                      Abriendo...
                    </>
                  ) : (
                    <>
                      Iniciar Turno
                      <ArrowRight className="h-5 w-5" />
                    </>
                  )}
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  size="lg"
                  className="w-full h-12 rounded-xl"
                  onClick={() => {
                    if (cashRegisters.length > 1) {
                      setStep('register');
                    } else {
                      setStep('pin');
                      setPin('');
                    }
                    setSelectedRegisterSession(null);
                  }}
                >
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Volver
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

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
