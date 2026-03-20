'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import {
  Button, Badge, Card, CardContent, Input, Label, Skeleton, toast,
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@nivo/ui';
import {
  Loader2, CheckCircle2, XCircle, Eye, EyeOff, Save, RefreshCw,
  ExternalLink, Clock, Search, X, ArrowLeft, Settings2,
} from 'lucide-react';
import { apiClient } from '@/lib/api';

// ---------------------------------------------------------------------------
// SVG Logos – inline for crisp rendering & zero external deps
// ---------------------------------------------------------------------------

const StripeLogo = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 40 40" className={className} fill="none">
    <rect width="40" height="40" rx="8" fill="#635BFF" />
    <path d="M18.84 16.16c0-1.09.9-1.51 2.38-1.51 2.13 0 4.82.65 6.95 1.8V10.6c-2.33-.92-4.63-1.29-6.95-1.29-5.69 0-9.48 2.97-9.48 7.93 0 7.73 10.64 6.5 10.64 9.83 0 1.29-1.12 1.71-2.69 1.71-2.33 0-5.3-.96-7.66-2.24v5.95c2.61 1.12 5.24 1.6 7.66 1.6 5.83 0 9.83-2.88 9.83-7.92-.01-8.34-10.68-6.87-10.68-9.81z" fill="white" />
  </svg>
);

const MercadoPagoLogo = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 40 40" className={className} fill="none">
    <rect width="40" height="40" rx="8" fill="#009EE3" />
    <path d="M20 10c-5.52 0-10 4.48-10 10s4.48 10 10 10 10-4.48 10-10-4.48-10-10-10zm0 15c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5z" fill="white" />
    <circle cx="20" cy="20" r="2.5" fill="white" />
  </svg>
);

const PayPalLogo = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 40 40" className={className} fill="none">
    <rect width="40" height="40" rx="8" fill="#003087" />
    <path d="M25.6 13.2c-.4-1.8-2.2-3.2-4.8-3.2h-6.2c-.4 0-.8.3-.9.7l-2.5 16c-.05.3.2.6.5.6h3.6l.9-5.7-.03.2c.1-.4.5-.7.9-.7h1.9c3.7 0 6.6-1.5 7.4-5.8.03-.1.04-.3.06-.4.2-1.4.0-2.4-.76-3.3z" fill="#27346A" />
    <path d="M25.6 13.2c-.4-1.8-2.2-3.2-4.8-3.2h-6.2c-.4 0-.8.3-.9.7L12 16.4l-.9 5.7h0l-.8 5.2c-.05.3.2.5.5.5h3.5c.4 0 .7-.3.8-.7l.8-5h1.8c3.7 0 6.6-1.5 7.4-5.8.3-1.5.1-2.7-.5-3.6z" fill="#2790C3" />
    <path d="M16.3 13.4c.1-.2.2-.4.4-.5.1-.1.3-.1.4-.1h5.5c.7 0 1.3 0 1.8.1.2 0 .3.1.5.1.2.1.3.1.5.2.1.05.2.1.3.15-.4-1.8-2.2-3.25-4.8-3.25h-6.2c-.4 0-.8.3-.9.7l-2.5 16c-.05.3.2.6.5.6h3.6l.9-5.7 .9-5.7z" fill="white" opacity="0.3" />
  </svg>
);

const ResendLogo = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 40 40" className={className} fill="none">
    <rect width="40" height="40" rx="8" fill="#000" />
    <path d="M12 12h6c2.2 0 4 1.8 4 4 0 1.7-1 3.1-2.5 3.7L23 28h-3.5l-3-7.5H15V28h-3V12zm3 3v3.5h3c.83 0 1.5-.67 1.5-1.5v-.5c0-.83-.67-1.5-1.5-1.5h-3z" fill="white" />
  </svg>
);

const SendGridLogo = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 40 40" className={className} fill="none">
    <rect width="40" height="40" rx="8" fill="#1A82E2" />
    <path d="M13 13h5v5h-5zM18 18h5v5h-5zM23 13h5v5h-5zM13 23h5v5h-5zM23 23h5v5h-5z" fill="white" opacity="0.9" />
    <path d="M18 13h5v5h-5z" fill="white" opacity="0.4" />
    <path d="M13 18h5v5h-5zM23 18h5v5h-5z" fill="white" opacity="0.4" />
    <path d="M18 23h5v5h-5z" fill="white" opacity="0.4" />
  </svg>
);

