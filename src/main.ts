import type { Moment, WeekSpec } from "moment";
import { App, Plugin, WorkspaceLeaf } from "obsidian";

import { VIEW_TYPE_CALENDAR } from "./constants";
import { settings } from "./ui/stores";
import {
  appHasPeriodicNotesPluginLoaded,
  CalendarSettingsTab,
  ISettings,
} from "./settings";
import CalendarView from "./view";

declare global {
  interface Window {
    app: App;
    moment: () => Moment;
    _bundledLocaleWeekSpec: WeekSpec;
  }
}

// Legacy plugin id used by the original "Calendar" plugin. Several
// community plugins -- including `obsidian-daily-notes-interface`, which
// this plugin itself depends on -- hard-code lookups for a plugin
// registered under this id to read Weekly Note settings (format, folder,
// template) when the Periodic Notes plugin isn't installed.
const LEGACY_PLUGIN_ID = "calendar";

export default class CalendarPlugin extends Plugin {
  public options: ISettings;
  private view: CalendarView;
  private didRegisterLegacyAlias = false;

  onunload(): void {
    this.app.workspace
      .getLeavesOfType(VIEW_TYPE_CALENDAR)
      .forEach((leaf) => leaf.detach());
    this.unregisterLegacyAlias();
  }

  /**
   * Alias this plugin under the original Calendar plugin's id so that
   * `obsidian-daily-notes-interface`'s Weekly Note settings lookup keeps
   * working now that this fork uses a distinct id. Only registers the
   * alias when nothing already occupies that id, so an actual install of
   * the original Calendar plugin is never shadowed.
   */
  private registerLegacyAlias(): void {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pluginManager = (this.app as any).plugins;
    if (pluginManager?.plugins && !pluginManager.plugins[LEGACY_PLUGIN_ID]) {
      pluginManager.plugins[LEGACY_PLUGIN_ID] = this;
      this.didRegisterLegacyAlias = true;
    }
  }

  private unregisterLegacyAlias(): void {
    if (!this.didRegisterLegacyAlias) {
      return;
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pluginManager = (this.app as any).plugins;
    if (pluginManager?.plugins?.[LEGACY_PLUGIN_ID] === this) {
      delete pluginManager.plugins[LEGACY_PLUGIN_ID];
    }
    this.didRegisterLegacyAlias = false;
  }

  async onload(): Promise<void> {
    this.registerLegacyAlias();

    this.register(
      settings.subscribe((value) => {
        this.options = value;
      })
    );

    this.registerView(
      VIEW_TYPE_CALENDAR,
      (leaf: WorkspaceLeaf) => (this.view = new CalendarView(leaf))
    );

    this.addCommand({
      id: "show-calendar-view",
      name: "Open view",
      checkCallback: (checking: boolean) => {
        if (checking) {
          return (
            this.app.workspace.getLeavesOfType(VIEW_TYPE_CALENDAR).length === 0
          );
        }
        this.initLeaf();
      },
    });

    this.addCommand({
      id: "open-weekly-note",
      name: "Open Weekly Note",
      checkCallback: (checking) => {
        if (checking) {
          return !appHasPeriodicNotesPluginLoaded();
        }
        this.view.openOrCreateWeeklyNote(window.moment(), false);
      },
    });

    this.addCommand({
      id: "reveal-active-note",
      name: "Reveal active note",
      callback: () => this.view.revealActiveNote(),
    });

    await this.loadOptions();

    this.addSettingTab(new CalendarSettingsTab(this.app, this));

    if (this.app.workspace.layoutReady) {
      this.initLeaf();
    } else {
      this.registerEvent(
        this.app.workspace.on("layout-ready", this.initLeaf.bind(this))
      );
    }
  }

  initLeaf(): void {
    if (this.app.workspace.getLeavesOfType(VIEW_TYPE_CALENDAR).length) {
      return;
    }
    this.app.workspace.getRightLeaf(false).setViewState({
      type: VIEW_TYPE_CALENDAR,
    });
  }

  async loadOptions(): Promise<void> {
    const options = await this.loadData();
    settings.update((old) => {
      return {
        ...old,
        ...(options || {}),
      };
    });

    await this.saveData(this.options);
  }

  async writeOptions(
    changeOpts: (settings: ISettings) => Partial<ISettings>
  ): Promise<void> {
    settings.update((old) => ({ ...old, ...changeOpts(old) }));
    await this.saveData(this.options);
  }
}
