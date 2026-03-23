'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  Input,
  Switch,
  Skeleton,
  Badge,
} from '@nivo/ui';
import { apiClient } from '@/lib/api';

// ─── Types ────────────────────────────────────────────────────
export interface ColumnDef {
  key: string;
  label: string;
  type: 'text' | 'number' | 'boolean' | 'badge';
  editable?: boolean;
  width?: string;
  placeholder?: string;
  /** For number type: min value */
  min?: number;
  /** For number type: step */
  step?: number;
  /** For number type: suffix to display */
  suffix?: string;
}

interface DataGridEditableProps {
  endpoint: string;
  columns: ColumnDef[];
  /** Label for the "add new" button text */
  addLabel?: string;
}

interface RowData {
  id: string;
  is_active: boolean;
  [key: string]: any;
}

// ─── Inline Editable Cell ─────────────────────────────────────
function EditableCell({
  value,
  column,
  onSave,
}: {
  value: any;
  column: ColumnDef;
  onSave: (newValue: any) => Promise<void>;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(String(value ?? ''));
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  // Sync external value changes
  useEffect(() => {
    if (!isEditing) {
      setEditValue(String(value ?? ''));
    }
  }, [value, isEditing]);

  const handleSave = async () => {
    const trimmed = editValue.trim();
    if (!trimmed || trimmed === String(value)) {
      setIsEditing(false);
      setEditValue(String(value ?? ''));
      return;
    }
    setSaving(true);
    try {
      const parsed = column.type === 'number' ? parseFloat(trimmed) : trimmed;
      await onSave(parsed);
      setIsEditing(false);
    } catch {
      // Revert on error
      setEditValue(String(value ?? ''));
      setIsEditing(false);
    }
    setSaving(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSave();
    } else if (e.key === 'Escape') {
      setEditValue(String(value ?? ''));
      setIsEditing(false);
    }
  };

  if (column.type === 'boolean') {
    return null; // Handled separately
  }

  if (column.type === 'badge') {
    return <Badge variant={value ? 'default' : 'secondary'}>{value ? 'Activo' : 'Inactivo'}</Badge>;
  }

  if (!column.editable) {
    return (
      <span className="text-sm">
        {value}
        {column.suffix ? column.suffix : ''}
      </span>
    );
  }

  if (isEditing) {
    return (
      <Input
        ref={inputRef}
        type={column.type === 'number' ? 'number' : 'text'}
        value={editValue}
        onChange={(e) => setEditValue(e.target.value)}
        onBlur={handleSave}
        onKeyDown={handleKeyDown}
        disabled={saving}
        min={column.min}
        step={column.step}
        className="h-8 text-sm"
      />
    );
  }

  return (
    <span
      onClick={() => setIsEditing(true)}
      className="cursor-pointer hover:bg-muted/50 px-2 py-1 rounded text-sm transition-colors inline-block min-w-[40px]"
      title="Click para editar"
    >
      {value}
      {column.suffix ? column.suffix : ''}
    </span>
  );
}

// ─── New Row Form ─────────────────────────────────────────────
function NewRowForm({
  columns,
  onAdd,
  addLabel,
}: {
  columns: ColumnDef[];
  onAdd: (data: Record<string, any>) => Promise<void>;
  addLabel: string;
}) {
  const [isAdding, setIsAdding] = useState(false);
  const [values, setValues] = useState<Record<string, any>>({});
  const [saving, setSaving] = useState(false);
  const firstInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isAdding && firstInputRef.current) {
      firstInputRef.current.focus();
    }
  }, [isAdding]);

  const textColumns = columns.filter(
    (c) => c.editable && c.type !== 'boolean' && c.key !== 'is_active'
  );
  const booleanColumns = columns.filter(
    (c) => c.editable && c.type === 'boolean' && c.key !== 'is_active'
  );

  const handleSubmit = async () => {
    // Require at least the first text field
    const firstCol = textColumns[0];
    if (!firstCol || !values[firstCol.key]?.toString().trim()) return;

    setSaving(true);
    try {
      const data: Record<string, any> = {};
      textColumns.forEach((col) => {
        const val = values[col.key];
        if (val !== undefined && val !== '') {
          data[col.key] = col.type === 'number' ? parseFloat(val) : val;
        }
      });
      // Include boolean fields (default to false if not toggled)
      booleanColumns.forEach((col) => {
        data[col.key] = values[col.key] ?? false;
      });
      await onAdd(data);
      setValues({});
      setIsAdding(false);
    } catch {
      // Keep form open on error
    }
    setSaving(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSubmit();
    } else if (e.key === 'Escape') {
      setValues({});
      setIsAdding(false);
    }
  };

  if (!isAdding) {
    return (
      <TableRow>
        <TableCell colSpan={columns.length + 1}>
          <button
            onClick={() => setIsAdding(true)}
            className="text-sm text-primary hover:text-primary/80 font-medium transition-colors flex items-center gap-1"
          >
            <span className="text-lg leading-none">+</span> {addLabel}
          </button>
        </TableCell>
      </TableRow>
    );
  }

  return (
    <TableRow className="bg-muted/30">
      {columns.map((col, idx) => (
        <TableCell key={col.key}>
          {col.editable && col.type !== 'boolean' && col.key !== 'is_active' ? (
            <Input
              ref={idx === 0 ? firstInputRef : undefined}
              type={col.type === 'number' ? 'number' : 'text'}
              placeholder={col.placeholder || col.label}
              value={values[col.key] || ''}
              onChange={(e) =>
                setValues((prev) => ({ ...prev, [col.key]: e.target.value }))
              }
              onKeyDown={handleKeyDown}
              disabled={saving}
              min={col.min}
              step={col.step}
              className="h-8 text-sm"
            />
          ) : col.type === 'boolean' ? (
            <Switch
              checked={values[col.key] ?? false}
              onCheckedChange={(checked) =>
                setValues((prev) => ({ ...prev, [col.key]: checked }))
              }
              disabled={saving}
            />
          ) : null}
        </TableCell>
      ))}
      <TableCell>
        <div className="flex items-center gap-1">
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="text-xs text-primary hover:text-primary/80 font-medium px-2 py-1 rounded hover:bg-primary/10 transition-colors"
          >
            Guardar
          </button>
          <button
            onClick={() => {
              setValues({});
              setIsAdding(false);
            }}
            className="text-xs text-muted-foreground hover:text-foreground px-2 py-1 rounded hover:bg-muted transition-colors"
          >
            Cancelar
          </button>
        </div>
      </TableCell>
    </TableRow>
  );
}

