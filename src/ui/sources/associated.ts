import type { Moment } from "moment";
import type { ICalendarSource, IDayMetadata } from "obsidian-calendar-ui";
import { get } from "svelte/store";

import {
  associatedNotesIndex,
  getAssociatedNotes,
} from "../associatedNotes";
import { settings } from "../stores";

export const associatedNotesSource: ICalendarSource = {
  getDailyMetadata: async (date: Moment): Promise<IDayMetadata> => {
    const options = get(settings);
    if (!options.showAssociatedDots) {
      return { dots: [] };
    }

    let notes = getAssociatedNotes(get(associatedNotesIndex), date);
    if (!options.showAssociatedDotsForRanges) {
      notes = notes.filter((note) => note.reason !== "range");
    }
    if (!notes.length) {
      return { dots: [] };
    }

    return {
      dots: [
        {
          className: "associated",
          color: "associated",
          isFilled: true,
        },
      ],
    };
  },

  getWeeklyMetadata: async (): Promise<IDayMetadata> => {
    return { dots: [] };
  },
};
