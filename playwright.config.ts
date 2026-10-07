import { defineConfig, devices } from '@playwright/test';

// Optional local workaround for environments where the OS resolver can't reach
// *.supabase.co (seen on this network): set E2E_DNS_OVERRIDE="host:ip[,host:ip]"
// to force Chromium to use a specific IP for a hostname. Unset in normal/CI use.
const dnsOverride = process.env.E2E_DNS_OVERRIDE;
const hostResolverArgs = dnsOverride
  ? [`--host-resolver-rules=${dnsOverride.split(',').map((pair) => {
      const [host, ip] = pair.split(':');
      return `MAP ${host} ${ip}`;
    }).join(', ')}`]
  : [];

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:3009',
    locale: 'en-US',
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        launchOptions: { args: hostResolverArgs },
      },
    },
  ],
});
