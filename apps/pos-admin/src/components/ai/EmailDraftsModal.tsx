'use client';

import { useEffect, useState, useCallback } from 'react';
import { X, Send, Loader2, ChevronLeft, ChevronRight, FileDown, CheckCircle2, AlertCircle } from 'lucide-react';
import { apiClient } from '@/lib/api';

interface EmailDraft {
  id: string;
  supplier_name: string;
  supplier_email: string;
  subject: string;
  body_html: string;
  pdf_url: string | null;
  po_folio: string;
  status: 'pending' | 'sent' | 'failed';
}

interface EditableState {
  subject: string;
  body_html: string;
}

interface Props {
  draftIds: string[];
  onClose: () => void;
}

export function EmailDraftsModal({ draftIds, onClose }: Props) {
  const [drafts, setDrafts] = useState<EmailDraft[]>([]);
  const [edits, setEdits] = useState<Record<string, EditableState>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [sendingIds, setSendingIds] = useState<Set<string>>(new Set());
  const [sentIds, setSentIds] = useState<Set<string>>(new Set());
  const [failedIds, setFailedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (draftIds.length === 0) return;

    apiClient
      .get(`/nibbit/email-drafts?ids=${draftIds.join(',')}`)
      .then(({ data }) => {
        setDrafts(data);
        const initial: Record<string, EditableState> = {};
        for (const d of data) {
          initial[d.id] = { subject: d.subject, body_html: d.body_html };
        }
        setEdits(initial);
      })
      .catch((err) => setError(err.response?.data?.message || 'Error cargando borradores'))
      .finally(() => setLoading(false));
  }, [draftIds]);

  const current = drafts[currentIndex];
  const currentEdit = current ? edits[current.id] : null;

  const updateEdit = useCallback((field: keyof EditableState, value: string) => {
    if (!current) return;
    setEdits((prev) => ({
      ...prev,
      [current.id]: { ...prev[current.id], [field]: value },
    }));
  }, [current]);

  const sendDraft = useCallback(async (draft: EmailDraft) => {
    const edit = edits[draft.id];
    if (!edit) return;

    setSendingIds((prev) => new Set(prev).add(draft.id));

    try {
      await apiClient.post('/nibbit/send-email-drafts', {
        drafts: [{ draft_id: draft.id, subject: edit.subject, body_html: edit.body_html }],
      });
      setSentIds((prev) => new Set(prev).add(draft.id));
    } catch {
      setFailedIds((prev) => new Set(prev).add(draft.id));
    } finally {
      setSendingIds((prev) => {
        const next = new Set(prev);
        next.delete(draft.id);
        return next;
      });
    }
  }, [edits]);

  const sendAll = useCallback(async () => {
    const pending = drafts.filter((d) => !sentIds.has(d.id) && !sendingIds.has(d.id));
    const payload = pending.map((d) => ({
      draft_id: d.id,
      subject: edits[d.id]?.subject || d.subject,
      body_html: edits[d.id]?.body_html || d.body_html,
    }));

    if (payload.length === 0) return;

    const ids = new Set(pending.map((d) => d.id));
    setSendingIds(ids);

    try {
      const { data } = await apiClient.post('/nibbit/send-email-drafts', { drafts: payload });
      if (data.sent > 0) {
        pending.forEach((d) => setSentIds((prev) => new Set(prev).add(d.id)));
      }
    } catch {
      pending.forEach((d) => setFailedIds((prev) => new Set(prev).add(d.id)));
    } finally {
      setSendingIds(new Set());
    }
  }, [drafts, edits, sentIds, sendingIds]);

  const allSent = drafts.length > 0 && drafts.every((d) => sentIds.has(d.id));

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-[640px] max-h-[85vh] rounded-2xl border border-white/10 bg-[#0c0c0c] shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06] shrink-0">
          <div>
            <h2 className="text-sm font-semibold text-white">Correos a Proveedores</h2>
            <p className="text-[11px] text-white/40 mt-0.5">
              {drafts.length > 0
                ? `${currentIndex + 1} de ${drafts.length} borradores`
                : 'Cargando...'}
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-white/30 hover:text-white hover:bg-white/[0.06] transition">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {loading && (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-5 w-5 animate-spin text-white/40" />
            </div>
          )}

          {error && (
            <div className="text-center py-8 text-red-400 text-sm">{error}</div>
          )}

          {!loading && !error && current && currentEdit && (
            <div className="space-y-4">
              {/* Supplier info */}
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-white/40">Proveedor</p>
                  <p className="text-sm font-medium text-white">{current.supplier_name}</p>
                  <p className="text-xs text-white/50">{current.supplier_email}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-white/40">Orden de Compra</p>
                  <p className="text-sm font-medium text-blue-400">{current.po_folio}</p>
                </div>
              </div>

              {/* Status badge */}
              {sentIds.has(current.id) && (
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                  <span className="text-xs text-emerald-300">Correo enviado exitosamente</span>
                </div>
              )}
              {failedIds.has(current.id) && (
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20">
                  <AlertCircle className="h-4 w-4 text-red-400" />
                  <span className="text-xs text-red-300">Error al enviar correo</span>
                </div>
              )}

              {/* Subject */}
              <div>
                <label className="text-[11px] text-white/40 uppercase tracking-wider mb-1 block">Asunto</label>
                <input
                  type="text"
                  value={currentEdit.subject}
                  onChange={(e) => updateEdit('subject', e.target.value)}
                  disabled={sentIds.has(current.id)}
                  className="w-full px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-sm text-white placeholder:text-white/30 outline-none focus:border-blue-500/30 transition disabled:opacity-50"
                />
              </div>

              {/* Body */}
              <div>
                <label className="text-[11px] text-white/40 uppercase tracking-wider mb-1 block">Cuerpo del correo</label>
                <textarea
                  value={currentEdit.body_html}
                  onChange={(e) => updateEdit('body_html', e.target.value)}
                  disabled={sentIds.has(current.id)}
                  rows={10}
                  className="w-full px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-sm text-white/80 placeholder:text-white/30 outline-none focus:border-blue-500/30 transition resize-y font-mono text-xs leading-relaxed disabled:opacity-50"
                />
              </div>

              {/* PDF attachment */}
              {current.pdf_url && (
                <a
                  href={current.pdf_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/[0.03] border border-white/[0.06] text-white/60 text-xs hover:bg-white/[0.06] hover:text-white/80 transition"
                >
                  <FileDown className="h-3.5 w-3.5" />
                  Ver PDF de Orden de Compra ({current.po_folio})
                </a>
              )}

              {/* Send single button */}
              {!sentIds.has(current.id) && (
                <button
                  onClick={() => sendDraft(current)}
                  disabled={sendingIds.has(current.id)}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-blue-600/80 text-white text-sm font-medium hover:bg-blue-600 disabled:opacity-50 transition"
                >
                  {sendingIds.has(current.id) ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                  Enviar Confirmado
                </button>
              )}
            </div>
          )}
        </div>

        {/* Footer: navigation + send all */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-white/[0.06] shrink-0">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentIndex((i) => Math.max(0, i - 1))}
              disabled={currentIndex === 0}
              className="p-1.5 rounded-lg text-white/30 hover:text-white hover:bg-white/[0.06] disabled:opacity-20 transition"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            {/* Dots indicator */}
            <div className="flex gap-1">
              {drafts.map((d, i) => (
                <button
                  key={d.id}
                  onClick={() => setCurrentIndex(i)}
                  className={`h-1.5 rounded-full transition-all ${
                    i === currentIndex
                      ? 'w-4 bg-blue-400'
                      : sentIds.has(d.id)
                        ? 'w-1.5 bg-emerald-400/60'
                        : 'w-1.5 bg-white/20'
                  }`}
                />
              ))}
            </div>
            <button
              onClick={() => setCurrentIndex((i) => Math.min(drafts.length - 1, i + 1))}
              disabled={currentIndex >= drafts.length - 1}
              className="p-1.5 rounded-lg text-white/30 hover:text-white hover:bg-white/[0.06] disabled:opacity-20 transition"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          {allSent ? (
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg bg-emerald-600/80 text-white text-xs font-medium hover:bg-emerald-600 transition"
            >
              Todos enviados — Cerrar
            </button>
          ) : (
            <button
              onClick={sendAll}
              disabled={sendingIds.size > 0}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-white/[0.06] border border-white/[0.08] text-white/70 text-xs font-medium hover:bg-white/[0.1] hover:text-white disabled:opacity-50 transition"
            >
              {sendingIds.size > 0 ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Send className="h-3 w-3" />
              )}
              Enviar Todos ({drafts.length - sentIds.size})
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
