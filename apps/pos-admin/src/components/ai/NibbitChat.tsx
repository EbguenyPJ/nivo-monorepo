'use client';

import { useState, useRef, useEffect, useCallback, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { MessageSquare, X, Send, Loader2, Bot, User, Sparkles, Minimize2, FileText, Mail } from 'lucide-react';
import { apiClient } from '@/lib/api';
import { EmailDraftsModal } from './EmailDraftsModal';

interface NibbitAction {
  type: 'requisition_draft' | 'email_drafts';
  label: string;
  payload: Record<string, any>;
}

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  loading?: boolean;
  toolCalls?: { name: string; input: any }[];
  actions?: NibbitAction[];
}

function generateId() {
  return Math.random().toString(36).substring(2, 10);
}

function MarkdownContent({ content }: { content: string }) {
  const lines = content.split('\n');
  const elements: JSX.Element[] = [];
  let tableLines: string[] = [];
  let inTable = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line.trim().startsWith('|') && line.trim().endsWith('|')) {
      if (!inTable) inTable = true;
      tableLines.push(line);
      continue;
    }

    if (inTable) {
      elements.push(<MarkdownTable key={`tbl-${i}`} lines={tableLines} />);
      tableLines = [];
      inTable = false;
    }

    if (line.startsWith('### ')) {
      elements.push(<h4 key={i} className="font-semibold text-white/90 mt-3 mb-1 text-sm">{line.slice(4)}</h4>);
    } else if (line.startsWith('## ')) {
      elements.push(<h3 key={i} className="font-bold text-white mt-3 mb-1">{line.slice(3)}</h3>);
    } else if (line.startsWith('**') && line.endsWith('**')) {
      elements.push(<p key={i} className="font-semibold text-white/90 mt-2">{line.slice(2, -2)}</p>);
    } else if (line.startsWith('- ')) {
      elements.push(
        <div key={i} className="flex gap-2 ml-1">
          <span className="text-white/30 shrink-0">•</span>
          <span>{renderInline(line.slice(2))}</span>
        </div>
      );
    } else if (line.trim() === '') {
      elements.push(<div key={i} className="h-2" />);
    } else {
      elements.push(<p key={i}>{renderInline(line)}</p>);
    }
  }

  if (inTable && tableLines.length > 0) {
    elements.push(<MarkdownTable key="tbl-end" lines={tableLines} />);
  }

  return <div className="space-y-0.5">{elements}</div>;
}

function renderInline(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*|\$[\d,]+\.?\d*)/g);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i} className="text-white font-semibold">{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith('$') && /^\$[\d,]+\.?\d*$/.test(part)) {
      return <span key={i} className="text-emerald-400 font-medium">{part}</span>;
    }
    return part;
  });
}

