# Smart Batch Exporter

A context-menu workflow extension for Ableton Live 12 (Beta) that renders every clip on an arrangement audio track and imports them into your project as individual audio files.

## Download
[Download the latest .ablx installer](https://github.com/nejben77/smart-batch-exporter/releases)

## Requirements
- Ableton Live 12 Beta (the build that includes the Extensions feature)
- Install via Settings > Extensions with Developer Mode off

## Before you start
Save your Set first. The exported clips are written into the project folder, which only exists once the Set has been saved, so saving before you run the export makes sure the files have a home you can find.

## Usage
1. Save your Set.
2. Go to an audio track in the Arrangement holding your sliced or cut-up segments.
3. Right-click any clip and choose **Export to Folder**.

## Finding your files
The rendered clips are imported into your project's `Samples/Imported` folder. To get there quickly, right-click any of the imported clips inside Live and use the option to show or manage its sample file, which opens that folder in Finder.

## Planned
- Sequential naming (`_01`, `_02`, `_03`) for exported slices.
- Auto-match bit depth, reading source files to export native 24-bit and 32-bit streams.
- AIFF (`.aif`) container support alongside WAV.