const AWSLogo = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 40 40" className={className} fill="none">
    <rect width="40" height="40" rx="8" fill="#232F3E" />
    <path d="M15.5 22.5c0 .4.05.7.1.9.08.2.15.4.25.6.04.07.06.14.06.2 0 .08-.05.17-.16.25l-.54.36c-.08.05-.15.08-.22.08-.08 0-.17-.04-.25-.13-.12-.13-.22-.27-.3-.42-.08-.15-.16-.32-.25-.53-.63.74-1.42 1.11-2.37 1.11-.68 0-1.22-.19-1.62-.58-.4-.39-.6-.9-.6-1.55 0-.68.24-1.24.73-1.66.48-.42 1.13-.63 1.95-.63.27 0 .55.02.84.07.3.05.6.12.92.2v-.59c0-.61-.13-1.04-.38-1.3-.26-.26-.7-.38-1.32-.38-.28 0-.57.03-.87.1-.3.07-.59.16-.87.27-.13.05-.22.09-.28.1-.06.02-.1.03-.13.03-.12 0-.17-.08-.17-.25v-.42c0-.13.02-.23.05-.29.03-.06.1-.12.22-.18.28-.14.62-.26 1.02-.36.4-.1.82-.15 1.27-.15.97 0 1.68.22 2.13.66.45.44.67 1.11.67 2.01v2.65zm-3.27.98c.26 0 .53-.05.82-.14.28-.1.54-.27.75-.5.13-.15.23-.32.28-.53.06-.2.09-.45.09-.74v-.36c-.24-.06-.49-.12-.76-.16-.27-.04-.53-.06-.79-.06-.53 0-.92.1-1.17.32-.26.22-.38.52-.38.92 0 .37.1.65.31.84.2.19.49.28.85.28zm6.49 1.23c-.15 0-.25-.03-.32-.08-.07-.05-.13-.16-.18-.32l-2.01-6.61-.02-.06c-.02-.1-.03-.17-.03-.2 0-.16.08-.25.24-.25h.83c.16 0 .27.03.33.08.07.05.12.16.17.32l1.44 5.66 1.33-5.66c.04-.17.1-.27.17-.32.07-.05.18-.08.34-.08h.68c.16 0 .27.03.34.08.07.05.13.16.17.32l1.35 5.73 1.48-5.73c.05-.17.11-.27.17-.32.07-.05.18-.08.33-.08h.79c.16 0 .25.08.25.25 0 .05-.01.1-.02.16-.02.06-.03.13-.06.21l-2.06 6.61c-.05.17-.11.27-.18.32-.07.05-.18.08-.32.08h-.73c-.16 0-.27-.03-.34-.08-.07-.06-.13-.16-.17-.33l-1.33-5.51-1.32 5.5c-.04.17-.1.27-.17.33-.07.05-.19.08-.34.08h-.73z" fill="white" />
    <path d="M27.2 26.1c-2.07 1.53-5.08 2.34-7.66 2.34-3.63 0-6.89-1.34-9.36-3.57-.19-.17-.02-.41.21-.28 2.67 1.55 5.96 2.49 9.37 2.49 2.3 0 4.83-.48 7.16-1.46.35-.15.64.23.28.48z" fill="#FF9900" />
    <path d="M28.12 25.05c-.27-.34-1.77-.16-2.45-.08-.2.02-.24-.15-.05-.28 1.2-.84 3.16-.6 3.39-.32.23.28-.06 2.28-1.18 3.23-.17.15-.34.07-.26-.12.25-.63.82-2.04.55-2.43z" fill="#FF9900" />
  </svg>
);

const S3Logo = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 40 40" className={className} fill="none">
    <rect width="40" height="40" rx="8" fill="#569A31" />
    <path d="M20 10l-8 4v12l8 4 8-4V14l-8-4zm0 2.3l5.5 2.7L20 17.7 14.5 15 20 12.3zM13 16.2l6 3v8.6l-6-3v-8.6zm14 0v8.6l-6 3v-8.6l6-3z" fill="white" />
  </svg>
);

const CloudinaryLogo = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 40 40" className={className} fill="none">
    <rect width="40" height="40" rx="8" fill="#3448C5" />
    <path d="M28 22.5c1.38 0 2.5-1.12 2.5-2.5 0-1.2-.84-2.2-1.97-2.44C28.24 15.07 26.28 13 23.8 13c-1.76 0-3.3 1-4.05 2.47C19.25 15.18 18.66 15 18.03 15c-1.93 0-3.53 1.57-3.53 3.5 0 .33.05.64.13.94C13.1 19.7 12 20.97 12 22.5c0 1.66 1.34 3 3 3h13c1.38 0 2.5-1.12 2.5-2.5s-1.12-2.5-2.5-2.5z" fill="white" opacity="0.9" />
  </svg>
);

const SlackLogo = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 40 40" className={className} fill="none">
    <rect width="40" height="40" rx="8" fill="#4A154B" />
    <path d="M16.5 23.5c0 .83-.67 1.5-1.5 1.5s-1.5-.67-1.5-1.5.67-1.5 1.5-1.5h1.5v1.5zm.75 0c0-.83.67-1.5 1.5-1.5s1.5.67 1.5 1.5v3.75c0 .83-.67 1.5-1.5 1.5s-1.5-.67-1.5-1.5v-3.75z" fill="#E01E5A" />
    <path d="M18.75 16.5c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5v1.5h-1.5zm0 .75c.83 0 1.5.67 1.5 1.5s-.67 1.5-1.5 1.5H15c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5h3.75z" fill="#36C5F0" />
    <path d="M25.75 18.75c0-.83.67-1.5 1.5-1.5s1.5.67 1.5 1.5-.67 1.5-1.5 1.5h-1.5v-1.5zm-.75 0c0 .83-.67 1.5-1.5 1.5s-1.5-.67-1.5-1.5V15c0-.83.67-1.5 1.5-1.5s1.5.67 1.5 1.5v3.75z" fill="#2EB67D" />
    <path d="M23.5 25.75c.83 0 1.5.67 1.5 1.5s-.67 1.5-1.5 1.5-1.5-.67-1.5-1.5v-1.5h1.5zm0-.75c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5H27.25c.83 0 1.5.67 1.5 1.5s-.67 1.5-1.5 1.5H23.5z" fill="#ECB22E" />
  </svg>
);

