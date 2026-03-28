import type { SubscriptionTier } from "./stripe-config";

const ADMIN_LIMITS: TierLimits = {
  projectsPerMonth: Infinity,
  imagesPerProject: Infinity,
  storageGB: Infinity,
  priorityProcessing: true,
  shareLinks: true,
  pointCloud: true,
  contourExport: true,
  gcpSupport: true,
  multiSpectral: true,
  apiAccess: true,
  whiteLabel: true,
  tierLabel: "Admin",
};

export interface TierLimits {
  projectsPerMonth: number;
  imagesPerProject: number;
  storageGB: number;
  priorityProcessing: boolean;
  shareLinks: boolean;
  pointCloud: boolean;
  contourExport: boolean;
  gcpSupport: boolean;
  multiSpectral: boolean;
  apiAccess: boolean;
  whiteLabel: boolean;
  tierLabel: string;
}

const LIMITS: Record<string, TierLimits> = {
  free: {
    projectsPerMonth: 3,
    imagesPerProject: 500,
    storageGB: 1,
    priorityProcessing: false,
    shareLinks: false,
    pointCloud: false,
    contourExport: false,
    gcpSupport: false,
    multiSpectral: false,
    apiAccess: false,
    whiteLabel: false,
    tierLabel: "Pilot (Free)",
  },
  professional: {
    projectsPerMonth: Infinity,
    imagesPerProject: 5000,
    storageGB: 50,
    priorityProcessing: true,
    shareLinks: true,
    pointCloud: true,
    contourExport: true,
    gcpSupport: true,
    multiSpectral: false,
    apiAccess: false,
    whiteLabel: false,
    tierLabel: "Professional",
  },
  enterprise: {
    projectsPerMonth: Infinity,
    imagesPerProject: Infinity,
    storageGB: 500,
    priorityProcessing: true,
    shareLinks: true,
    pointCloud: true,
    contourExport: true,
    gcpSupport: true,
    multiSpectral: true,
    apiAccess: true,
    whiteLabel: true,
    tierLabel: "Enterprise",
  },
};

export function getTierLimits(tier: SubscriptionTier): TierLimits {
  return LIMITS[tier || "free"];
}

export function canCreateProject(tier: SubscriptionTier, currentMonthProjectCount: number): boolean {
  const limits = getTierLimits(tier);
  return currentMonthProjectCount < limits.projectsPerMonth;
}

export function getProjectsRemaining(tier: SubscriptionTier, currentMonthProjectCount: number): number {
  const limits = getTierLimits(tier);
  if (limits.projectsPerMonth === Infinity) return Infinity;
  return Math.max(0, limits.projectsPerMonth - currentMonthProjectCount);
}

export function canUseFeature(tier: SubscriptionTier, feature: keyof Omit<TierLimits, "projectsPerMonth" | "imagesPerProject" | "storageGB" | "tierLabel">): boolean {
  const limits = getTierLimits(tier);
  return limits[feature] as boolean;
}
