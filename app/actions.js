"use server";

import { revalidatePath } from "next/cache";
import { setSettings, updateJobFlag } from "@/lib/db.js";

export async function saveSettings(formData) {
  setSettings({
    searchKeywords: String(formData.get("searchKeywords") || ""),
    excludeKeywords: String(formData.get("excludeKeywords") || ""),
    searchResultCount: String(formData.get("searchResultCount") || "10"),
    fetchDetails: formData.get("fetchDetails") ? "true" : "false",
    minNotifyScore: String(formData.get("minNotifyScore") || "20")
  });
  revalidatePath("/");
}

export async function setFavorite(formData) {
  const sourceId = String(formData.get("sourceId") || "");
  const enabled = String(formData.get("enabled") || "") === "true";
  if (sourceId) updateJobFlag(sourceId, "favorite", enabled);
  revalidatePath("/");
}

export async function setHidden(formData) {
  const sourceId = String(formData.get("sourceId") || "");
  const enabled = String(formData.get("enabled") || "") === "true";
  if (sourceId) updateJobFlag(sourceId, "hidden", enabled);
  revalidatePath("/");
}
