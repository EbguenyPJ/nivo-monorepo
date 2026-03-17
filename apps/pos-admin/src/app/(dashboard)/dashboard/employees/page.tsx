'use client';

import { useEffect, useState } from 'react';
import {
  Button, Badge, Card, CardContent, CardHeader, CardTitle, Input, Label,
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@nivo/ui';
import { Plus, Users, Pencil } from 'lucide-react';
import { apiClient } from '@/lib/api';

interface Branch {
  id: string;
  name: string;
}

interface Employee {
  id: string;
  name: string;
  email: string;
  pin_code: string | null;
  role: string;
  branch_id: string | null;
  branch: Branch | null;
  is_active: boolean;
  created_at: string;
}

const ROLE_LABELS: Record<string, string> = {
  admin: 'Administrador',
  manager: 'Gerente',
  cashier: 'Cajero',
};

const ROLE_VARIANTS: Record<string, 'default' | 'secondary' | 'outline'> = {
  admin: 'default',
  manager: 'secondary',
  cashier: 'outline',
};

export default function EmployeesPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    pin_code: '',
    role: 'cashier',
    branch_id: '',
  });

  const fetchData = async () => {
    try {
      const [empRes, branchRes] = await Promise.all([
        apiClient.get('/employees'),
        apiClient.get('/branches'),
      ]);
      setEmployees(empRes.data);
      setBranches(branchRes.data);
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const openCreate = () => {
    setEditingEmployee(null);
    setForm({ name: '', email: '', password: '', pin_code: '', role: 'cashier', branch_id: '' });
    setDialogOpen(true);
  };

  const openEdit = (emp: Employee) => {
    setEditingEmployee(emp);
    setForm({
      name: emp.name,
      email: emp.email,
      password: '',
      pin_code: emp.pin_code || '',
      role: emp.role,
      branch_id: emp.branch_id || '',
    });
    setDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload: any = { ...form };
      if (!payload.branch_id) delete payload.branch_id;
      if (!payload.pin_code) delete payload.pin_code;

      if (editingEmployee) {
        if (!payload.password) delete payload.password;
        await apiClient.put(`/employees/${editingEmployee.id}`, payload);
      } else {
        await apiClient.post('/employees', payload);
      }
      setDialogOpen(false);
      setEditingEmployee(null);
      await fetchData();
    } catch (error: any) {
      alert(error.response?.data?.message || 'Error al guardar el empleado');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Empleados</h2>
          <p className="text-muted-foreground">Gestiona tu equipo de trabajo</p>
        </div>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <Button className="gap-2" onClick={openCreate}>
            <Plus className="h-4 w-4" />
            Nuevo Empleado
          </Button>
          <DialogContent>
            <form onSubmit={handleSubmit}>
              <DialogHeader>
                <DialogTitle>{editingEmployee ? 'Editar Empleado' : 'Nuevo Empleado'}</DialogTitle>
                <DialogDescription>
                  {editingEmployee ? 'Modifica los datos del empleado.' : 'Agrega un nuevo miembro a tu equipo.'}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Nombre Completo</Label>
                  <Input
                    id="name"
                    placeholder="Juan Pérez"
                    value={form.name}
                    onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Correo Electrónico</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="juan@zapateria.com"
                    value={form.email}
                    onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">
                    Contraseña {editingEmployee && '(dejar vacío para no cambiar)'}
                  </Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder="Mínimo 8 caracteres"
                    value={form.password}
                    onChange={(e) => setForm((prev) => ({ ...prev, password: e.target.value }))}
                    {...(!editingEmployee && { required: true, minLength: 8 })}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="role">Rol</Label>
                    <select
                      id="role"
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                      value={form.role}
                      onChange={(e) => setForm((prev) => ({ ...prev, role: e.target.value }))}
                    >
                      <option value="cashier">Cajero</option>
                      <option value="manager">Gerente</option>
                      <option value="admin">Administrador</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="pin_code">PIN (POS)</Label>
                    <Input
                      id="pin_code"
                      placeholder="1234"
                      maxLength={10}
                      value={form.pin_code}
                      onChange={(e) => setForm((prev) => ({ ...prev, pin_code: e.target.value }))}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="branch_id">Sucursal</Label>
                  <select
                    id="branch_id"
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    value={form.branch_id}
                    onChange={(e) => setForm((prev) => ({ ...prev, branch_id: e.target.value }))}
                  >
                    <option value="">Sin asignar</option>
                    {branches.map((b) => (
                      <option key={b.id} value={b.id}>{b.name}</option>
                    ))}
                  </select>
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={saving}>
                  {saving ? 'Guardando...' : editingEmployee ? 'Guardar Cambios' : 'Crear Empleado'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <p className="text-muted-foreground">Cargando empleados...</p>
      ) : employees.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No hay empleados registrados aún.</p>
            <p className="text-sm text-muted-foreground">Agrega a tu primer empleado para empezar.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {employees.map((emp) => (
            <Card key={emp.id}>
              <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
                <div>
                  <CardTitle className="text-base">{emp.name}</CardTitle>
                  <p className="text-sm text-muted-foreground">{emp.email}</p>
                </div>
                <Button variant="ghost" size="icon" onClick={() => openEdit(emp)}>
                  <Pencil className="h-4 w-4" />
                </Button>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant={ROLE_VARIANTS[emp.role] || 'outline'}>
                    {ROLE_LABELS[emp.role] || emp.role}
                  </Badge>
                  {emp.branch && (
                    <Badge variant="secondary">{emp.branch.name}</Badge>
                  )}
                  <Badge variant={emp.is_active ? 'default' : 'destructive'}>
                    {emp.is_active ? 'Activo' : 'Inactivo'}
                  </Badge>
                </div>
                {emp.pin_code && (
                  <p className="text-xs text-muted-foreground mt-2">PIN: {emp.pin_code}</p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
