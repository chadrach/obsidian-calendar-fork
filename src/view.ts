import type { Moment } from "moment";
import {
  getDailyNote,
  getDailyNoteSettings,
  getDateFromFile,
  getWeeklyNote,
  getWeeklyNoteSettings,
} from "obsidian-daily-notes-interface";
import { FileView, TFile, ItemView, WorkspaceLeaf } from "obsidian";
import { get } from "svelte/store";

import { TRIGGER_ON_OPEN, VIEW_TYPE_CALENDAR } from "src/constants";
import { tryToCreateDailyNote } from "src/io/dailyNotes";
import { tryToCreateWeeklyNote } from "src/io/weeklyNotes";
import type { ISettings } from "src/settings";

import Calendar from "./ui/Calendar.svelte";
import AssociatedNotes from "./ui/AssociatedNotes.svelte";
import { associatedNotesIndex } from "./ui/associatedNotes";
import { showFileMenu } from "./ui/fileMenu";
import {
  activeFile,
  dailyNotes,
  weeklyNotes,
  selectedDate,
  settings,
} from "./ui/stores";
import {
  associatedNotesSource,
  customTagsSource,
  streakSource,
  tasksSource,
  wordCountSource,
} from "./ui/sources";

export default class CalendarView extends ItemView {
  private calendar: Calendar;
  private associatedNotesPane: AssociatedNotes;
  private settings: ISettings;
  private reindexTimer: number;

  constructor(leaf: WorkspaceLeaf) {
    super(leaf);

    this.openOrCreateDailyNote = this.openOrCreateDailyNote.bind(this);
    this.openOrCreateWeeklyNote = this.openOrCreateWeeklyNote.bind(this);

    this.onNoteSettingsUpdate = this.onNoteSettingsUpdate.bind(this);
    this.onFileCreated = this.onFileCreated.bind(this);
    this.onFileDeleted = this.onFileDeleted.bind(this);
    this.onFileModified = this.onFileModified.bind(this);
    this.onFileOpen = this.onFileOpen.bind(this);
    this.onMetadataResolved = this.onMetadataResolved.bind(this);

    this.onHoverDay = this.onHoverDay.bind(this);
    this.onHoverWeek = this.onHoverWeek.bind(this);
    this.onHoverAssociatedNote = this.onHoverAssociatedNote.bind(this);

    this.onContextMenuDay = this.onContextMenuDay.bind(this);
    this.onContextMenuWeek = this.onContextMenuWeek.bind(this);
    this.onContextMenuAssociatedNote = this.onContextMenuAssociatedNote.bind(
      this
    );
    this.openAssociatedNote = this.openAssociatedNote.bind(this);

    this.registerEvent(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (<any>this.app.workspace).on(
        "periodic-notes:settings-updated",
        this.onNoteSettingsUpdate
      )
    );
    this.registerEvent(this.app.vault.on("create", this.onFileCreated));
    this.registerEvent(this.app.vault.on("delete", this.onFileDeleted));
    this.registerEvent(this.app.vault.on("modify", this.onFileModified));
    this.registerEvent(this.app.workspace.on("file-open", this.onFileOpen));
    this.registerEvent(
      this.app.metadataCache.on("resolved", this.onMetadataResolved)
    );

    this.settings = null;
    settings.subscribe((val) => {
      const associationSettingsChanged =
        this.settings &&
        (this.settings.associatedDateProperties !==
          val.associatedDateProperties ||
          this.settings.associatedStartProperty !==
            val.associatedStartProperty ||
          this.settings.associatedEndProperty !== val.associatedEndProperty ||
          this.settings.associatedIncludeLinks !== val.associatedIncludeLinks);

      this.settings = val;
      this.applyAssociatedDotColor();

      if (associationSettingsChanged) {
        associatedNotesIndex.reindex();
      }

      // Refresh the calendar if settings change
      if (this.calendar) {
        this.calendar.tick();
      }
    });
  }

  private applyAssociatedDotColor(): void {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const contentEl = (this as any).contentEl as HTMLElement;
    if (!contentEl) {
      return;
    }
    const color = this.settings?.associatedDotColor?.trim();
    if (color) {
      contentEl.style.setProperty("--calendar-associated-dot-color", color);
    } else {
      // Falls back to the theme's --interactive-accent color (see styles.css)
      contentEl.style.removeProperty("--calendar-associated-dot-color");
    }
  }

