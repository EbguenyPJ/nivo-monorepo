'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';
import { Eye, EyeOff, Store } from 'lucide-react';

const ALL_IMAGES = [
  '/images/login/imgw1.jpg',
  '/images/login/imgm1.jpg',
  '/images/login/imgw2.jpg',
  '/images/login/imgm2.jpg',
  '/images/login/imgw3.jpg',
  '/images/login/imgm3.jpg',
  '/images/login/imgw4.jpg',
  '/images/login/imgm4.jpg',
];

function shuffleArray<T>(arr: T[]): T[] {
  const shuffled = [...arr];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

/**
 * Detects tenant subdomain from the current hostname.
 * - "mizapateria.nivo.com" → "mizapateria"
 * - "mizapateria.localhost" → "mizapateria"
 * - "nivo.com" / "localhost" / "localhost:3001" → null (super-admin)
 */
function detectTenantFromHostname(): string | null {
  if (typeof window === 'undefined') return null;
  const hostname = window.location.hostname;

  // localhost / 127.0.0.1 → super-admin
  if (hostname === 'localhost' || hostname === '127.0.0.1') return null;

  // subdomain.localhost → tenant
  if (hostname.endsWith('.localhost')) {
    const sub = hostname.replace('.localhost', '');
    return sub || null;
  }

  // Production: sub.nivo.com or sub.domain.com
  const parts = hostname.split('.');
  if (parts.length >= 3) {
    return parts[0];
  }

  return null; // nivo.com / domain.com → super-admin
}

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [shuffledImages, setShuffledImages] = useState<string[]>(ALL_IMAGES);
  const [tenantSubdomain, setTenantSubdomain] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const router = useRouter();
  const login = useAuthStore((state) => state.login);

  useEffect(() => {
    setMounted(true);
    setShuffledImages(shuffleArray(ALL_IMAGES));
    setTenantSubdomain(detectTenantFromHostname());
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentImageIndex((prev) => (prev + 1) % shuffledImages.length);
    }, 4000);
    return () => clearInterval(interval);
  }, [shuffledImages.length]);

  const isTenantLogin = tenantSubdomain !== null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) return;

    setIsLoading(true);
    setError('');
    try {
      await login(email, password, isTenantLogin ? tenantSubdomain : undefined);
      await new Promise((resolve) => setTimeout(resolve, 100));
      const state = useAuthStore.getState();
      if (state.userType === 'super-admin') {
        router.push('/admin');
      } else {
        router.push('/dashboard');
      }
    } catch {
      setError(
        isTenantLogin
          ? 'Credenciales inválidas. Verifica tu correo y contraseña.'
          : 'Credenciales inválidas. Verifica tu correo y contraseña de administrador.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="login-page">
      {/* Background Carousel */}
      <div className="login-bg">
        {shuffledImages.map((src, i) => (
          <div
            key={src}
            className="login-bg-slide"
            style={{
              backgroundImage: `url(${src})`,
              opacity: i === currentImageIndex ? 1 : 0,
            }}
          />
        ))}
        <div className="login-bg-overlay" />
      </div>

      {/* Glass Card */}
      <div className="login-glass-card">
        {/* Left: Login Form */}
        <div className="login-form-section">
          <div className="login-brand">
            <h1>
              Bienvenido a <span className="login-brand-accent">
                {isTenantLogin ? tenantSubdomain : 'Nivo'}
              </span>
            </h1>
            <p>
              {isTenantLogin
                ? 'Inicia sesión para acceder al punto de venta'
                : 'Panel de administración del sistema'
              }
            </p>
          </div>

          <div className="login-form-container">
            <h2>Iniciar Sesión</h2>

            {/* Auto-detected tenant from URL */}
            {isTenantLogin && (
              <div className="login-tenant-badge">
                <Store size={14} />
                <span>Zapatería: <strong>{tenantSubdomain}</strong></span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="login-form">
              {error && (
                <div className="login-error">
                  {error}
                </div>
              )}

              <div className="login-field">
                <label htmlFor="email">Correo electrónico</label>
                <div className="login-input-wrapper">
                  <input
                    id="email"
                    type="email"
                    placeholder={isTenantLogin ? 'empleado@email.com' : 'admin@nivo.com'}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoComplete="email"
                  />
                </div>
              </div>

              <div className="login-field">
                <label htmlFor="password">Contraseña</label>
                <div className="login-input-wrapper">
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    className="login-eye-btn"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              <button type="submit" className="login-submit-btn" disabled={isLoading}>
                {isLoading ? <span className="login-spinner" /> : null}
                {isLoading ? 'Iniciando sesión...' : 'Entrar'}
              </button>
            </form>

            <div className="login-footer">
              <p>Nivo POS — Sistema de Punto de Venta</p>
            </div>
          </div>
        </div>

        {/* Right: Decorative */}
        <div className="login-deco-section">
          <div className="login-deco-content">
            <Store size={48} strokeWidth={1.5} />
            <h2>{isTenantLogin ? tenantSubdomain : 'Nivo POS'}</h2>
            <p>
              {isTenantLogin
                ? 'Accede a tu punto de venta'
                : 'Gestiona tu zapatería de forma inteligente'
              }
            </p>

            <div className="login-features">
              {isTenantLogin ? (
                <>
                  <div className="login-feature">
                    <div className="login-feature-num">1</div>
                    <span>Vende rápido con o sin conexión</span>
                  </div>
                  <div className="login-feature">
                    <div className="login-feature-num">2</div>
                    <span>Consulta inventario en tiempo real</span>
                  </div>
                  <div className="login-feature">
                    <div className="login-feature-num">3</div>
                    <span>Genera tickets y reportes al instante</span>
                  </div>
                </>
              ) : (
                <>
                  <div className="login-feature">
                    <div className="login-feature-num">1</div>
                    <span>Administra todos tus tenants</span>
                  </div>
                  <div className="login-feature">
                    <div className="login-feature-num">2</div>
                    <span>Gestiona suscripciones y facturación</span>
                  </div>
                  <div className="login-feature">
                    <div className="login-feature-num">3</div>
                    <span>Monitorea el rendimiento global</span>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
