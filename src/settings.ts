import { App, PluginSettingTab, Setting } from "obsidian";
import { appHasDailyNotesPluginLoaded } from "obsidian-daily-notes-interface";
import type { ILocaleOverride, IWeekStartOption } from "obsidian-calendar-ui";

import {
  DEFAULT_ASSOCIATED_DOT_COLOR,
  DEFAULT_WEEK_FORMAT,
  DEFAULT_WORDS_PER_DOT,
} from "src/constants";

import type CalendarPlugin from "./main";

export type IAssociatedNoteStyle = "card" | "compact";

export interface ISettings {
  wordsPerDot: number;
  weekStart: IWeekStartOption;
  shouldConfirmBeforeCreate: boolean;

  // Calendar dot settings
  showTaskDots: boolean;
  showAssociatedDots: boolean;
  associatedDotColor: string;

  // Associated notes settings
  showAssociatedNotesPane: boolean;
  associatedDateProperties: string;
  associatedStartProperty: string;
  associatedEndProperty: string;
  associatedIncludeLinks: boolean;
  associatedNoteStyle: IAssociatedNoteStyle;
  showAssociatedNotePath: boolean;
  showAssociatedNotePreview: boolean;
  showAssociatedNoteReason: boolean;

  // Weekly Note settings
  showWeeklyNote: boolean;
  weeklyNoteFormat: string;
  weeklyNoteTemplate: string;
  weeklyNoteFolder: string;

  localeOverride: ILocaleOverride;
}

const weekdays = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
];

export const defaultSettings = Object.freeze({
  shouldConfirmBeforeCreate: true,
  weekStart: "locale" as IWeekStartOption,

  wordsPerDot: DEFAULT_WORDS_PER_DOT,

  showTaskDots: true,
  showAssociatedDots: true,
  associatedDotColor: DEFAULT_ASSOCIATED_DOT_COLOR,

  showAssociatedNotesPane: true,
  associatedDateProperties: "date",
  associatedStartProperty: "",
  associatedEndProperty: "",
  associatedIncludeLinks: true,
  associatedNoteStyle: "card" as IAssociatedNoteStyle,
  showAssociatedNotePath: true,
  showAssociatedNotePreview: true,
  showAssociatedNoteReason: true,

  showWeeklyNote: false,
  weeklyNoteFormat: "",
  weeklyNoteTemplate: "",
  weeklyNoteFolder: "",

  localeOverride: "system-default",
});

export function appHasPeriodicNotesPluginLoaded(): boolean {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const periodicNotes = (<any>window.app).plugins.getPlugin("periodic-notes");
  return periodicNotes && periodicNotes.settings?.weekly?.enabled;
}

export class CalendarSettingsTab extends PluginSettingTab {
  private plugin: CalendarPlugin;

