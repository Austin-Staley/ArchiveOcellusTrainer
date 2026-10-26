import { describe, expect, it } from "vitest";
import type { Tick } from "../../../sim/brands";
import { seed, tile } from "../../../sim/brands";
import { OCELLUS_P3 } from "../../ocellus/js/OcellusTimings";
import { defaultOptions } from "../catalog";
import type { RaidId } from "../catalog";
import { patternOrder, project } from "../clock";
import type { RaidInput } from "../clock";
import { cornerCrack } from "../cracks";
import { DAGON_TRAIL, ROOMS, WAVE_SKIP, beamHits, centreTendril } from "../layout";
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

  it("fires enrage beams every 20 ticks and stops the ranged auto after the first beam", () => {
    const input = hold("guardian", { realHp: 363 });
    const beams = names("guardian", 40, input).filter((row) => row.name === "beam").map((row) => row.at);
    expect(beams).toEqual([0, 20, 40]);
    const autos = names("guardian", 40, input).filter((row) => row.name === "14751").map((row) => row.at);
    expect(autos).toEqual([0]);
  });

  it("grounds the guardian for 35 ticks, then 41, then 47", () => {
    const phases = project("guardian", options, 140, hold("guardian", { bossHp: 0 })).flatMap((stamp) =>
      stamp.event.kind === "phase" ? [{ at: stamp.at, name: stamp.event.name }] : [],
    );
    expect(phases.filter((row) => row.name === "grounded").map((row) => row.at)).toEqual([3, 45, 93]);
    expect(phases.filter((row) => row.name === "takeoff").map((row) => row.at)).toEqual([38, 86, 140]);
  });

  it("steps Ezekiel melee, specials and the enrage waves", () => {
    const melee = names("ezekiel", 41).filter((row) => row.name === "melee").map((row) => row.at);
    expect(melee).toEqual([0, 5, 17, 22, 36, 41]);
    const waves = names("ezekiel", 22, hold("ezekiel", { bossHp: 900 })).filter((row) => row.name === "wave");
    expect(waves.map((row) => row.at)).toEqual([0, 11, 22]);
    expect(waves.every((row) => row.text === "14694")).toBe(true);
    const waveHits = project("ezekiel", options, 6, hold("ezekiel", { bossHp: 900 })).filter((stamp) => stamp.event.kind === "damage" && stamp.event.name === "wave").map((stamp) => stamp.at);
    expect(waveHits).toEqual([4, 5, 6]);
    const stunned = names("ezekiel", 32);
    expect(stunned.find((row) => row.name === "stun")).toMatchObject({ at: 24, text: "14691" });
    expect(stunned.find((row) => row.name === "stun-end")).toMatchObject({ at: 32, text: "14693" });
  });

  it("relocates Moia every 25 ticks and vanishes under a third", () => {
    const moved = names("moia", 45).filter((row) => row.name === "relocate").map((row) => row.at);
    expect(moved).toEqual([20, 45]);
    const low = project("moia", options, 18, hold("moia", { bossHp: 600 }));
    expect(low.find((stamp) => stamp.event.kind === "attack" && stamp.event.name === "chant")?.at).toBe(18);
    expect(low.some((stamp) => stamp.event.kind === "chat" && stamp.event.text === "Cease this futile resistance!")).toBe(true);
    const autos = names("moia", 20).filter((row) => row.name === "14785").map((row) => row.at);
    expect(autos).toEqual([0, 5, 10, 15]);
    const rows = project("moia", options, 24, hold("moia"));
    const ranged = rows.filter((stamp) => stamp.event.kind === "damage" && stamp.event.name === "ranged").map((stamp) => stamp.at);
    expect(ranged).toEqual([0, 5, 10, 15]);
    const magic = rows.filter((stamp) => stamp.event.kind === "damage" && stamp.event.name === "magic").map((stamp) => stamp.at);
    expect(magic).toEqual([24]);
    expect(names("moia", 10).filter((row) => row.name === "14791").map((row) => row.at)).toEqual([0, 5, 10]);
  });

  it("blasts Xarth after five magic autos", () => {
    const rows = names("xarth", 23);
    expect(rows.filter((row) => row.name === "14984").map((row) => row.at)).toEqual([0, 4, 8, 12, 16]);
    expect(rows.find((row) => row.name === "14992")?.at).toBe(20);
    expect(rows.find((row) => row.name === "14989")?.at).toBe(23);
    const magic = project("xarth", options, 18, hold("xarth")).filter((stamp) => stamp.event.kind === "damage" && stamp.event.name === "magic").map((stamp) => stamp.at);
    expect(magic).toEqual([2, 6, 10, 14, 18]);
  });

  it("channels the Dagon'hai elements and walks the cauldron", () => {
    const rows = names("dagonhai", 37);
    expect(rows.filter((row) => row.name === "channel").map((row) => row.text)).toEqual(["I'll feed the flames!", "I'll strengthen the bond!"]);
    expect(rows.filter((row) => row.name === "cauldron").map((row) => row.at)).toEqual([23, 25, 27, 29, 31, 33]);
    const spots = project("dagonhai", options, 34, hold("dagonhai")).flatMap((stamp) => (stamp.event.kind === "mark" && stamp.event.text === "cauldron" ? stamp.event.tiles.map((at) => ({ x: at.x, y: at.y })) : []));
    expect(spots).toEqual(DAGON_TRAIL.map((at) => ({ x: at.x, y: at.y })));
    const second = names("dagonhai", 73).filter((row) => row.name === "cauldron").map((row) => row.at);
    expect(second[0]).toBe(23);
    expect(second.at(-1)).toBe(73);
  });

  it("sends seven corner cracks two ticks apart, then the walk", () => {
    const rows = names("ocellus-p1", 20);
    expect(rows.filter((row) => row.name === "tendril").map((row) => row.at)).toEqual([0, 2, 4, 6, 8, 10, 12]);
    expect(rows.filter((row) => row.name === "14809").map((row) => row.at)).toEqual([0, 8, 16]);
    expect(rows.filter((row) => row.name === "14811").map((row) => row.at)).toEqual([4, 12, 20]);
    expect(rows.find((row) => row.name === "slam")?.at).toBe(17);
    const walked = project("ocellus-p1", options, 28, hold("ocellus-p1"));
    const volley = walked.find((stamp) => stamp.event.kind === "attack" && (stamp.event.name === "4229" || stamp.event.name === "4232"));
    const landed = walked.find((stamp) => stamp.event.kind === "damage" && stamp.event.name === "volley");
    expect(volley?.at).toBe(21);
    expect(landed?.at).toBe(23);
    const opened = walked.find((stamp) => stamp.event.kind === "mark" && stamp.event.text === "tendril");
    if (!opened || opened.event.kind !== "mark") throw new Error("the first crack did not open");
    expect(opened.at).toBe(0);
    expect(opened.event.tiles).toEqual(cornerCrack(0, 0));
    expect(opened.event.tiles).toHaveLength(8);
  });

  it("lights phase 2 at the logged round ticks and releases at 46, 88 and 124", () => {
    const rows = project("ocellus-p2", options, 131, hold("ocellus-p2"));
    const volleys = rows.filter((stamp) => stamp.event.kind === "attack" && stamp.event.name === "volley").map((stamp) => stamp.at);
    expect(volleys.slice(0, 3)).toEqual([11, 16, 21]);
    expect(volleys.filter((at) => at === 53 || at === 95)).toEqual([53, 95]);
    expect(rows.filter((stamp) => stamp.event.kind === "phase" && stamp.event.name === "portals").map((stamp) => stamp.at)).toEqual([2]);
    const risen = rows.find((stamp) => stamp.event.kind === "portals" && stamp.at === 2);
    const lit = rows.find((stamp) => stamp.event.kind === "portals" && stamp.at === 11);
    if (!risen || risen.event.kind !== "portals" || !lit || lit.event.kind !== "portals" || lit.event.look !== "lit") throw new Error("the portal grid did not light");
    expect(risen.event).toEqual({ kind: "portals", look: "idle" });
    expect(lit.event).toEqual({ kind: "portals", look: "lit", quadrant: "NW", nsGap: 2, ewGap: 2 });
    expect(rows.filter((stamp) => stamp.event.kind === "phase" && stamp.event.name === "blade-open").map((stamp) => stamp.at)).toEqual([7]);
    expect(rows.filter((stamp) => stamp.event.kind === "bank-halve").map((stamp) => stamp.at)).toEqual([46, 88, 124]);
    expect(rows.some((stamp) => stamp.event.kind === "chat" && stamp.at === 123)).toBe(true);
    expect(rows.some((stamp) => stamp.event.kind === "phase" && stamp.event.name === "complete" && stamp.at === 131)).toBe(true);
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
