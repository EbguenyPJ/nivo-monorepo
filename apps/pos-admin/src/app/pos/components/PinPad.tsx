'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@nivo/ui';
import { Delete, Check, Loader2 } from 'lucide-react';

interface PinPadProps {
  onSubmit: (pin: string) => void;
  loading?: boolean;
  error?: string;
  maxLength?: number;
}

export function PinPad({ onSubmit, loading = false, error, maxLength = 6 }: PinPadProps) {
  const [pin, setPin] = useState('');
  const [shake, setShake] = useState(false);

  // Trigger shake on error
  useEffect(() => {
    if (error) {
      setShake(true);
      setPin('');
      const timer = setTimeout(() => setShake(false), 500);
      return () => clearTimeout(timer);
    }
  }, [error]);

  const addDigit = useCallback((digit: string) => {
    if (loading) return;
    setPin((prev) => (prev.length < maxLength ? prev + digit : prev));
  }, [loading, maxLength]);

  const removeDigit = useCallback(() => {
    if (loading) return;
    setPin((prev) => prev.slice(0, -1));
  }, [loading]);

  const submit = useCallback(() => {
    if (pin.length === 0 || loading) return;
    onSubmit(pin);
  }, [pin, loading, onSubmit]);

  // Keyboard support
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key >= '0' && e.key <= '9') {
        addDigit(e.key);
      } else if (e.key === 'Backspace') {
        removeDigit();
      } else if (e.key === 'Enter') {
        submit();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [addDigit, removeDigit, submit]);

  return (
    <div className="flex flex-col items-center gap-6">
      {/* PIN dots display */}
      <div className={`flex items-center gap-3 ${shake ? 'animate-shake' : ''}`}>
        {Array.from({ length: maxLength }).map((_, i) => (
          <div
            key={i}
            className={`w-4 h-4 rounded-full transition-all duration-150 ${
              i < pin.length
                ? 'bg-primary scale-110'
                : 'bg-muted-foreground/20'
            }`}
          />
        ))}
      </div>

      {/* Error message */}
      {error && (
        <p className="text-sm text-destructive font-medium">{error}</p>
      )}

      {/* Numpad grid */}
      <div className="grid grid-cols-3 gap-3">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((digit) => (
          <Button
            key={digit}
            variant="outline"
            className="w-16 h-16 text-xl font-semibold rounded-xl hover:bg-accent transition-colors"
            onClick={() => addDigit(String(digit))}
            disabled={loading}
          >
            {digit}
          </Button>
        ))}
        <Button
          variant="outline"
          className="w-16 h-16 rounded-xl hover:bg-accent transition-colors"
          onClick={removeDigit}
          disabled={loading}
        >
          <Delete className="h-5 w-5" />
        </Button>
        <Button
          variant="outline"
          className="w-16 h-16 text-xl font-semibold rounded-xl hover:bg-accent transition-colors"
          onClick={() => addDigit('0')}
          disabled={loading}
        >
          0
        </Button>
        <Button
          variant="default"
          className="w-16 h-16 rounded-xl transition-colors"
          onClick={submit}
          disabled={pin.length === 0 || loading}
        >
          {loading ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <Check className="h-5 w-5" />
          )}
        </Button>
      </div>

      {/* Shake animation style */}
      <style jsx global>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          20% { transform: translateX(-8px); }
          40% { transform: translateX(8px); }
          60% { transform: translateX(-6px); }
          80% { transform: translateX(6px); }
        }
        .animate-shake {
          animation: shake 0.4s ease-in-out;
        }
      `}</style>
    </div>
  );
}