  constructor(app: App, plugin: CalendarPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    this.containerEl.empty();

    if (!appHasDailyNotesPluginLoaded()) {
      this.containerEl.createDiv("settings-banner", (banner) => {
        banner.createEl("h3", {
          text: "⚠️ Daily Notes plugin not enabled",
        });
        banner.createEl("p", {
          cls: "setting-item-description",
          text:
            "The calendar is best used in conjunction with either the Daily Notes plugin or the Periodic Notes plugin (available in the Community Plugins catalog).",
        });
      });
    }

    this.containerEl.createEl("h3", {
      text: "General Settings",
    });
    this.addDotThresholdSetting();
    this.addWeekStartSetting();
    this.addConfirmCreateSetting();
    this.addShowWeeklyNoteSetting();

    this.containerEl.createEl("h3", {
      text: "Calendar Dots",
    });
    this.addShowTaskDotsSetting();
    this.addShowAssociatedDotsSetting();
    if (this.plugin.options.showAssociatedDots) {
      this.addAssociatedDotColorSetting();
    }

    this.containerEl.createEl("h3", {
      text: "Associated Notes",
    });
    this.containerEl.createEl("p", {
      cls: "setting-item-description",
      text:
        "Notes are considered 'associated' with a date if they have a matching date property in their frontmatter, if the date falls within a frontmatter date range, or if they contain a wikilink to that day's daily note.",
    });
    this.addAssociatedPaneSetting();
    this.addAssociatedDatePropertiesSetting();
    this.addAssociatedRangePropertiesSetting();
    this.addAssociatedIncludeLinksSetting();
    if (this.plugin.options.showAssociatedNotesPane) {
      this.addAssociatedNoteStyleSetting();
      this.addAssociatedNoteInfoSettings();
    }

    if (
      this.plugin.options.showWeeklyNote &&
      !appHasPeriodicNotesPluginLoaded()
    ) {
      this.containerEl.createEl("h3", {
        text: "Weekly Note Settings",
      });
      this.containerEl.createEl("p", {
        cls: "setting-item-description",
        text:
          "Note: Weekly Note settings are moving. You are encouraged to install the 'Periodic Notes' plugin to keep the functionality in the future.",
      });
      this.addWeeklyNoteFormatSetting();
      this.addWeeklyNoteTemplateSetting();
      this.addWeeklyNoteFolderSetting();
    }

    this.containerEl.createEl("h3", {
      text: "Advanced Settings",
    });
    this.addLocaleOverrideSetting();
  }

  addDotThresholdSetting(): void {
    new Setting(this.containerEl)
      .setName("Words per dot")
      .setDesc("How many words should be represented by a single dot?")
      .addText((textfield) => {
        textfield.setPlaceholder(String(DEFAULT_WORDS_PER_DOT));
        textfield.inputEl.type = "number";
        textfield.setValue(String(this.plugin.options.wordsPerDot));
        textfield.onChange(async (value) => {
          this.plugin.writeOptions(() => ({
            wordsPerDot: value !== "" ? Number(value) : undefined,
          }));
        });
      });
  }

  addWeekStartSetting(): void {
    const { moment } = window;

    const localizedWeekdays = moment.weekdays();
    const localeWeekStartNum = window._bundledLocaleWeekSpec.dow;
    const localeWeekStart = moment.weekdays()[localeWeekStartNum];

    new Setting(this.containerEl)
      .setName("Start week on:")
      .setDesc(
        "Choose what day of the week to start. Select 'Locale default' to use the default specified by moment.js"
      )
      .addDropdown((dropdown) => {
        dropdown.addOption("locale", `Locale default (${localeWeekStart})`);
        localizedWeekdays.forEach((day, i) => {
          dropdown.addOption(weekdays[i], day);
        });
        dropdown.setValue(this.plugin.options.weekStart);
        dropdown.onChange(async (value) => {
          this.plugin.writeOptions(() => ({
            weekStart: value as IWeekStartOption,
          }));
        });
      });
  }

  addConfirmCreateSetting(): void {
    new Setting(this.containerEl)
      .setName("Confirm before creating new note")
      .setDesc("Show a confirmation modal before creating a new note")
      .addToggle((toggle) => {
        toggle.setValue(this.plugin.options.shouldConfirmBeforeCreate);
        toggle.onChange(async (value) => {
          this.plugin.writeOptions(() => ({
            shouldConfirmBeforeCreate: value,
          }));
        });
      });
  }

  addShowWeeklyNoteSetting(): void {
    new Setting(this.containerEl)
      .setName("Show week number")
      .setDesc("Enable this to add a column with the week number")
      .addToggle((toggle) => {
        toggle.setValue(this.plugin.options.showWeeklyNote);
        toggle.onChange(async (value) => {
          this.plugin.writeOptions(() => ({ showWeeklyNote: value }));
          this.display(); // show/hide weekly settings
        });
      });
  }

