import moment from "moment";
import { TFile } from "obsidian";
import { getDateUID } from "obsidian-daily-notes-interface";
import { get } from "svelte/store";

import {
  createdOnThisDayIndex,
  getNotesCreatedOnThisDay,
} from "./createdOnThisDay";
import { dailyNotes } from "./stores";

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
  const sameDayLastYear = createFile(
    "journal/Reflections.md",
    moment("2025-07-09T14:00:00").valueOf()
  );
  const sameDayTwoYearsAgo = createFile(
    "projects/Kickoff.md",
    moment("2024-07-09T08:00:00").valueOf()
  );
  const otherDailyNoteSameMonthDay = createFile(
    "daily/2023-07-09.md",
    moment("2023-07-09T09:00:00").valueOf()
  );
  const unrelatedNote = createFile(
    "projects/Unrelated.md",
    moment("2026-03-01T09:00:00").valueOf()
  );

  beforeAll(() => {
    const files = [
      dailyNoteFile,
      sameDayLastYear,
      sameDayTwoYearsAgo,
      otherDailyNoteSameMonthDay,
      unrelatedNote,
    ];

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (<any>window).moment = moment;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (<any>window).app = {
      vault: {
        getMarkdownFiles: () => files,
      },
    };

    dailyNotes.set({
      [getDateUID(moment("2026-07-09"), "day")]: dailyNoteFile,
    });

    createdOnThisDayIndex.reindex();
  });

  it("finds notes created on the same month/day across years, newest first", () => {
    const notes = getNotesCreatedOnThisDay(
      get(createdOnThisDayIndex),
      moment("2026-07-09")
    );
    expect(notes.map((file) => file.path)).toEqual([
      sameDayLastYear.path,
      sameDayTwoYearsAgo.path,
      otherDailyNoteSameMonthDay.path,
    ]);
  });

  it("excludes the selected date's own daily note", () => {
    const notes = getNotesCreatedOnThisDay(
      get(createdOnThisDayIndex),
      moment("2026-07-09")
    );
    expect(
      notes.find((file) => file.path === dailyNoteFile.path)
    ).toBeUndefined();
  });

  it("includes past daily notes that share the month/day", () => {
    const notes = getNotesCreatedOnThisDay(
      get(createdOnThisDayIndex),
      moment("2026-07-09")
    );
    expect(
      notes.find((file) => file.path === otherDailyNoteSameMonthDay.path)
    ).toBeDefined();
  });

  it("does not match notes created on a different month/day", () => {
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