const DiscordLogo = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 40 40" className={className} fill="none">
    <rect width="40" height="40" rx="8" fill="#5865F2" />
    <path d="M27.93 13.66a18.1 18.1 0 00-4.47-1.39.07.07 0 00-.07.03c-.19.34-.41.79-.56 1.14a16.7 16.7 0 00-5.02 0 11.5 11.5 0 00-.57-1.14.07.07 0 00-.07-.03 18.06 18.06 0 00-4.47 1.39.06.06 0 00-.03.02C10.23 17.15 9.58 20.53 9.9 23.87c0 .02.01.04.03.05a18.2 18.2 0 005.48 2.77.07.07 0 00.08-.03c.42-.58.8-1.19 1.12-1.84a.07.07 0 00-.04-.1 12 12 0 01-1.71-.82.07.07 0 01-.01-.12c.12-.08.23-.17.34-.26a.07.07 0 01.07-.01c3.59 1.64 7.48 1.64 11.03 0a.07.07 0 01.07.01c.11.09.23.18.34.26.04.03.04.09-.01.12-.55.32-1.12.59-1.71.82a.07.07 0 00-.04.1c.33.64.7 1.26 1.12 1.84.02.02.05.04.08.03a18.14 18.14 0 005.49-2.77.07.07 0 00.03-.05c.38-3.93-.64-7.34-2.7-10.36a.06.06 0 00-.03-.02zM16.85 22.12c-.9 0-1.63-.82-1.63-1.83s.72-1.83 1.63-1.83c.92 0 1.65.83 1.63 1.83 0 1.01-.72 1.83-1.63 1.83zm6.03 0c-.9 0-1.63-.82-1.63-1.83s.72-1.83 1.63-1.83c.92 0 1.65.83 1.63 1.83 0 1.01-.71 1.83-1.63 1.83z" fill="white" />
  </svg>
);

const ShopifyLogo = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 40 40" className={className} fill="none">
    <rect width="40" height="40" rx="8" fill="#96BF48" />
    <path d="M26.5 12.8c-.02-.14-.15-.22-.26-.23-.11-.01-2.41-.04-2.41-.04s-1.6-1.56-1.77-1.73c-.17-.17-.5-.12-.63-.08-.02.01-.33.1-.85.27-.5-1.46-1.4-2.8-2.97-2.8h-.14C17.1 7.7 16.6 7.5 16.18 7.5c-3.67 0-5.42 4.58-5.97 6.91-.55.17-1.2.37-1.2.37-.55.17-.57.19-.64.71C8.31 15.96 7 26.8 7 26.8l14.2 2.45 6.3-1.58S26.52 12.94 26.5 12.8zM19.8 11.2l-1.36.42c0-.94-.13-2.27-.55-3.4.76.14 1.37 1.05 1.79 2.13l.12.85zm-2.3.71l-2.92.9c.56-2.17 1.62-3.22 2.55-3.62.37.75.52 1.8.37 2.72zm-1.55-3.83c.17 0 .33.06.49.17-1.22.57-2.52 2.01-3.07 4.88l-2.31.71c.64-2.19 2.17-5.76 4.89-5.76z" fill="white" />
    <path d="M26.24 12.57c-.11-.01-2.41-.04-2.41-.04s-1.6-1.56-1.77-1.73c-.06-.06-.15-.09-.24-.1L20.2 29.25l6.3-1.58S26.52 12.94 26.5 12.8c-.02-.14-.15-.22-.26-.23z" fill="white" opacity="0.6" />
  </svg>
);

const MercadoLibreLogo = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 40 40" className={className} fill="none">
    <rect width="40" height="40" rx="8" fill="#FFE600" />
    <path d="M20 11c-4.97 0-9 4.03-9 9s4.03 9 9 9 9-4.03 9-9-4.03-9-9-9zm0 2c1.5 0 2.88.47 4.02 1.27L20 18.29l-4.02-4.02A6.96 6.96 0 0120 13zm-5.73 2.27L18.29 20l-4.02 4.02A6.96 6.96 0 0113 20c0-1.5.47-2.88 1.27-4.02l0 .29zm1.71 9.46L20 20.71l4.02 4.02A6.96 6.96 0 0120 27c-1.5 0-2.88-.47-4.02-1.27zm9.75-1.71L21.71 20l4.02-4.02A6.96 6.96 0 0127 20c0 1.5-.47 2.88-1.27 4.02z" fill="#333" />
  </svg>
);

