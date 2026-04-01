'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Button, Input, Label, Badge, Skeleton, toast, cn,
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
  Tabs, TabsList, TabsTrigger,
} from '@nivo/ui';
import { Plus, GripVertical, Trash2, X } from 'lucide-react';
import { apiClient } from '@/lib/api';

// ─── Types ───────────────────────────────────────────────────
interface SizeSystem {
  id: string;
  name: string;
  is_active: boolean;
}

interface SizeGroup {
  id: string;
  name: string;
  is_active: boolean;
}

interface SizeEquivalency {
  id: string;
  size_system_id: string;
  value: string;
  sizeSystem: SizeSystem;
}

interface SizeRow {
  id: string;
  size_group_id: string;
  order_index: number;
  equivalencies: SizeEquivalency[];
}

// ─── Editable Cell ──────────────────────────────────────────
function InlineCell({
  value,
  onSave,
  placeholder,
  className: extraCn,
}: {
  value: string;
  onSave: (v: string) => Promise<void>;
  placeholder?: string;
  className?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [editVal, setEditVal] = useState(value);
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  useEffect(() => {
    if (!editing) setEditVal(value);
  }, [value, editing]);

  const handleSave = async () => {
    const trimmed = editVal.trim();
    if (trimmed === value) {
      setEditing(false);
      return;
    }
    setSaving(true);
    try {
      await onSave(trimmed);
      setEditing(false);
    } catch {
      setEditVal(value);
      setEditing(false);
    }
    setSaving(false);
  };

  if (editing) {
    return (
      <Input
        ref={inputRef}
        value={editVal}
        onChange={(e) => setEditVal(e.target.value)}
        onBlur={handleSave}
        onKeyDown={(e) => {
          if (e.key === 'Enter') handleSave();
          if (e.key === 'Escape') { setEditVal(value); setEditing(false); }
          // Tab to next cell
          if (e.key === 'Tab') {
            e.preventDefault();
            handleSave();
          }
        }}
        disabled={saving}
        className={cn('h-8 text-sm text-center w-full', extraCn)}
        placeholder={placeholder}
      />
    );
  }

  return (
    <span
      onClick={() => setEditing(true)}
      className={cn(
        'cursor-pointer hover:bg-muted/50 px-2 py-1 rounded text-sm transition-colors inline-block w-full text-center min-h-[32px] leading-[32px]',
        !value && 'text-muted-foreground/40 italic',
        extraCn,
      )}
      title="Clic para editar"
    >
      {value || '—'}
    </span>
  );
}

// ═══════════════════════════════════════════════════════════════
// Main Component
// ═══════════════════════════════════════════════════════════════
export function SizesMatrix() {
  const [groups, setGroups] = useState<SizeGroup[]>([]);
  const [systems, setSystems] = useState<SizeSystem[]>([]);
  const [sizes, setSizes] = useState<SizeRow[]>([]);
  const [activeGroupId, setActiveGroupId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingSizes, setLoadingSizes] = useState(false);

  // Dialogs
  const [newGroupDialog, setNewGroupDialog] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [newSystemDialog, setNewSystemDialog] = useState(false);
  const [newSystemName, setNewSystemName] = useState('');
  const [savingDialog, setSavingDialog] = useState(false);

  // Adding new row
  const [addingRow, setAddingRow] = useState(false);
  const [newRowValues, setNewRowValues] = useState<Record<string, string>>({});

  // Drag state
  const dragIdx = useRef<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);

  // ─── Fetch groups + systems ─────────────────────────────────
  const fetchMeta = useCallback(async () => {
    try {
      const [gRes, sRes] = await Promise.all([
        apiClient.get('/catalogs/size-groups'),
        apiClient.get('/catalogs/size-systems'),
      ]);
      setGroups(gRes.data);
      setSystems(sRes.data.filter((s: SizeSystem) => s.is_active));
      // Auto-select first group
      if (gRes.data.length > 0 && !activeGroupId) {
        setActiveGroupId(gRes.data[0].id);
      }
    } catch {
      toast({ title: 'Error al cargar datos', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMeta();
  }, [fetchMeta]);

  // ─── Fetch sizes for active group ──────────────────────────
  const fetchSizes = useCallback(async () => {
    if (!activeGroupId) return;
    setLoadingSizes(true);
    try {
      const res = await apiClient.get(`/catalogs/sizes?group_id=${activeGroupId}`);
      setSizes(res.data);
    } catch {
      toast({ title: 'Error al cargar tallas', variant: 'destructive' });
    } finally {
      setLoadingSizes(false);
    }
  }, [activeGroupId]);

  useEffect(() => {
    fetchSizes();
    setAddingRow(false);
    setNewRowValues({});
  }, [fetchSizes]);

  // ─── Cell value helper ─────────────────────────────────────
  const getCellValue = (row: SizeRow, systemId: string): string => {
    const eq = row.equivalencies.find((e) => e.size_system_id === systemId);
    return eq?.value || '';
  };

  // ─── Update a cell ─────────────────────────────────────────
  const handleCellSave = async (sizeId: string, systemId: string, value: string) => {
    try {
      await apiClient.patch(`/catalogs/sizes/${sizeId}/equivalencies`, {
        equivalencies: [{ size_system_id: systemId, value }],
      });
      // Optimistic update
      setSizes((prev) =>
        prev.map((s) => {
          if (s.id !== sizeId) return s;
          const eqs = [...s.equivalencies];
          const existing = eqs.findIndex((e) => e.size_system_id === systemId);
          if (existing >= 0) {
            if (value) {
              eqs[existing] = { ...eqs[existing], value };
            } else {
              eqs.splice(existing, 1);
            }
          } else if (value) {
            eqs.push({
              id: 'temp-' + Date.now(),
              size_system_id: systemId,
              value,
              sizeSystem: systems.find((ss) => ss.id === systemId) as SizeSystem,
            });
          }
          return { ...s, equivalencies: eqs };
        }),
      );
    } catch {
      toast({ title: 'Error al actualizar', variant: 'destructive' });
      throw new Error();
    }
  };

  // ─── Add new row ───────────────────────────────────────────
  const handleAddRow = async () => {
    const hasValues = Object.values(newRowValues).some((v) => v.trim());
    if (!hasValues || !activeGroupId) return;

    try {
      await apiClient.post('/catalogs/sizes', {
        size_group_id: activeGroupId,
        equivalencies: systems.map((sys) => ({
          size_system_id: sys.id,
          value: newRowValues[sys.id] || '',
        })),
      });
      setAddingRow(false);
      setNewRowValues({});
      await fetchSizes();
    } catch (error: any) {
      toast({ title: 'Error', description: error.response?.data?.message || 'Error al crear talla', variant: 'destructive' });
    }
  };

  // ─── Delete row ────────────────────────────────────────────
  const handleDeleteRow = async (sizeId: string) => {
    try {
      await apiClient.delete(`/catalogs/sizes/${sizeId}`);
      setSizes((prev) => prev.filter((s) => s.id !== sizeId));
    } catch {
      toast({ title: 'Error al eliminar', variant: 'destructive' });
    }
  };

  // ─── Drag & Drop reorder ──────────────────────────────────
  const handleDragStart = (idx: number) => {
    dragIdx.current = idx;
  };

  const handleDragOver = (e: React.DragEvent, idx: number) => {
    e.preventDefault();
    setDragOverIdx(idx);
  };

  const handleDrop = async (idx: number) => {
    const from = dragIdx.current;
    if (from === null || from === idx) {
      dragIdx.current = null;
      setDragOverIdx(null);
      return;
    }

    // Reorder locally
    const reordered = [...sizes];
    const [moved] = reordered.splice(from, 1);
    reordered.splice(idx, 0, moved);
    setSizes(reordered);

    dragIdx.current = null;
    setDragOverIdx(null);

    // Persist order
    try {
      await apiClient.patch('/catalogs/sizes/reorder', {
        items: reordered.map((s, i) => ({ id: s.id, order_index: i })),
      });
    } catch {
      toast({ title: 'Error al reordenar', variant: 'destructive' });
      fetchSizes(); // revert
    }
  };

  // ─── Add group ─────────────────────────────────────────────
  const handleAddGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGroupName.trim()) return;
    setSavingDialog(true);
    try {
      const res = await apiClient.post('/catalogs/size-groups', { name: newGroupName.trim() });
      setGroups((prev) => [...prev, res.data]);
      setActiveGroupId(res.data.id);
      setNewGroupDialog(false);
      setNewGroupName('');
      toast({ title: `Grupo "${res.data.name}" creado` });
    } catch (error: any) {
      toast({ title: 'Error', description: error.response?.data?.message || 'Error', variant: 'destructive' });
    } finally {
      setSavingDialog(false);
    }
  };

  // ─── Add system ────────────────────────────────────────────
  const handleAddSystem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSystemName.trim()) return;
    setSavingDialog(true);
    try {
      const res = await apiClient.post('/catalogs/size-systems', { name: newSystemName.trim().toUpperCase() });
      setSystems((prev) => [...prev, res.data]);
      setNewSystemDialog(false);
      setNewSystemName('');
      toast({ title: `Sistema "${res.data.name}" creado` });
    } catch (error: any) {
      toast({ title: 'Error', description: error.response?.data?.message || 'Error', variant: 'destructive' });
    } finally {
      setSavingDialog(false);
    }
  };

  // ─── Loading ───────────────────────────────────────────────
  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const activeGroup = groups.find((g) => g.id === activeGroupId);

  return (
    <div className="space-y-4">
      {/* Group Tabs */}
      <div className="flex items-center gap-2">
        {groups.length > 0 && (
          <Tabs value={activeGroupId || ''} onValueChange={setActiveGroupId} className="flex-1">
            <TabsList>
              {groups.filter((g) => g.is_active).map((g) => (
                <TabsTrigger key={g.id} value={g.id}>
                  {g.name}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        )}
        <Button variant="outline" size="sm" className="gap-1 shrink-0" onClick={() => setNewGroupDialog(true)}>
          <Plus className="h-3.5 w-3.5" />
          Grupo
        </Button>
      </div>

      {!activeGroupId ? (
        <div className="text-center text-muted-foreground py-12 text-sm">
          Crea un grupo de tallas para comenzar (ej. Hombre, Mujer, Niño).
        </div>
      ) : (
        <>
          {/* Size Matrix Table */}
          <div className="border rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/40 border-b">
                    <th className="w-10 px-2 py-2"></th>
                    {systems.map((sys) => (
                      <th key={sys.id} className="px-3 py-2 font-semibold text-center min-w-[80px]">
                        <span>{sys.name}</span>
                      </th>
                    ))}
                    <th className="w-28 px-2 py-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="gap-1 text-xs h-7"
                        onClick={() => setNewSystemDialog(true)}
                      >
                        <Plus className="h-3 w-3" />
                        Sistema
                      </Button>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {loadingSizes ? (
                    Array.from({ length: 5 }).map((_, i) => (
                      <tr key={i} className="border-b">
                        <td className="px-2 py-2"><Skeleton className="h-6 w-6" /></td>
                        {systems.map((s) => (
                          <td key={s.id} className="px-3 py-2"><Skeleton className="h-8 w-full" /></td>
                        ))}
                        <td />
                      </tr>
                    ))
                  ) : (
                    sizes.map((row, idx) => (
                      <tr
                        key={row.id}
                        className={cn(
                          'border-b last:border-b-0 transition-colors hover:bg-accent/30',
                          dragOverIdx === idx && 'bg-primary/10',
                        )}
                        draggable
                        onDragStart={() => handleDragStart(idx)}
                        onDragOver={(e) => handleDragOver(e, idx)}
                        onDragEnd={() => { dragIdx.current = null; setDragOverIdx(null); }}
                        onDrop={() => handleDrop(idx)}
                      >
                        <td className="px-2 py-1 text-center cursor-grab active:cursor-grabbing">
                          <GripVertical className="h-4 w-4 text-muted-foreground/40 mx-auto" />
                        </td>
                        {systems.map((sys) => (
                          <td key={sys.id} className="px-1 py-1">
                            <InlineCell
                              value={getCellValue(row, sys.id)}
                              onSave={(v) => handleCellSave(row.id, sys.id, v)}
                              placeholder="—"
                            />
                          </td>
                        ))}
                        <td className="px-2 py-1 text-center">
                          <button
                            onClick={() => handleDeleteRow(row.id)}
                            className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                            title="Eliminar fila"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}

                  {/* New row form */}
                  {addingRow && (
                    <tr className="border-b bg-muted/20">
                      <td className="px-2 py-1" />
                      {systems.map((sys, sIdx) => (
                        <td key={sys.id} className="px-1 py-1">
                          <Input
                            autoFocus={sIdx === 0}
                            placeholder={sys.name}
                            value={newRowValues[sys.id] || ''}
                            onChange={(e) => setNewRowValues((p) => ({ ...p, [sys.id]: e.target.value }))}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleAddRow();
                              if (e.key === 'Escape') { setAddingRow(false); setNewRowValues({}); }
                            }}
                            className="h-8 text-sm text-center"
                          />
                        </td>
                      ))}
                      <td className="px-2 py-1">
                        <div className="flex items-center gap-1">
                          <button
                            onClick={handleAddRow}
                            className="text-xs text-primary hover:text-primary/80 font-medium px-2 py-1 rounded hover:bg-primary/10 transition-colors"
                          >
                            Guardar
                          </button>
                          <button
                            onClick={() => { setAddingRow(false); setNewRowValues({}); }}
                            className="text-xs text-muted-foreground hover:text-foreground px-1 py-1 rounded hover:bg-muted transition-colors"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )}

                  {/* Add row trigger */}
                  {!addingRow && (
                    <tr>
                      <td colSpan={systems.length + 2} className="px-4 py-2">
                        <button
                          onClick={() => setAddingRow(true)}
                          className="text-sm text-primary hover:text-primary/80 font-medium transition-colors flex items-center gap-1"
                        >
                          <span className="text-lg leading-none">+</span> Añadir talla
                        </button>
                      </td>
                    </tr>
                  )}

                  {/* Empty state */}
                  {!loadingSizes && sizes.length === 0 && !addingRow && (
                    <tr>
                      <td colSpan={systems.length + 2} className="text-center text-muted-foreground py-8 text-sm">
                        No hay tallas en el grupo &quot;{activeGroup?.name}&quot;. Haz clic en &quot;+ Añadir talla&quot; para comenzar.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* ─── New Group Dialog ─────────────────────────────────── */}
      <Dialog open={newGroupDialog} onOpenChange={setNewGroupDialog}>
        <DialogContent className="max-w-sm">
          <form onSubmit={handleAddGroup}>
            <DialogHeader>
              <DialogTitle>Nuevo Grupo de Tallas</DialogTitle>
              <DialogDescription>Ej. Hombre, Mujer, Niño, Bebé, Unisex</DialogDescription>
            </DialogHeader>
            <div className="py-4">
              <Label>Nombre</Label>
              <Input
                placeholder="Ej. Niño"
                value={newGroupName}
                onChange={(e) => setNewGroupName(e.target.value)}
                required
                autoFocus
                className="mt-2"
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setNewGroupDialog(false)}>Cancelar</Button>
              <Button type="submit" disabled={savingDialog}>{savingDialog ? 'Creando...' : 'Crear Grupo'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ─── New System Dialog ────────────────────────────────── */}
      <Dialog open={newSystemDialog} onOpenChange={setNewSystemDialog}>
        <DialogContent className="max-w-sm">
          <form onSubmit={handleAddSystem}>
            <DialogHeader>
              <DialogTitle>Nuevo Sistema de Medida</DialogTitle>
              <DialogDescription>Ej. UK, CM, CHN (se convierte a mayúsculas)</DialogDescription>
            </DialogHeader>
            <div className="py-4">
              <Label>Nombre</Label>
              <Input
                placeholder="Ej. UK"
                value={newSystemName}
                onChange={(e) => setNewSystemName(e.target.value)}
                required
                autoFocus
                className="mt-2 uppercase"
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setNewSystemDialog(false)}>Cancelar</Button>
              <Button type="submit" disabled={savingDialog}>{savingDialog ? 'Creando...' : 'Crear Sistema'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
