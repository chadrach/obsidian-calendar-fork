<script lang="ts">
  import type { TFile } from "obsidian";

  import type { IAssociatedNote } from "./associatedNotes";
  import { associatedNotesIndex, getAssociatedNotes } from "./associatedNotes";
  import {
    createdOnThisDayIndex,
    getNotesCreatedOnThisDay,
  } from "./createdOnThisDay";
  import type { INoteListItem } from "./noteListItem";
  import NoteListSection from "./NoteListSection.svelte";
  import { selectedDate, settings } from "./stores";

  export let onClickNote: (note: TFile, inNewSplit: boolean) => void;
  export let onHoverNote: (
    note: TFile,
    targetEl: EventTarget,
    isMetaPressed: boolean
  ) => void;
  export let onContextMenuNote: (note: TFile, event: MouseEvent) => void;

  function getReasonLabel(note: IAssociatedNote): string {
    if (note.reason === "link") {
      return "🔗 link";
    }
    return note.detail;
  }

  let associatedItems: INoteListItem[] = [];
  $: associatedItems = getAssociatedNotes(
    $associatedNotesIndex,
    $selectedDate
  ).map((note) => ({ file: note.file, badge: getReasonLabel(note) }));

  let createdOnThisDayItems: INoteListItem[] = [];
  $: createdOnThisDayItems = getNotesCreatedOnThisDay(
    $createdOnThisDayIndex,
    $selectedDate
  ).map((file) => ({
    file,
    badge: window.moment(file.stat.ctime).format("h:mm A"),
  }));
</script>

{#if $selectedDate && ($settings.showAssociatedNotesPane || $settings.showCreatedOnThisDay)}
  <div class="associated-notes-pane">
    {#if $settings.showAssociatedNotesPane}
      <NoteListSection
        heading={`Notes for ${$selectedDate.format("ll")}`}
        items={associatedItems}
        emptyMessage="No associated notes"
        showBadge={$settings.showAssociatedNoteReason}
        showPath={$settings.showAssociatedNotePath}
        showPreview={$settings.showAssociatedNotePreview}
        style={$settings.associatedNoteStyle}
        {onClickNote}
        {onHoverNote}
        {onContextMenuNote}
      />
    {/if}

    {#if $settings.showCreatedOnThisDay}
      <NoteListSection
        heading="Created on this day"
        items={createdOnThisDayItems}
        emptyMessage="No notes created on this day"
        showBadge={$settings.showAssociatedNoteReason}
        showPath={$settings.showAssociatedNotePath}
        showPreview={$settings.showAssociatedNotePreview}
        style={$settings.associatedNoteStyle}
        {onClickNote}
        {onHoverNote}
        {onContextMenuNote}
      />
    {/if}
  </div>
{/if}
