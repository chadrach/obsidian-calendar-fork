import moment from "moment";
import { TFile } from "obsidian";
import { getDateUID } from "obsidian-daily-notes-interface";
import { get } from "svelte/store";

import { defaultSettings } from "src/settings";

import {
  associatedNotesIndex,
  getAssociatedNotes,
  parseFrontmatterDate,
} from "./associatedNotes";
import { dailyNotes, settings } from "./stores";

function createFile(path: string, mtime = 0): TFile {
  const file = new TFile();
  const basename = path.split("/").pop().replace(/\.md$/, "");
  return Object.assign(file, {
    path,
    basename,
    stat: { ctime: 0, mtime, size: 0 },
  });
}

const pluginSettingsMock = {
  plugins: {
    getPlugin: (): null => null,
  },
  internalPlugins: {
    getPluginById: () => ({
      instance: {
        options: { format: "YYYY-MM-DD", template: "", folder: "" },
      },
    }),
  },
};

describe("parseFrontmatterDate", () => {
  beforeAll(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (<any>window).moment = moment;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (<any>window).app = { ...pluginSettingsMock };
  });

  it("parses ISO dates", () => {
    expect(parseFrontmatterDate("2026-07-09").format("YYYY-MM-DD")).toEqual(
      "2026-07-09"
    );
  });

  it("parses dates with times", () => {
    expect(
      parseFrontmatterDate("2026-07-09T14:30").format("YYYY-MM-DD")
    ).toEqual("2026-07-09");
  });

  it("returns null for non-dates", () => {
    expect(parseFrontmatterDate("not a date")).toBeNull();
    expect(parseFrontmatterDate(null)).toBeNull();
    expect(parseFrontmatterDate("")).toBeNull();
  });
});

describe("associatedNotesIndex", () => {
  const dailyNoteFile = createFile("daily/2026-07-09.md");
  const propertyNote = createFile("projects/Party Planning.md", 300);
  const rangeNote = createFile("trips/Summer Vacation.md", 200);
  const linkingNote = createFile("meetings/Standup.md", 100);
  const unresolvedLinkNote = createFile("meetings/Retro.md", 50);
  const unrelatedNote = createFile("projects/Unrelated.md", 400);
  const otherDailyNote = createFile("daily/2026-07-08.md");

  const frontmatterByPath: Record<string, Record<string, unknown>> = {
    [propertyNote.path]: { Date: "2026-07-09" },
    [rangeNote.path]: {
      "start-date": "2026-07-01",
      "end-date": "2026-07-15",
    },
    [unrelatedNote.path]: { Date: "2026-08-20" },
    [dailyNoteFile.path]: { date: "2026-07-09" },
  };

  beforeAll(() => {
    const files = [
      dailyNoteFile,
      propertyNote,
      rangeNote,
      linkingNote,
      unresolvedLinkNote,
      unrelatedNote,
      otherDailyNote,
    ];
    const filesByPath: Record<string, TFile> = {};
    files.forEach((file) => (filesByPath[file.path] = file));

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (<any>window).moment = moment;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (<any>window).app = {
      vault: {
        getMarkdownFiles: () => files,
        getAbstractFileByPath: (path: string) => filesByPath[path] || null,
      },
      metadataCache: {
        getFileCache: (file: TFile) => {
          const frontmatter = frontmatterByPath[file.path];
          return frontmatter ? { frontmatter } : null;
        },
        resolvedLinks: {
          [linkingNote.path]: { [dailyNoteFile.path]: 1 },
          // daily notes linking to daily notes should not count
          [otherDailyNote.path]: { [dailyNoteFile.path]: 1 },
        },
        unresolvedLinks: {
          [unresolvedLinkNote.path]: { "2026-07-10": 1 },
        },
      },
      ...pluginSettingsMock,
    };

    settings.set({
      ...defaultSettings,
      associatedDateProperties: "date",
      associatedStartProperty: "start-date",
      associatedEndProperty: "end-date",
    });
    dailyNotes.set({
      [getDateUID(moment("2026-07-09"), "day")]: dailyNoteFile,
      [getDateUID(moment("2026-07-08"), "day")]: otherDailyNote,
    });

    associatedNotesIndex.reindex();
  });

  it("finds notes by date property, range, and link", () => {
    const notes = getAssociatedNotes(
      get(associatedNotesIndex),
      moment("2026-07-09")
    );
    expect(notes.map((note) => note.file.path)).toEqual([
      propertyNote.path,
      rangeNote.path,
      linkingNote.path,
    ]);
    expect(notes.map((note) => note.reason)).toEqual([
      "property",
      "range",
      "link",
    ]);
  });

  it("matches date properties case-insensitively", () => {
    const notes = getAssociatedNotes(
      get(associatedNotesIndex),
      moment("2026-07-09")
    );
    const propertyMatch = notes.find(
      (note) => note.file.path === propertyNote.path
    );
    expect(propertyMatch.detail).toEqual("date");
  });

  it("excludes the daily note from its own associations", () => {
    const notes = getAssociatedNotes(
      get(associatedNotesIndex),
      moment("2026-07-09")
    );
    expect(
      notes.find((note) => note.file.path === dailyNoteFile.path)
    ).toBeUndefined();
  });

  it("matches every date within a range", () => {
    const midRange = getAssociatedNotes(
      get(associatedNotesIndex),
      moment("2026-07-03")
    );
    expect(midRange.map((note) => note.file.path)).toEqual([rangeNote.path]);

    const outsideRange = getAssociatedNotes(
      get(associatedNotesIndex),
      moment("2026-07-20")
    );
    expect(outsideRange).toEqual([]);
  });

  it("matches unresolved links to not-yet-created daily notes", () => {
    const notes = getAssociatedNotes(
      get(associatedNotesIndex),
      moment("2026-07-10")
    );
    // The vacation range (07-01 to 07-15) also covers this date
    expect(notes.map((note) => note.file.path)).toEqual([
      rangeNote.path,
      unresolvedLinkNote.path,
    ]);
    expect(notes[1].reason).toEqual("link");
  });

  it("does not associate notes with unrelated dates", () => {
    const notes = getAssociatedNotes(
      get(associatedNotesIndex),
      moment("2026-08-20")
    );
    expect(notes.map((note) => note.file.path)).toEqual([unrelatedNote.path]);
  });
});