  private onMetadataResolved(): void {
    // Debounce: `resolved` can fire in rapid succession while editing
    window.clearTimeout(this.reindexTimer);
    this.reindexTimer = window.setTimeout(() => {
      associatedNotesIndex.reindex();
      if (this.calendar) {
        this.calendar.tick();
      }
    }, 500);
  }

  getViewType(): string {
    return VIEW_TYPE_CALENDAR;
  }

  getDisplayText(): string {
    return "Calendar";
  }

  getIcon(): string {
    return "calendar-with-checkmark";
  }

  onClose(): Promise<void> {
    window.clearTimeout(this.reindexTimer);
    if (this.calendar) {
      this.calendar.$destroy();
    }
    if (this.associatedNotesPane) {
      this.associatedNotesPane.$destroy();
    }
    return Promise.resolve();
  }

  async onOpen(): Promise<void> {
    // Integration point: external plugins can listen for `calendar-fork:open`
    // to feed in additional sources.
    const sources = [
      customTagsSource,
      streakSource,
      wordCountSource,
      tasksSource,
      associatedNotesSource,
    ];
    this.app.workspace.trigger(TRIGGER_ON_OPEN, sources);

    dailyNotes.reindex();
    associatedNotesIndex.reindex();
    selectedDate.set(window.moment());
    this.applyAssociatedDotColor();

    this.calendar = new Calendar({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      target: (this as any).contentEl,
      props: {
        onClickDay: this.openOrCreateDailyNote,
        onClickWeek: this.openOrCreateWeeklyNote,
        onHoverDay: this.onHoverDay,
        onHoverWeek: this.onHoverWeek,
        onContextMenuDay: this.onContextMenuDay,
        onContextMenuWeek: this.onContextMenuWeek,
        sources,
      },
    });

    this.associatedNotesPane = new AssociatedNotes({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      target: (this as any).contentEl,
      props: {
        onClickNote: this.openAssociatedNote,
        onHoverNote: this.onHoverAssociatedNote,
        onContextMenuNote: this.onContextMenuAssociatedNote,
      },
    });
  }

  onHoverDay(
    date: Moment,
    targetEl: EventTarget,
    isMetaPressed: boolean
  ): void {
    if (!isMetaPressed) {
      return;
    }
    const { format } = getDailyNoteSettings();
    const note = getDailyNote(date, get(dailyNotes));
    this.app.workspace.trigger(
      "link-hover",
      this,
      targetEl,
      date.format(format),
      note?.path
    );
  }

  onHoverWeek(
    date: Moment,
    targetEl: EventTarget,
    isMetaPressed: boolean
  ): void {
    if (!isMetaPressed) {
      return;
    }
    const note = getWeeklyNote(date, get(weeklyNotes));
    const { format } = getWeeklyNoteSettings();
    this.app.workspace.trigger(
      "link-hover",
      this,
      targetEl,
      date.format(format),
      note?.path
    );
  }

  onHoverAssociatedNote(
    note: TFile,
    targetEl: EventTarget,
    isMetaPressed: boolean
  ): void {
    if (!isMetaPressed) {
      return;
    }
    this.app.workspace.trigger(
      "link-hover",
      this,
      targetEl,
      note.basename,
      note.path
    );
  }

  private onContextMenuAssociatedNote(note: TFile, event: MouseEvent): void {
    showFileMenu(this.app, note, {
      x: event.pageX,
      y: event.pageY,
    });
  }

  async openAssociatedNote(note: TFile, inNewSplit: boolean): Promise<void> {
    const { workspace } = this.app;
    const leaf = inNewSplit
      ? workspace.splitActiveLeaf()
      : workspace.getUnpinnedLeaf();
    await leaf.openFile(note, { active: true });
    workspace.setActiveLeaf(leaf, true, true);
  }

  private onContextMenuDay(date: Moment, event: MouseEvent): void {
    const note = getDailyNote(date, get(dailyNotes));
    if (!note) {
      // If no file exists for a given day, show nothing.
      return;
    }
    showFileMenu(this.app, note, {
      x: event.pageX,
      y: event.pageY,
    });
  }

  private onContextMenuWeek(date: Moment, event: MouseEvent): void {
    const note = getWeeklyNote(date, get(weeklyNotes));
    if (!note) {
      // If no file exists for a given day, show nothing.
      return;
    }
    showFileMenu(this.app, note, {
      x: event.pageX,
      y: event.pageY,
    });
  }

  private onNoteSettingsUpdate(): void {
    dailyNotes.reindex();
    weeklyNotes.reindex();
    this.updateActiveFile();
  }

