// @ts-nocheck
import { initialize, AudioTrack } from "@ableton-extensions/sdk";

export function activate(context: any) {
  const api = initialize(context, "1.0.0");

  api.commands.registerCommand("smartBatchExportAction", async (target: any) => {
    // 1. Validate we have an ArrangementSelection target
    if (!target || typeof target.time_selection_start !== "number" || !target.selected_lanes || target.selected_lanes.length === 0) {
      return;
    }

    // 2. Resolve the AudioTrack from the highlighted lane
    let track;
    try {
      track = api.getObjectFromHandle(target.selected_lanes[0], AudioTrack);
    } catch (error) {
      console.error("Selection is not on a valid Audio Track.");
      return;
    }

    const selStart = target.time_selection_start;
    const selEnd = target.time_selection_end;

    // 3. Filter clips to only those overlapping the highlighted selection
    const allClips = track.arrangementClips;
    const targetClips = allClips.filter((clip: any) => {
      return clip.startTime < selEnd && clip.endTime > selStart;
    });

    if (targetClips.length === 0) return;

    // 4. Run the Sandbox-Safe Render & Import Loop
    await api.ui.withinProgressDialog(
      "Rendering Selected Clips...",
      { progress: 0 },
      async (update) => {
        for (let i = 0; i < targetClips.length; i++) {
          const clip = targetClips[i];
          if (!clip) continue;

          const percent = Math.floor((i / targetClips.length) * 100);
          await update(`Rendering clip ${i + 1} of ${targetClips.length}...`, percent);

          // Render the isolated clip audio to a temp file
          const renderedPath = await api.resources.renderPreFxAudio(
            track as AudioTrack<"1.0.0">,
            clip.startTime,
            clip.endTime
          );

          // Permanently import the temp file into the Project's "Samples/Imported" folder
          await api.resources.importIntoProject(renderedPath);
        }
      }
    );
  });

  // Register strictly on Highlighted Time Selections for Audio Tracks
  api.ui.registerContextMenuAction(
    "AudioTrack.ArrangementSelection", 
    "Render Clips to Project", 
    "smartBatchExportAction"
  );
}