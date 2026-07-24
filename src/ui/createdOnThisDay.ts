import type { Moment } from "moment";
import type { TFile } from "obsidian";
import { getDateFromFile } from "obsidian-daily-notes-interface";
import { writable } from "svelte/store";

export interface ICreatedOnThisDayIndex {
  // key: "YYYY-MM-DD"
  byDate: Record<string, TFile[]>;
}

function buildIndex(): ICreatedOnThisDayIndex {
  const index: ICreatedOnThisDayIndex = { byDate: {} };

  for (const file of window.app.vault.getMarkdownFiles()) {
    const key = window.moment(file.stat.ctime).format("YYYY-MM-DD");
    (index.byDate[key] = index.byDate[key] || []).push(file);
  }

  return index;
}

function createCreatedOnThisDayStore() {
  const store = writable<ICreatedOnThisDayIndex>({ byDate: {} });
  return {
    reindex: () => {
      try {
        store.set(buildIndex());
      } catch (err) {
        console.error("[Calendar] Failed to index note creation dates", err);
      }
    },
    ...store,
  };
}

export const createdOnThisDayIndex = createCreatedOnThisDayStore();

export function getNotesCreatedOnThisDay(
  index: ICreatedOnThisDayIndex,
  date: Moment | null
): TFile[] {
  if (!date) {
    return [];
  }

  const files = index.byDate[date.format("YYYY-MM-DD")] || [];

  // Daily notes are trivially "created on this day" for their own date --
  // exclude them all so this section only surfaces other notes.
  return files
    .filter((file) => !getDateFromFile(file, "day"))
    .sort((a, b) => b.stat.ctime - a.stat.ctime);
}