  private async onFileDeleted(file: TFile): Promise<void> {
    if (getDateFromFile(file, "day")) {
      dailyNotes.reindex();
      this.updateActiveFile();
    }
    if (getDateFromFile(file, "week")) {
      weeklyNotes.reindex();
      this.updateActiveFile();
    }
  }

  private async onFileModified(file: TFile): Promise<void> {
    const date = getDateFromFile(file, "day") || getDateFromFile(file, "week");
    if (date && this.calendar) {
      this.calendar.tick();
    }
  }

  private onFileCreated(file: TFile): void {
    if (this.app.workspace.layoutReady && this.calendar) {
      if (getDateFromFile(file, "day")) {
        dailyNotes.reindex();
        this.calendar.tick();
      }
      if (getDateFromFile(file, "week")) {
        weeklyNotes.reindex();
        this.calendar.tick();
      }
    }
  }

  public onFileOpen(_file: TFile): void {
    if (this.app.workspace.layoutReady) {
      this.updateActiveFile();
    }
  }

  /**
   * Resolve the date represented by a file, checking daily-note format
   * first and falling back to the weekly-note format.
   */
  private getRevealDate(file: TFile): Moment | null {
    const { moment } = window;

    const dailyDate = getDateFromFile(file, "day");
    if (dailyDate) {
      return dailyDate;
    }

    const { format } = getWeeklyNoteSettings();
    const weeklyDate = moment(file.basename, format, true);
    return weeklyDate.isValid() ? weeklyDate : null;
  }

  private updateActiveFile(): void {
    const { view } = this.app.workspace.activeLeaf;

    let file: TFile | null = null;
    if (view instanceof FileView) {
      file = view.file;
    } else {
      // Recognize embedded editors (e.g. the Daily Notes Editor) that redirect
      // activation to a non-FileView parent leaf but keep workspace.activeEditor
      // pointed at the in-view note. This mirrors how Bases reads the active file.
      file = this.app.workspace.getActiveFile();
    }
    activeFile.setFile(file);

    if (file) {
      // Keep the associated notes pane in sync with the active daily note
      const dailyDate = getDateFromFile(file, "day");
      if (dailyDate) {
        selectedDate.set(dailyDate);
      }

      if (this.settings.autoRevealActiveNote && this.calendar) {
        const revealDate = dailyDate || this.getRevealDate(file);
        if (revealDate) {
          this.calendar.$set({ displayedMonth: revealDate });
        }
      }
    }

    if (this.calendar) {
      this.calendar.tick();
    }
  }

  public revealActiveNote(): void {
    const { activeLeaf } = this.app.workspace;

    if (activeLeaf.view instanceof FileView) {
      const date = this.getRevealDate(activeLeaf.view.file);
      if (date) {
        this.calendar.$set({ displayedMonth: date });
      }
    }
  }

  async openOrCreateWeeklyNote(
    date: Moment,
    inNewSplit: boolean
  ): Promise<void> {
    const { workspace } = this.app;

    const startOfWeek = date.clone().startOf("week");

    const existingFile = getWeeklyNote(date, get(weeklyNotes));

    if (!existingFile) {
      // File doesn't exist
      tryToCreateWeeklyNote(startOfWeek, inNewSplit, this.settings, (file) => {
        activeFile.setFile(file);
      });
      return;
    }

    const leaf = inNewSplit
      ? workspace.splitActiveLeaf()
      : workspace.getUnpinnedLeaf();
    await leaf.openFile(existingFile);

    activeFile.setFile(existingFile);
    workspace.setActiveLeaf(leaf, true, true)
  }

  async openOrCreateDailyNote(
    date: Moment,
    inNewSplit: boolean
  ): Promise<void> {
    const { workspace } = this.app;
    selectedDate.set(date);
    const existingFile = getDailyNote(date, get(dailyNotes));
    if (!existingFile) {
      // File doesn't exist
      tryToCreateDailyNote(
        date,
        inNewSplit,
        this.settings,
        (dailyNote: TFile) => {
          activeFile.setFile(dailyNote);
        }
      );
      return;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mode = (this.app.vault as any).getConfig("defaultViewMode");
    const leaf = inNewSplit
      ? workspace.splitActiveLeaf()
      : workspace.getUnpinnedLeaf();
    await leaf.openFile(existingFile, { active : true, mode });

    activeFile.setFile(existingFile);
  }
}
