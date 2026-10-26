/**
 * Two fixes for the pinned asset tool, both idempotent.
 * Attack sequences name frame sounds this cache does not store, and the tool
 * stops the extract on the first missing sound.
 * Ocellus's floor overlay stores the sentinel as its 3D colour and a real
 * colour in the secondary slot. The tool was dropping those tiles. The
 * secondary colour is the one the cache stores for that overlay, so the
 * floor is painted with it.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const target = resolve("node_modules/osrs-sdk-assets/dist/cli.js");
let source = readFileSync(target, "utf8");
let changed = false;

const soundMarker = "sound effect ${id2} is not in this cache";
if (source.includes(soundMarker)) {
  console.log("patch-asset-tool: missing sound effects are already skipped");
} else {
  const previous = `        const file = await cache.getFile(IndexType.SOUNDEFFECTS, id2, 0, { cacheResults: false });
        soundEffects.push({ id: id2, bytes: Uint8Array.from(file.content) });`;
  const next = `        const file = await cache.getFile(IndexType.SOUNDEFFECTS, id2, 0, { cacheResults: false });
        if (!file?.content) {
          console.warn(\`osrs-sdk-assets: sound effect \${id2} is not in this cache\`);
          continue;
        }
        soundEffects.push({ id: id2, bytes: Uint8Array.from(file.content) });`;
  if (!source.includes(previous)) {
    console.error("patch-asset-tool: the sound-effect loop was not where this patch expects it");
    process.exit(1);
  }
  source = source.replace(previous, next);
  changed = true;
  console.log("patch-asset-tool: missing sound effects are skipped");
}

const floorMarker = "overlay secondary colour fills a sentinel floor";
if (source.includes(floorMarker)) {
  console.log("patch-asset-tool: sentinel floors already use the secondary colour");
} else {
  const previous = `        let rgb = null;
        for (let offset = 0; offset < content.length; ) {
          const opcode = content[offset++];
          if (opcode === 0) break;
          if (opcode === 1) {
            rgb = content[offset] << 16 | content[offset + 1] << 8 | content[offset + 2];
            offset += 3;
          } else if (opcode === 2) offset += 1;
          else if (opcode === 7) offset += 3;
        }
        overlays.set(id2, { definition: file?.def, transparent: rgb === 16711935 });`;
  const next = `        let rgb = null;
        let secondary = null;
        for (let offset = 0; offset < content.length; ) {
          const opcode = content[offset++];
          if (opcode === 0) break;
          if (opcode === 1) {
            rgb = content[offset] << 16 | content[offset + 1] << 8 | content[offset + 2];
            offset += 3;
          } else if (opcode === 2) offset += 1;
          else if (opcode === 7) {
            secondary = content[offset] << 16 | content[offset + 1] << 8 | content[offset + 2];
            offset += 3;
          }
        }
        const sentinel = rgb === 16711935;
        const flat = sentinel && secondary != null ? rgbToOverlayHsl(secondary) : null;
        // overlay secondary colour fills a sentinel floor
        overlays.set(id2, { definition: file?.def, transparent: sentinel && flat == null, flat });`;
  const colourLine = `        if (info?.definition?.color >= 0 && !transparentOverlay) overlay = info.definition.color;`;
  const colourNext = `        if (info?.flat != null) overlay = info.flat;
        else if (info?.definition?.color >= 0 && !transparentOverlay) overlay = info.definition.color;`;
  const hslFn = `    const rgbToOverlayHsl = (var1) => {
      const channel = (shift) => ((var1 >> shift) & 255) / 256;
      const red = channel(16), green = channel(8), blue = channel(0);
      const min = Math.min(red, green, blue), max = Math.max(red, green, blue);
      let hue = 0, saturation = 0;
      const lightness = (min + max) / 2;
      if (min != max) {
        saturation = lightness < 0.5 ? (max - min) / (min + max) : (max - min) / (2 - max - min);
        if (max == red) hue = (green - blue) / (max - min);
        else if (max == green) hue = 2 + (blue - red) / (max - min);
        else hue = 4 + (red - green) / (max - min);
      }
      hue = Math.floor(hue / 6 * 64);
      saturation = Math.max(0, Math.min(7, Math.floor(saturation * 8)));
      const level = Math.max(0, Math.min(127, Math.floor(lightness * 128)));
      return (hue << 10) | (saturation << 7) | level;
    };
`;
  if (!source.includes(previous) || !source.includes(colourLine) || !source.includes("    const overlayDefinition = async (id2) => {")) {
    console.error("patch-asset-tool: the overlay parser was not where this patch expects it");
    process.exit(1);
  }
  source = source.replace(previous, next).replace(colourLine, colourNext).replace(
    "    const overlayDefinition = async (id2) => {",
    `${hslFn}    const overlayDefinition = async (id2) => {`,
  );
  changed = true;
  console.log("patch-asset-tool: sentinel floors use the secondary colour");
}

if (changed) writeFileSync(target, source);
