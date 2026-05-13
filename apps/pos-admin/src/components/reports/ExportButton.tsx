'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Button, Input, Label, toast,
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@nivo/ui';
import {
  Download, FileSpreadsheet, FileText, Mail, MessageCircle,
  ChevronDown, Loader2, CheckCircle2, AlertCircle, X,
} from 'lucide-react';
import { apiClient } from '@/lib/api';

// ─── Types ────────────────────────────────────────────────────────────────────

export type ReportType = 'sales' | 'profitability' | 'audits' | 'performance' | 'dashboard';

export interface ExportFilters {
  start_date?: string;
  end_date?: string;
  branch_id?: string;
}

interface ExportButtonProps {
  reportType: ReportType;
  filters: ExportFilters;
  className?: string;
}

type JobStatus = 'idle' | 'queued' | 'active' | 'completed' | 'failed';

interface ActiveJob {
  jobId: string;
  status: JobStatus;
  message: string;
  downloadUrl?: string;
  progress: number;
}

const REPORT_LABELS: Record<ReportType, string> = {
  sales:         'Reporte de Ventas',
  profitability: 'Reporte de Rentabilidad',
  audits:        'Arqueos de Caja',
  performance:   'Rendimiento de Vendedores',
  dashboard:     'Resumen del Dashboard',
};

// ─── Progress Toast ───────────────────────────────────────────────────────────

