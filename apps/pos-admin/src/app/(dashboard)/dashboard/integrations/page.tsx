'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  Button, Card, CardContent, CardHeader, CardTitle, Badge, Skeleton,
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
  Input, Switch,
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
  toast,
} from '@nivo/ui';
import {
  Plug, CheckCircle2, XCircle, AlertTriangle, Loader2, ExternalLink,
  FileText, CreditCard, MessageCircle, Smartphone, Wifi, WifiOff,
  Shield, Clock, ChevronRight, RefreshCw, Trash2, Eye, EyeOff,
} from 'lucide-react';
import { apiClient } from '@/lib/api';

// ─── Types ───────────────────────────────────────────────────────

interface Integration {
  id: string | null;
  integration_type: string;
  display_name: string;
  is_active: boolean;
  status: string;
  last_tested_at: string | null;
  last_error: string | null;
  credentials: Record<string, any>;
  required_fields: string[];
  configured: boolean;
}

// ─── Integration visual config ──────────────────────────────────

const INTEGRATION_META: Record<string, {
  icon: React.ReactNode;
  category: string;
  description: string;
  color: string;
  bgColor: string;
  docsUrl?: string;
  fields: { key: string; label: string; placeholder: string; type?: 'text' | 'password' | 'select'; options?: string[] }[];
}> = {
  sat: {
    icon: <FileText className="h-7 w-7" />,
    category: 'Facturación',
    description: 'Emite CFDI 4.0 directamente desde el historial de ventas',
    color: 'text-emerald-500',
    bgColor: 'bg-emerald-500/10',
    fields: [
      { key: 'rfc', label: 'RFC del Negocio', placeholder: 'XAXX010101000' },
      { key: 'regimen_fiscal', label: 'Régimen Fiscal', placeholder: '601 - General de Ley', type: 'select', options: [
        '601 - General de Ley Personas Morales',
        '603 - Personas Morales con Fines no Lucrativos',
        '605 - Sueldos y Salarios',
        '606 - Arrendamiento',
        '612 - Personas Físicas con Actividades Empresariales',
        '616 - Sin obligaciones fiscales',
        '621 - Incorporación Fiscal',
        '625 - Régimen de Actividades Agrícolas',
        '626 - Régimen Simplificado de Confianza',
      ]},
      { key: 'pac_provider', label: 'Proveedor PAC', placeholder: 'Facturama, SW Sapien...', type: 'select', options: [
        'Facturama', 'SW Sapien', 'Factura.com', 'Digisat', 'Otro',
      ]},
      { key: 'pac_api_key', label: 'API Key del PAC', placeholder: 'Tu llave de API', type: 'password' },
      { key: 'cer_base64', label: 'Certificado CSD (.cer)', placeholder: 'Base64 del certificado', type: 'password' },
      { key: 'key_base64', label: 'Llave Privada (.key)', placeholder: 'Base64 de la llave', type: 'password' },
      { key: 'key_password', label: 'Contraseña de la Llave', placeholder: '••••••••', type: 'password' },
    ],
  },
  clip: {
    icon: <CreditCard className="h-7 w-7" />,
    category: 'Terminal de Pago',
    description: 'Envía el monto exacto a tu terminal Clip automáticamente',
    color: 'text-orange-500',
    bgColor: 'bg-orange-500/10',
    fields: [
      { key: 'api_key', label: 'API Key', placeholder: 'Tu llave de API de Clip', type: 'password' },
      { key: 'terminal_id', label: 'ID de Terminal (opcional)', placeholder: 'ID del dispositivo' },
    ],
  },
  mercadopago: {
    icon: <Smartphone className="h-7 w-7" />,
    category: 'Terminal de Pago',
    description: 'Conecta tu Mercado Pago Point para cobros automáticos',
    color: 'text-sky-500',
    bgColor: 'bg-sky-500/10',
    fields: [
      { key: 'access_token', label: 'Access Token', placeholder: 'APP_USR-...', type: 'password' },
      { key: 'device_id', label: 'ID del Dispositivo (opcional)', placeholder: 'PAX_...' },
    ],
  },
  srpago: {
    icon: <CreditCard className="h-7 w-7" />,
    category: 'Terminal de Pago',
    description: 'Integra tu terminal Sr. Pago con cobros por intención',
    color: 'text-violet-500',
    bgColor: 'bg-violet-500/10',
    fields: [
      { key: 'merchant_id', label: 'Merchant ID', placeholder: 'Tu ID de comercio' },
      { key: 'api_key', label: 'API Key', placeholder: 'Tu llave de API', type: 'password' },
    ],
  },
  whatsapp: {
    icon: <MessageCircle className="h-7 w-7" />,
    category: 'Comunicación',
    description: 'Envía tickets digitales y notificaciones por WhatsApp',
    color: 'text-green-500',
    bgColor: 'bg-green-500/10',
    fields: [
      { key: 'phone_number_id', label: 'Phone Number ID', placeholder: 'ID de tu número verificado' },
      { key: 'access_token', label: 'Access Token', placeholder: 'Token de acceso de Meta', type: 'password' },
      { key: 'waba_id', label: 'WABA ID (opcional)', placeholder: 'WhatsApp Business Account ID' },
    ],
  },
};

