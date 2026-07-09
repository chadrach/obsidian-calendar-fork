import type { Moment } from "moment";
import { TFile } from "obsidian";
import {
  getDailyNote,
  getDailyNoteSettings,
  getDateUID,
} from "obsidian-daily-notes-interface";
import { get, writable } from "svelte/store";

import { dailyNotes, settings } from "./stores";

export type AssociationReason = "property" | "range" | "link";

export interface IAssociatedNote {
  file: TFile;
  reason: AssociationReason;
  // Which property (or link) produced the association, for display purposes
  detail: string;
}

interface IDateRangeAssociation {
  file: TFile;
  start: Moment;
  end: Moment;
  detail: string;
}

export interface IAssociatedNotesIndex {
  byDateUID: Record<string, IAssociatedNote[]>;
  ranges: IDateRangeAssociation[];
}

const DATE_FORMATS = [
  "YYYY-MM-DD",
  "YYYY-MM-DDTHH:mm",
  "YYYY-MM-DDTHH:mm:ss",
  "YYYY-MM-DDTHH:mm:ssZ",
  "YYYY-M-D",
  "MM/DD/YYYY",
];

export function parseFrontmatterDate(value: unknown): Moment | null {
  if (value === null || value === undefined) {
    return null;
  }
  const valueAsString = String(value).trim();
  if (!valueAsString) {
    return null;
  }

  const { moment } = window;
  const { format } = getDailyNoteSettings();

  let date = moment(valueAsString, [...DATE_FORMATS, format], true);
  if (!date.isValid()) {
    // Fall back to moment's tolerant parsing (handles full ISO timestamps)
    date = moment(valueAsString);
  }
  return date.isValid() ? date : null;
}

function getPropertyValues(
  frontmatter: Record<string, unknown>,
  propertyName: string
): unknown[] {
  const normalizedName = propertyName.toLowerCase();
  for (const [key, value] of Object.entries(frontmatter)) {
    if (key.toLowerCase() === normalizedName) {
      return Array.isArray(value) ? value : [value];
    }
  }
  return [];
}

function addAssociation(
  index: IAssociatedNotesIndex,
  dateUID: string,
  note: IAssociatedNote
): void {
  const notes = (index.byDateUID[dateUID] = index.byDateUID[dateUID] || []);
  if (!notes.some((existing) => existing.file.path === note.file.path)) {
    notes.push(note);
  }
}

function buildIndex(): IAssociatedNotesIndex {
  const index: IAssociatedNotesIndex = { byDateUID: {}, ranges: [] };
  const { metadataCache, vault } = window.app;
  const options = get(settings);

  const dateProperties = (options.associatedDateProperties || "")
    .split(",")
    .map((prop) => prop.trim())
    .filter(Boolean);
  const startProperty = (options.associatedStartProperty || "").trim();
  const endProperty = (options.associatedEndProperty || "").trim();

  // (a) and (b): frontmatter date and date-range properties
  for (const file of vault.getMarkdownFiles()) {
    const frontmatter = metadataCache.getFileCache(file)?.frontmatter;
    if (!frontmatter) {
      continue;
    }

    for (const property of dateProperties) {
      for (const value of getPropertyValues(frontmatter, property)) {
        const date = parseFrontmatterDate(value);
        if (date) {
          addAssociation(index, getDateUID(date, "day"), {
            file,
            reason: "property",
            detail: property,
          });
        }
      }
    }

    if (startProperty && endProperty) {
      const start = parseFrontmatterDate(
        getPropertyValues(frontmatter, startProperty)[0]
      );
      const end = parseFrontmatterDate(
        getPropertyValues(frontmatter, endProperty)[0]
      );
      if (start && end) {
        index.ranges.push({
          file,
          start: start.isAfter(end) ? end : start,
          end: start.isAfter(end) ? start : end,
          detail: `${startProperty}/${endProperty}`,
        });
      }
    }
  }

  // (c): wikilinks pointing at daily notes
  if (options.associatedIncludeLinks) {
    const dailyNoteUIDsByPath: Record<string, string> = {};
    for (const [dateUID, file] of Object.entries(get(dailyNotes) || {})) {
      dailyNoteUIDsByPath[file.path] = dateUID;
    }

    for (const [sourcePath, links] of Object.entries(
      metadataCache.resolvedLinks
    )) {
      // Skip daily notes linking to other daily notes (e.g. prev/next links)
      if (dailyNoteUIDsByPath[sourcePath]) {
        continue;
      }
      for (const targetPath of Object.keys(links)) {
        const dateUID = dailyNoteUIDsByPath[targetPath];
        if (!dateUID) {
          continue;
        }
        const sourceFile = vault.getAbstractFileByPath(sourcePath);
        if (sourceFile instanceof TFile) {
          addAssociation(index, dateUID, {
            file: sourceFile,
            reason: "link",
            detail: "link",
          });
        }
      }
    }

    // Also match links to daily notes that don't exist yet
    const { format } = getDailyNoteSettings();
    for (const [sourcePath, links] of Object.entries(
      metadataCache.unresolvedLinks
    )) {
      if (dailyNoteUIDsByPath[sourcePath]) {
        continue;
      }
      for (const linkText of Object.keys(links)) {
        const date = window.moment(linkText, format, true);
        if (!date.isValid()) {
          continue;
        }
        const sourceFile = vault.getAbstractFileByPath(sourcePath);
        if (sourceFile instanceof TFile) {
          addAssociation(index, getDateUID(date, "day"), {
            file: sourceFile,
            reason: "link",
            detail: "link",
          });
        }
      }
    }
  }

  return index;
}

function createAssociatedNotesStore() {
  const store = writable<IAssociatedNotesIndex>({ byDateUID: {}, ranges: [] });
  return {
    reindex: () => {
      try {
        store.set(buildIndex());
      } catch (err) {
        console.error("[Calendar] Failed to index associated notes", err);
      }
    },
    ...store,
  };
}

export const associatedNotesIndex = createAssociatedNotesStore();

export function getAssociatedNotes(
  index: IAssociatedNotesIndex,
  date: Moment | null
): IAssociatedNote[] {
  if (!date) {
    return [];
  }

  const notes = [...(index.byDateUID[getDateUID(date, "day")] || [])];
  for (const range of index.ranges) {
    if (date.isBetween(range.start, range.end, "day", "[]")) {
      notes.push({ file: range.file, reason: "range", detail: range.detail });
    }
  }

  // The daily note for this date is already represented by the calendar
  // itself, so exclude it from its own association list.
  const ownDailyNote = getDailyNote(date, get(dailyNotes));

  const seen: Record<string, boolean> = {};
  return notes
    .filter((note) => {
      if (seen[note.file.path] || note.file.path === ownDailyNote?.path) {
        return false;
      }
      seen[note.file.path] = true;
      return true;
    })
    .sort((a, b) => b.file.stat.mtime - a.file.stat.mtime);
}
