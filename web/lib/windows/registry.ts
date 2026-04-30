import dynamic from "next/dynamic";
import type { ComponentType } from "react";

// A "section" groups windows in the Start menu submenus. Names match the
// URL prefix so the section can be derived from the route if needed; we
// still keep it explicit on each definition for clarity.
export type WindowArea = "Environmental" | "Social" | "Governance" | "Objective";

export interface WindowDefinition {
  // Stable id — used as Redux key, deep-link mapping, registry lookup, and
  // (with `iconPath`) the SVG file path. Equal to `route.slice(1)` to avoid
  // divergence.
  id: string;
  title: string;
  route: string;
  area: WindowArea;
  // Lazy-loaded content. `next/dynamic` defers fetching the chunk until the
  // window actually mounts, so unopened pages cost nothing on initial load.
  Component: ComponentType;
}

// Order of entries here drives default desktop icon order and Start-menu
// section item order. Keep grouped by area, matching the previous sidebar.
export const WINDOW_REGISTRY: Record<string, WindowDefinition> = {
  "environmental/energy-consumption": {
    id: "environmental/energy-consumption",
    title: "Energy Consumption",
    route: "/environmental/energy-consumption",
    area: "Environmental",
    Component: dynamic(
      () => import("@/components/pages/environmental/EnergyConsumption"),
    ),
  },
  "environmental/co2-emissions": {
    id: "environmental/co2-emissions",
    title: "CO₂ Emissions",
    route: "/environmental/co2-emissions",
    area: "Environmental",
    Component: dynamic(
      () => import("@/components/pages/environmental/Co2Emissions"),
    ),
  },
  "environmental/water-usage": {
    id: "environmental/water-usage",
    title: "Water Usage",
    route: "/environmental/water-usage",
    area: "Environmental",
    Component: dynamic(
      () => import("@/components/pages/environmental/WaterUsage"),
    ),
  },
  "environmental/waste-management": {
    id: "environmental/waste-management",
    title: "Waste Management",
    route: "/environmental/waste-management",
    area: "Environmental",
    Component: dynamic(
      () => import("@/components/pages/environmental/WasteManagement"),
    ),
  },
  "social/human-resources": {
    id: "social/human-resources",
    title: "Human Resources",
    route: "/social/human-resources",
    area: "Social",
    Component: dynamic(
      () => import("@/components/pages/social/HumanResources"),
    ),
  },
  "social/inclusivity": {
    id: "social/inclusivity",
    title: "Inclusivity",
    route: "/social/inclusivity",
    area: "Social",
    Component: dynamic(
      () => import("@/components/pages/social/Inclusivity"),
    ),
  },
  "social/health-and-safety": {
    id: "social/health-and-safety",
    title: "Health and Safety",
    route: "/social/health-and-safety",
    area: "Social",
    Component: dynamic(
      () => import("@/components/pages/social/HealthAndSafety"),
    ),
  },
  "governance/cda": {
    id: "governance/cda",
    title: "CDA",
    route: "/governance/cda",
    area: "Governance",
    Component: dynamic(() => import("@/components/pages/governance/Cda")),
  },
  "governance/ethics-and-compliance": {
    id: "governance/ethics-and-compliance",
    title: "Ethics and Compliance",
    route: "/governance/ethics-and-compliance",
    area: "Governance",
    Component: dynamic(
      () => import("@/components/pages/governance/EthicsAndCompliance"),
    ),
  },
  "governance/supply-chain": {
    id: "governance/supply-chain",
    title: "Supply Chain",
    route: "/governance/supply-chain",
    area: "Governance",
    Component: dynamic(
      () => import("@/components/pages/governance/SupplyChain"),
    ),
  },
  "objective/reporting-csrd": {
    id: "objective/reporting-csrd",
    title: "Reporting CSRD",
    route: "/objective/reporting-csrd",
    area: "Objective",
    Component: dynamic(
      () => import("@/components/pages/objective/ReportingCsrd"),
    ),
  },
  "objective/rating-esg": {
    id: "objective/rating-esg",
    title: "Rating ESG",
    route: "/objective/rating-esg",
    area: "Objective",
    Component: dynamic(
      () => import("@/components/pages/objective/RatingEsg"),
    ),
  },
  "objective/strategy": {
    id: "objective/strategy",
    title: "Strategy",
    route: "/objective/strategy",
    area: "Objective",
    Component: dynamic(() => import("@/components/pages/objective/Strategy")),
  },
};

export const WINDOW_DEFINITIONS: WindowDefinition[] =
  Object.values(WINDOW_REGISTRY);

// Convenience grouping for Start-menu rendering.
export const AREAS: WindowArea[] = [
  "Environmental",
  "Social",
  "Governance",
  "Objective",
];

export function windowsByArea(area: WindowArea): WindowDefinition[] {
  return WINDOW_DEFINITIONS.filter((w) => w.area === area);
}

export function getWindow(id: string): WindowDefinition | undefined {
  return WINDOW_REGISTRY[id];
}

export function findWindowByRoute(route: string): WindowDefinition | undefined {
  return WINDOW_DEFINITIONS.find((w) => w.route === route);
}

// Resolves the SVG icon for a window. Files live at
// `web/public/icons/<id>.svg`; the path scheme mirrors the registry id so
// adding a new entry only requires dropping a matching SVG into place.
export function iconPath(def: WindowDefinition): string {
  return `/icons/${def.id}.svg`;
}
