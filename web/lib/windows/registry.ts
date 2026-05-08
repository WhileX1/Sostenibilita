import dynamic from "next/dynamic";
import type { ComponentType } from "react";
import {
  EnvironmentalFolder,
  GovernanceFolder,
  SocialFolder,
} from "@/components/pages/folder/folders";

// A "section" groups windows in the Start menu submenus. Names match the
// URL prefix so the section can be derived from the route if needed; we
// still keep it explicit on each definition for clarity.
export type WindowArea = "Environmental" | "Social" | "Governance" | "Objective";

// `page` (default) → a real content window with formulas, inputs, scoring.
// `folder` → a navigational shell on the desktop and Start menu that
//   groups the scored metrics of one area. Folders carry no metric data,
//   no ESRS mapping, no score; their `Component` just renders a grid of
//   inner icons that open the underlying metric pages. Only the three
//   E/S/G areas have a folder — the Objective area has no folder because
//   its three entries are outputs, not metrics, and live loose on the
//   desktop next to the folders.
export type WindowKind = "page" | "folder";

export interface WindowDefinition {
  // Stable id — used as Redux key, deep-link mapping, registry lookup, and
  // (with `iconPath`) the SVG file path. Equal to `route.slice(1)` to avoid
  // divergence.
  id: string;
  title: string;
  route: string;
  area: WindowArea;
  // Defaults to "page" when omitted.
  kind?: WindowKind;
  // Marks an entry as a measurable ESG metric that contributes to the
  // overall score. The 15 E/S/G windows are flagged; the 3 Objective
  // windows (Reporting CSRD, Rating ESG, Strategy) are *outputs* /
  // configuration of the system itself and intentionally unflagged.
  // `web/lib/scoring/config.ts` filters by this flag instead of by area,
  // so a future Objective entry could be opted into scoring without
  // reshuffling the area grouping.
  scored?: boolean;
  // ESRS topical anchor for scored metrics. Read by the Reporting CSRD
  // window to tag each section with its standards reference, and to
  // derive the "Topics not assessed" disclosure from any metric the
  // user has flagged `isMaterial: false` in the metric editor. Optional
  // — non-scored windows (Strategy / Rating ESG / Reporting CSRD) and
  // any future scored metric without a clear ESRS mapping can omit it.
  esrs?: { code: string; topic: string };
  // Lazy-loaded content. `next/dynamic` defers fetching the chunk until the
  // window actually mounts, so unopened pages cost nothing on initial load.
  Component: ComponentType;
}

