import { describe, expect, it } from "vitest";
import type { Tick } from "../../../sim/brands";
import { seed, tile } from "../../../sim/brands";
import { OCELLUS_P3 } from "../../ocellus/js/OcellusTimings";
import { defaultOptions } from "../catalog";
import type { RaidId } from "../catalog";
import { patternOrder, project } from "../clock";
import type { RaidInput } from "../clock";
import { ROOMS, WAVE_SKIP, beamHits, centreTendril } from "../layout";
import { ARCHIVE, DEMONBANE_RESISTANCE } from "../timings";

const options = defaultOptions(seed(1));

function hold(id: RaidId, patch: Partial<RaidInput> = {}): (at: Tick) => RaidInput {
  const room = ROOMS[id];
  const bossHp = id === "bork" ? ARCHIVE.bork.hp : id === "ezekiel" ? ARCHIVE.ezekiel.hp : id === "moia" ? options.moiaHp : id === "xarth" ? ARCHIVE.xarth.hp : id === "ocellus-p1" ? ARCHIVE.p1.hp : id === "ocellus-p3" ? ARCHIVE.p3.hp : ARCHIVE.guardian.shield;
  return () => ({
    player: room.player,
    bossHp,
    realHp: ARCHIVE.guardian.hp,
    addsHp: [ARCHIVE.bork.smorkHp],
    addsAlive: 1,
    prayer: "melee",
    previous: room.player,
    ...patch,
  });
}

function names(id: RaidId, until: number, input: (at: Tick) => RaidInput = hold(id)) {
  return project(id, options, until, input).flatMap((stamp) => (stamp.event.kind === "attack" ? [{ at: stamp.at, name: stamp.event.name, text: stamp.event.text }] : []));
}

