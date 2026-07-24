import moment from "moment";
import { TFile } from "obsidian";
import { get } from "svelte/store";

import {
  createdOnThisDayIndex,
  getNotesCreatedOnThisDay,
} from "./createdOnThisDay";

function createFile(path: string, ctime: number): TFile {
  const file = new TFile();
  const basename = path.split("/").pop().replace(/\.md$/, "");
  return Object.assign(file, {
    path,
    basename,
    stat: { ctime, mtime: ctime, size: 0 },
  });
}

describe("createdOnThisDayIndex", () => {
  const dailyNoteFile = createFile(
    "daily/2026-07-09.md",
    moment("2026-07-09T09:00:00").valueOf()
  );
  const otherDailyNoteSameDate = createFile(
    "old-daily/2026-07-09.md",
    moment("2026-07-09T09:00:00").valueOf()
  );
  const morningNote = createFile(
    "journal/Morning Pages.md",
    moment("2026-07-09T07:00:00").valueOf()
  );
  const eveningNote = createFile(
    "projects/Kickoff.md",
    moment("2026-07-09T20:00:00").valueOf()
  );
  const sameMonthDayLastYear = createFile(
    "journal/Reflections.md",
    moment("2025-07-09T14:00:00").valueOf()
  );
  const unrelatedNote = createFile(
    "projects/Unrelated.md",
    moment("2026-03-01T09:00:00").valueOf()
  );

  beforeAll(() => {
    const files = [
      dailyNoteFile,
      otherDailyNoteSameDate,
      morningNote,
      eveningNote,
      sameMonthDayLastYear,
      unrelatedNote,
    ];

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (<any>window).moment = moment;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (<any>window).app = {
      vault: {
        getMarkdownFiles: () => files,
      },
      internalPlugins: {
        getPluginById: () => ({
          instance: {
            options: { format: "YYYY-MM-DD", template: "", folder: "" },
          },
        }),
      },
      plugins: {
        getPlugin: (): null => null,
      },
    };

    createdOnThisDayIndex.reindex();
  });

  it("finds notes created on the exact selected date, newest first", () => {
    const notes = getNotesCreatedOnThisDay(
      get(createdOnThisDayIndex),
      moment("2026-07-09")
    );
    expect(notes.map((file) => file.path)).toEqual([
      eveningNote.path,
      morningNote.path,
    ]);
  });

  it("excludes daily notes, including ones outside the daily notes folder", () => {
    const notes = getNotesCreatedOnThisDay(
      get(createdOnThisDayIndex),
      moment("2026-07-09")
    );
    expect(
      notes.find((file) => file.path === dailyNoteFile.path)
    ).toBeUndefined();
    expect(
      notes.find((file) => file.path === otherDailyNoteSameDate.path)
    ).toBeUndefined();
  });

  it("does not match the same month/day from a different year", () => {
    const notes = getNotesCreatedOnThisDay(
      get(createdOnThisDayIndex),
      moment("2026-07-09")
    );
    expect(
      notes.find((file) => file.path === sameMonthDayLastYear.path)
    ).toBeUndefined();

    const lastYear = getNotesCreatedOnThisDay(
      get(createdOnThisDayIndex),
      moment("2025-07-09")
    );
    expect(lastYear.map((file) => file.path)).toEqual([
      sameMonthDayLastYear.path,
    ]);
  });

  it("does not match a different date", () => {
    const notes = getNotesCreatedOnThisDay(
      get(createdOnThisDayIndex),
      moment("2026-12-25")
    );
    expect(notes).toEqual([]);
  });

  it("returns an empty array for a null date", () => {
    expect(getNotesCreatedOnThisDay(get(createdOnThisDayIndex), null)).toEqual(
      []
    );
  });
});
