'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  Button, Badge, Card, CardContent, Input, Skeleton, toast,
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
  Label, Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
  Separator,
} from '@nivo/ui';
import {
  MapPin, Plus, ChevronRight, ChevronDown, Pencil, Trash2, Zap,
  Warehouse, FolderTree,
} from 'lucide-react';
import { apiClient } from '@/lib/api';
import { useBranchStore } from '@/store/branchStore';

// ─── Types ────────────────────────────────────────────────────────

interface StorageLocation {
  id: string;
  branch_id: string;
  parent_id: string | null;
  name: string;
  code: string;
  type: string;
  description: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  children: StorageLocation[];
}

interface Branch {
  id: string;
  name: string;
}

const TYPE_LABELS: Record<string, string> = {
  zone: 'Zona',
  aisle: 'Pasillo',
  shelf: 'Estante',
  bin: 'Casilla',
};

const TYPE_COLORS: Record<string, string> = {
  zone: 'bg-purple-100 text-purple-800',
  aisle: 'bg-blue-100 text-blue-800',
  shelf: 'bg-green-100 text-green-800',
  bin: 'bg-amber-100 text-amber-800',
};

// ─── Tree Node Component ──────────────────────────────────────────

function LocationNode({
  location,
  depth = 0,
  onEdit,
  onDelete,
  onAddChild,
}: {
  location: StorageLocation;
  depth?: number;
  onEdit: (loc: StorageLocation) => void;
  onDelete: (loc: StorageLocation) => void;
  onAddChild: (parentId: string) => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const hasChildren = location.children && location.children.length > 0;

  return (
    <div>
      <div
        className={`flex items-center justify-between py-2 px-3 rounded-md hover:bg-accent/50 transition-colors ${
          !location.is_active ? 'opacity-50' : ''
        }`}
        style={{ marginLeft: `${depth * 24}px` }}
      >
        <div className="flex items-center gap-2 min-w-0">
          {hasChildren ? (
            <button onClick={() => setExpanded(!expanded)} className="p-0.5 rounded hover:bg-muted">
              {expanded ? (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              )}
            </button>
          ) : (
            <span className="w-5" />
          )}
          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${TYPE_COLORS[location.type] || 'bg-gray-100 text-gray-800'}`}>
            {TYPE_LABELS[location.type] || location.type}
          </span>
          <span className="font-mono text-sm font-semibold">{location.code}</span>
          <span className="text-sm text-muted-foreground truncate">{location.name}</span>
          {!location.is_active && <Badge variant="outline" className="text-xs">Inactivo</Badge>}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {location.type !== 'bin' && (
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onAddChild(location.id)} title="Agregar hijo">
              <Plus className="h-3.5 w-3.5" />
            </Button>
          )}
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onEdit(location)} title="Editar">
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => onDelete(location)} title="Eliminar">
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
      {expanded && hasChildren && (
        <div>
          {location.children.map((child) => (
            <LocationNode
              key={child.id}
              location={child}
              depth={depth + 1}
              onEdit={onEdit}
              onDelete={onDelete}
              onAddChild={onAddChild}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Quick Setup Dialog ──────────────────────────────────────────

function QuickSetupDialog({
  open,
  onClose,
  onSubmit,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (aisles: number, shelvesPerAisle: number) => void;
}) {
  const [aisles, setAisles] = useState(3);
  const [shelves, setShelves] = useState(4);

  const preview = Array.from({ length: aisles }, (_, i) => {
    const letter = String.fromCharCode(65 + i);
    return {
      code: letter,
      name: `Pasillo ${letter}`,
      shelves: Array.from({ length: shelves }, (_, j) => ({
        code: `${letter}-${j + 1}`,
        name: `Estante ${letter}-${j + 1}`,
      })),
    };
  });

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-primary" />
            Setup Rapido
          </DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Genera automaticamente pasillos y estantes con codigos secuenciales.
        </p>
        <div className="grid grid-cols-2 gap-4 mt-4">
          <div className="space-y-2">
            <Label>Pasillos</Label>
            <Input type="number" min={1} max={26} value={aisles} onChange={(e) => setAisles(Math.min(26, Math.max(1, Number(e.target.value))))} />
          </div>
          <div className="space-y-2">
            <Label>Estantes por pasillo</Label>
            <Input type="number" min={1} max={50} value={shelves} onChange={(e) => setShelves(Math.min(50, Math.max(1, Number(e.target.value))))} />
          </div>
        </div>

        <div className="mt-4 max-h-48 overflow-y-auto border rounded-md p-3 bg-muted/30 text-xs space-y-2">
          <p className="font-medium text-foreground mb-2">Vista previa ({aisles * (1 + shelves)} ubicaciones):</p>
          {preview.slice(0, 4).map((aisle) => (
            <div key={aisle.code}>
              <span className="font-mono font-semibold">{aisle.code}</span>
              <span className="text-muted-foreground"> — {aisle.name}</span>
              <div className="ml-4 text-muted-foreground">
                {aisle.shelves.slice(0, 3).map((s) => (
                  <span key={s.code} className="mr-3">{s.code}</span>
                ))}
                {aisle.shelves.length > 3 && <span>+{aisle.shelves.length - 3} mas</span>}
              </div>
            </div>
          ))}
          {preview.length > 4 && <p className="text-muted-foreground">+{preview.length - 4} pasillos mas...</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={() => onSubmit(aisles, shelves)}>
            <Zap className="h-4 w-4 mr-2" />
            Generar {aisles * (1 + shelves)} ubicaciones
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main Page ───────────────────────────────────────────────────

export default function StorageLocationsPage() {
  const { selectedBranchId, isGeneralSelected, branches } = useBranchStore();
  const [locations, setLocations] = useState<StorageLocation[]>([]);
  const [flatLocations, setFlatLocations] = useState<StorageLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [branchList, setBranchList] = useState<Branch[]>([]);
  const [activeBranchId, setActiveBranchId] = useState<string>('');

  // Dialog states
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showQuickSetup, setShowQuickSetup] = useState(false);
  const [editingLocation, setEditingLocation] = useState<StorageLocation | null>(null);
  const [parentIdForCreate, setParentIdForCreate] = useState<string | null>(null);

  // Form state
  const [formName, setFormName] = useState('');
  const [formCode, setFormCode] = useState('');
  const [formType, setFormType] = useState('aisle');
  const [formDescription, setFormDescription] = useState('');
  const [saving, setSaving] = useState(false);

  // Determine which branch to use
  useEffect(() => {
    if (!isGeneralSelected && selectedBranchId) {
      setActiveBranchId(selectedBranchId);
    }
  }, [isGeneralSelected, selectedBranchId]);

  // Fetch branches for selector
  useEffect(() => {
    const fetchBranches = async () => {
      try {
        const res = await apiClient.get('/branches');
        setBranchList(res.data);
        if (isGeneralSelected && res.data.length > 0 && !activeBranchId) {
          setActiveBranchId(res.data[0].id);
        }
      } catch (err) {
        console.error('Error fetching branches:', err);
      }
    };
    fetchBranches();
  }, []);

  // Fetch locations when branch changes
  const fetchLocations = useCallback(async () => {
    if (!activeBranchId) return;
    setLoading(true);
    try {
      const res = await apiClient.get('/storage-locations', { params: { branch_id: activeBranchId } });
      setLocations(res.data.tree || []);
      setFlatLocations(res.data.flat || []);
    } catch (err) {
      console.error('Error fetching locations:', err);
      toast({ title: 'Error', description: 'No se pudieron cargar las ubicaciones', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [activeBranchId]);

  useEffect(() => {
    fetchLocations();
  }, [fetchLocations]);

  // ─── Handlers ──────────────────────────────────────────────────

  const openCreateDialog = (parentId?: string) => {
    setEditingLocation(null);
    setParentIdForCreate(parentId || null);
    setFormName('');
    setFormCode('');
    setFormDescription('');
    // Auto-suggest type based on parent
    if (parentId) {
      const parent = flatLocations.find((l) => l.id === parentId);
      if (parent?.type === 'aisle' || parent?.type === 'zone') setFormType('shelf');
      else if (parent?.type === 'shelf') setFormType('bin');
      else setFormType('shelf');
    } else {
      setFormType('aisle');
    }
    setShowCreateDialog(true);
  };

  const openEditDialog = (location: StorageLocation) => {
    setEditingLocation(location);
    setParentIdForCreate(null);
    setFormName(location.name);
    setFormCode(location.code);
    setFormType(location.type);
    setFormDescription(location.description || '');
    setShowCreateDialog(true);
  };

  const handleSave = async () => {
    if (!formName.trim() || !formCode.trim()) {
      toast({ title: 'Error', description: 'Nombre y codigo son obligatorios', variant: 'destructive' });
      return;
    }

    setSaving(true);
    try {
      if (editingLocation) {
        await apiClient.put(`/storage-locations/${editingLocation.id}`, {
          name: formName.trim(),
          code: formCode.trim(),
          description: formDescription.trim() || null,
        });
        toast({ title: 'Ubicacion actualizada' });
      } else {
        await apiClient.post('/storage-locations', {
          branch_id: activeBranchId,
          parent_id: parentIdForCreate,
          name: formName.trim(),
          code: formCode.trim(),
          type: formType,
          description: formDescription.trim() || undefined,
        });
        toast({ title: 'Ubicacion creada' });
      }
      setShowCreateDialog(false);
      fetchLocations();
    } catch (err: any) {
      toast({
        title: 'Error',
        description: err.response?.data?.message || 'Error al guardar',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (location: StorageLocation) => {
    try {
      await apiClient.delete(`/storage-locations/${location.id}`);
      toast({ title: 'Ubicacion eliminada', description: `"${location.name}" fue eliminada.` });
      fetchLocations();
    } catch (err: any) {
      toast({
        title: 'Error',
        description: err.response?.data?.message || 'No se pudo eliminar. Verifica que no tenga stock asignado.',
        variant: 'destructive',
      });
    }
  };

  const handleQuickSetup = async (aisles: number, shelvesPerAisle: number) => {
    setSaving(true);
    try {
      const locations: Array<{ name: string; code: string; type: string; parent_id?: string }> = [];

      // First pass: create aisles
      const aisleIds: string[] = [];
      for (let i = 0; i < aisles; i++) {
        const letter = String.fromCharCode(65 + i);
        locations.push({ name: `Pasillo ${letter}`, code: letter, type: 'aisle' });
      }

      // Use bulk create for aisles first
      const aisleRes = await apiClient.post('/storage-locations/bulk', {
        branch_id: activeBranchId,
        locations: locations.map((l) => ({ ...l })),
      });
      const savedAisles = aisleRes.data;

      // Second pass: create shelves for each aisle
      const shelfLocations: Array<{ name: string; code: string; type: string; parent_id: string }> = [];
      for (let i = 0; i < savedAisles.length; i++) {
        const letter = String.fromCharCode(65 + i);
        for (let j = 1; j <= shelvesPerAisle; j++) {
          shelfLocations.push({
            name: `Estante ${letter}-${j}`,
            code: `${letter}-${j}`,
            type: 'shelf',
            parent_id: savedAisles[i].id,
          });
        }
      }

      if (shelfLocations.length > 0) {
        await apiClient.post('/storage-locations/bulk', {
          branch_id: activeBranchId,
          locations: shelfLocations,
        });
      }

      toast({ title: 'Setup completo', description: `Se crearon ${aisles} pasillos con ${shelvesPerAisle} estantes cada uno.` });
      setShowQuickSetup(false);
      fetchLocations();
    } catch (err: any) {
      toast({
        title: 'Error',
        description: err.response?.data?.message || 'Error durante el setup rapido',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  // ─── Render ────────────────────────────────────────────────────

  const currentBranchName = branchList.find((b) => b.id === activeBranchId)?.name || '';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Ubicaciones</h2>
          <p className="text-muted-foreground">Mapa fisico de pasillos y estantes por sucursal</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setShowQuickSetup(true)} disabled={!activeBranchId}>
            <Zap className="h-4 w-4 mr-2" />
            Setup Rapido
          </Button>
          <Button onClick={() => openCreateDialog()} disabled={!activeBranchId}>
            <Plus className="h-4 w-4 mr-2" />
            Nueva Ubicacion
          </Button>
        </div>
      </div>

      {/* Branch selector (shown when in General mode) */}
      {isGeneralSelected && branchList.length > 0 && (
        <div className="flex items-center gap-3">
          <Label className="text-sm font-medium">Sucursal:</Label>
          <Select value={activeBranchId} onValueChange={setActiveBranchId}>
            <SelectTrigger className="w-64">
              <SelectValue placeholder="Selecciona una sucursal" />
            </SelectTrigger>
            <SelectContent>
              {branchList.map((b) => (
                <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Stats */}
      {!loading && flatLocations.length > 0 && (
        <div className="flex gap-4">
          {['aisle', 'shelf', 'bin'].map((type) => {
            const count = flatLocations.filter((l) => l.type === type).length;
            if (count === 0) return null;
            return (
              <div key={type} className="flex items-center gap-2 text-sm">
                <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${TYPE_COLORS[type]}`}>
                  {count}
                </span>
                <span className="text-muted-foreground">{TYPE_LABELS[type]}{count !== 1 ? 's' : ''}</span>
              </div>
            );
          })}
        </div>
      )}

      {/* Location tree */}
      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full rounded-md" />
          ))}
        </div>
      ) : !activeBranchId ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Warehouse className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">Selecciona una sucursal para ver sus ubicaciones.</p>
          </CardContent>
        </Card>
      ) : locations.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <FolderTree className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">
              {currentBranchName ? `"${currentBranchName}" no tiene ubicaciones configuradas.` : 'No hay ubicaciones configuradas.'}
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              Usa "Setup Rapido" para crear pasillos y estantes automaticamente.
            </p>
            <Button className="mt-4" onClick={() => setShowQuickSetup(true)}>
              <Zap className="h-4 w-4 mr-2" />
              Setup Rapido
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="py-3">
            {locations.map((loc) => (
              <LocationNode
                key={loc.id}
                location={loc}
                onEdit={openEditDialog}
                onDelete={handleDelete}
                onAddChild={(parentId) => openCreateDialog(parentId)}
              />
            ))}
          </CardContent>
        </Card>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={(v) => !v && setShowCreateDialog(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingLocation ? 'Editar Ubicacion' : parentIdForCreate ? 'Agregar Sub-ubicacion' : 'Nueva Ubicacion'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            {!editingLocation && (
              <div className="space-y-2">
                <Label>Tipo</Label>
                <Select value={formType} onValueChange={setFormType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="zone">Zona</SelectItem>
                    <SelectItem value="aisle">Pasillo</SelectItem>
                    <SelectItem value="shelf">Estante</SelectItem>
                    <SelectItem value="bin">Casilla</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Codigo</Label>
                <Input placeholder="Ej: A, A-1" value={formCode} onChange={(e) => setFormCode(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Nombre</Label>
                <Input placeholder="Ej: Pasillo A" value={formName} onChange={(e) => setFormName(e.target.value)} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Descripcion (opcional)</Label>
              <Input placeholder="Notas adicionales..." value={formDescription} onChange={(e) => setFormDescription(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? 'Guardando...' : editingLocation ? 'Actualizar' : 'Crear'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Quick Setup Dialog */}
      <QuickSetupDialog
        open={showQuickSetup}
        onClose={() => setShowQuickSetup(false)}
        onSubmit={handleQuickSetup}
      />
    </div>
  );
}