  addShowTaskDotsSetting(): void {
    new Setting(this.containerEl)
      .setName("Show task circles")
      .setDesc(
        "Show a hollow circle on days whose note contains incomplete tasks"
      )
      .addToggle((toggle) => {
        toggle.setValue(this.plugin.options.showTaskDots);
        toggle.onChange(async (value) => {
          this.plugin.writeOptions(() => ({ showTaskDots: value }));
        });
      });
  }

  addShowAssociatedDotsSetting(): void {
    new Setting(this.containerEl)
      .setName("Show associated note dots")
      .setDesc(
        "Show a colored dot on days that have other notes associated with them"
      )
      .addToggle((toggle) => {
        toggle.setValue(this.plugin.options.showAssociatedDots);
        toggle.onChange(async (value) => {
          this.plugin.writeOptions(() => ({ showAssociatedDots: value }));
          this.display(); // show/hide the color setting
        });
      });
  }

  addAssociatedDotColorSetting(): void {
    new Setting(this.containerEl)
      .setName("Associated note dot color")
      .setDesc("The color used for the associated note dots")
      .addText((textfield) => {
        textfield.inputEl.type = "color";
        textfield.setValue(
          this.plugin.options.associatedDotColor || DEFAULT_ASSOCIATED_DOT_COLOR
        );
        textfield.onChange(async (value) => {
          this.plugin.writeOptions(() => ({ associatedDotColor: value }));
        });
      });
  }

  addAssociatedPaneSetting(): void {
    new Setting(this.containerEl)
      .setName("Show associated notes pane")
      .setDesc(
        "List the notes associated with the selected date underneath the calendar"
      )
      .addToggle((toggle) => {
        toggle.setValue(this.plugin.options.showAssociatedNotesPane);
        toggle.onChange(async (value) => {
          this.plugin.writeOptions(() => ({ showAssociatedNotesPane: value }));
          this.display(); // show/hide the pane display settings
        });
      });
  }

  addAssociatedDatePropertiesSetting(): void {
    new Setting(this.containerEl)
      .setName("Date properties")
      .setDesc(
        "Comma-separated list of frontmatter properties containing a date (e.g. 'date, published'). A note is associated with the dates found in these properties."
      )
      .addText((textfield) => {
        textfield.setPlaceholder("date");
        textfield.setValue(this.plugin.options.associatedDateProperties);
        textfield.onChange(async (value) => {
          this.plugin.writeOptions(() => ({
            associatedDateProperties: value,
          }));
        });
      });
  }

  addAssociatedRangePropertiesSetting(): void {
    new Setting(this.containerEl)
      .setName("Date range start property")
      .setDesc(
        "Frontmatter property marking the start of a date range (e.g. 'start-date'). Leave blank to disable range matching."
      )
      .addText((textfield) => {
        textfield.setPlaceholder("start-date");
        textfield.setValue(this.plugin.options.associatedStartProperty);
        textfield.onChange(async (value) => {
          this.plugin.writeOptions(() => ({
            associatedStartProperty: value,
          }));
        });
      });

    new Setting(this.containerEl)
      .setName("Date range end property")
      .setDesc(
        "Frontmatter property marking the end of a date range (e.g. 'end-date'). A note is associated with every date between start and end."
      )
      .addText((textfield) => {
        textfield.setPlaceholder("end-date");
        textfield.setValue(this.plugin.options.associatedEndProperty);
        textfield.onChange(async (value) => {
          this.plugin.writeOptions(() => ({
            associatedEndProperty: value,
          }));
        });
      });
  }

  addAssociatedIncludeLinksSetting(): void {
    new Setting(this.containerEl)
      .setName("Include linking notes")
      .setDesc(
        "Associate notes that contain a wikilink to a day's daily note (daily notes themselves are excluded)"
      )
      .addToggle((toggle) => {
        toggle.setValue(this.plugin.options.associatedIncludeLinks);
        toggle.onChange(async (value) => {
          this.plugin.writeOptions(() => ({
            associatedIncludeLinks: value,
          }));
        });
      });
  }