const WhatsAppLogo = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 40 40" className={className} fill="none">
    <rect width="40" height="40" rx="8" fill="#25D366" />
    <path d="M27.38 12.56A9.89 9.89 0 0020.04 10C15.51 10 11.82 13.68 11.8 18.2c0 1.45.38 2.86 1.1 4.11L11.76 27l4.82-1.26a9.85 9.85 0 004.72 1.2h0c4.53 0 8.22-3.68 8.24-8.2a8.17 8.17 0 00-2.41-5.84l.25-.34zM20.04 26.02h0a8.19 8.19 0 01-4.18-1.14l-.3-.18-3.1.82.83-3.04-.2-.31a8.17 8.17 0 01-1.25-4.36c0-4.53 3.28-7.33 7.32-7.33a7.27 7.27 0 015.15 2.14 7.27 7.27 0 012.13 5.17c-.02 3.77-3.3 7.23-8.4 7.23zm4.48-5.45c-.24-.12-1.45-.71-1.67-.8-.23-.08-.4-.12-.56.12-.17.24-.64.8-.79.96-.14.17-.3.19-.54.06-.24-.12-1.03-.38-1.96-1.21-.72-.65-1.21-1.44-1.36-1.69-.14-.24-.02-.37.11-.49.11-.11.24-.3.37-.44.12-.15.17-.24.25-.41.08-.17.04-.32-.02-.44-.06-.12-.56-1.36-.77-1.86-.2-.49-.41-.42-.56-.43h-.48c-.17 0-.44.06-.67.3-.23.24-.87.85-.87 2.08s.89 2.42 1.02 2.58c.12.17 1.75 2.67 4.25 3.74.59.26 1.06.41 1.42.52.6.19 1.14.16 1.57.1.48-.07 1.45-.6 1.66-1.17.2-.58.2-1.07.14-1.17-.06-.1-.23-.17-.48-.29z" fill="white" />
  </svg>
);

const SATLogo = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 40 40" className={className} fill="none">
    <rect width="40" height="40" rx="8" fill="#8B1A1A" />
    <path d="M12 14h16v2H12zM12 18h16v2H12zM12 22h16v2H12z" fill="white" opacity="0.3" />
    <text x="20" y="22" textAnchor="middle" fill="white" fontSize="7" fontWeight="bold" fontFamily="system-ui">SAT</text>
    <path d="M14 26h12v2H14z" fill="white" opacity="0.5" />
  </svg>
);

const WooCommerceLogo = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 40 40" className={className} fill="none">
    <rect width="40" height="40" rx="8" fill="#96588A" />
    <path d="M11 13c-.55 0-1 .45-1 1v9c0 .55.45 1 1 1h5l2 3 2-3h9c.55 0 1-.45 1-1v-9c0-.55-.45-1-1-1H11zm3.5 3c.55 0 1 .67 1 1.5v3c0 .83-.45 1.5-1 1.5s-1-.67-1-1.5v-3c0-.83.45-1.5 1-1.5zm4.5 0c.55 0 1 .67 1 1.5v3c0 .83-.45 1.5-1 1.5s-1-.67-1-1.5v-3c0-.83.45-1.5 1-1.5zm5 0c.4 0 .75.3.95.75l1.05 2.75-1.05 2.75c-.2.45-.55.75-.95.75-.55 0-1-.67-1-1.5v-3.5l.5-1.25c.1-.15.25-.25.5-.25z" fill="white" />
  </svg>
);

// ---------------------------------------------------------------------------
// Integration catalog – the "App Directory"
// ---------------------------------------------------------------------------

type IntegrationStatus = 'available' | 'coming_soon';
type IntegrationCategory = 'payments' | 'email' | 'storage' | 'notifications' | 'ecommerce' | 'marketplace' | 'communication' | 'billing';

interface CatalogIntegration {
  id: string;
  name: string;
  description: string;
  category: IntegrationCategory;
  status: IntegrationStatus;
  logo: React.FC<{ className?: string }>;
  brandColor: string;          // ring / accent colour on hover
  configFields?: { key: string; label: string; secret?: boolean; placeholder?: string }[];
}

const CATEGORIES: { key: IntegrationCategory; label: string; emoji: string }[] = [
  { key: 'payments', label: 'Pagos y Suscripciones', emoji: '💳' },
  { key: 'email', label: 'Correos Transaccionales', emoji: '📧' },
  { key: 'storage', label: 'Almacenamiento', emoji: '☁️' },
  { key: 'notifications', label: 'Notificaciones del Sistema', emoji: '🔔' },
  { key: 'ecommerce', label: 'E-commerce', emoji: '🛒' },
  { key: 'marketplace', label: 'Marketplaces', emoji: '🏪' },
  { key: 'communication', label: 'Comunicación', emoji: '💬' },
  { key: 'billing', label: 'Facturación Electrónica', emoji: '🧾' },
];

