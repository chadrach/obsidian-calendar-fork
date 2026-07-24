<script lang="ts">
  import type { TFile } from "obsidian";

  import type { IAssociatedNoteStyle } from "src/settings";

  import type { INoteListItem } from "./noteListItem";

  export let heading: string;
  export let items: INoteListItem[] = [];
  export let emptyMessage: string;
  export let showBadge: boolean;
  export let showPath: boolean;
  export let showPreview: boolean;
  export let style: IAssociatedNoteStyle;
  export let onClickNote: (note: TFile, inNewSplit: boolean) => void;
  export let onHoverNote: (
    note: TFile,
    targetEl: EventTarget,
    isMetaPressed: boolean
  ) => void;
  export let onContextMenuNote: (note: TFile, event: MouseEvent) => void;

  function isMetaPressed(event: MouseEvent): boolean {
    return event.ctrlKey || event.metaKey;
  }

  function getFolder(file: TFile): string {
    const folder = file.parent?.path;
    return folder && folder !== "/" ? folder : "";
  }

  async function getExcerpt(file: TFile): Promise<string> {
    const contents = await window.app.vault.cachedRead(file);
    const excerpt = contents
      .replace(/^---\r?\n[\s\S]*?\r?\n---/, "") // strip frontmatter
      .replace(/```[\s\S]*?```/g, " ")
      .replace(/!\[\[[^\]]*\]\]/g, " ") // embeds
      .replace(/\[\[(?:[^\]|]*\|)?([^\]]*)\]\]/g, "$1") // wikilinks -> text
      .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1") // md links -> text
      .replace(/^#+\s+/gm, "")
      .replace(/[*_`>~]/g, "")
      .replace(/\s+/g, " ")
      .trim();
    return excerpt.length > 160 ? `${excerpt.slice(0, 160)}…` : excerpt;
  }
</script>

<div class="associated-notes-section">
  <div class="associated-notes-header">
    <span class="associated-notes-heading">{heading}</span>
    <span class="associated-notes-count">{items.length}</span>
  </div>
  {#if items.length === 0}
    <div class="associated-notes-empty">{emptyMessage}</div>
  {:else}
    <div
      class="associated-notes-list"
      class:is-compact={style === "compact"}
    >
      {#each items as item (item.file.path)}
        <div
          class="associated-note"
          on:click={(event) => onClickNote(item.file, isMetaPressed(event))}
          on:mouseover={(event) =>
            onHoverNote(item.file, event.target, isMetaPressed(event))}
          on:contextmenu={(event) => onContextMenuNote(item.file, event)}
        >
          <div class="associated-note-title">
            <span class="associated-note-name">{item.file.basename}</span>
            {#if showBadge}
              <span class="associated-note-reason">{item.badge}</span>
            {/if}
          </div>
          {#if showPath && getFolder(item.file)}
            <div class="associated-note-path">{getFolder(item.file)}</div>
          {/if}
          {#if showPreview && style === "card"}
            {#await getExcerpt(item.file) then excerpt}
              {#if excerpt}
                <div class="associated-note-preview">{excerpt}</div>
              {/if}
            {/await}
          {/if}
        </div>
      {/each}
    </div>
  {/if}
</div>
