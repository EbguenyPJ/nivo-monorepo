export const CREDENTIALS = {
  superAdmin: {
    email: 'admin@nivo.com',
    password: 'Superadmin1234!',
    role: 'super-admin' as const,
  },
  demo: {
    email: 'nivo.demo2@gmail.com',
    emailPassword: 'NiVo241195!',
    phone: '+522228124824',
  },
};

export function tenantCredentials(subdomain: string) {
  return {
    email: `${subdomain}@nivo.com`,
    password: `${subdomain}123!`,
  };
}