  addAssociatedNoteStyleSetting(): void {
    new Setting(this.containerEl)
      .setName("Note display style")
      .setDesc("How the associated notes are displayed in the pane")
      .addDropdown((dropdown) => {
        dropdown.addOption("card", "Cards");
        dropdown.addOption("compact", "Compact list");
        dropdown.setValue(this.plugin.options.associatedNoteStyle);
        dropdown.onChange(async (value) => {
          this.plugin.writeOptions(() => ({
            associatedNoteStyle: value as IAssociatedNoteStyle,
          }));
          this.display(); // preview setting only applies to cards
        });
      });
  }

  addAssociatedNoteInfoSettings(): void {
    new Setting(this.containerEl)
      .setName("Show note path")
      .setDesc("Show the folder path of each associated note")
      .addToggle((toggle) => {
        toggle.setValue(this.plugin.options.showAssociatedNotePath);
        toggle.onChange(async (value) => {
          this.plugin.writeOptions(() => ({
            showAssociatedNotePath: value,
          }));
        });
      });

    if (this.plugin.options.associatedNoteStyle === "card") {
      new Setting(this.containerEl)
        .setName("Show note preview")
        .setDesc("Show the first few lines of each associated note")
        .addToggle((toggle) => {
          toggle.setValue(this.plugin.options.showAssociatedNotePreview);
          toggle.onChange(async (value) => {
            this.plugin.writeOptions(() => ({
              showAssociatedNotePreview: value,
            }));
          });
        });
    }

    new Setting(this.containerEl)
      .setName("Show match reason")
      .setDesc(
        "Show a tag explaining why each note is associated with the date (the matching property, date range, or link)"
      )
      .addToggle((toggle) => {
        toggle.setValue(this.plugin.options.showAssociatedNoteReason);
        toggle.onChange(async (value) => {
          this.plugin.writeOptions(() => ({
            showAssociatedNoteReason: value,
          }));
        });
      });
  }

  addWeeklyNoteFormatSetting(): void {
    new Setting(this.containerEl)
      .setName("Weekly note format")
      .setDesc("For more syntax help, refer to format reference")
      .addText((textfield) => {
        textfield.setValue(this.plugin.options.weeklyNoteFormat);
        textfield.setPlaceholder(DEFAULT_WEEK_FORMAT);
        textfield.onChange(async (value) => {
          this.plugin.writeOptions(() => ({ weeklyNoteFormat: value }));
        });
      });
  }

  addWeeklyNoteTemplateSetting(): void {
    new Setting(this.containerEl)
      .setName("Weekly note template")
      .setDesc(
        "Choose the file you want to use as the template for your weekly notes"
      )
      .addText((textfield) => {
        textfield.setValue(this.plugin.options.weeklyNoteTemplate);
        textfield.onChange(async (value) => {
          this.plugin.writeOptions(() => ({ weeklyNoteTemplate: value }));
        });
      });
  }

  addWeeklyNoteFolderSetting(): void {
    new Setting(this.containerEl)
      .setName("Weekly note folder")
      .setDesc("New weekly notes will be placed here")
      .addText((textfield) => {
        textfield.setValue(this.plugin.options.weeklyNoteFolder);
        textfield.onChange(async (value) => {
          this.plugin.writeOptions(() => ({ weeklyNoteFolder: value }));
        });
      });
  }

  addLocaleOverrideSetting(): void {
    const { moment } = window;

    const sysLocale = navigator.language?.toLowerCase();

    new Setting(this.containerEl)
      .setName("Override locale:")
      .setDesc(
        "Set this if you want to use a locale different from the default"
      )
      .addDropdown((dropdown) => {
        dropdown.addOption("system-default", `Same as system (${sysLocale})`);
        moment.locales().forEach((locale) => {
          dropdown.addOption(locale, locale);
        });
        dropdown.setValue(this.plugin.options.localeOverride);
        dropdown.onChange(async (value) => {
          this.plugin.writeOptions(() => ({
            localeOverride: value as ILocaleOverride,
          }));
        });
      });
  }
}