function JobProgressToast({ job, onDismiss }: { job: ActiveJob; onDismiss: () => void }) {
  const isLoading = job.status === 'queued' || job.status === 'active';
  const isDone    = job.status === 'completed';
  const isFailed  = job.status === 'failed';

  return (
    <div className="fixed bottom-5 right-5 z-[100] w-80 rounded-xl border border-white/10 bg-zinc-900 p-4 shadow-2xl shadow-black/40 backdrop-blur-md">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 shrink-0">
          {isLoading && <Loader2 className="h-5 w-5 animate-spin text-primary" />}
          {isDone    && <CheckCircle2 className="h-5 w-5 text-emerald-400" />}
          {isFailed  && <AlertCircle className="h-5 w-5 text-red-400" />}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-zinc-100">{job.message}</p>
          {isLoading && (
            <div className="mt-2 h-1.5 w-full rounded-full bg-zinc-700 overflow-hidden">
              <div
                className="h-full rounded-full bg-primary transition-all duration-500"
                style={{ width: `${job.progress}%` }}
              />
            </div>
          )}
          {isDone && job.downloadUrl && (
            <a
              href={job.downloadUrl}
              download
              className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
            >
              <Download className="h-3 w-3" />
              Descargar ahora
            </a>
          )}
        </div>
        <button onClick={onDismiss} className="shrink-0 text-zinc-500 hover:text-zinc-300">
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

// ─── Distribution Modal ───────────────────────────────────────────────────────

interface DistributionModalProps {
  open: boolean;
  channel: 'email' | 'whatsapp';
  reportType: ReportType;
  filters: ExportFilters;
  onClose: () => void;
  onJobStarted: (jobId: string) => void;
}

function DistributionModal({
  open, channel, reportType, filters, onClose, onJobStarted,
}: DistributionModalProps) {
  const [recipient, setRecipient] = useState('');
  const [subject, setSubject]     = useState(`${REPORT_LABELS[reportType]} — Nivo POS`);
  const [message, setMessage]     = useState('');
  const [sending, setSending]     = useState(false);

  const isEmail = channel === 'email';
  const placeholder = isEmail ? 'correo@empresa.com' : '+521234567890';
  const label       = isEmail ? 'Correo electrónico' : 'Número de WhatsApp';

  const handleSend = async () => {
    if (!recipient.trim()) return;
    setSending(true);
    try {
      const res = await apiClient.post('/reports/export/send', {
        report_type: reportType,
        format: 'pdf',
        channel,
        recipient: recipient.trim(),
        subject: isEmail ? subject : undefined,
        message: message || undefined,
        ...filters,
      });
      onJobStarted(res.data.jobId);
      onClose();
      setRecipient(''); setMessage('');
    } catch (err: any) {
      toast({
        title: 'Error al enviar',
        description: err.response?.data?.message || 'Intenta de nuevo',
        variant: 'destructive',
      });
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md bg-zinc-950/95 border-white/10 backdrop-blur-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isEmail
              ? <Mail className="h-5 w-5 text-primary" />
              : <MessageCircle className="h-5 w-5 text-emerald-400" />}
            {isEmail ? 'Enviar por Correo' : 'Enviar por WhatsApp'}
          </DialogTitle>
          <DialogDescription>
            Se generará el PDF de <span className="font-medium text-foreground">{REPORT_LABELS[reportType]}</span> y se enviará automáticamente.
          </DialogDescription>
        </DialogHeader>

        {/* Preview pill */}
        <div className="flex items-center gap-3 rounded-xl border border-white/5 bg-white/[0.03] p-3">
          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            <FileText className="h-5 w-5 text-primary" />
          </div>
          <div>
            <p className="text-sm font-medium">{REPORT_LABELS[reportType]}</p>
            <p className="text-xs text-muted-foreground">
              {filters.start_date && filters.end_date
                ? `${filters.start_date} — ${filters.end_date}`
                : 'Periodo seleccionado'}
            </p>
          </div>
          <span className="ml-auto text-[10px] uppercase tracking-wider font-medium text-muted-foreground border border-white/10 rounded-full px-2 py-0.5">PDF</span>
        </div>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>{label}</Label>
            <Input
              placeholder={placeholder}
              value={recipient}
              onChange={(e) => setRecipient(e.target.value)}
              autoFocus
              type={isEmail ? 'email' : 'tel'}
            />
          </div>

          {isEmail && (
            <div className="space-y-1.5">
              <Label>Asunto</Label>
              <Input
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
              />
            </div>
          )}

          <div className="space-y-1.5">
            <Label>Mensaje (opcional)</Label>
            <textarea
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-none h-20 focus:outline-none focus:ring-1 focus:ring-ring"
              placeholder={isEmail
                ? 'Adjunto el reporte solicitado...'
                : 'Hola, te comparto el reporte de esta semana...'}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={sending}>Cancelar</Button>
          <Button
            onClick={handleSend}
            disabled={!recipient.trim() || sending}
            className={isEmail ? '' : 'bg-emerald-600 hover:bg-emerald-500'}
          >
            {sending
              ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Enviando...</>
              : isEmail
                ? <><Mail className="h-4 w-4 mr-2" />Enviar correo</>
                : <><MessageCircle className="h-4 w-4 mr-2" />Enviar por WhatsApp</>}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main ExportButton ────────────────────────────────────────────────────────

export function ExportButton({ reportType, filters, className }: ExportButtonProps) {
  const [dropdownOpen, setDropdownOpen]   = useState(false);
  const [modalChannel, setModalChannel]   = useState<'email' | 'whatsapp' | null>(null);
  const [activeJob, setActiveJob]         = useState<ActiveJob | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Poll job status
  const startPolling = useCallback((jobId: string, initialMsg: string) => {
    setActiveJob({ jobId, status: 'queued', message: initialMsg, progress: 5 });

    pollRef.current = setInterval(async () => {
      try {
        const res = await apiClient.get(`/reports/export/status/${jobId}`);
        const { state, progress, downloadUrl, error } = res.data;

        if (state === 'completed') {
          clearInterval(pollRef.current!);
          setActiveJob({
            jobId, status: 'completed', progress: 100,
            message: downloadUrl ? 'Archivo listo — haz clic para descargar' : '¡Reporte enviado exitosamente! ✅',
            downloadUrl,
          });
          // Auto-download if it was a direct download job
          if (downloadUrl) {
            window.open(downloadUrl, '_blank');
          }
        } else if (state === 'failed') {
          clearInterval(pollRef.current!);
          setActiveJob({ jobId, status: 'failed', progress: 0, message: `Error: ${error ?? 'Fallo desconocido'}` });
        } else {
          setActiveJob((prev) => prev ? { ...prev, status: 'active', progress: Math.max(progress ?? 10, prev.progress) } : prev);
        }
      } catch { /* ignore poll errors */ }
    }, 1500);
  }, []);

  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current); }, []);

  // ── Excel: direct download (synchronous) ──
  const handleExcel = () => {
    setDropdownOpen(false);
    const qs = new URLSearchParams({ report_type: reportType });
    if (filters.start_date) qs.set('start_date', filters.start_date);
    if (filters.end_date)   qs.set('end_date',   filters.end_date);
    if (filters.branch_id)  qs.set('branch_id',  filters.branch_id);

    const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1';
    // Open in new tab — the server streams the xlsx with Content-Disposition: attachment
    window.open(`${apiBase}/reports/export/download?${qs}`, '_blank');
  };

  // ── PDF: async via BullMQ ──
  const handlePdf = async () => {
    setDropdownOpen(false);
    try {
      const res = await apiClient.post('/reports/export/pdf', {
        report_type: reportType,
        ...filters,
      });
      startPolling(res.data.jobId, 'Generando PDF con diseño ejecutivo...');
    } catch (err: any) {
      toast({ title: 'Error', description: err.response?.data?.message, variant: 'destructive' });
    }
  };

  // ── Send: open modal ──
  const handleSendOpen = (channel: 'email' | 'whatsapp') => {
    setDropdownOpen(false);
    setModalChannel(channel);
  };

  const handleJobStarted = (jobId: string) => {
    startPolling(jobId, modalChannel === 'email'
      ? 'Generando y enviando por correo...'
      : 'Generando y enviando por WhatsApp...');
  };

  return (
    <>
      {/* Dropdown */}
      <div ref={dropdownRef} className={`relative ${className ?? ''}`}>
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5 border-white/10 bg-white/[0.03] hover:bg-white/[0.06]"
          onClick={() => setDropdownOpen((v) => !v)}
        >
          <Download className="h-4 w-4" />
          Exportar
          <ChevronDown className={`h-3.5 w-3.5 transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} />
        </Button>

        {dropdownOpen && (
          <div className="absolute right-0 top-full mt-1.5 z-50 w-56 rounded-xl border border-white/10 bg-zinc-900/95 backdrop-blur-xl shadow-xl overflow-hidden">
            <div className="p-1">
              {/* Excel */}
              <button
                onClick={handleExcel}
                className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm hover:bg-white/[0.06] transition-colors text-left"
              >
                <FileSpreadsheet className="h-4 w-4 text-emerald-400 shrink-0" />
                <div>
                  <p className="font-medium">Descargar Excel</p>
                  <p className="text-[10px] text-muted-foreground">Datos crudos con colores de marca</p>
                </div>
              </button>

              {/* PDF */}
              <button
                onClick={handlePdf}
                className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm hover:bg-white/[0.06] transition-colors text-left"
              >
                <FileText className="h-4 w-4 text-red-400 shrink-0" />
                <div>
                  <p className="font-medium">Descargar PDF</p>
                  <p className="text-[10px] text-muted-foreground">Vista ejecutiva con gráficas</p>
                </div>
              </button>

              <div className="my-1 border-t border-white/5" />

              {/* Email */}
              <button
                onClick={() => handleSendOpen('email')}
                className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm hover:bg-white/[0.06] transition-colors text-left"
              >
                <Mail className="h-4 w-4 text-primary shrink-0" />
                <div>
                  <p className="font-medium">Enviar por Correo</p>
                  <p className="text-[10px] text-muted-foreground">PDF adjunto vía Resend</p>
                </div>
              </button>

              {/* WhatsApp */}
              <button
                onClick={() => handleSendOpen('whatsapp')}
                className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm hover:bg-white/[0.06] transition-colors text-left"
              >
                <MessageCircle className="h-4 w-4 text-emerald-400 shrink-0" />
                <div>
                  <p className="font-medium">Enviar por WhatsApp</p>
                  <p className="text-[10px] text-muted-foreground">Meta Cloud API</p>
                </div>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Distribution Modal */}
      {modalChannel && (
        <DistributionModal
          open={!!modalChannel}
          channel={modalChannel}
          reportType={reportType}
          filters={filters}
          onClose={() => setModalChannel(null)}
          onJobStarted={handleJobStarted}
        />
      )}

      {/* Job Progress Toast */}
      {activeJob && (
        <JobProgressToast
          job={activeJob}
          onDismiss={() => {
            if (pollRef.current) clearInterval(pollRef.current);
            setActiveJob(null);
          }}
        />
      )}
    </>
  );
}
