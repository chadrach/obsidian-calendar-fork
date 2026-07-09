<script lang="ts">
  import type { TFile } from "obsidian";

  import type { IAssociatedNote } from "./associatedNotes";
  import { associatedNotesIndex, getAssociatedNotes } from "./associatedNotes";
  import { selectedDate, settings } from "./stores";

  export let onClickNote: (note: TFile, inNewSplit: boolean) => void;
  export let onHoverNote: (
    note: TFile,
    targetEl: EventTarget,
    isMetaPressed: boolean
  ) => void;
  export let onContextMenuNote: (note: TFile, event: MouseEvent) => void;

  let notes: IAssociatedNote[] = [];
  $: notes = getAssociatedNotes($associatedNotesIndex, $selectedDate);

  function isMetaPressed(event: MouseEvent): boolean {
    return event.ctrlKey || event.metaKey;
  }

  function getFolder(note: TFile): string {
    const folder = note.parent?.path;
    return folder && folder !== "/" ? folder : "";
  }

  function getReasonLabel(note: IAssociatedNote): string {
    if (note.reason === "link") {
      return "🔗 link";
    }
    return note.detail;
  }

  async function getExcerpt(note: TFile): Promise<string> {
    const contents = await window.app.vault.cachedRead(note);
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

{#if $settings.showAssociatedNotesPane && $selectedDate}
  <div class="associated-notes-pane">
    <div class="associated-notes-header">
      <span class="associated-notes-heading"
        >Notes for {$selectedDate.format("ll")}</span
      >
      <span class="associated-notes-count">{notes.length}</span>
    </div>
    {#if notes.length === 0}
      <div class="associated-notes-empty">No associated notes</div>
    {:else}
      <div
        class="associated-notes-list"
        class:is-compact={$settings.associatedNoteStyle === "compact"}
      >
        {#each notes as note (note.file.path)}
          <div
            class="associated-note"
            on:click={(event) => onClickNote(note.file, isMetaPressed(event))}
            on:mouseover={(event) =>
              onHoverNote(note.file, event.target, isMetaPressed(event))}
            on:contextmenu={(event) => onContextMenuNote(note.file, event)}
          >
            <div class="associated-note-title">
              <span class="associated-note-name">{note.file.basename}</span>
              {#if $settings.showAssociatedNoteReason}
                <span class="associated-note-reason">{getReasonLabel(note)}</span>
              {/if}
            </div>
            {#if $settings.showAssociatedNotePath && getFolder(note.file)}
              <div class="associated-note-path">{getFolder(note.file)}</div>
            {/if}
            {#if $settings.showAssociatedNotePreview && $settings.associatedNoteStyle === "card"}
              {#await getExcerpt(note.file) then excerpt}
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
{/if}
