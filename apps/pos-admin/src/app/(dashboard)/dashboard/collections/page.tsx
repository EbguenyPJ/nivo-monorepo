'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  Button, Badge, Card, CardContent, Input, Label,
  Skeleton, toast,
} from '@nivo/ui';
import {
  Plus, FolderTree, ChevronRight, ChevronDown,
  GripVertical, Pencil, Trash2, Power, Check, X,
  Upload, Link2, Loader2,
} from 'lucide-react';
import { cn } from '@nivo/ui';
import { apiClient } from '@/lib/api';

// ─── Types ──────────────────────────────────────────────────────
interface CollectionNode {
  id: string;
  name: string;
  parent_id: string | null;
  color: string | null;
  image_url: string | null;
  sort_order: number;
  is_active: boolean;
  children: CollectionNode[];
}

// ─── Component ──────────────────────────────────────────────────
export default function CollectionsPage() {
  const [tree, setTree] = useState<CollectionNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<CollectionNode | null>(null);
  const [saving, setSaving] = useState(false);

  // Inline creation state: null = not creating, '__root__' = root level, uuid = child of that id
  const [creatingParentId, setCreatingParentId] = useState<string | null>(null);
  const [newName, setNewName] = useState('');
  const [creatingInline, setCreatingInline] = useState(false);
  const isCreating = creatingParentId !== null;

  // Edit form for right panel
  const [editForm, setEditForm] = useState({ name: '', color: '', image_url: '' });
  const [imageMode, setImageMode] = useState<'upload' | 'url'>('upload');
  const [uploadingImage, setUploadingImage] = useState(false);

  // ─── Fetch ──────────────────────────────────────────────────
  const fetchTree = useCallback(async () => {
    try {
      const res = await apiClient.get('/collections/tree?includeInactive=true');
      setTree(res.data);
    } catch (error) {
      console.error('Failed to fetch collections:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchTree(); }, [fetchTree]);

  // ─── Select a node ────────────────────────────────────────────
  const selectNode = (node: CollectionNode) => {
    setSelected(node);
    setEditForm({
      name: node.name,
      color: node.color || '',
      image_url: node.image_url || '',
    });
    setImageMode(node.image_url ? 'url' : 'upload');
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingImage(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await apiClient.post('/uploads/image', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      const baseUrl = process.env.NEXT_PUBLIC_API_URL?.replace('/api/v1', '') || 'http://localhost:3000';
      const fullUrl = `${baseUrl}${res.data.url}`;
      setEditForm((prev) => ({ ...prev, image_url: fullUrl }));
      toast({ title: 'Imagen subida correctamente' });
    } catch (error: any) {
      toast({ title: 'Error al subir imagen', description: error.response?.data?.message || 'Intenta con otro archivo', variant: 'destructive' });
    } finally {
      setUploadingImage(false);
      e.target.value = '';
    }
  };

  // ─── Inline Create ────────────────────────────────────────────
  const startInlineCreate = (parentId: string | null) => {
    // null means "root level" → use sentinel '__root__'
    setCreatingParentId(parentId ?? '__root__');
    setNewName('');
  };

  const cancelInlineCreate = () => {
    setCreatingParentId(null);
    setNewName('');
  };

  const submitInlineCreate = async () => {
    if (!newName.trim()) { cancelInlineCreate(); return; }
    setCreatingInline(true);
    try {
      const payload: any = { name: newName.trim() };
      if (creatingParentId && creatingParentId !== '__root__') {
        payload.parent_id = creatingParentId;
      }
      await apiClient.post('/collections', payload);
      toast({ title: 'Colección creada', description: `"${newName.trim()}" se agregó al árbol.` });
      cancelInlineCreate();
      await fetchTree();
    } catch (error: any) {
      toast({ title: 'Error', description: error.response?.data?.message || 'Error al crear', variant: 'destructive' });
    } finally {
      setCreatingInline(false);
    }
  };

  // ─── Update from right panel ──────────────────────────────────
  const handleUpdate = async () => {
    if (!selected || !editForm.name.trim()) return;
    setSaving(true);
    try {
      await apiClient.put(`/collections/${selected.id}`, {
        name: editForm.name.trim(),
        color: editForm.color || null,
        image_url: editForm.image_url || null,
      });
      toast({ title: 'Colección actualizada' });
      // Refresh and re-select
      await fetchTree();
      setSelected((prev) => prev ? { ...prev, name: editForm.name.trim(), color: editForm.color || null, image_url: editForm.image_url || null } : null);
    } catch (error: any) {
      toast({ title: 'Error', description: error.response?.data?.message || 'Error al guardar', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  // ─── Toggle status ────────────────────────────────────────────
  const handleToggle = async (node: CollectionNode) => {
    try {
      await apiClient.patch(`/collections/${node.id}/toggle-status`);
      toast({
        title: node.is_active ? 'Colección desactivada' : 'Colección reactivada',
      });
      await fetchTree();
      if (selected?.id === node.id) {
        setSelected((prev) => prev ? { ...prev, is_active: !prev.is_active } : null);
      }
    } catch (error: any) {
      toast({ title: 'Error', description: error.response?.data?.message || 'Error', variant: 'destructive' });
    }
  };

  // ─── Delete ───────────────────────────────────────────────────
  const handleDelete = async (node: CollectionNode) => {
    try {
      await apiClient.delete(`/collections/${node.id}`);
      toast({ title: 'Colección eliminada', description: `"${node.name}" fue eliminada. Sus hijos se movieron al nivel anterior.` });
      if (selected?.id === node.id) setSelected(null);
      await fetchTree();
    } catch (error: any) {
      toast({ title: 'Error', description: error.response?.data?.message || 'Error', variant: 'destructive' });
    }
  };

  // ─── Count total nodes ────────────────────────────────────────
  const countNodes = (nodes: CollectionNode[]): number =>
    nodes.reduce((sum, n) => sum + 1 + countNodes(n.children), 0);

  const totalCount = countNodes(tree);

  // ─── Render ───────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Colecciones</h2>
          <p className="text-muted-foreground">
            {totalCount} colección{totalCount !== 1 ? 'es' : ''} en tu árbol de navegación
          </p>
        </div>
        <Button className="gap-2" onClick={() => startInlineCreate(null)}>
          <Plus className="h-4 w-4" />
          Nueva Colección
        </Button>
      </div>

      {/* Info */}
      <div className="rounded-lg border border-border bg-muted/30 px-4 py-3">
        <p className="text-sm text-muted-foreground">
          <span className="font-medium text-foreground">Colecciones</span> definen los botones de navegación visual del POS.
          Un producto puede pertenecer a múltiples colecciones. Pasa el cursor sobre una colección para agregar subcategorías con <span className="font-mono text-xs bg-muted px-1 rounded">+</span>.
        </p>
      </div>

      {/* Loading */}
      {loading ? (
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
          <Skeleton className="h-96 rounded-xl" />
          <Skeleton className="h-96 rounded-xl" />
        </div>
      ) : tree.length === 0 && !isCreating ? (
        <Card>
          <CardContent className="py-16 text-center">
            <div className="mx-auto mb-4 h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center">
              <FolderTree className="h-8 w-8 text-primary" />
            </div>
            <h3 className="text-lg font-semibold mb-1">No hay colecciones</h3>
            <p className="text-sm text-muted-foreground mb-6 max-w-md mx-auto">
              Crea tu primera colección para organizar tu catálogo. Ejemplo: "Caballero", "Dama", "Niños".
            </p>
            <Button onClick={() => startInlineCreate(null)} className="gap-2">
              <Plus className="h-4 w-4" />
              Crear Primera Colección
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
          {/* LEFT: Tree */}
          <Card>
            <CardContent className="p-4">
              <div className="space-y-0.5">
                {tree.map((node) => (
                  <TreeNode
                    key={node.id}
                    node={node}
                    depth={0}
                    selectedId={selected?.id || null}
                    onSelect={selectNode}
                    onAddChild={startInlineCreate}
                    creatingParentId={creatingParentId}
                    newName={newName}
                    onNewNameChange={setNewName}
                    onSubmitCreate={submitInlineCreate}
                    onCancelCreate={cancelInlineCreate}
                    creatingInline={creatingInline}
                  />
                ))}

                {/* Root-level inline create */}
                {creatingParentId === '__root__' && (
                  <InlineCreateInput
                    depth={0}
                    value={newName}
                    onChange={setNewName}
                    onSubmit={submitInlineCreate}
                    onCancel={cancelInlineCreate}
                    saving={creatingInline}
                  />
                )}
              </div>
            </CardContent>
          </Card>

          {/* RIGHT: Edit Panel */}
          <Card className="h-fit sticky top-20">
            <CardContent className="p-5">
              {selected ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-lg">Editar Colección</h3>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => handleToggle(selected)}
                        title={selected.is_active ? 'Desactivar' : 'Reactivar'}
                      >
                        <Power className={`h-4 w-4 ${selected.is_active ? 'text-green-500' : 'text-muted-foreground'}`} />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => handleDelete(selected)}
                        title="Eliminar"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  <Badge variant={selected.is_active ? 'default' : 'secondary'} className="text-xs">
                    {selected.is_active ? 'Activa' : 'Inactiva'}
                  </Badge>

                  <div className="space-y-3">
                    <div className="space-y-2">
                      <Label>Nombre</Label>
                      <Input
                        value={editForm.name}
                        onChange={(e) => setEditForm((prev) => ({ ...prev, name: e.target.value }))}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Color del POS</Label>
                      <div className="flex gap-2">
                        <input
                          type="color"
                          value={editForm.color || '#3B82F6'}
                          onChange={(e) => setEditForm((prev) => ({ ...prev, color: e.target.value }))}
                          className="h-10 w-12 rounded border border-border cursor-pointer bg-transparent"
                        />
                        <Input
                          value={editForm.color}
                          onChange={(e) => setEditForm((prev) => ({ ...prev, color: e.target.value }))}
                          placeholder="#3B82F6"
                          className="font-mono flex-1"
                          maxLength={9}
                        />
                      </div>
                      <p className="text-[11px] text-muted-foreground">
                        Color para los botones de esta colección en el POS.
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label>Imagen de portada <span className="text-muted-foreground font-normal">(opcional)</span></Label>

                      {/* Mode Tabs */}
                      <div className="flex rounded-lg border border-border overflow-hidden">
                        <button
                          type="button"
                          onClick={() => setImageMode('upload')}
                          className={cn(
                            'flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 text-[11px] font-medium transition-colors',
                            imageMode === 'upload' ? 'bg-primary text-primary-foreground' : 'bg-muted/30 text-muted-foreground hover:bg-muted',
                          )}
                        >
                          <Upload className="h-3 w-3" />
                          Subir
                        </button>
                        <button
                          type="button"
                          onClick={() => setImageMode('url')}
                          className={cn(
                            'flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 text-[11px] font-medium transition-colors',
                            imageMode === 'url' ? 'bg-primary text-primary-foreground' : 'bg-muted/30 text-muted-foreground hover:bg-muted',
                          )}
                        >
                          <Link2 className="h-3 w-3" />
                          URL
                        </button>
                      </div>

                      {imageMode === 'upload' ? (
                        <div>
                          <label
                            htmlFor="collection-file"
                            className={cn(
                              'flex flex-col items-center justify-center gap-1.5 rounded-lg border-2 border-dashed border-border py-4 cursor-pointer transition-colors',
                              uploadingImage ? 'opacity-50 pointer-events-none' : 'hover:border-primary/40 hover:bg-primary/5',
                            )}
                          >
                            {uploadingImage ? (
                              <Loader2 className="h-6 w-6 text-primary animate-spin" />
                            ) : (
                              <Upload className="h-6 w-6 text-muted-foreground" />
                            )}
                            <span className="text-[11px] text-muted-foreground">
                              {uploadingImage ? 'Subiendo...' : 'Clic para subir imagen'}
                            </span>
                          </label>
                          <input
                            id="collection-file"
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={handleImageUpload}
                            disabled={uploadingImage}
                          />
                        </div>
                      ) : (
                        <Input
                          value={editForm.image_url}
                          onChange={(e) => setEditForm((prev) => ({ ...prev, image_url: e.target.value }))}
                          placeholder="https://ejemplo.com/imagen.jpg"
                        />
                      )}

                      {/* Preview */}
                      {editForm.image_url && (
                        <div className="relative mt-2 h-24 rounded-lg border border-border bg-muted/30 overflow-hidden">
                          <img
                            src={editForm.image_url}
                            alt="Preview"
                            className="h-full w-full object-cover"
                            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                          />
                          <button
                            type="button"
                            onClick={() => setEditForm((prev) => ({ ...prev, image_url: '' }))}
                            className="absolute top-1 right-1 h-5 w-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center text-xs hover:bg-destructive/80"
                          >
                            ×
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  <Button onClick={handleUpdate} disabled={saving} className="w-full">
                    {saving ? 'Guardando...' : 'Guardar Cambios'}
                  </Button>
                </div>
              ) : (
                <div className="py-8 text-center">
                  <FolderTree className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground">
                    Selecciona una colección del árbol para editarla.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

// ─── Tree Node Component ────────────────────────────────────────
function TreeNode({
  node, depth, selectedId, onSelect, onAddChild,
  creatingParentId, newName, onNewNameChange, onSubmitCreate, onCancelCreate, creatingInline,
}: {
  node: CollectionNode;
  depth: number;
  selectedId: string | null;
  onSelect: (n: CollectionNode) => void;
  onAddChild: (parentId: string) => void;
  creatingParentId: string | null | 'root';
  newName: string;
  onNewNameChange: (v: string) => void;
  onSubmitCreate: () => void;
  onCancelCreate: () => void;
  creatingInline: boolean;
}) {
  const [expanded, setExpanded] = useState(true);
  const hasChildren = node.children.length > 0 || creatingParentId === node.id;
  const isSelected = selectedId === node.id;

  return (
    <div>
      <div
        className={cn(
          'group flex items-center gap-1 rounded-lg px-2 py-1.5 text-sm cursor-pointer transition-colors',
          isSelected
            ? 'bg-primary/10 text-primary font-medium'
            : 'hover:bg-muted/50 text-foreground',
          !node.is_active && 'opacity-50',
        )}
        style={{ paddingLeft: `${depth * 20 + 8}px` }}
      >
        {/* Expand toggle */}
        <button
          onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }}
          className={cn('h-5 w-5 flex items-center justify-center shrink-0 rounded hover:bg-muted', !hasChildren && 'invisible')}
        >
          {expanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
        </button>

        {/* Color dot */}
        {node.color && (
          <div className="h-3 w-3 rounded-full shrink-0 border border-border" style={{ backgroundColor: node.color }} />
        )}

        {/* Name */}
        <span
          className="flex-1 truncate"
          onClick={() => onSelect(node)}
        >
          {node.name}
        </span>

        {/* Badge for count */}
        {node.children.length > 0 && (
          <span className="text-[10px] text-muted-foreground mr-1">{node.children.length}</span>
        )}

        {/* Add child button (appears on hover) */}
        <button
          onClick={(e) => { e.stopPropagation(); onAddChild(node.id); setExpanded(true); }}
          className="h-5 w-5 flex items-center justify-center rounded hover:bg-primary/10 hover:text-primary opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
          title="Agregar subcategoría"
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Children */}
      {expanded && (
        <>
          {node.children.map((child) => (
            <TreeNode
              key={child.id}
              node={child}
              depth={depth + 1}
              selectedId={selectedId}
              onSelect={onSelect}
              onAddChild={onAddChild}
              creatingParentId={creatingParentId}
              newName={newName}
              onNewNameChange={onNewNameChange}
              onSubmitCreate={onSubmitCreate}
              onCancelCreate={onCancelCreate}
              creatingInline={creatingInline}
            />
          ))}

          {/* Inline create for this parent */}
          {creatingParentId === node.id && (
            <InlineCreateInput
              depth={depth + 1}
              value={newName}
              onChange={onNewNameChange}
              onSubmit={onSubmitCreate}
              onCancel={onCancelCreate}
              saving={creatingInline}
            />
          )}
        </>
      )}
    </div>
  );
}

// ─── Inline Create Input ────────────────────────────────────────
function InlineCreateInput({
  depth, value, onChange, onSubmit, onCancel, saving,
}: {
  depth: number;
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  onCancel: () => void;
  saving: boolean;
}) {
  return (
    <div
      className="flex items-center gap-1 rounded-lg px-2 py-1 bg-primary/5 border border-primary/20"
      style={{ paddingLeft: `${depth * 20 + 8 + 24}px` }}
    >
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Nombre de la colección..."
        className="h-7 text-sm border-0 bg-transparent shadow-none focus-visible:ring-0 px-1"
        autoFocus
        disabled={saving}
        onKeyDown={(e) => {
          if (e.key === 'Enter') onSubmit();
          if (e.key === 'Escape') onCancel();
        }}
      />
      <button
        onClick={onSubmit}
        disabled={saving || !value.trim()}
        className="h-6 w-6 flex items-center justify-center rounded hover:bg-primary/10 text-primary shrink-0 disabled:opacity-50"
      >
        <Check className="h-3.5 w-3.5" />
      </button>
      <button
        onClick={onCancel}
        className="h-6 w-6 flex items-center justify-center rounded hover:bg-muted text-muted-foreground shrink-0"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
