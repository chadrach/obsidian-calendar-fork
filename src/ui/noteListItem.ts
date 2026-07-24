import type { TFile } from "obsidian";

export interface INoteListItem {
  file: TFile;
  // Short badge text: the association reason, or the creation year
  badge: string;
}
