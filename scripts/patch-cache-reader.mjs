/**
 * Cache 2746 leaves the map index unnamed. Each region is one archive:
 * file 0 is terrain and file 1 is locations. The pinned reader only looks up
 * the older named archives, so region extraction throws. This patches that
 * checkout in place. A fresh netlify build checks the reader out again and
 * runs this before extracting assets.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const reader = process.argv[2];
if (!reader) {
  console.error("usage: node scripts/patch-cache-reader.mjs <osrscachereader checkout>");
  process.exit(1);
}

const target = resolve(reader, "src/cacheReader/RSCache.js");
const source = readFileSync(target, "utf8");
const marker = "Cache 2746 (revision 241) leaves the map index unnamed.";
if (source.includes(marker)) {
  console.log(`patch-cache-reader: ${target} already loads region archives`);
  process.exit(0);
}

const imported = source.includes('import MapLoader from "./loaders/MapLoader.js";')
  ? source
  : source.replace(
      'import ConfigType from "./cacheTypes/ConfigType.js";\n',
      'import ConfigType from "./cacheTypes/ConfigType.js";\nimport MapLoader from "./loaders/MapLoader.js";\n',
    );

const previous = `    async #getMapDef(x, y, type) {
        let hash = (str) => {
            let h = 0;
            for (let i = 0; i < str.length; i++) {
                h = h * 31 + str.charCodeAt(i);
            }
            return new Int32Array([h])[0];
        }

        let archives = this.indicies[IndexType.MAPS.id].archives;
        let hashVal = hash(type + x + "_" + y);

        let map = Object.values(archives).find(x => x.nameHash == hashVal);
        return this.getDef(IndexType.MAPS, map.id);
    }`;

const next = `    async #getMapDef(x, y, type) {
        let hash = (str) => {
            let h = 0;
            for (let i = 0; i < str.length; i++) {
                h = h * 31 + str.charCodeAt(i);
            }
            return new Int32Array([h])[0];
        }

        let archives = this.indicies[IndexType.MAPS.id].archives;
        let hashVal = hash(type + x + "_" + y);

        let map = Object.values(archives).find((archive) => archive.nameHash == hashVal);
        if (map) return this.getDef(IndexType.MAPS, map.id);

        // Cache 2746 (revision 241) leaves the map index unnamed. One archive per region holds terrain in file 0 and locations in file 1.
        const regionId = (x << 8) | y;
        const archive = archives[regionId];
        if (!archive) return undefined;
        const index = this.getIndex(IndexType.MAPS);
        if (!archive.files[0]?.content?.length) {
            const segment = index.indexSegments[archive.id];
            const data = await this.cacheRequester.readData(index, segment.size, segment.segment, archive.id);
            archive.loadFiles(data.decompressedData);
        }
        const loader = new MapLoader();
        const file = archive.files[type === "m" ? 0 : 1];
        const bytes = file?.content;
        if (!bytes?.length) return undefined;
        return type === "m" ? loader.loadMapDef(bytes, regionId, x, y) : loader.loadLocationDef(bytes, regionId, x, y);
    }`;

if (!imported.includes(previous)) {
  console.error(`patch-cache-reader: ${target} does not contain the expected getMapDef`);
  process.exit(1);
}

writeFileSync(target, imported.replace(previous, next));
console.log(`patch-cache-reader: region archives now load from ${target}`);
