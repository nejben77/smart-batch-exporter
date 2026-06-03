// @ts-nocheck
import { initialize, type ActivationContext } from "@ableton-extensions/sdk";
import * as fs from "fs";
import * as path from "path";

export function activate(context: ActivationContext) {
  const api = initialize(context, "1.0.0");

  api.commands.registerCommand("smartBatchExportAction", async (...args: any[]) => {
    console.log("=== Smart Batch Exporter: Generating Audio Files ===");
    
    const target = args[0];
    if (!target || !target.id) return;

    // Target directory set directly to your Mac Downloads folder
    const outputFolder = "/Users/nejmbenessaiah/Downloads/Smart_Batch_Exports";

    try {
      const dm = (api.application as any).dataModel;

      // 1. Ensure the output directory exists in Downloads
      if (!fs.existsSync(outputFolder)) {
        fs.mkdirSync(outputFolder, { recursive: true });
      }

      // 2. Retrieve project handles and current BPM Tempo
      const rootHandle = await dm.getRoot();
      const songHandle = await dm.rootGetSong(rootHandle);
      const tempo = await dm.songGetTempo(songHandle);
      console.log(`Current Project Tempo captured: ${tempo} BPM`);

      // 3. Capture the track layout map
      const trackHandle = await dm.getObjectCanonicalParent(target);
      const trackClips: any[] = await dm.trackGetArrangementClips(trackHandle);
      console.log(`Processing ${trackClips.length} slices...`);

      // 4. Process and export each clip slice natively
      for (let i = 0; i < trackClips.length; i++) {
        const clipHandle = typeof trackClips[i] === "bigint" ? { id: trackClips[i] } : trackClips[i];

        const clipName = await dm.clipGetName(clipHandle);
        const startTimeBeats = await dm.clipGetStartTime(clipHandle);
        const endTimeBeats = await dm.clipGetEndTime(clipHandle);
        const sourcePath = await dm.audioclipGetFilePath(clipHandle);

        if (!sourcePath || !fs.existsSync(sourcePath)) {
          console.log(`Skipping slice ${i + 1}: Source file not readable.`);
          continue;
        }

        // Convert Ableton timeline beats into exact seconds: (Beats / BPM) * 60
        const startSec = (startTimeBeats / tempo) * 60;
        const endSec = (endTimeBeats / tempo) * 60;

        // Clean automated filename prefixing
        const baseName = clipName ? clipName.replace(/[\/\\?%*:|"<>]/g, '-') : "Slice";
        const paddedIndex = String(i + 1).padStart(2, '0');
        const targetFileName = `${baseName}_${paddedIndex}.wav`;
        const destinationPath = path.join(outputFolder, targetFileName);

        // Natively slice the WAV file using custom chunk searching
        sliceWavFile(sourcePath, destinationPath, startSec, endSec);
        console.log(`Exported: ${targetFileName}`);
      }

      console.log(`\n=== SUCCESS! All slices saved cleanly to: ${outputFolder} ===`);

    } catch (error) {
      console.error("Export generation script encountered an error:", error);
    }
  });

  api.ui.registerContextMenuAction("AudioClip", "Export to Folder", "smartBatchExportAction");
}

// Adaptive WAV byte file carver that reads dynamic header indexes
function sliceWavFile(sourcePath: string, targetPath: string, startSec: number, endSec: number) {
  // Allocate a 2KB buffer to safely read through complex Broadcast Wave metadata blocks
  const chunkBuffer = Buffer.alloc(2048);
  const fd = fs.openSync(sourcePath, 'r');
  fs.readSync(fd, chunkBuffer, 0, 2048, 0);
  
  // Dynamically locate where Ableton positioned the format descriptor vs data boundaries
  const fmtIndex = chunkBuffer.indexOf("fmt ");
  const dataIndex = chunkBuffer.indexOf("data");
  if (fmtIndex === -1 || dataIndex === -1) {
    fs.closeSync(fd);
    throw new Error("Unsupported or corrupted WAV file layout structure.");
  }
  
  const numChannels = chunkBuffer.readUInt16LE(fmtIndex + 10);
  const sampleRate = chunkBuffer.readUInt32LE(fmtIndex + 12);
  const byteRate = chunkBuffer.readUInt32LE(fmtIndex + 16);
  const blockAlign = chunkBuffer.readUInt16LE(fmtIndex + 20);
  const bitsPerSample = chunkBuffer.readUInt16LE(fmtIndex + 22);
  
  const dataStartOffset = dataIndex + 8;
  
  const startByte = dataStartOffset + Math.floor(startSec * byteRate);
  const endByte = dataStartOffset + Math.floor(endSec * byteRate);
  let durationBytes = endByte - startByte;
  
  durationBytes = Math.floor(durationBytes / blockAlign) * blockAlign;
  if (durationBytes <= 0) durationBytes = blockAlign;

  // Re-write a clean standalone standard 44-byte WAV header block for absolute compatibility
  const newHeader = Buffer.alloc(44);
  newHeader.write("RIFF", 0);
  newHeader.writeUInt32LE(durationBytes + 36, 4);
  newHeader.write("WAVE", 8);
  newHeader.write("fmt ", 12);
  newHeader.writeUInt32LE(16, 16); 
  newHeader.writeUInt16LE(1, 20);  
  newHeader.writeUInt16LE(numChannels, 22);
  newHeader.writeUInt32LE(sampleRate, 24);
  newHeader.writeUInt32LE(byteRate, 28);
  newHeader.writeUInt16LE(blockAlign, 32);
  newHeader.writeUInt16LE(bitsPerSample, 34);
  newHeader.write("data", 36);
  newHeader.writeUInt32LE(durationBytes, 40);
  
  const writeStream = fs.createWriteStream(targetPath);
  writeStream.write(newHeader);
  
  const readStream = fs.createReadStream(sourcePath, { 
    start: startByte, 
    end: startByte + durationBytes - 1 
  });
  
  readStream.pipe(writeStream);
  fs.closeSync(fd);
}