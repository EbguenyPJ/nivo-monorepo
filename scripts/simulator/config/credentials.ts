export const CREDENTIALS = {
  superAdmin: {
    email: process.env.SUPER_ADMIN_EMAIL || 'admin@nivo.com',
    password: process.env.SUPER_ADMIN_PASSWORD || 'ChangeMe123!',
    role: 'super-admin' as const,
  },
  demo: {
    email: process.env.DEMO_EMAIL || 'demo@nivo.com',
    emailPassword: process.env.DEMO_EMAIL_PASSWORD || 'ChangeMe123!',
    phone: process.env.DEMO_PHONE || '+520000000000',
  },
};

export function tenantCredentials(subdomain: string) {
  return {
    email: `${subdomain}@nivo.com`,
    password: `${subdomain}123!`,
  };
}
