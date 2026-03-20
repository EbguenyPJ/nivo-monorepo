'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import {
  Button, Badge, Card, CardContent, Input, Label, Skeleton, toast,
} from '@nivo/ui';
import {
  MessageSquare, Gamepad2, Mail, Cloud, Link, Loader2, CheckCircle2,
  XCircle, Eye, EyeOff, Save, RefreshCw,
} from 'lucide-react';
import { apiClient } from '@/lib/api';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Integration {
  id: string;
  type: string;
  display_name: string;
  is_enabled: boolean;
  config: Record<string, string>;
  status: 'connected' | 'disconnected' | 'error';
  last_tested_at: string | null;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const INTEGRATION_ICONS: Record<string, React.ElementType> = {
  slack: MessageSquare,
  discord: Gamepad2,
  sendgrid: Mail,
  aws_ses: Cloud,
  webhook: Link,
};

const INTEGRATION_DESCRIPTIONS: Record<string, string> = {
  slack: 'Envía notificaciones automáticas a un canal de Slack.',
  discord: 'Envía notificaciones automáticas a un canal de Discord.',
  sendgrid: 'Envía correos transaccionales mediante SendGrid.',
  aws_ses: 'Envía correos transaccionales mediante Amazon SES.',
  webhook: 'Notifica eventos a un endpoint externo via HTTP.',
};

const INTEGRATION_FIELDS: Record<string, { key: string; label: string; secret?: boolean }[]> = {
  slack: [{ key: 'webhook_url', label: 'Webhook URL' }],
  discord: [{ key: 'webhook_url', label: 'Webhook URL' }],
  sendgrid: [{ key: 'api_key', label: 'API Key', secret: true }],
  aws_ses: [
    { key: 'region', label: 'Región' },
    { key: 'access_key', label: 'Access Key', secret: true },
    { key: 'secret_key', label: 'Secret Key', secret: true },
  ],
  webhook: [
    { key: 'url', label: 'URL' },
    { key: 'secret', label: 'Secret Token', secret: true },
  ],
};

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  connected: {
    label: 'Conectado',
    className: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
  },
  disconnected: {
    label: 'Desconectado',
    className: 'bg-muted text-muted-foreground border-border',
  },
  error: {
    label: 'Error',
    className: 'bg-red-500/10 text-red-500 border-red-500/20',
  },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatTimestamp(iso: string): string {
  return new Date(iso).toLocaleString('es-MX', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// ---------------------------------------------------------------------------
// Integration Card Component
// ---------------------------------------------------------------------------

interface IntegrationCardProps {
  integration: Integration;
  onRefresh: () => void;
}

function IntegrationCard({ integration, onRefresh }: IntegrationCardProps) {
  const [config, setConfig] = useState<Record<string, string>>({ ...integration.config });
  const [enabled, setEnabled] = useState(integration.is_enabled);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ status: string; message: string } | null>(null);
  const [revealedFields, setRevealedFields] = useState<Set<string>>(new Set());

  const initialConfigRef = useRef<Record<string, string>>({ ...integration.config });

  // Sync when parent data changes (e.g. after refresh)
  useEffect(() => {
    setConfig({ ...integration.config });
    setEnabled(integration.is_enabled);
    initialConfigRef.current = { ...integration.config };
  }, [integration]);

  const fields = INTEGRATION_FIELDS[integration.type] || [];
  const Icon = INTEGRATION_ICONS[integration.type] || Link;
  const statusCfg = STATUS_CONFIG[integration.status] || STATUS_CONFIG.disconnected;

  const isDirty = fields.some(
    (f) => (config[f.key] ?? '') !== (initialConfigRef.current[f.key] ?? ''),
  );

  // ---- Handlers ----

  const handleToggle = async () => {
    const next = !enabled;
    setEnabled(next);
    try {
      await apiClient.patch(`/integrations/${integration.id}`, { is_enabled: next });
      toast({
        title: next ? 'Integración activada' : 'Integración desactivada',
        description: `${integration.display_name} fue ${next ? 'activada' : 'desactivada'}.`,
      });
      onRefresh();
    } catch (error: any) {
      setEnabled(!next);
      toast({
        title: 'Error',
        description: error.response?.data?.message || 'No se pudo actualizar la integración.',
        variant: 'destructive',
      });
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await apiClient.patch(`/integrations/${integration.id}`, { config });
      initialConfigRef.current = { ...config };
      toast({ title: 'Guardado', description: 'La configuración fue guardada correctamente.' });
      onRefresh();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.response?.data?.message || 'No se pudo guardar la configuración.',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await apiClient.post(`/integrations/${integration.id}/test`);
      setTestResult({ status: res.data.status, message: res.data.message });
      onRefresh();
    } catch (error: any) {
      setTestResult({
        status: 'error',
        message: error.response?.data?.message || 'Error al probar la conexión.',
      });
    } finally {
      setTesting(false);
    }

    // Auto-clear result after 6 seconds
    setTimeout(() => setTestResult(null), 6000);
  };

  const toggleReveal = (key: string) => {
    setRevealedFields((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  return (
    <Card>
      <CardContent className="p-6 space-y-5">
        {/* Header: Icon + Name + Status + Toggle */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center shrink-0">
              <Icon className="h-5 w-5 text-foreground" />
            </div>
            <div>
              <h3 className="font-semibold text-foreground">{integration.display_name}</h3>
              <p className="text-sm text-muted-foreground mt-0.5">
                {INTEGRATION_DESCRIPTIONS[integration.type] || 'Integración externa.'}
              </p>
            </div>
          </div>
          <Badge variant="outline" className={statusCfg.className}>
            {statusCfg.label}
          </Badge>
        </div>

        {/* Toggle */}
        <div className="flex items-center justify-between">
          <Label className="text-sm text-muted-foreground">Habilitada</Label>
          <button
            type="button"
            role="switch"
            aria-checked={enabled}
            onClick={handleToggle}
            className={`
              relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent
              transition-colors duration-200 ease-in-out focus-visible:outline-none focus-visible:ring-2
              focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background
              ${enabled ? 'bg-emerald-500' : 'bg-muted'}
            `}
          >
            <span
              className={`
                pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-lg ring-0
                transition-transform duration-200 ease-in-out
                ${enabled ? 'translate-x-5' : 'translate-x-0'}
              `}
            />
          </button>
        </div>

        {/* Config Fields */}
        {fields.length > 0 && (
          <div className="space-y-3">
            {fields.map((field) => {
              const isRevealed = revealedFields.has(field.key);
              return (
                <div key={field.key} className="space-y-1.5">
                  <Label htmlFor={`${integration.id}-${field.key}`} className="text-sm">
                    {field.label}
                  </Label>
                  <div className="relative">
                    <Input
                      id={`${integration.id}-${field.key}`}
                      type={field.secret && !isRevealed ? 'password' : 'text'}
                      value={config[field.key] ?? ''}
                      onChange={(e) =>
                        setConfig((prev) => ({ ...prev, [field.key]: e.target.value }))
                      }
                      placeholder={field.secret ? '••••••••' : `Ingresa ${field.label.toLowerCase()}`}
                      className={field.secret ? 'pr-10' : ''}
                    />
                    {field.secret && (
                      <button
                        type="button"
                        onClick={() => toggleReveal(field.key)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                      >
                        {isRevealed ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Test result */}
        {testResult && (
          <div
            className={`flex items-center gap-2 text-sm rounded-md px-3 py-2 ${
              testResult.status === 'success'
                ? 'bg-emerald-500/10 text-emerald-500'
                : 'bg-red-500/10 text-red-500'
            }`}
          >
            {testResult.status === 'success' ? (
              <CheckCircle2 className="h-4 w-4 shrink-0" />
            ) : (
              <XCircle className="h-4 w-4 shrink-0" />
            )}
            <span>{testResult.message}</span>
          </div>
        )}

        {/* Last tested */}
        {integration.last_tested_at && (
          <p className="text-xs text-muted-foreground">
            Última prueba: {formatTimestamp(integration.last_tested_at)}
          </p>
        )}

        {/* Actions */}
        <div className="flex items-center gap-2 pt-1">
          <Button
            variant="outline"
            size="sm"
            onClick={handleTest}
            disabled={testing}
            className="gap-1.5"
          >
            {testing ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <RefreshCw className="h-3.5 w-3.5" />
            )}
            Probar Conexión
          </Button>

          {isDirty && (
            <Button
              size="sm"
              onClick={handleSave}
              disabled={saving}
              className="gap-1.5 bg-gradient-to-r from-purple-500 to-fuchsia-600 hover:from-purple-600 hover:to-fuchsia-700 border-0"
            >
              {saving ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Save className="h-3.5 w-3.5" />
              )}
              Guardar
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function IntegrationsPage() {
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchIntegrations = useCallback(async () => {
    try {
      const res = await apiClient.get('/integrations');
      setIntegrations(res.data.data || []);
    } catch (error) {
      console.error('Failed to fetch integrations:', error);
      toast({
        title: 'Error',
        description: 'No se pudieron cargar las integraciones.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchIntegrations();
  }, [fetchIntegrations]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold tracking-tight text-foreground">Integraciones</h2>
        <p className="text-sm text-muted-foreground mt-0.5">
          Conecta Nivo con servicios externos
        </p>
      </div>

      {/* Grid */}
      {loading ? (
        <div className="grid gap-6 md:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-6 space-y-4">
                <div className="flex items-center gap-3">
                  <Skeleton className="h-10 w-10 rounded-lg" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-5 w-32" />
                    <Skeleton className="h-4 w-48" />
                  </div>
                  <Skeleton className="h-5 w-20 rounded-full" />
                </div>
                <Skeleton className="h-6 w-16" />
                <Skeleton className="h-9 w-full" />
                <Skeleton className="h-9 w-full" />
                <Skeleton className="h-8 w-32" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : integrations.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <div className="h-16 w-16 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-4">
              <Link className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="font-semibold text-foreground mb-1">Sin integraciones</h3>
            <p className="text-sm text-muted-foreground max-w-sm mx-auto">
              No hay integraciones configuradas para este tenant.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 md:grid-cols-2">
          {integrations.map((integration) => (
            <IntegrationCard
              key={integration.id}
              integration={integration}
              onRefresh={fetchIntegrations}
            />
          ))}
        </div>
      )}
    </div>
  );
}