// Order of entries here drives default desktop icon order and Start-menu
// section item order. Keep grouped by area, matching the previous sidebar.
//
// Folders come first per area so `DESKTOP_ITEMS` (folders + Objective)
// stays in display order without an extra sort: Environmental folder,
// Social folder, Governance folder, then the three Objective entries.
export const WINDOW_REGISTRY: Record<string, WindowDefinition> = {
  "folder/environmental": {
    id: "folder/environmental",
    title: "Environmental",
    route: "/folder/environmental",
    area: "Environmental",
    kind: "folder",
    Component: EnvironmentalFolder,
  },
  "environmental/energy-consumption": {
    id: "environmental/energy-consumption",
    title: "Energy Consumption",
    route: "/environmental/energy-consumption",
    area: "Environmental",
    scored: true,
    esrs: { code: "ESRS E1", topic: "Climate change — energy consumption" },
    Component: dynamic(
      () => import("@/components/pages/environmental/EnergyConsumption"),
    ),
  },
  "environmental/co2-emissions": {
    id: "environmental/co2-emissions",
    title: "CO₂ Emissions",
    route: "/environmental/co2-emissions",
    area: "Environmental",
    scored: true,
    esrs: { code: "ESRS E1", topic: "Climate change — GHG emissions" },
    Component: dynamic(
      () => import("@/components/pages/environmental/Co2Emissions"),
    ),
  },
  "environmental/pollution": {
    id: "environmental/pollution",
    title: "Pollution",
    route: "/environmental/pollution",
    area: "Environmental",
    scored: true,
    esrs: { code: "ESRS E2", topic: "Pollution of air, water and soil" },
    Component: dynamic(
      () => import("@/components/pages/environmental/Pollution"),
    ),
  },
  "environmental/water-usage": {
    id: "environmental/water-usage",
    title: "Water Usage",
    route: "/environmental/water-usage",
    area: "Environmental",
    scored: true,
    esrs: { code: "ESRS E3", topic: "Water and marine resources" },
    Component: dynamic(
      () => import("@/components/pages/environmental/WaterUsage"),
    ),
  },
  "environmental/biodiversity": {
    id: "environmental/biodiversity",
    title: "Biodiversity",
    route: "/environmental/biodiversity",
    area: "Environmental",
    scored: true,
    esrs: { code: "ESRS E4", topic: "Biodiversity and ecosystems" },
    Component: dynamic(
      () => import("@/components/pages/environmental/Biodiversity"),
    ),
  },
  "environmental/waste-management": {
    id: "environmental/waste-management",
    title: "Waste Management",
    route: "/environmental/waste-management",
    area: "Environmental",
    scored: true,
    esrs: { code: "ESRS E5", topic: "Resource use and circular economy" },
    Component: dynamic(
      () => import("@/components/pages/environmental/WasteManagement"),
    ),
  },
  "folder/social": {
    id: "folder/social",
    title: "Social",
    route: "/folder/social",
    area: "Social",
    kind: "folder",
    Component: SocialFolder,
  },
  "social/human-resources": {
    id: "social/human-resources",
    title: "Human Resources",
    route: "/social/human-resources",
    area: "Social",
    scored: true,
    esrs: { code: "ESRS S1", topic: "Own workforce — employment & training" },
    Component: dynamic(
      () => import("@/components/pages/social/HumanResources"),
    ),
  },
  "social/inclusivity": {
    id: "social/inclusivity",
    title: "Inclusivity",
    route: "/social/inclusivity",
    area: "Social",
    scored: true,
    esrs: { code: "ESRS S1", topic: "Own workforce — diversity & inclusion" },
    Component: dynamic(
      () => import("@/components/pages/social/Inclusivity"),
    ),
  },
  "social/health-and-safety": {
    id: "social/health-and-safety",
    title: "Health and Safety",
    route: "/social/health-and-safety",
    area: "Social",
    scored: true,
    esrs: {
      code: "ESRS S1",
      topic: "Own workforce — occupational health & safety",
    },
    Component: dynamic(
      () => import("@/components/pages/social/HealthAndSafety"),
    ),
  },
  "social/value-chain-workers": {
    id: "social/value-chain-workers",
    title: "Value Chain Workers",
    route: "/social/value-chain-workers",
    area: "Social",
    scored: true,
    esrs: { code: "ESRS S2", topic: "Workers in the value chain" },
    Component: dynamic(
      () => import("@/components/pages/social/ValueChainWorkers"),
    ),
  },
  "social/affected-communities": {
    id: "social/affected-communities",
    title: "Affected Communities",
    route: "/social/affected-communities",
    area: "Social",
    scored: true,
    esrs: { code: "ESRS S3", topic: "Affected communities" },
    Component: dynamic(
      () => import("@/components/pages/social/AffectedCommunities"),
    ),
  },
  "social/consumers-end-users": {
    id: "social/consumers-end-users",
    title: "Consumers and End-Users",
    route: "/social/consumers-end-users",
    area: "Social",
    scored: true,
    esrs: { code: "ESRS S4", topic: "Consumers and end-users" },
    Component: dynamic(
      () => import("@/components/pages/social/ConsumersEndUsers"),
    ),
  },
  "folder/governance": {
    id: "folder/governance",
    title: "Governance",
    route: "/folder/governance",
    area: "Governance",
    kind: "folder",
    Component: GovernanceFolder,
  },
  "governance/cda": {
    id: "governance/cda",
    title: "CDA",
    route: "/governance/cda",
    area: "Governance",
    scored: true,
    esrs: { code: "ESRS 2 GOV-1", topic: "Governance — board composition" },
    Component: dynamic(() => import("@/components/pages/governance/Cda")),
  },
  "governance/ethics-and-compliance": {
    id: "governance/ethics-and-compliance",
    title: "Ethics and Compliance",
    route: "/governance/ethics-and-compliance",
    area: "Governance",
    scored: true,
    esrs: {
      code: "ESRS G1",
      topic: "Business conduct — ethics & anti-corruption",
    },
    Component: dynamic(
      () => import("@/components/pages/governance/EthicsAndCompliance"),
    ),
  },
  "governance/supply-chain": {
    id: "governance/supply-chain",
    title: "Supply Chain",
    route: "/governance/supply-chain",
    area: "Governance",
    scored: true,
    esrs: {
      code: "ESRS G1-2",
      topic: "Business conduct — supplier relationships",
    },
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

// What renders directly on the desktop wallpaper. The 15 scored metrics
// are tucked inside their per-area folder, so the desktop only shows
// 6 icons: 3 folders (E/S/G) + 3 Objective outputs (Reporting CSRD,
// Rating ESG, Strategy). The metric windows are still in the registry
// and addressable by route — they just don't have a wallpaper icon. To
// open one, the user double-clicks the area folder and then the metric
// inside it (or uses the Start menu).
export const DESKTOP_ITEMS: WindowDefinition[] = WINDOW_DEFINITIONS.filter(
  (w) => w.kind === "folder" || w.area === "Objective",
);

// Convenience grouping for Start-menu rendering.
export const AREAS: WindowArea[] = [
  "Environmental",
  "Social",
  "Governance",
  "Objective",
];

// Every registered window in an area, including the area's folder shell
// when one exists. Kept around for callers that want the *complete* list
// — not used by the Start menu (which wants pages only) or the folder
// view (which wants scored metrics only). Use `pagesByArea` or
// `folderChildren` instead when those are the real intent.
export function windowsByArea(area: WindowArea): WindowDefinition[] {
  return WINDOW_DEFINITIONS.filter((w) => w.area === area);
}

// Real content windows in an area — folders excluded. Used by the Start
// menu: each E/S/G submenu lists the area's scored metrics, and the
// Objective rows render flat (a folder grouping for three output windows
// would be more friction than navigation).
export function pagesByArea(area: WindowArea): WindowDefinition[] {
  return WINDOW_DEFINITIONS.filter(
    (w) => w.area === area && w.kind !== "folder",
  );
}

// The scored metrics that live inside an area's folder window. Only
// defined for the three areas with folders (E/S/G); calling it with
// "Objective" returns an empty list.
export function folderChildren(area: WindowArea): WindowDefinition[] {
  return WINDOW_DEFINITIONS.filter(
    (w) => w.area === area && w.scored === true,
  );
}

// Every folder shell, in registry order. Used by the folder window's
// left "quick access" panel — the panel lists the desktop plus all
// three folders so the user can pivot between any of them without
// going back to the wallpaper. The caller decides how to mark the
// current folder.
export function allFolders(): WindowDefinition[] {
  return WINDOW_DEFINITIONS.filter((w) => w.kind === "folder");
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
// Folder ids (`folder/environmental` etc.) naturally land at
// `/icons/folder/<area>.svg` — the folder-shaped icons with the area
// badge embedded — without needing a special case here.
export function iconPath(def: WindowDefinition): string {
  return `/icons/${def.id}.svg`;
}

// Resolves the SVG icon for an area (the four ESG groupings). Files live
// at `web/public/icons/areas/<area>.svg`. Kept separate from `iconPath` so
// area-level rows in the Start menu render a distinct symbol from any of
// their child windows.
export function areaIconPath(area: WindowArea): string {
  return `/icons/areas/${area.toLowerCase()}.svg`;
}