// ─── Main Component ───────────────────────────────────────────
export function DataGridEditable({ endpoint, columns, addLabel = 'Añadir nuevo' }: DataGridEditableProps) {
  const [data, setData] = useState<RowData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const res = await apiClient.get(endpoint);
      setData(res.data);
      setError(null);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Error al cargar datos');
    } finally {
      setLoading(false);
    }
  }, [endpoint]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleUpdate = async (id: string, field: string, value: any) => {
    // Optimistic update
    setData((prev) =>
      prev.map((row) => (row.id === id ? { ...row, [field]: value } : row))
    );
    try {
      await apiClient.patch(`${endpoint}/${id}`, { [field]: value });
    } catch (err: any) {
      // Revert on error
      fetchData();
      throw err;
    }
  };

  const handleToggleActive = async (id: string, currentActive: boolean) => {
    await handleUpdate(id, 'is_active', !currentActive);
  };

  const handleAdd = async (rowData: Record<string, any>) => {
    try {
      const res = await apiClient.post(endpoint, rowData);
      setData((prev) => [...prev, res.data]);
    } catch (err: any) {
      throw err;
    }
  };

  if (loading) {
    return (
      <div className="space-y-3 p-4">
        {[...Array(4)].map((_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center p-8 text-sm text-destructive">
        {error}
        <button onClick={fetchData} className="ml-2 text-primary hover:underline">
          Reintentar
        </button>
      </div>
    );
  }

  // Separate active and inactive for display
  const activeRows = data.filter((r) => r.is_active);
  const inactiveRows = data.filter((r) => !r.is_active);

  return (
    <div className="border rounded-lg overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            {columns.map((col) => (
              <TableHead key={col.key} style={col.width ? { width: col.width } : undefined}>
                {col.label}
              </TableHead>
            ))}
            <TableHead style={{ width: '80px' }}>Activo</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {activeRows.map((row) => (
            <TableRow key={row.id}>
              {columns.map((col) => (
                <TableCell key={col.key}>
                  {col.type === 'boolean' && col.key !== 'is_active' ? (
                    <Switch
                      checked={row[col.key] ?? false}
                      onCheckedChange={(checked) => handleUpdate(row.id, col.key, checked)}
                    />
                  ) : (
                    <EditableCell
                      value={row[col.key]}
                      column={col}
                      onSave={(newValue) => handleUpdate(row.id, col.key, newValue)}
                    />
                  )}
                </TableCell>
              ))}
              <TableCell>
                <Switch
                  checked={row.is_active}
                  onCheckedChange={() => handleToggleActive(row.id, row.is_active)}
                />
              </TableCell>
            </TableRow>
          ))}

          <NewRowForm columns={columns} onAdd={handleAdd} addLabel={addLabel} />

          {inactiveRows.length > 0 && (
            <>
              <TableRow>
                <TableCell
                  colSpan={columns.length + 1}
                  className="bg-muted/30 text-xs text-muted-foreground font-medium py-2"
                >
                  Inactivos ({inactiveRows.length})
                </TableCell>
              </TableRow>
              {inactiveRows.map((row) => (
                <TableRow key={row.id} className="opacity-50">
                  {columns.map((col) => (
                    <TableCell key={col.key}>
                      {col.type === 'boolean' && col.key !== 'is_active' ? (
                        <Switch checked={row[col.key] ?? false} disabled />
                      ) : (
                        <span className="text-sm text-muted-foreground">
                          {row[col.key]}
                          {col.suffix || ''}
                        </span>
                      )}
                    </TableCell>
                  ))}
                  <TableCell>
                    <Switch
                      checked={row.is_active}
                      onCheckedChange={() => handleToggleActive(row.id, row.is_active)}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </>
          )}

          {activeRows.length === 0 && inactiveRows.length === 0 && (
            <TableRow>
              <TableCell colSpan={columns.length + 1} className="text-center text-muted-foreground py-8">
                No hay registros. Haz clic en &quot;+ {addLabel}&quot; para comenzar.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
