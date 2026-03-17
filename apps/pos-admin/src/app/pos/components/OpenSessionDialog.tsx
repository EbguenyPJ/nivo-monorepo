'use client';

import { useEffect, useState } from 'react';
import {
  Button, Input, Label,
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@nivo/ui';
import { apiClient } from '@/lib/api';

interface Branch {
  id: string;
  name: string;
}

interface OpenSessionDialogProps {
  open: boolean;
  onSessionOpened: () => void;
  onOpenSession: (branchId: string, openingAmount: number) => Promise<void>;
}

export function OpenSessionDialog({ open, onSessionOpened, onOpenSession }: OpenSessionDialogProps) {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [branchId, setBranchId] = useState('');
  const [openingAmount, setOpeningAmount] = useState('0');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {
      apiClient.get('/branches').then((res) => {
        setBranches(res.data);
        if (res.data.length > 0 && !branchId) {
          setBranchId(res.data[0].id);
        }
      }).catch(() => {});
    }
  }, [open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!branchId) {
      setError('Selecciona una sucursal');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await onOpenSession(branchId, parseFloat(openingAmount) || 0);
      onSessionOpened();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Error al abrir la caja');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent className="sm:max-w-md" onPointerDownOutside={(e) => e.preventDefault()}>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Abrir Caja</DialogTitle>
            <DialogDescription>
              Selecciona la sucursal e ingresa el monto de apertura para iniciar tu turno.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {error && (
              <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</div>
            )}
            <div className="space-y-2">
              <Label htmlFor="branch">Sucursal</Label>
              <select
                id="branch"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                value={branchId}
                onChange={(e) => setBranchId(e.target.value)}
                required
              >
                <option value="">Seleccionar sucursal...</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="opening-amount">Monto de Apertura ($)</Label>
              <Input
                id="opening-amount"
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                value={openingAmount}
                onChange={(e) => setOpeningAmount(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={loading} className="w-full">
              {loading ? 'Abriendo caja...' : 'Abrir Caja'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
