'use client';

import { useEffect, useState, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  Button, Badge, Card, CardContent, Input, Label, Textarea,
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
  Skeleton, toast,
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator,
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from '@nivo/ui';
import {
  Plus, Users, MoreVertical, Pencil, Power, MapPin,
  ShieldCheck, KeyRound, Shuffle, ChevronDown, ChevronRight,
  Phone, Mail, Search, UserCog,
} from 'lucide-react';
import { apiClient } from '@/lib/api';

// ─── Types ──────────────────────────────────────────────────────
interface Branch {
  id: string;
  name: string;
  code: string;
  is_active: boolean;
}

interface RoleInfo {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  is_system: boolean;
}

interface PermissionInfo {
  id: string;
  key: string;
  name: string;
  module: string;
  submodule: string | null;
}

interface Employee {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: string;
  role_id: string | null;
  roleEntity: RoleInfo | null;
  branch_id: string | null;
  branch: Branch | null;
  is_active: boolean;
  created_at: string;
}

interface PermOverride {
  permission_id: string;
  granted: boolean;
}

const ROLE_COLORS: Record<string, string> = {
  admin: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
  manager: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  cashier: 'bg-green-500/10 text-green-400 border-green-500/20',
};

// ─── Component ──────────────────────────────────────────────────
export default function EmployeesPage() {
  const searchParams = useSearchParams();
  const branchFilter = searchParams.get('branch');

  // Data
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [roles, setRoles] = useState<RoleInfo[]>([]);
  const [allPermissions, setAllPermissions] = useState<PermissionInfo[]>([]);
  const [permissionsGrouped, setPermissionsGrouped] = useState<Record<string, PermissionInfo[]>>({});
  const [loading, setLoading] = useState(true);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [filterBranch, setFilterBranch] = useState<string>(branchFilter || 'all');
  const [filterRole, setFilterRole] = useState<string>('all');

  // Dialog
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);

  // Form
  const [form, setForm] = useState({
    name: '', email: '', password: '', phone: '',
    pin: '', role_id: '', branch_id: '',
  });
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [rolePermissionKeys, setRolePermissionKeys] = useState<string[]>([]);
  const [permOverrides, setPermOverrides] = useState<PermOverride[]>([]);

  // Toggle status
  const [confirmToggle, setConfirmToggle] = useState<Employee | null>(null);
  const [toggling, setToggling] = useState(false);

  // ─── Fetch Data ───────────────────────────────────────────────
  const fetchData = async () => {
    try {
      const [empRes, branchRes, rolesRes, permsRes] = await Promise.all([
        apiClient.get('/employees'),
        apiClient.get('/branches?includeInactive=true'),
        apiClient.get('/employees/roles'),
        apiClient.get('/employees/permissions'),
      ]);
      setEmployees(empRes.data);
      setBranches(branchRes.data);
      setRoles(rolesRes.data);
      setAllPermissions(permsRes.data.permissions);
      setPermissionsGrouped(permsRes.data.grouped);
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  // ─── When role changes, fetch its default permissions ─────────
  const fetchRolePerms = async (roleId: string) => {
    if (!roleId) { setRolePermissionKeys([]); return; }
    try {
      const res = await apiClient.get(`/employees/roles/${roleId}/permissions`);
      setRolePermissionKeys(res.data);
    } catch {
      setRolePermissionKeys([]);
    }
  };

  // ─── Filtering ────────────────────────────────────────────────
  const filtered = useMemo(() => {
    return employees.filter((emp) => {
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        if (!emp.name.toLowerCase().includes(q) && !emp.email.toLowerCase().includes(q)) return false;
      }
      if (filterBranch !== 'all' && emp.branch_id !== filterBranch) return false;
      if (filterRole !== 'all') {
        const roleSlug = emp.roleEntity?.slug || emp.role;
        if (roleSlug !== filterRole) return false;
      }
      return true;
    });
  }, [employees, searchQuery, filterBranch, filterRole]);

  // ─── Open Create ──────────────────────────────────────────────
  const openCreate = () => {
    setEditingEmployee(null);
    setForm({ name: '', email: '', password: '', phone: '', pin: '', role_id: '', branch_id: branchFilter || '' });
    setShowAdvanced(false);
    setRolePermissionKeys([]);
    setPermOverrides([]);
    setDialogOpen(true);
  };

  // ─── Open Edit ────────────────────────────────────────────────
  const openEdit = async (emp: Employee) => {
    setEditingEmployee(emp);
    setForm({
      name: emp.name,
      email: emp.email,
      password: '',
      phone: emp.phone || '',
      pin: '',
      role_id: emp.role_id || '',
      branch_id: emp.branch_id || '',
    });
    setShowAdvanced(false);
    setPermOverrides([]);

    // Fetch role permissions + employee overrides
    if (emp.role_id) {
      await fetchRolePerms(emp.role_id);
    }
    try {
      const res = await apiClient.get(`/employees/${emp.id}/permissions`);
      setPermOverrides(
        res.data.map((o: any) => ({ permission_id: o.permission_id, granted: o.granted })),
      );
    } catch {}

    setDialogOpen(true);
  };

  // ─── Submit ───────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload: any = {
        name: form.name,
        email: form.email,
        phone: form.phone || null,
        role_id: form.role_id,
        branch_id: form.branch_id,
      };

      if (form.password) payload.password = form.password;
      if (form.pin) payload.pin = form.pin;
      if (permOverrides.length > 0) payload.permission_overrides = permOverrides;

      if (editingEmployee) {
        await apiClient.put(`/employees/${editingEmployee.id}`, payload);
        toast({ title: 'Empleado actualizado', description: `"${form.name}" se actualizó correctamente.` });
      } else {
        await apiClient.post('/employees', payload);
        toast({ title: 'Empleado creado', description: `"${form.name}" ya puede acceder al sistema.` });
      }
      setDialogOpen(false);
      setEditingEmployee(null);
      await fetchData();
    } catch (error: any) {
      toast({ title: 'Error', description: error.response?.data?.message || 'Error al guardar', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  // ─── Toggle status ────────────────────────────────────────────
  const handleToggleStatus = async () => {
    if (!confirmToggle) return;
    setToggling(true);
    try {
      await apiClient.patch(`/employees/${confirmToggle.id}/toggle-status`);
      toast({
        title: confirmToggle.is_active ? 'Empleado desactivado' : 'Empleado reactivado',
        description: `"${confirmToggle.name}" ${confirmToggle.is_active ? 'ya no puede acceder al sistema.' : 'puede volver a acceder.'}`,
      });
      setConfirmToggle(null);
      await fetchData();
    } catch (error: any) {
      toast({ title: 'Error', description: error.response?.data?.message || 'Error', variant: 'destructive' });
    } finally {
      setToggling(false);
    }
  };

  // ─── PIN Generator ────────────────────────────────────────────
  const generatePin = () => {
    const pin = Math.floor(1000 + Math.random() * 9000).toString();
    setForm((prev) => ({ ...prev, pin }));
  };

  // ─── Permission override helpers ──────────────────────────────
  const isPermGrantedByRole = (permKey: string) => rolePermissionKeys.includes(permKey);

  const getOverride = (permId: string) => permOverrides.find((o) => o.permission_id === permId);

  const togglePermOverride = (perm: PermissionInfo) => {
    const existing = getOverride(perm.id);
    const isFromRole = isPermGrantedByRole(perm.key);

    if (existing) {
      // Remove override → back to role default
      setPermOverrides((prev) => prev.filter((o) => o.permission_id !== perm.id));
    } else {
      // Add override: if role grants it, revoke; if role doesn't, grant
      setPermOverrides((prev) => [
        ...prev,
        { permission_id: perm.id, granted: !isFromRole },
      ]);
    }
  };

  // ─── Role info for selected role ──────────────────────────────
  const selectedRole = roles.find((r) => r.id === form.role_id);

  // ─── Stats ────────────────────────────────────────────────────
  const activeCount = employees.filter((e) => e.is_active).length;

  // ─── Render ───────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Empleados</h2>
          <p className="text-muted-foreground">
            {employees.length} empleado{employees.length !== 1 ? 's' : ''} registrado{employees.length !== 1 ? 's' : ''}
            {' · '}{activeCount} activo{activeCount !== 1 ? 's' : ''}
          </p>
        </div>
        <Button className="gap-2" onClick={openCreate}>
          <Plus className="h-4 w-4" />
          Nuevo Empleado
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nombre o correo..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={filterBranch} onValueChange={setFilterBranch}>
          <SelectTrigger className="w-[180px]">
            <MapPin className="h-4 w-4 mr-1.5 text-muted-foreground" />
            <SelectValue placeholder="Sucursal" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas las sucursales</SelectItem>
            {branches.filter((b) => b.is_active).map((b) => (
              <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterRole} onValueChange={setFilterRole}>
          <SelectTrigger className="w-[160px]">
            <ShieldCheck className="h-4 w-4 mr-1.5 text-muted-foreground" />
            <SelectValue placeholder="Rol" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los roles</SelectItem>
            {roles.map((r) => (
              <SelectItem key={r.id} value={r.slug}>{r.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Content */}
      {loading ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-44 rounded-xl" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <div className="mx-auto mb-4 h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center">
              <Users className="h-8 w-8 text-primary" />
            </div>
            <h3 className="text-lg font-semibold mb-1">
              {employees.length === 0 ? 'No hay empleados registrados' : 'Sin resultados'}
            </h3>
            <p className="text-sm text-muted-foreground mb-6 max-w-md mx-auto">
              {employees.length === 0
                ? 'Agrega a tu primer empleado para empezar a operar.'
                : 'Intenta ajustar los filtros de búsqueda.'}
            </p>
            {employees.length === 0 && (
              <Button onClick={openCreate} className="gap-2">
                <Plus className="h-4 w-4" />
                Crear Primer Empleado
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((emp) => {
            const roleSlug = emp.roleEntity?.slug || emp.role;
            const roleName = emp.roleEntity?.name || emp.role;
            return (
              <Card
                key={emp.id}
                className={`relative transition-all ${!emp.is_active ? 'opacity-60 border-dashed' : 'hover:shadow-md'}`}
              >
                <CardContent className="p-5">
                  {/* Header: Avatar + Name + Menu */}
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div className="flex items-start gap-3 min-w-0 flex-1">
                      {/* Avatar with role color */}
                      <div className={`h-11 w-11 rounded-xl flex items-center justify-center shrink-0 text-sm font-bold border ${ROLE_COLORS[roleSlug] || 'bg-muted text-muted-foreground'}`}>
                        {emp.name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-semibold text-base truncate">{emp.name}</h3>
                          {!emp.is_active && (
                            <Badge variant="secondary" className="text-[10px] px-1.5 py-0">Inactivo</Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground truncate flex items-center gap-1">
                          <Mail className="h-3 w-3 shrink-0" />
                          {emp.email}
                        </p>
                      </div>
                    </div>

                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-48">
                        <DropdownMenuItem onClick={() => openEdit(emp)}>
                          <Pencil className="h-4 w-4 mr-2" />
                          Editar Empleado
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={() => setConfirmToggle(emp)}
                          className={emp.is_active ? 'text-destructive focus:text-destructive' : 'text-green-600 focus:text-green-600'}
                        >
                          <Power className="h-4 w-4 mr-2" />
                          {emp.is_active ? 'Desactivar' : 'Reactivar'}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  {/* Info row */}
                  <div className="flex items-center gap-2 flex-wrap mb-3">
                    <span className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-medium ${ROLE_COLORS[roleSlug] || ''}`}>
                      <ShieldCheck className="h-3 w-3" />
                      {roleName}
                    </span>
                    {emp.branch && (
                      <span className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                        <MapPin className="h-3 w-3" />
                        {emp.branch.name}
                      </span>
                    )}
                  </div>

                  {/* Contact */}
                  {emp.phone && (
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <Phone className="h-3 w-3" />
                      {emp.phone}
                    </p>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* ─── Create/Edit Dialog ─────────────────────────────────── */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <form onSubmit={handleSubmit}>
            <DialogHeader>
              <DialogTitle>
                {editingEmployee ? 'Editar Empleado' : 'Nuevo Empleado'}
              </DialogTitle>
              <DialogDescription>
                {editingEmployee
                  ? 'Modifica los datos del empleado.'
                  : 'Completa los datos para dar de alta a un nuevo miembro del equipo.'}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-6 py-4">
              {/* ─── Block 1: Personal Info ─────────────────────── */}
              <div className="space-y-4">
                <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <UserCog className="h-4 w-4 text-primary" />
                  Información Personal
                </h4>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="emp-name">
                      Nombre Completo <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="emp-name"
                      placeholder="Juan Pérez"
                      value={form.name}
                      onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                      required
                      autoFocus
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="emp-phone">Teléfono</Label>
                    <Input
                      id="emp-phone"
                      placeholder="55 1234 5678"
                      value={form.phone}
                      onChange={(e) => setForm((prev) => ({ ...prev, phone: e.target.value }))}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="emp-email">
                      Correo Electrónico <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="emp-email"
                      type="email"
                      placeholder="juan@zapateria.com"
                      value={form.email}
                      onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="emp-password">
                      Contraseña {editingEmployee ? '(vacío = no cambiar)' : <span className="text-destructive">*</span>}
                    </Label>
                    <Input
                      id="emp-password"
                      type="password"
                      placeholder="Mínimo 8 caracteres"
                      value={form.password}
                      onChange={(e) => setForm((prev) => ({ ...prev, password: e.target.value }))}
                      {...(!editingEmployee && { required: true, minLength: 8 })}
                    />
                  </div>
                </div>
              </div>

              {/* ─── Block 2: Operation & Security ─────────────── */}
              <div className="space-y-4 border-t border-border pt-5">
                <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-primary" />
                  Operación y Seguridad
                </h4>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="emp-branch">
                      Sucursal Asignada <span className="text-destructive">*</span>
                    </Label>
                    <select
                      id="emp-branch"
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      value={form.branch_id}
                      onChange={(e) => setForm((prev) => ({ ...prev, branch_id: e.target.value }))}
                      required
                    >
                      <option value="">Seleccionar sucursal...</option>
                      {branches.filter((b) => b.is_active).map((b) => (
                        <option key={b.id} value={b.id}>{b.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="emp-role">
                      Rol del Sistema <span className="text-destructive">*</span>
                    </Label>
                    <select
                      id="emp-role"
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      value={form.role_id}
                      onChange={async (e) => {
                        setForm((prev) => ({ ...prev, role_id: e.target.value }));
                        await fetchRolePerms(e.target.value);
                        setPermOverrides([]); // Reset overrides when changing role
                      }}
                      required
                    >
                      <option value="">Seleccionar rol...</option>
                      {roles.map((r) => (
                        <option key={r.id} value={r.id}>{r.name}</option>
                      ))}
                    </select>
                    {selectedRole?.description && (
                      <p className="text-[11px] text-muted-foreground mt-1 leading-snug">
                        💡 {selectedRole.description}
                      </p>
                    )}
                  </div>
                </div>

                {/* PIN */}
                <div className="space-y-2">
                  <Label htmlFor="emp-pin">
                    PIN de Acceso (POS)
                    {editingEmployee && <span className="text-muted-foreground font-normal"> — vacío = no cambiar</span>}
                  </Label>
                  <div className="flex gap-2">
                    <Input
                      id="emp-pin"
                      type="password"
                      placeholder="4-6 dígitos"
                      value={form.pin}
                      onChange={(e) => {
                        const val = e.target.value.replace(/\D/g, '').slice(0, 6);
                        setForm((prev) => ({ ...prev, pin: val }));
                      }}
                      maxLength={6}
                      className="font-mono flex-1"
                    />
                    <Button type="button" variant="outline" onClick={generatePin} className="gap-1.5 shrink-0">
                      <Shuffle className="h-4 w-4" />
                      Generar
                    </Button>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    El PIN es exclusivo para desbloquear el Punto de Venta. No reemplaza la contraseña.
                  </p>
                </div>
              </div>

              {/* ─── Block 3: Permission Overrides (Collapsible) ── */}
              {form.role_id && (
                <div className="border-t border-border pt-5">
                  <button
                    type="button"
                    onClick={() => setShowAdvanced(!showAdvanced)}
                    className="flex items-center gap-2 text-sm font-semibold text-foreground hover:text-primary transition-colors w-full text-left"
                  >
                    {showAdvanced ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    <KeyRound className="h-4 w-4 text-primary" />
                    Permisos Avanzados (Overrides)
                    {permOverrides.length > 0 && (
                      <Badge variant="secondary" className="ml-2 text-[10px]">
                        {permOverrides.length} override{permOverrides.length !== 1 ? 's' : ''}
                      </Badge>
                    )}
                  </button>

                  {showAdvanced && (
                    <div className="mt-4 space-y-4">
                      <p className="text-xs text-muted-foreground">
                        Los permisos marcados con ◼ vienen del rol <span className="font-medium">{selectedRole?.name}</span>.
                        Haz clic para agregar o quitar permisos específicos para este empleado.
                      </p>

                      {Object.entries(permissionsGrouped).map(([module, perms]) => (
                        <div key={module} className="space-y-2">
                          <h5 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{module}</h5>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
                            {perms.map((perm) => {
                              const fromRole = isPermGrantedByRole(perm.key);
                              const override = getOverride(perm.id);
                              // Effective state: override > role default
                              const isGranted = override ? override.granted : fromRole;
                              const isOverridden = !!override;

                              return (
                                <label
                                  key={perm.id}
                                  className={`flex items-center gap-2 rounded-md px-2.5 py-1.5 text-sm cursor-pointer transition-colors ${
                                    isOverridden
                                      ? 'bg-primary/5 border border-primary/20'
                                      : 'hover:bg-muted/50'
                                  }`}
                                >
                                  <input
                                    type="checkbox"
                                    checked={isGranted}
                                    onChange={() => togglePermOverride(perm)}
                                    className="rounded border-border"
                                  />
                                  <span className={`text-xs ${isGranted ? 'text-foreground' : 'text-muted-foreground'}`}>
                                    {perm.name}
                                  </span>
                                  {fromRole && !isOverridden && (
                                    <span className="text-[10px] text-muted-foreground/50 ml-auto">rol</span>
                                  )}
                                  {isOverridden && (
                                    <span className={`text-[10px] ml-auto font-medium ${override?.granted ? 'text-green-500' : 'text-red-400'}`}>
                                      {override?.granted ? '+extra' : '−revocado'}
                                    </span>
                                  )}
                                </label>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
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

      {/* ─── Toggle Status Confirmation ──────────────────────────── */}
      <Dialog open={!!confirmToggle} onOpenChange={(open) => !open && setConfirmToggle(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {confirmToggle?.is_active ? '🚫 Desactivar Empleado' : '✅ Reactivar Empleado'}
            </DialogTitle>
            <DialogDescription>
              {confirmToggle?.is_active
                ? `"${confirmToggle.name}" no podrá acceder al sistema ni al Punto de Venta.`
                : `"${confirmToggle?.name}" podrá volver a acceder al sistema.`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmToggle(null)} disabled={toggling}>
              Cancelar
            </Button>
            <Button
              variant={confirmToggle?.is_active ? 'destructive' : 'default'}
              onClick={handleToggleStatus}
              disabled={toggling}
            >
              {toggling ? 'Procesando...' : confirmToggle?.is_active ? 'Desactivar' : 'Reactivar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