describe("raid clocks", () => {
  it("keeps the demonbane resistance at one fifth", () => {
    expect(DEMONBANE_RESISTANCE).toBe(0.2);
  });

  it("drums every 7 ticks at full Smorks health", () => {
    const drums = names("bork", 21).filter((row) => row.name === "drum").map((row) => row.at);
    expect(drums).toEqual([0, 7, 14, 21]);
  });

  it("places the angry chain off the bomb tell", () => {
    const rows = names("bork", 71);
    const tell = rows.find((row) => row.name === "bomb-tell")?.at;
    expect(tell).toBe(33);
    const at = (name: string) => rows.find((row) => row.name === name)?.at;
    expect(at("oof")).toBe(38);
    expect(at("very-angry")).toBe(52);
    expect(at("14550")).toBe(54);
    expect(at("14551")).toBe(60);
    expect(at("drum-resume")).toBe(71);
  });

  it("lands the guardian 3 ticks after the shield breaks and sends vines from landing + 5", () => {
    const vines = names("guardian", 40, hold("guardian", { bossHp: 0 })).filter((row) => row.name === "vine").map((row) => row.at);
    expect(vines[0]).toBe(8);
    expect(vines[1]).toBe(11);
    expect(vines.at(-1)).toBe(32);
  });

  it("fires enrage beams every 20 ticks", () => {
    const beams = names("guardian", 40, hold("guardian", { realHp: 363 })).filter((row) => row.name === "beam").map((row) => row.at);
    expect(beams).toEqual([0, 20, 40]);
  });

  it("steps Ezekiel melee, specials and the enrage waves", () => {
    const melee = names("ezekiel", 41).filter((row) => row.name === "melee").map((row) => row.at);
    expect(melee).toEqual([0, 5, 17, 22, 36, 41]);
    const waves = names("ezekiel", 22, hold("ezekiel", { bossHp: 900 })).filter((row) => row.name === "wave").map((row) => row.at);
    expect(waves).toEqual([0, 11, 22]);
  });

  it("relocates Moia every 25 ticks and vanishes under a third", () => {
    const moved = names("moia", 45).filter((row) => row.name === "relocate").map((row) => row.at);
    expect(moved).toEqual([20, 45]);
    const low = project("moia", options, 18, hold("moia", { bossHp: 600 }));
    expect(low.find((stamp) => stamp.event.kind === "attack" && stamp.event.name === "chant")?.at).toBe(18);
    expect(low.some((stamp) => stamp.event.kind === "chat" && stamp.event.text === "Cease this futile resistance!")).toBe(true);
  });

  it("blasts Xarth after five magic autos", () => {
    const rows = names("xarth", 23);
    expect(rows.filter((row) => row.name === "14984").map((row) => row.at)).toEqual([0, 4, 8, 12, 16]);
    expect(rows.find((row) => row.name === "14992")?.at).toBe(20);
    expect(rows.find((row) => row.name === "14989")?.at).toBe(23);
  });

  it("channels the Dagon'hai elements and walks the cauldron", () => {
    const rows = names("dagonhai", 37);
    expect(rows.filter((row) => row.name === "channel").map((row) => row.text)).toEqual(["I'll feed the flames!", "I'll strengthen the bond!"]);
    expect(rows.filter((row) => row.name === "cauldron").map((row) => row.at)).toEqual([23, 25, 27, 29, 31, 33]);
  });

  it("sends seven corner tendrils and then the two-tile slam", () => {
    const rows = names("ocellus-p1", 44);
    expect(rows.filter((row) => row.name === "tendril").map((row) => row.at)).toEqual([0, 6, 12, 18, 24, 30, 36]);
    expect(rows.find((row) => row.name === "slam")?.at).toBe(41);
  });

  it("runs four centre pairs and then the annihilation", () => {
    const rows = project("ocellus-p1", options, 69, hold("ocellus-p1", { bossHp: 1600 }));
    const attacks = rows.flatMap((stamp) => (stamp.event.kind === "attack" ? [stamp] : []));
    expect(attacks.filter((stamp) => stamp.event.kind === "attack" && stamp.event.name === "tendril")).toHaveLength(8);
    expect(attacks.filter((stamp) => stamp.event.kind === "attack" && stamp.event.name === "slam")).toHaveLength(4);
    expect(attacks.find((stamp) => stamp.event.kind === "attack" && stamp.event.name === "14810")?.event).toMatchObject({ text: "Embrace... annihilation..." });
    const shots = rows.filter((stamp) => stamp.event.kind === "damage" && stamp.event.name === "annihilation");
    expect(shots).toHaveLength(8);
    expect(shots.every((stamp) => stamp.at === 69)).toBe(true);
  });

  it("a fully blocked centre is one Death projectile", () => {
    const blocked = project("ocellus-p1", options, 69, (at) => {
      const local = at % 15;
      const pair = Math.floor(at / 15);
      const standing = local === 0 || local === 6 ? centreTendril(pair, local === 0 ? 0 : 1) : ROOMS["ocellus-p1"].player;
      const base = hold("ocellus-p1", { bossHp: 1600 })(at);
      return { ...base, player: standing, previous: standing };
    });
    const shout = blocked.find((stamp) => stamp.event.kind === "attack" && stamp.event.name === "14810");
    const shots = blocked.filter((stamp) => stamp.event.kind === "damage" && stamp.event.name === "annihilation");
    expect(shout?.event).toMatchObject({ text: "Death... awaits..." });
    expect(shots).toHaveLength(1);
  });

  it("keeps the orange-on-orange pocket safe and the next purple tile hit", () => {
    expect(patternOrder(1)[0]).toBe("B");
    expect(beamHits("NW", 2, 2, tile(8, 15))).toBe(false);
    expect(beamHits("NW", 2, 2, tile(10, 15))).toBe(true);
    expect(WAVE_SKIP.NW.outer.x).toBe(6);
  });

  it("fires six portal volleys from tick 11 and opens the orange pad", () => {
    const rows = project("ocellus-p2", options, 38, hold("ocellus-p2"));
    const volleys = rows.flatMap((stamp) => (stamp.event.kind === "attack" && stamp.event.name === "volley" ? [stamp.at] : []));
    const pad = rows.find((stamp) => stamp.event.kind === "pad");
    expect(volleys).toEqual([11, 16, 21, 26, 31, 36]);
    expect(pad?.at).toBe(38);
    expect(pad?.event).toMatchObject({ kind: "pad", next: { x: 16, y: 16 } });
  });

  it("follows the phase 3 auto offsets and the 13-tick collapse", () => {
    const steps = OCELLUS_P3.autos.value;
    const offsets: number[] = [];
    let cursor = 0;
    for (const step of steps) {
      offsets.push(cursor);
      cursor += step.next;
    }
    expect(cursor).toBe(20);
    const swung = names("ocellus-p3", 19).filter((row) => row.name === "melee" || row.name === "wave").map((row) => row.at);
    expect(swung).toEqual(offsets);
    const collapse = names("ocellus-p3", 13, hold("ocellus-p3", { bossHp: 3937 })).find((row) => row.name === "collapse");
    expect(collapse?.at).toBe(0);
    const hit = project("ocellus-p3", options, 13, hold("ocellus-p3", { bossHp: 3937 })).find((stamp) => stamp.event.kind === "damage" && stamp.event.name === "collapse");
    expect(hit?.at).toBe(13);
  });
});
