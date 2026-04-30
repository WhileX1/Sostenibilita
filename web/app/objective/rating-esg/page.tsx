"use client";

import { useOpenWindowOnMount } from "@/lib/windows/useOpenWindowOnMount";

export default function Page() {
  useOpenWindowOnMount("objective/rating-esg");
  return null;
}