const CATALOG: CatalogIntegration[] = [
  // ---- Pagos y Suscripciones ----
  {
    id: 'stripe',
    name: 'Stripe',
    description: 'Cobra suscripciones mensuales y anuales automáticamente con tarjeta de crédito/débito.',
    category: 'payments',
    status: 'available',
    logo: StripeLogo,
    brandColor: 'ring-[#635BFF]/40',
    configFields: [
      { key: 'secret_key', label: 'Secret Key', secret: true, placeholder: 'sk_live_...' },
      { key: 'publishable_key', label: 'Publishable Key', placeholder: 'pk_live_...' },
      { key: 'webhook_secret', label: 'Webhook Secret', secret: true, placeholder: 'whsec_...' },
    ],
  },
  {
    id: 'mercado_pago',
    name: 'Mercado Pago',
    description: 'Acepta pagos con tarjeta, transferencia y efectivo en México y Latam.',
    category: 'payments',
    status: 'coming_soon',
    logo: MercadoPagoLogo,
    brandColor: 'ring-[#009EE3]/40',
  },
  {
    id: 'paypal',
    name: 'PayPal',
    description: 'Procesa pagos internacionales vía PayPal y tarjetas de crédito.',
    category: 'payments',
    status: 'coming_soon',
    logo: PayPalLogo,
    brandColor: 'ring-[#003087]/40',
  },
  // ---- Correos Transaccionales ----
  {
    id: 'resend',
    name: 'Resend',
    description: 'Envía correos transaccionales modernos con alta entregabilidad.',
    category: 'email',
    status: 'available',
    logo: ResendLogo,
    brandColor: 'ring-neutral-500/40',
    configFields: [
      { key: 'api_key', label: 'API Key', secret: true, placeholder: 're_...' },
      { key: 'from_email', label: 'Email de envío', placeholder: 'noreply@tunivo.com' },
    ],
  },
  {
    id: 'sendgrid',
    name: 'SendGrid',
    description: 'Servicio de correos transaccionales robusto de Twilio para bienvenidas, recibos y alertas.',
    category: 'email',
    status: 'available',
    logo: SendGridLogo,
    brandColor: 'ring-[#1A82E2]/40',
    configFields: [
      { key: 'api_key', label: 'API Key', secret: true, placeholder: 'SG.xxxx...' },
      { key: 'from_email', label: 'Email de envío', placeholder: 'noreply@tunivo.com' },
    ],
  },
  {
    id: 'aws_ses',
    name: 'Amazon SES',
    description: 'Servicio de correo escalable de AWS con precios muy competitivos por volumen.',
    category: 'email',
    status: 'available',
    logo: AWSLogo,
    brandColor: 'ring-[#FF9900]/40',
    configFields: [
      { key: 'region', label: 'Región AWS', placeholder: 'us-east-1' },
      { key: 'access_key', label: 'Access Key ID', secret: true },
      { key: 'secret_key', label: 'Secret Access Key', secret: true },
      { key: 'from_email', label: 'Email de envío', placeholder: 'noreply@tunivo.com' },
    ],
  },
  // ---- Almacenamiento de Archivos ----
  {
    id: 'aws_s3',
    name: 'Amazon S3',
    description: 'Almacena fotos de productos, logos de tiendas y archivos sin saturar el servidor.',
    category: 'storage',
    status: 'available',
    logo: S3Logo,
    brandColor: 'ring-[#569A31]/40',
    configFields: [
      { key: 'bucket', label: 'Nombre del Bucket', placeholder: 'nivo-uploads' },
      { key: 'region', label: 'Región', placeholder: 'us-east-1' },
      { key: 'access_key', label: 'Access Key ID', secret: true },
      { key: 'secret_key', label: 'Secret Access Key', secret: true },
    ],
  },
  {
    id: 'cloudinary',
    name: 'Cloudinary',
    description: 'Optimiza y transforma imágenes de zapatos al vuelo con CDN global.',
    category: 'storage',
    status: 'coming_soon',
    logo: CloudinaryLogo,
    brandColor: 'ring-[#3448C5]/40',
  },
  // ---- Notificaciones del Sistema ----
  {
    id: 'slack',
    name: 'Slack',
    description: 'Recibe alertas en tiempo real: nuevos registros, errores críticos y métricas.',
    category: 'notifications',
    status: 'available',
    logo: SlackLogo,
    brandColor: 'ring-[#4A154B]/40',
    configFields: [
      { key: 'webhook_url', label: 'Webhook URL', placeholder: 'https://hooks.slack.com/services/...' },
      { key: 'channel', label: 'Canal (opcional)', placeholder: '#nivo-alerts' },
    ],
  },
  {
    id: 'discord',
    name: 'Discord',
    description: 'Envía notificaciones automáticas al servidor de Discord del equipo.',
    category: 'notifications',
    status: 'available',
    logo: DiscordLogo,
    brandColor: 'ring-[#5865F2]/40',
    configFields: [
      { key: 'webhook_url', label: 'Webhook URL', placeholder: 'https://discord.com/api/webhooks/...' },
    ],
  },
  // ---- E-commerce (Próximamente – Nivel Tenant) ----
  {
    id: 'shopify',
    name: 'Shopify',
    description: 'Sincroniza inventario físico con tu tienda en línea de Shopify automáticamente.',
    category: 'ecommerce',
    status: 'coming_soon',
    logo: ShopifyLogo,
    brandColor: 'ring-[#96BF48]/40',
  },
  {
    id: 'woocommerce',
    name: 'WooCommerce',
    description: 'Conecta tu inventario con tiendas basadas en WordPress/WooCommerce.',
    category: 'ecommerce',
    status: 'coming_soon',
    logo: WooCommerceLogo,
    brandColor: 'ring-[#96588A]/40',
  },
  // ---- Marketplaces (Próximamente – Nivel Tenant) ----
  {
    id: 'mercado_libre',
    name: 'Mercado Libre',
    description: 'Sincroniza stock: al vender en tienda física, se descuenta en Mercado Libre.',
    category: 'marketplace',
    status: 'coming_soon',
    logo: MercadoLibreLogo,
    brandColor: 'ring-[#FFE600]/40',
  },
  // ---- Comunicación (Próximamente – Nivel Tenant) ----
  {
    id: 'whatsapp',
    name: 'WhatsApp Business',
    description: 'Envía tickets de compra y notificaciones al cliente final por WhatsApp.',
    category: 'communication',
    status: 'coming_soon',
    logo: WhatsAppLogo,
    brandColor: 'ring-[#25D366]/40',
  },
  // ---- Facturación (Próximamente – Nivel Tenant) ----
  {
    id: 'sat_cfdi',
    name: 'Facturación CFDI (SAT)',
    description: 'Genera facturas electrónicas válidas ante el SAT para clientes finales.',
    category: 'billing',
    status: 'coming_soon',
    logo: SATLogo,
    brandColor: 'ring-[#8B1A1A]/40',
  },
];

