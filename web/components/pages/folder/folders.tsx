"use client";

import { FolderView } from "./FolderView";

// Three thin wrappers that bind `FolderView` to a fixed area, so each
// `WindowDefinition.Component` matches the registry's `ComponentType`
// signature (no props). Imported statically by the registry — folders
// are tiny, lazy-loading them via `next/dynamic` would buy nothing.
export function EnvironmentalFolder() {
  return <FolderView area="Environmental" />;
}

export function SocialFolder() {
  return <FolderView area="Social" />;
}

export function GovernanceFolder() {
  return <FolderView area="Governance" />;
}
