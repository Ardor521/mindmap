/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_STRIPE_CHECKOUT_URL?: string;
  readonly VITE_STRIPE_PRICE_PRO_MONTHLY?: string;
  readonly VITE_STRIPE_PRICE_PRO_YEARLY?: string;
  readonly VITE_STRIPE_PRICE_TEAM_MONTHLY?: string;
  readonly VITE_STRIPE_PRICE_TEAM_YEARLY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