// ---------------------------------------------------------------------------
// Live integration data from API
// ---------------------------------------------------------------------------

interface LiveIntegration {
  id: string;
  type: string;
  display_name: string;
  is_enabled: boolean;
  config: Record<string, string>;
  status: 'connected' | 'disconnected' | 'error';
  last_tested_at: string | null;
}

// ---------------------------------------------------------------------------
// Configure Dialog Component
// ---------------------------------------------------------------------------

interface ConfigureDialogProps {
  catalog: CatalogIntegration;
  live: LiveIntegration | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onRefresh: () => void;
}

function ConfigureDialog({ catalog, live, open, onOpenChange, onRefresh }: ConfigureDialogProps) {
  const fields = catalog.configFields || [];
  const [config, setConfig] = useState<Record<string, string>>({});
  const [enabled, setEnabled] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; msg: string } | null>(null);
  const [revealed, setRevealed] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (open && live) {
      setConfig({ ...live.config });
      setEnabled(live.is_enabled);
    } else if (open) {
      const defaults: Record<string, string> = {};
      fields.forEach((f) => (defaults[f.key] = ''));
      setConfig(defaults);
      setEnabled(false);
    }
    setTestResult(null);
    setRevealed(new Set());
  }, [open, live]);

  const handleSave = async () => {
    setSaving(true);
    try {
      if (live) {
        await apiClient.patch(`/integrations/${live.id}`, { config, is_enabled: enabled });
      } else {
        await apiClient.post('/integrations', {
          type: catalog.id,
          display_name: catalog.name,
          config,
          is_enabled: enabled,
        });
      }
      toast({ title: 'Guardado', description: `${catalog.name} configurado correctamente.` });
      onRefresh();
      onOpenChange(false);
    } catch (err: any) {
      toast({
        title: 'Error',
        description: err.response?.data?.message || 'No se pudo guardar la configuración.',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    if (!live) return;
    setTesting(true);
    setTestResult(null);
    try {
      const res = await apiClient.post(`/integrations/${live.id}/test`);
      setTestResult({ ok: res.data.status === 'success', msg: res.data.message || 'Conexión exitosa.' });
      onRefresh();
    } catch (err: any) {
      setTestResult({ ok: false, msg: err.response?.data?.message || 'Error al probar la conexión.' });
    } finally {
      setTesting(false);
    }
  };

  const toggleReveal = (key: string) =>
    setRevealed((prev) => {
      const n = new Set(prev);
      n.has(key) ? n.delete(key) : n.add(key);
      return n;
    });

  const Logo = catalog.logo;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-1">
            <Logo className="h-10 w-10 rounded-lg shrink-0" />
            <div>
              <DialogTitle className="text-lg">{catalog.name}</DialogTitle>
              <DialogDescription className="text-sm">{catalog.description}</DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Toggle enabled */}
          <div className="flex items-center justify-between">
            <Label className="text-sm">Integración activa</Label>
            <button
              type="button"
              role="switch"
              aria-checked={enabled}
              onClick={() => setEnabled(!enabled)}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${enabled ? 'bg-emerald-500' : 'bg-muted'}`}
            >
              <span className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-lg transition-transform duration-200 ${enabled ? 'translate-x-5' : 'translate-x-0'}`} />
            </button>
          </div>

          {/* Config fields */}
          {fields.map((field) => {
            const isRevealed = revealed.has(field.key);
            return (
              <div key={field.key} className="space-y-1.5">
                <Label htmlFor={`cfg-${field.key}`} className="text-sm font-medium">
                  {field.label}
                </Label>
                <div className="relative">
                  <Input
                    id={`cfg-${field.key}`}
                    type={field.secret && !isRevealed ? 'password' : 'text'}
                    value={config[field.key] ?? ''}
                    onChange={(e) => setConfig((p) => ({ ...p, [field.key]: e.target.value }))}
                    placeholder={field.placeholder || (field.secret ? '••••••••' : `Ingresa ${field.label.toLowerCase()}`)}
                    className={field.secret ? 'pr-10' : ''}
                  />
                  {field.secret && (
                    <button
                      type="button"
                      onClick={() => toggleReveal(field.key)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {isRevealed ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  )}
                </div>
              </div>
            );
          })}

          {/* Test result banner */}
          {testResult && (
            <div className={`flex items-center gap-2 text-sm rounded-md px-3 py-2 ${testResult.ok ? 'bg-emerald-500/10 text-emerald-500' : 'bg-red-500/10 text-red-500'}`}>
              {testResult.ok ? <CheckCircle2 className="h-4 w-4 shrink-0" /> : <XCircle className="h-4 w-4 shrink-0" />}
              <span>{testResult.msg}</span>
            </div>
          )}
        </div>

        <DialogFooter className="flex-row gap-2 sm:justify-between">
          <div>
            {live && (
              <Button variant="outline" size="sm" onClick={handleTest} disabled={testing} className="gap-1.5">
                {testing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                Probar Conexión
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving}
              className="gap-1.5 bg-gradient-to-r from-purple-500 to-fuchsia-600 hover:from-purple-600 hover:to-fuchsia-700 border-0"
            >
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
              Guardar
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Integration Card – "App Directory" style
// ---------------------------------------------------------------------------

interface AppCardProps {
  catalog: CatalogIntegration;
  live: LiveIntegration | null;
  onConfigure: () => void;
}

function AppCard({ catalog, live, onConfigure }: AppCardProps) {
  const Logo = catalog.logo;
  const isComingSoon = catalog.status === 'coming_soon';
  const isConnected = live?.status === 'connected' && live.is_enabled;
  const isConfigured = !!live;

  return (
    <Card
      className={`group relative overflow-hidden transition-all duration-300 hover:shadow-lg ${
        isComingSoon
          ? 'opacity-70 hover:opacity-85'
          : `hover:ring-2 ${catalog.brandColor} cursor-pointer`
      }`}
      onClick={() => !isComingSoon && onConfigure()}
    >
      <CardContent className="p-5">
        {/* Status indicator top-right */}
        <div className="absolute top-4 right-4">
          {isComingSoon ? (
            <Badge variant="outline" className="bg-muted/50 text-muted-foreground border-border text-[11px] gap-1">
              <Clock className="h-3 w-3" />
              Próximamente
            </Badge>
          ) : isConnected ? (
            <Badge variant="outline" className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20 text-[11px] gap-1">
              <CheckCircle2 className="h-3 w-3" />
              Conectado
            </Badge>
          ) : isConfigured ? (
            <Badge variant="outline" className="bg-amber-500/10 text-amber-500 border-amber-500/20 text-[11px] gap-1">
              <Settings2 className="h-3 w-3" />
              Configurado
            </Badge>
          ) : (
            <Badge variant="outline" className="bg-muted/50 text-muted-foreground border-border text-[11px]">
              Disponible
            </Badge>
          )}
        </div>

        {/* Logo + Name + Description */}
        <div className="flex items-start gap-3.5">
          <div className="shrink-0">
            <Logo className="h-12 w-12 rounded-xl shadow-sm" />
          </div>
          <div className="min-w-0 pr-20">
            <h3 className="font-semibold text-foreground text-[15px] truncate">{catalog.name}</h3>
            <p className="text-sm text-muted-foreground mt-1 line-clamp-2 leading-relaxed">
              {catalog.description}
            </p>
          </div>
        </div>

        {/* Action area */}
        <div className="mt-4 flex items-center justify-between">
          <span className="text-[11px] text-muted-foreground/60 uppercase tracking-wider font-medium">
            {CATEGORIES.find((c) => c.key === catalog.category)?.label}
          </span>
          {!isComingSoon && (
            <Button
              variant={isConnected ? 'outline' : 'default'}
              size="sm"
              className={`text-xs h-8 gap-1.5 ${
                isConnected
                  ? ''
                  : 'bg-gradient-to-r from-purple-500 to-fuchsia-600 hover:from-purple-600 hover:to-fuchsia-700 border-0'
              }`}
              onClick={(e) => {
                e.stopPropagation();
                onConfigure();
              }}
            >
              {isConnected ? (
                <>
                  <Settings2 className="h-3.5 w-3.5" />
                  Configurar
                </>
              ) : (
                <>
                  <ExternalLink className="h-3.5 w-3.5" />
                  Conectar
                </>
              )}
            </Button>
          )}
          {isComingSoon && (
            <Button variant="outline" size="sm" className="text-xs h-8 opacity-50 cursor-not-allowed" disabled>
              <Clock className="h-3.5 w-3.5 mr-1" />
              Próximamente
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
  const [liveIntegrations, setLiveIntegrations] = useState<LiveIntegration[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState<IntegrationCategory | 'all'>('all');
  const [configTarget, setConfigTarget] = useState<CatalogIntegration | null>(null);

  const fetchLive = useCallback(async () => {
    try {
      const res = await apiClient.get('/integrations');
      const data = res.data.data || res.data || [];
      setLiveIntegrations(Array.isArray(data) ? data : []);
    } catch {
      // silently fail – catalog still renders
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLive();
  }, [fetchLive]);

  // Match live data to catalog entries
  const getLive = (catalogId: string) =>
    liveIntegrations.find((l) => l.type === catalogId) || null;

  // Filter catalog
  const filtered = CATALOG.filter((item) => {
    const q = search.toLowerCase().trim();
    const matchesSearch =
      !q ||
      item.name.toLowerCase().includes(q) ||
      item.description.toLowerCase().includes(q) ||
      CATEGORIES.find((c) => c.key === item.category)?.label.toLowerCase().includes(q);
    const matchesCategory = activeCategory === 'all' || item.category === activeCategory;
    return matchesSearch && matchesCategory;
  });

  // Group by category for display
  const usedCategories = CATEGORIES.filter((cat) =>
    filtered.some((item) => item.category === cat.key),
  );

  // Stats
  const connectedCount = CATALOG.filter(
    (c) => c.status === 'available' && getLive(c.id)?.status === 'connected' && getLive(c.id)?.is_enabled,
  ).length;
  const availableCount = CATALOG.filter((c) => c.status === 'available').length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-foreground">Integraciones</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Conecta Nivo con servicios externos para potenciar la plataforma.{' '}
            <span className="text-foreground/60">
              {connectedCount} de {availableCount} conectadas
            </span>
          </p>
        </div>
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar integraciones..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 pr-9 h-9"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Category pills */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setActiveCategory('all')}
          className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-200 ${
            activeCategory === 'all'
              ? 'bg-gradient-to-r from-purple-500 to-fuchsia-600 text-white shadow-md shadow-purple-500/20'
              : 'bg-muted text-muted-foreground hover:bg-accent hover:text-accent-foreground'
          }`}
        >
          Todas ({CATALOG.length})
        </button>
        {CATEGORIES.map((cat) => {
          const count = CATALOG.filter((i) => i.category === cat.key).length;
          if (count === 0) return null;
          return (
            <button
              key={cat.key}
              onClick={() => setActiveCategory(cat.key)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-200 ${
                activeCategory === cat.key
                  ? 'bg-gradient-to-r from-purple-500 to-fuchsia-600 text-white shadow-md shadow-purple-500/20'
                  : 'bg-muted text-muted-foreground hover:bg-accent hover:text-accent-foreground'
              }`}
            >
              {cat.emoji} {cat.label} ({count})
            </button>
          );
        })}
      </div>

      {/* Main grid */}
      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-5 space-y-4">
                <div className="flex items-start gap-3.5">
                  <Skeleton className="h-12 w-12 rounded-xl" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-5 w-28" />
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-3/4" />
                  </div>
                </div>
                <div className="flex justify-between">
                  <Skeleton className="h-3 w-24" />
                  <Skeleton className="h-8 w-24 rounded-md" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <Search className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
            <h3 className="font-semibold text-foreground mb-1">Sin resultados</h3>
            <p className="text-sm text-muted-foreground">
              No se encontraron integraciones que coincidan con tu búsqueda.
            </p>
            <Button variant="outline" size="sm" className="mt-4" onClick={() => { setSearch(''); setActiveCategory('all'); }}>
              <ArrowLeft className="h-3.5 w-3.5 mr-1.5" />
              Ver todas
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-8">
          {usedCategories.map((cat) => {
            const items = filtered.filter((i) => i.category === cat.key);
            if (items.length === 0) return null;
            return (
              <div key={cat.key}>
                <h3 className="text-sm font-semibold text-foreground/80 mb-3 flex items-center gap-2">
                  <span>{cat.emoji}</span>
                  {cat.label}
                  <span className="text-muted-foreground font-normal">({items.length})</span>
                </h3>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {items.map((item) => (
                    <AppCard
                      key={item.id}
                      catalog={item}
                      live={getLive(item.id)}
                      onConfigure={() => setConfigTarget(item)}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Configure dialog */}
      {configTarget && (
        <ConfigureDialog
          catalog={configTarget}
          live={getLive(configTarget.id)}
          open={!!configTarget}
          onOpenChange={(v) => !v && setConfigTarget(null)}
          onRefresh={fetchLive}
        />
      )}
    </div>
  );
}