function MarkdownTable({ lines }: { lines: string[] }) {
  const parseRow = (line: string) =>
    line.split('|').filter(Boolean).map(cell => cell.trim());

  if (lines.length < 2) return null;

  const headers = parseRow(lines[0]);
  const isSeparator = (line: string) => /^\|[\s-:|]+\|$/.test(line.trim());
  const dataLines = lines.slice(isSeparator(lines[1]) ? 2 : 1);

  return (
    <div className="overflow-x-auto my-2 rounded-lg border border-white/[0.08]">
      <table className="w-full text-xs">
        <thead>
          <tr className="bg-white/[0.04]">
            {headers.map((h, i) => (
              <th key={i} className="text-left px-3 py-2 text-white/50 font-medium whitespace-nowrap">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {dataLines.map((line, ri) => (
            <tr key={ri} className="border-t border-white/[0.05]">
              {parseRow(line).map((cell, ci) => (
                <td key={ci} className="px-3 py-1.5 text-white/80 whitespace-nowrap">{renderInline(cell)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const TOOL_LABELS: Record<string, string> = {
  get_sales_summary: 'Consultando ventas',
  get_top_selling_products: 'Buscando productos más vendidos',
  get_least_selling_products: 'Analizando baja rotación',
  get_most_profitable_brand: 'Calculando rentabilidad por marca',
  get_cash_expenses_sum: 'Sumando gastos',
  get_low_stock_items: 'Revisando inventario',
  get_cash_discrepancies: 'Verificando arqueos de caja',
  search_product_catalog: 'Buscando en catálogo',
  get_sales_by_hour: 'Analizando horarios',
  get_branch_comparison: 'Comparando sucursales',
  list_branches: 'Consultando sucursales',
  list_requisitions: 'Consultando requisiciones',
  draft_auto_requisition: 'Generando requisición automática',
  draft_supplier_emails: 'Redactando correos a proveedores',
};

export function NibbitChat() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [emailModalDraftIds, setEmailModalDraftIds] = useState<string[] | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    if (open && inputRef.current) {
      inputRef.current.focus();
    }
  }, [open]);

  const sendMessage = useCallback(async (e?: FormEvent) => {
    e?.preventDefault();
    const text = input.trim();
    if (!text || sending) return;

    const userMsg: Message = { id: generateId(), role: 'user', content: text };
    const loadingMsg: Message = { id: generateId(), role: 'assistant', content: '', loading: true };

    setMessages(prev => [...prev, userMsg, loadingMsg]);
    setInput('');
    setSending(true);

    try {
      const chatHistory = [...messages.filter(m => !m.loading), userMsg].map(m => ({
        role: m.role,
        content: m.content,
      }));

      const { data } = await apiClient.post('/nibbit/chat', { messages: chatHistory });

      setMessages(prev =>
        prev.map(m =>
          m.id === loadingMsg.id
            ? { ...m, content: data.reply, loading: false, toolCalls: data.tool_calls, actions: data.actions }
            : m,
        ),
      );
    } catch (err: any) {
      const status = err?.response?.status;
      const detail = err?.response?.data?.message || err?.response?.data?.detail || '';
      let errorMsg = 'Lo siento, ocurrió un error al procesar tu consulta. Intenta de nuevo.';
      if (status === 403) {
        errorMsg = detail || 'Nibbit no está disponible en tu plan actual. Contacta a soporte para activarlo.';
      } else if (status === 400) {
        errorMsg = 'No se pudo conectar con el contexto de tu negocio. Intenta recargar la página.';
      }
      setMessages(prev =>
        prev.map(m =>
          m.id === loadingMsg.id
            ? { ...m, content: errorMsg, loading: false }
            : m,
        ),
      );
    } finally {
      setSending(false);
    }
  }, [input, sending, messages]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <>
      {/* FAB Button */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-6 right-6 z-50 h-14 w-14 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 text-white shadow-lg shadow-blue-500/25 hover:shadow-xl hover:shadow-blue-500/30 hover:scale-105 transition-all flex items-center justify-center group"
        >
          <Sparkles className="h-6 w-6 group-hover:rotate-12 transition-transform" />
        </button>
      )}

      {/* Chat panel */}
      {open && (
        <div className="fixed bottom-6 right-6 z-50 w-[420px] h-[600px] max-h-[80vh] rounded-2xl border border-white/10 bg-[#0c0c0c]/95 backdrop-blur-xl shadow-2xl flex flex-col overflow-hidden">
          {/* Header */}
          <div className="flex items-center gap-3 px-4 py-3 border-b border-white/[0.06] shrink-0">
            <div className="h-8 w-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
              <Bot className="h-4 w-4 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-semibold text-white">Nibbit</h3>
              <p className="text-[11px] text-white/40">Asistente de inteligencia Nivo</p>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="p-1.5 rounded-lg text-white/30 hover:text-white hover:bg-white/[0.06] transition"
            >
              <Minimize2 className="h-4 w-4" />
            </button>
          </div>

          {/* Messages */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
            {messages.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full text-center px-4">
                <div className="h-12 w-12 rounded-full bg-gradient-to-br from-blue-500/20 to-purple-600/20 flex items-center justify-center mb-3">
                  <Sparkles className="h-6 w-6 text-blue-400" />
                </div>
                <p className="text-sm font-medium text-white/80 mb-1">Hola, soy Nibbit</p>
                <p className="text-xs text-white/40 mb-4">Pregúntame sobre tus ventas, inventario, gastos o productos.</p>
                <div className="flex flex-wrap gap-1.5 justify-center">
                  {[
                    '¿Cuánto vendimos ayer?',
                    '¿Qué marca es la más rentable?',
                    '¿Qué productos tienen stock bajo?',
                    '¿Cuáles son mis horarios pico?',
                  ].map((q) => (
                    <button
                      key={q}
                      onClick={() => { setInput(q); }}
                      className="px-2.5 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.06] text-[11px] text-white/60 hover:text-white hover:bg-white/[0.08] transition"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((msg) => (
              <div key={msg.id} className={`flex gap-2.5 ${msg.role === 'user' ? 'justify-end' : ''}`}>
                {msg.role === 'assistant' && (
                  <div className="h-6 w-6 rounded-full bg-gradient-to-br from-blue-500/30 to-purple-600/30 flex items-center justify-center shrink-0 mt-0.5">
                    <Bot className="h-3 w-3 text-blue-400" />
                  </div>
                )}
                <div className={`max-w-[85%] rounded-xl px-3.5 py-2.5 text-[13px] leading-relaxed ${
                  msg.role === 'user'
                    ? 'bg-blue-600/20 border border-blue-500/20 text-white'
                    : 'bg-white/[0.03] border border-white/[0.06] text-white/80'
                }`}>
                  {msg.loading ? (
                    <div className="flex items-center gap-2 text-white/50">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      <span className="text-xs">Nibbit está analizando la base de datos...</span>
                    </div>
                  ) : (
                    <>
                      {msg.toolCalls && msg.toolCalls.length > 0 && (
                        <div className="flex flex-wrap gap-1 mb-2">
                          {msg.toolCalls.map((tc, i) => (
                            <span key={i} className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-blue-500/10 text-[10px] text-blue-400">
                              <Sparkles className="h-2.5 w-2.5" />
                              {TOOL_LABELS[tc.name] || tc.name}
                            </span>
                          ))}
                        </div>
                      )}
                      <MarkdownContent content={msg.content} />
                      {msg.actions && msg.actions.length > 0 && (
                        <div className="flex flex-col gap-1.5 mt-3">
                          {msg.actions.map((action, i) => (
                            <button
                              key={i}
                              onClick={() => {
                                if (action.type === 'requisition_draft') {
                                  router.push(`/dashboard/requisitions?draft_id=${action.payload.requisition_id}`);
                                  setOpen(false);
                                } else if (action.type === 'email_drafts') {
                                  setEmailModalDraftIds(action.payload.draft_ids || []);
                                }
                              }}
                              className="flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-500/15 border border-blue-500/25 text-blue-300 text-xs font-medium hover:bg-blue-500/25 hover:text-blue-200 transition-all"
                            >
                              {action.type === 'requisition_draft' ? (
                                <FileText className="h-3.5 w-3.5" />
                              ) : (
                                <Mail className="h-3.5 w-3.5" />
                              )}
                              {action.label}
                            </button>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </div>
                {msg.role === 'user' && (
                  <div className="h-6 w-6 rounded-full bg-white/10 flex items-center justify-center shrink-0 mt-0.5">
                    <User className="h-3 w-3 text-white/50" />
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Input */}
          <form onSubmit={sendMessage} className="px-4 py-3 border-t border-white/[0.06] shrink-0">
            <div className="flex items-end gap-2 rounded-xl bg-white/[0.04] border border-white/[0.08] px-3 py-2 focus-within:border-blue-500/30 transition">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => {
                  setInput(e.target.value);
                  // Auto-resize: reset to 1 row then grow up to 2 lines
                  const el = e.target;
                  el.style.height = 'auto';
                  const lineHeight = parseInt(getComputedStyle(el).lineHeight) || 20;
                  el.style.height = `${Math.min(el.scrollHeight, lineHeight * 2)}px`;
                }}
                onKeyDown={handleKeyDown}
                placeholder="Pregunta a Nibbit..."
                rows={1}
                className="flex-1 bg-transparent text-sm text-white placeholder:text-white/30 resize-none outline-none leading-5"
                style={{ maxHeight: '2.5rem' }}
                disabled={sending}
              />
              <button
                type="submit"
                disabled={!input.trim() || sending}
                className="p-1.5 rounded-lg text-white/30 hover:text-blue-400 disabled:opacity-30 transition shrink-0"
              >
                <Send className="h-4 w-4" />
              </button>
            </div>
            <p className="text-[10px] text-white/20 text-center mt-1.5">
              Los datos provienen directamente de tu base de datos — sin estimaciones
            </p>
          </form>
        </div>
      )}
      {emailModalDraftIds && (
        <EmailDraftsModal
          draftIds={emailModalDraftIds}
          onClose={() => setEmailModalDraftIds(null)}
        />
      )}
    </>
  );
}
