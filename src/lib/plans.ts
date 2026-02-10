// Shared plans configuration - single source of truth
export type PlanKey = 'free' | 'pro' | 'business' | 'enterprise';

export interface Plan {
  id: string;
  name: PlanKey;
  displayName: string;
  description: string;
  priceMonthly: number;
  priceYearly: number;
  storage: string;
  storageGB: number;
  organizations: number;
  teams: number;
  projects: number;
  features: string[];
  highlighted?: boolean;
  badge?: string;
}

export const PLANS: Plan[] = [
  {
    id: 'free',
    name: 'free',
    displayName: 'Free',
    description: 'Perfect for individuals getting started',
    priceMonthly: 0,
    priceYearly: 0,
    storage: '1GB',
    storageGB: 1,
    organizations: 1,
    teams: 3,
    projects: 10,
    features: [],
  },
  {
    id: 'pro',
    name: 'pro',
    displayName: 'Pro',
    description: 'For growing teams and agencies',
    priceMonthly: 999,
    priceYearly: 9999,
    storage: '50GB',
    storageGB: 50,
    organizations: 5,
    teams: 10,
    projects: 100,
    features: [],
    highlighted: true,
    badge: '⭐ Recommended',
  },
  {
    id: 'business',
    name: 'business',
    displayName: 'Business',
    description: 'For large organizations with advanced needs',
    priceMonthly: 1999,
    priceYearly: 19999,
    storage: '100GB',
    storageGB: 100,
    organizations: Infinity,
    teams: 50,
    projects: 100,
    features: [],
  },
  {
    id: 'enterprise',
    name: 'enterprise',
    displayName: 'Enterprise',
    description: 'For enterprises with unlimited scale',
    priceMonthly: 3999,
    priceYearly: 39999,
    storage: '200GB',
    storageGB: 200,
    organizations: Infinity,
    teams: Infinity,
    projects: Infinity,
    features: [],
  },
];

export const getPlanByName = (name: string): Plan | undefined => {
  return PLANS.find((p) => p.name === name);
};

export const formatPrice = (price: number): string => {
  if (price === 0) return 'Free';
  return `₹${price.toLocaleString('en-IN')}`;
};

// Plan limit helpers
export const getPlanLimits = (planName: string) => {
  const plan = getPlanByName(planName) || PLANS[0];
  return {
    organizations: plan.organizations,
    teams: plan.teams,
    projects: plan.projects,
    storageGB: plan.storageGB,
  };
};

export const formatLimit = (value: number): string => {
  return value === Infinity ? 'Unlimited' : value.toString();
};

// Feature access helpers
export const canCreateOrg = (orgCount: number, planName: string): boolean => {
  const limits = getPlanLimits(planName);
  return orgCount < limits.organizations;
};

export const canCreateTeam = (teamCount: number, planName: string): boolean => {
  const limits = getPlanLimits(planName);
  return teamCount < limits.teams;
};

export const canCreateProject = (projectCount: number, planName: string): boolean => {
  const limits = getPlanLimits(planName);
  return projectCount < limits.projects;
};