const STATUS_CONFIG: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline'; icon: React.ReactNode }> = {
  connected: { label: 'Conectado', variant: 'default', icon: <CheckCircle2 className="h-3 w-3" /> },
  disconnected: { label: 'No configurado', variant: 'secondary', icon: <WifiOff className="h-3 w-3" /> },
  error: { label: 'Error', variant: 'destructive', icon: <XCircle className="h-3 w-3" /> },
};

function formatDate(d: string | null) {
  if (!d) return null;
  return new Date(d).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

// ─── Page ────────────────────────────────────────────────────────

export default function IntegrationsPage() {
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [loading, setLoading] = useState(true);
  const [configOpen, setConfigOpen] = useState<string | null>(null);

  const fetchIntegrations = useCallback(async () => {
    try {
      setLoading(true);
      const res = await apiClient.get('/tenant-integrations');
      setIntegrations(res.data);
    } catch {
      toast({ title: 'Error', description: 'No se pudieron cargar las integraciones', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchIntegrations(); }, [fetchIntegrations]);

  const selectedIntegration = integrations.find((i) => i.integration_type === configOpen);

  // Group by category
  const categories = new Map<string, Integration[]>();
  for (const intg of integrations) {
    const meta = INTEGRATION_META[intg.integration_type];
    const cat = meta?.category || 'Otros';
    if (!categories.has(cat)) categories.set(cat, []);
    categories.get(cat)!.push(intg);
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Integraciones</h2>
        <p className="text-muted-foreground">
          Conecta Nivo con servicios externos para automatizar facturación, cobros y comunicación.
        </p>
      </div>

      {/* Security badge */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/50 rounded-lg px-4 py-2.5 border">
        <Shield className="h-4 w-4 text-emerald-500 flex-shrink-0" />
        <span>Todas las credenciales se almacenan cifradas con AES-256-GCM. Nunca se muestran completas.</span>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-48 rounded-xl" />
          ))}
        </div>
      ) : (
        <>
          {Array.from(categories.entries()).map(([category, items]) => (
            <div key={category} className="space-y-3">
              <h3 className="text-lg font-semibold text-foreground">{category}</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {items.map((intg) => {
                  const meta = INTEGRATION_META[intg.integration_type];
                  if (!meta) return null;
                  const statusCfg = STATUS_CONFIG[intg.status] || STATUS_CONFIG.disconnected;

                  return (
                    <Card
                      key={intg.integration_type}
                      className="group relative overflow-hidden hover:shadow-md transition-shadow cursor-pointer"
                      onClick={() => setConfigOpen(intg.integration_type)}
                    >
                      <CardContent className="p-5">
                        <div className="flex items-start justify-between mb-4">
                          <div className={`h-12 w-12 rounded-xl ${meta.bgColor} ${meta.color} flex items-center justify-center`}>
                            {meta.icon}
                          </div>
                          <Badge variant={statusCfg.variant} className="gap-1 text-xs">
                            {statusCfg.icon}
                            {statusCfg.label}
                          </Badge>
                        </div>

                        <h4 className="font-semibold text-foreground mb-1">{intg.display_name}</h4>
                        <p className="text-sm text-muted-foreground mb-4 line-clamp-2">{meta.description}</p>

                        <div className="flex items-center justify-between">
                          {intg.last_tested_at ? (
                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {formatDate(intg.last_tested_at)}
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground">Sin probar</span>
                          )}
                          <Button variant="ghost" size="sm" className="gap-1 text-xs group-hover:bg-primary/10">
                            {intg.configured ? 'Gestionar' : 'Configurar'}
                            <ChevronRight className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </CardContent>

                      {/* Active indicator line */}
                      {intg.is_active && intg.status === 'connected' && (
                        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-emerald-500" />
                      )}
                    </Card>
                  );
                })}
              </div>
            </div>
          ))}
        </>
      )}

      {/* Configuration Dialog */}
      <Dialog open={!!configOpen} onOpenChange={(open) => { if (!open) setConfigOpen(null); }}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          {selectedIntegration && (
            <IntegrationConfigForm
              integration={selectedIntegration}
              onSaved={() => { fetchIntegrations(); }}
              onClose={() => setConfigOpen(null)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Configuration Form ──────────────────────────────────────────

function IntegrationConfigForm({
  integration,
  onSaved,
  onClose,
}: {
  integration: Integration;
  onSaved: () => void;
  onClose: () => void;
}) {
  const meta = INTEGRATION_META[integration.integration_type];
  const statusCfg = STATUS_CONFIG[integration.status] || STATUS_CONFIG.disconnected;

  const [credentials, setCredentials] = useState<Record<string, any>>(() => ({ ...integration.credentials }));
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [revealedFields, setRevealedFields] = useState<Set<string>>(new Set());

  if (!meta) return null;

  const updateField = (key: string, value: string) => {
    setCredentials((prev) => ({ ...prev, [key]: value }));
  };

  const toggleReveal = (key: string) => {
    setRevealedFields((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await apiClient.post(`/tenant-integrations/${integration.integration_type}`, {
        credentials,
        is_active: integration.is_active,
      });
      toast({ title: 'Guardado', description: 'Credenciales actualizadas correctamente' });
      onSaved();
    } catch (err: any) {
      toast({
        title: 'Error',
        description: err.response?.data?.message || 'No se pudo guardar',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    try {
      // Save first, then test
      if (Object.keys(credentials).some((k) => credentials[k]?.toString().trim())) {
        await apiClient.post(`/tenant-integrations/${integration.integration_type}`, {
          credentials,
          is_active: integration.is_active,
        });
      }
      const res = await apiClient.post(`/tenant-integrations/${integration.integration_type}/test`);
      if (res.data.success) {
        toast({ title: 'Conexión exitosa', description: res.data.message });
      } else {
        toast({ title: 'Error de conexión', description: res.data.message, variant: 'destructive' });
      }
      onSaved();
    } catch (err: any) {
      toast({
        title: 'Error',
        description: err.response?.data?.message || 'No se pudo probar la conexión',
        variant: 'destructive',
      });
    } finally {
      setTesting(false);
    }
  };

  const handleToggleActive = async () => {
    try {
      await apiClient.patch(`/tenant-integrations/${integration.integration_type}/toggle`, {
        is_active: !integration.is_active,
      });
      toast({ title: integration.is_active ? 'Integración desactivada' : 'Integración activada' });
      onSaved();
    } catch (err: any) {
      toast({ title: 'Error', description: err.response?.data?.message || 'Error', variant: 'destructive' });
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await apiClient.delete(`/tenant-integrations/${integration.integration_type}`);
      toast({ title: 'Integración eliminada', description: 'Las credenciales han sido removidas' });
      onSaved();
      onClose();
    } catch (err: any) {
      toast({ title: 'Error', description: err.response?.data?.message || 'Error', variant: 'destructive' });
    } finally {
      setDeleting(false);
    }
  };

  return (
    <>
      <DialogHeader>
        <div className="flex items-center gap-3">
          <div className={`h-10 w-10 rounded-xl ${meta.bgColor} ${meta.color} flex items-center justify-center`}>
            {meta.icon}
          </div>
          <div>
            <DialogTitle>{integration.display_name}</DialogTitle>
            <DialogDescription>{meta.description}</DialogDescription>
          </div>
        </div>
      </DialogHeader>

      {/* Status bar */}
      <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg border">
        <div className="flex items-center gap-2">
          <Badge variant={statusCfg.variant} className="gap-1">
            {statusCfg.icon}
            {statusCfg.label}
          </Badge>
          {integration.last_tested_at && (
            <span className="text-xs text-muted-foreground">
              Probado: {formatDate(integration.last_tested_at)}
            </span>
          )}
        </div>
        {integration.configured && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Activa</span>
            <Switch
              checked={integration.is_active}
              onCheckedChange={handleToggleActive}
            />
          </div>
        )}
      </div>

      {/* Error message */}
      {integration.last_error && (
        <div className="flex items-start gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-sm">
          <AlertTriangle className="h-4 w-4 text-red-500 mt-0.5 flex-shrink-0" />
          <div>
            <p className="font-medium text-red-600 dark:text-red-400">Error en la última prueba</p>
            <p className="text-xs text-muted-foreground mt-0.5">{integration.last_error}</p>
          </div>
        </div>
      )}

      {/* Credential fields */}
      <div className="space-y-3">
        {meta.fields.map((field) => (
          <div key={field.key} className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">
              {field.label}
              {integration.required_fields.includes(field.key) && (
                <span className="text-red-500 ml-0.5">*</span>
              )}
            </label>
            {field.type === 'select' ? (
              <Select
                value={credentials[field.key] || ''}
                onValueChange={(v) => updateField(field.key, v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder={field.placeholder} />
                </SelectTrigger>
                <SelectContent>
                  {field.options?.map((opt) => (
                    <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <div className="relative">
                <Input
                  type={field.type === 'password' && !revealedFields.has(field.key) ? 'password' : 'text'}
                  placeholder={field.placeholder}
                  value={credentials[field.key] || ''}
                  onChange={(e) => updateField(field.key, e.target.value)}
                />
                {field.type === 'password' && (
                  <button
                    type="button"
                    onClick={() => toggleReveal(field.key)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {revealedFields.has(field.key) ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Actions */}
      <DialogFooter className="flex-col sm:flex-row gap-2">
        {integration.configured && (
          <Button
            variant="ghost"
            size="sm"
            className="text-red-500 hover:text-red-600 hover:bg-red-500/10 mr-auto"
            onClick={handleDelete}
            disabled={deleting}
          >
            {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4 mr-1" />}
            Desconectar
          </Button>
        )}

        <Button
          variant="outline"
          onClick={handleTest}
          disabled={testing || saving}
          className="gap-1.5"
        >
          {testing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wifi className="h-4 w-4" />}
          Probar Conexión
        </Button>

        <Button
          onClick={handleSave}
          disabled={saving || testing}
          className="gap-1.5"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
          Guardar Credenciales
        </Button>
      </DialogFooter>
    </>
  );
}
