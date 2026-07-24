import type { Moment } from "moment";
import type { TFile } from "obsidian";
import { getDailyNote } from "obsidian-daily-notes-interface";
import { get, writable } from "svelte/store";

import { dailyNotes } from "./stores";

export interface ICreatedOnThisDayIndex {
  // key: "MM-DD"
  byMonthDay: Record<string, TFile[]>;
}

function buildIndex(): ICreatedOnThisDayIndex {
  const index: ICreatedOnThisDayIndex = { byMonthDay: {} };

  for (const file of window.app.vault.getMarkdownFiles()) {
    const key = window.moment(file.stat.ctime).format("MM-DD");
    (index.byMonthDay[key] = index.byMonthDay[key] || []).push(file);
  }

  return index;
}

function createCreatedOnThisDayStore() {
  const store = writable<ICreatedOnThisDayIndex>({ byMonthDay: {} });
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

  const files = index.byMonthDay[date.format("MM-DD")] || [];

  // The selected date's own daily note is already the note being viewed,
  // so exclude it from its own "created on this day" list. Daily notes
  // from other years that share the same month/day are still included.
  const ownDailyNote = getDailyNote(date, get(dailyNotes));

  return files
    .filter((file) => file.path !== ownDailyNote?.path)
    .sort((a, b) => b.stat.ctime - a.stat.ctime);
}
