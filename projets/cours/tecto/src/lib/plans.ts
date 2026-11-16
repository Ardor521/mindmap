
/** Plans & monétisation — prêt pour Stripe */

export type PlanId = 'free' | 'pro' | 'team';

export interface PlanLimits {
  maxWorkspaces: number;
  maxNodesPerWorkspace: number;
  maxCustomRelationTypes: number;
  cloudBackup: boolean;
  prioritySupport: boolean;
  removeBranding: boolean;
  teamSeats: number;
  aiAssist: boolean;
}

export interface PlanDef {
  id: PlanId;
  name: string;
  tagline: string;
  priceMonthly: number; // EUR
  priceYearly: number;
  /** Stripe Price IDs — à renseigner en production */
  stripePriceIdMonthly?: string;
  stripePriceIdYearly?: string;
  highlight?: boolean;
  limits: PlanLimits;
  features: string[];
}

export const PLANS: Record<PlanId, PlanDef> = {
  free: {
    id: 'free',
    name: 'Découverte',
    tagline: 'Pour explorer et cartographier librement',
    priceMonthly: 0,
    priceYearly: 0,
    limits: {
      maxWorkspaces: 3,
      maxNodesPerWorkspace: 150,
      maxCustomRelationTypes: 5,
      cloudBackup: false,
      prioritySupport: false,
      removeBranding: false,
      teamSeats: 1,
      aiAssist: true,
    },
    features: [
      '3 espaces (Univers 3D ou Mindmap 2D)',
      'Jusqu’à 150 concepts par espace',
      'Export JSON & Markdown',
      'Multi-chemins & normalisation hiérarchique',
      'Assistant IA local',
    ],
  },
  pro: {
    id: 'pro',
    name: 'Pro',
    tagline: 'Pour les créateurs et chercheurs exigeants',
    priceMonthly: 12,
    priceYearly: 108, // 9€/mois annuel
    highlight: true,
    stripePriceIdMonthly: import.meta.env.VITE_STRIPE_PRICE_PRO_MONTHLY || '',
    stripePriceIdYearly: import.meta.env.VITE_STRIPE_PRICE_PRO_YEARLY || '',
    limits: {
      maxWorkspaces: 50,
      maxNodesPerWorkspace: 5000,
      maxCustomRelationTypes: 100,
      cloudBackup: true,
      prioritySupport: true,
      removeBranding: true,
      teamSeats: 1,
      aiAssist: true,
    },
    features: [
      '50 espaces',
      'Jusqu’à 5 000 concepts par espace',
      'Sauvegarde cloud (bientôt)',
      'Types de liens illimités',
      'Sans branding Knowledge Universe',
      'Support prioritaire',
    ],
  },
  team: {
    id: 'team',
    name: 'Équipe',
    tagline: 'Pour collabores et organisations',
    priceMonthly: 29,
    priceYearly: 276,
    stripePriceIdMonthly: import.meta.env.VITE_STRIPE_PRICE_TEAM_MONTHLY || '',
    stripePriceIdYearly: import.meta.env.VITE_STRIPE_PRICE_TEAM_YEARLY || '',
    limits: {
      maxWorkspaces: 200,
      maxNodesPerWorkspace: 20000,
      maxCustomRelationTypes: 500,
      cloudBackup: true,
      prioritySupport: true,
      removeBranding: true,
      teamSeats: 10,
      aiAssist: true,
    },
    features: [
      'Tout Pro inclus',
      'Jusqu’à 10 sièges',
      '200 espaces partagés',
      'Rôles & permissions (bientôt)',
      'Facturation centralisée',
    ],
  },
};

export function planOf(id: PlanId | string | undefined): PlanDef {
  if (id && id in PLANS) return PLANS[id as PlanId];
  return PLANS.free;
}

export function canCreateWorkspace(planId: PlanId, currentCount: number): boolean {
  return currentCount < planOf(planId).limits.maxWorkspaces;
}

export function canAddNode(planId: PlanId, currentNodes: number): boolean {
  return currentNodes < planOf(planId).limits.maxNodesPerWorkspace;
}
