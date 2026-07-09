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
    if (!get(settings).showAssociatedDots) {
      return { dots: [] };
    }

    const notes = getAssociatedNotes(get(associatedNotesIndex), date);
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
