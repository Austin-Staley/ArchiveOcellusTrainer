import { describe, expect, it } from "vitest";
import type { Tick } from "../../../sim/brands";
import { seed, tile } from "../../../sim/brands";
import { defaultOptions, parseRaid } from "../catalog";
import type { RaidId } from "../catalog";
import { portalOpening, project } from "../clock";
import type { RaidInput } from "../clock";
import { blastRing, crackFrom } from "../cracks";
import { DAGON_TRAIL, P1_CENTRE, ROOMS, WAVE_SKIP, beamHits } from "../layout";
import { countdownStart, distanceToBody, tileGap, vinePlace } from "../p1Route";
import { ARCHIVE, DEMONBANE_RESISTANCE, oilChip } from "../timings";

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
    running: true,
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

  it("fires the incendiary cannon on every fourth drum and oils the 3×3 four ticks later", () => {
    const rows = project("bork", options, 28, hold("bork"));
    const napalm = rows.filter((stamp) => stamp.event.kind === "attack" && stamp.event.name === "napalm").map((stamp) => stamp.at);
    expect(napalm).toEqual([0, 28]);
    const oil = rows.find((stamp) => stamp.event.kind === "ground" && stamp.event.role === "oil");
    if (!oil || oil.event.kind !== "ground") throw new Error("the oil did not spawn");
    expect(oil.at).toBe(ARCHIVE.bork.cannon.flight);
    expect(oil.event.graphic).toBe(ARCHIVE.bork.oil.objectId);
    expect(oil.event.ticks).toBe(ARCHIVE.bork.oil.life);
    expect(oil.event.tiles).toHaveLength(9);
    const fire = rows.find((stamp) => stamp.event.kind === "ground" && stamp.event.role === "fire");
    if (!fire || fire.event.kind !== "ground") throw new Error("the fire graphic did not land");
    expect(fire.event.tiles).toEqual(oil.event.tiles);
    const start = ROOMS.bork.player;
    const away = tile(1, 1);
    const stayed = project("bork", options, 4, hold("bork")).find((stamp) => stamp.at === 4 && stamp.event.kind === "damage" && stamp.event.name === "oil");
    if (!stayed || stayed.event.kind !== "damage") throw new Error("standing on the oil did not hit");
    expect(stayed.event.unprotectedAmount).toBe(oilChip(options.seed, 4));
    expect(stayed.event.unprotectedAmount).toBeGreaterThanOrEqual(ARCHIVE.bork.oil.min);
    expect(stayed.event.unprotectedAmount).toBeLessThanOrEqual(ARCHIVE.bork.oil.max);
    const clear = project("bork", options, 4, (at) => {
      const player = at === 0 ? start : tile(start.x + 0, start.y + 3);
      return { ...hold("bork")(at), player, previous: player };
    });
    expect(clear.some((stamp) => stamp.event.kind === "damage" && stamp.event.name === "oil")).toBe(false);
    const stepped = project("bork", options, 203, (at) => {
      const player = at > 0 && at % 28 === 0 ? away : start;
      return { ...hold("bork")(at), player, previous: player };
    });
    expect(stepped.some((stamp) => stamp.at === 202 && stamp.event.kind === "damage" && stamp.event.name === "oil")).toBe(true);
    expect(stepped.some((stamp) => stamp.at === 203 && stamp.event.kind === "damage" && stamp.event.name === "oil" && stamp.event.unprotectedAmount > 0)).toBe(false);
  });

  it("says the tank line 29 ticks after Oof", () => {
    const rows = project("bork", options, 71, hold("bork"));
    const oof = rows.find((stamp) => stamp.event.kind === "attack" && stamp.event.name === "oof");
    const smash = rows.find((stamp) => stamp.event.kind === "chat" && stamp.event.text === "Bork smash you now.");
    if (!oof || !smash) throw new Error("the tank line was not scheduled");
    expect(smash.at - oof.at).toBe(29);
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

  it("opens seven corner cracks two ticks apart from the tile he is standing on, then blasts at C + 19", () => {
    const rows = project("ocellus-p1", options, 80, hold("ocellus-p1"));
    const tendrils = rows.filter((stamp) => stamp.event.kind === "attack" && stamp.event.name === "tendril" && stamp.event.text !== "centre");
    const first = tendrils[0];
    if (first === undefined) throw new Error("the first crack did not open");
    expect(tendrils.slice(0, 7).map((stamp) => stamp.at)).toEqual([0, 2, 4, 6, 8, 10, 12].map((offset) => first.at + offset));
    const opened = rows.find((stamp) => stamp.at === first.at && stamp.event.kind === "mark" && stamp.event.text === "tendril");
    if (!opened || opened.event.kind !== "mark") throw new Error("the first crack was not marked");
    const moves = rows.filter((stamp) => stamp.event.kind === "boss-at" && stamp.at <= first.at);
    const lastMove = moves[moves.length - 1];
    const anchor = lastMove !== undefined && lastMove.event.kind === "boss-at" ? lastMove.event.tile : ROOMS["ocellus-p1"].boss;
    expect(opened.event.tiles).toEqual(crackFrom(anchor, 0));
    expect(opened.event.tiles).toHaveLength(ARCHIVE.p1.tendrilLength);
    const outline = rows.find((stamp) => stamp.event.kind === "mark" && stamp.event.text === "blast-outline");
    const blast = rows.find((stamp) => stamp.event.kind === "mark" && stamp.event.text === "vine");
    if (!outline || outline.event.kind !== "mark" || !blast || blast.event.kind !== "mark") throw new Error("the blast was not marked");
    expect(outline.at).toBe(blast.at - ARCHIVE.p1.outlineLead);
    expect(blast.at).toBe(first.at + ARCHIVE.p1.explodeAt + ARCHIVE.p1.blastAfter);
    expect(outline.event.tiles).toEqual(blast.event.tiles);
    expect(rows.some((stamp) => stamp.at === outline.at - 1 && stamp.event.kind === "mark" && stamp.event.text === "blast-outline")).toBe(false);
  });

  it("starts the stand countdown four ticks before the player has to move", () => {
    expect(countdownStart(19, 0, 2)).toBe(15);
    expect(countdownStart(19, 6, 2)).toBe(12);
    expect(countdownStart(19, 6, 0)).toBe(15);
    const player = ROOMS["ocellus-p1"].player;
    const rows = project("ocellus-p1", options, 80, hold("ocellus-p1"));
    const opened = rows.find((stamp) => stamp.event.kind === "mark" && stamp.event.text === "tendril");
    if (!opened || opened.event.kind !== "mark") throw new Error("the first crack did not open");
    const stand = opened.event.tiles.reduce((best, at) => (tileGap(player, at) < tileGap(player, best) ? at : best), opened.event.tiles[0] ?? player);
    const deadline = opened.at + ARCHIVE.p1.tendrilGreen;
    const start = countdownStart(deadline, tileGap(player, stand), ARCHIVE.p1.runTiles);
    const fours = rows.filter((stamp) => stamp.event.kind === "mark" && stamp.event.text === "stand-4" && stamp.event.tiles.some((at) => at.x === stand.x && at.y === stand.y));
    expect(fours.map((stamp) => stamp.at)).toContain(start);
    expect(fours.map((stamp) => stamp.at)).not.toContain(start - 1);
  });

  it("chips a player on a closing vine, refunds it off the vine, and blasts only inside the radius", () => {
    const scout = project("ocellus-p1", options, 80, hold("ocellus-p1", { player: tile(1, 1), previous: tile(1, 1) }));
    const opened = scout.find((stamp) => stamp.event.kind === "mark" && stamp.event.text === "tendril");
    const blast = scout.find((stamp) => stamp.event.kind === "mark" && stamp.event.text === "vine");
    if (!opened || opened.event.kind !== "mark" || !blast || blast.event.kind !== "mark") throw new Error("the vine cycle did not run");
    const vine = opened.event.tiles;
    const onVine = vine[0] ?? tile(1, 1);
    const moves = scout.filter((stamp) => stamp.event.kind === "boss-at" && stamp.at <= blast.at);
    const lastMove = moves[moves.length - 1];
    const origin = lastMove !== undefined && lastMove.event.kind === "boss-at" ? lastMove.event.tile : ROOMS["ocellus-p1"].boss;
    const beside = vine.flatMap((spot) => [tile(spot.x + 1, spot.y + 0), tile(spot.x - 1, spot.y + 0), tile(spot.x + 0, spot.y + 1), tile(spot.x + 0, spot.y - 1)]).find(
      (at) => at.x >= 0 && at.y >= 0 && at.x < 25 && at.y < 25 && vinePlace(at, vine, origin, ARCHIVE.p1.blastRadius) === "beside-vine",
    );
    if (beside === undefined) throw new Error("no tile sits beside the vine and outside the blast");
    expect(vinePlace(onVine, vine, origin, ARCHIVE.p1.blastRadius)).toBe("on-vine");
    expect(vinePlace(beside, vine, origin, ARCHIVE.p1.blastRadius)).toBe("beside-vine");
    expect(vinePlace(tile(1, 1), vine, origin, ARCHIVE.p1.blastRadius)).toBe("safe");
    const closeAt = opened.at + ARCHIVE.p1.tendrilGreen;
    const blocked = project("ocellus-p1", options, closeAt + 2, (at) => {
      const standing = at === closeAt ? onVine : tile(1, 1);
      return { ...hold("ocellus-p1", { player: standing, previous: standing })(at), player: standing, previous: standing };
    });
    const chip = blocked.find((stamp) => stamp.at === closeAt && stamp.event.kind === "damage" && stamp.event.name === "tendril-chip");
    if (!chip || chip.event.kind !== "damage") throw new Error("standing on the vine did not chip");
    expect(chip.event.unprotectedAmount).toBeGreaterThanOrEqual(ARCHIVE.p1.blockMin);
    expect(chip.event.unprotectedAmount).toBeLessThanOrEqual(ARCHIVE.p1.blockMax);
    const refund = blocked.find((stamp) => stamp.at === closeAt + 1 && stamp.event.kind === "heal-player");
    expect(refund?.event).toMatchObject({ kind: "heal-player", amount: chip.event.unprotectedAmount });
    const missed = project("ocellus-p1", options, closeAt, hold("ocellus-p1", { player: tile(1, 1), previous: tile(1, 1) }));
    expect(missed.some((stamp) => stamp.at === closeAt && stamp.event.kind === "damage" && stamp.event.name === "tendril-chip")).toBe(false);
    expect(missed.find((stamp) => stamp.at === closeAt && stamp.event.kind === "heal-boss")?.event).toMatchObject({ kind: "heal-boss", amount: ARCHIVE.p1.tendrilBossHeal });
    const adjacent = project("ocellus-p1", options, closeAt, hold("ocellus-p1", { player: beside, previous: beside }));
    expect(adjacent.some((stamp) => stamp.at === closeAt && stamp.event.kind === "damage" && stamp.event.name === "tendril-chip")).toBe(false);
    const inside = blast.event.tiles[0] ?? tile(1, 1);
    const outside = tile(1, 1);
    expect(distanceToBody(origin, inside)).toBeGreaterThan(0);
    expect(distanceToBody(origin, inside)).toBeLessThanOrEqual(ARCHIVE.p1.blastRadius);
    expect(blast.event.tiles.some((at) => at.x === outside.x && at.y === outside.y)).toBe(false);
    const blasted = project("ocellus-p1", options, blast.at, hold("ocellus-p1", { player: inside, previous: inside }));
    const boom = blasted.find((stamp) => stamp.at === blast.at && stamp.event.kind === "damage" && stamp.event.name === "blast");
    if (!boom || boom.event.kind !== "damage") throw new Error("standing in the blast did not hit");
    expect(boom.event.unprotectedAmount).toBeGreaterThanOrEqual(ARCHIVE.p1.blastMin);
    expect(boom.event.unprotectedAmount).toBeLessThanOrEqual(ARCHIVE.p1.blastMax);
    const clear = project("ocellus-p1", options, blast.at, hold("ocellus-p1", { player: outside, previous: outside }));
    expect(clear.some((stamp) => stamp.at === blast.at && stamp.event.kind === "damage" && stamp.event.name === "blast")).toBe(false);
    expect(blastRing(P1_CENTRE).every((at) => distanceToBody(P1_CENTRE, at) <= ARCHIVE.p1.blastRadius && distanceToBody(P1_CENTRE, at) > 0)).toBe(true);
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
    expect(lit.event).toEqual({ kind: "portals", look: "lit", quadrant: "NE", colour: "orange", nsGap: 2, ewGap: 2 });
    expect(rows.filter((stamp) => stamp.event.kind === "phase" && stamp.event.name === "blade-open").map((stamp) => stamp.at)).toEqual([7]);
    expect(rows.filter((stamp) => stamp.event.kind === "bank-halve").map((stamp) => stamp.at)).toEqual([46, 88, 124]);
    expect(rows.some((stamp) => stamp.event.kind === "chat" && stamp.at === 123)).toBe(true);
    expect(rows.some((stamp) => stamp.event.kind === "phase" && stamp.event.name === "complete" && stamp.at === 131)).toBe(true);
  });

  it("teleports to the middle at 66% and strikes once when the bar stays under 24", () => {
    const rows = project("ocellus-p1", options, 80, hold("ocellus-p1", { bossHp: 1600 }));
    const arrived = rows.find((stamp) => stamp.event.kind === "boss-at" && stamp.event.tile.x === P1_CENTRE.x && stamp.event.tile.y === P1_CENTRE.y);
    expect(arrived?.at).toBe(ARCHIVE.p1.arrive + ARCHIVE.p1.teleportIn);
    const shout = rows.find((stamp) => stamp.event.kind === "attack" && stamp.event.name === "14810");
    const shots = rows.filter((stamp) => stamp.event.kind === "damage" && stamp.event.name === "strike");
    expect(shout?.event).toMatchObject({ text: "Death... awaits..." });
    expect(shots).toHaveLength(1);
    const hit = shots[0];
    if (!hit || hit.event.kind !== "damage") throw new Error("the strike did not land");
    expect(hit.event.unprotectedAmount).toBeGreaterThanOrEqual(ARCHIVE.p1.strikeMin);
    expect(hit.event.unprotectedAmount).toBeLessThanOrEqual(ARCHIVE.p1.strikeMax);
  });

  it("keeps the orange-on-orange pocket safe and the next purple tile hit", () => {
    expect(beamHits("NW", 2, 2, tile(8, 15))).toBe(false);
    expect(beamHits("NW", 2, 2, tile(10, 15))).toBe(true);
    expect(WAVE_SKIP.NW.outer.x).toBe(6);
  });

  it("seeds the starting quadrant and first colour, then runs orange, red, green clockwise", () => {
    expect(portalOpening(1)).toEqual({
      quadrants: ["NE", "SE", "SW"],
      colours: ["orange", "red", "green"],
    });
    expect(portalOpening(4)).toEqual({
      quadrants: ["NW", "NE", "SE"],
      colours: ["red", "green", "orange"],
    });
    expect(portalOpening(8)).toEqual({
      quadrants: ["NW", "NE", "SE"],
      colours: ["green", "orange", "red"],
    });
    expect(portalOpening(5)).toEqual({
      quadrants: ["NE", "SE", "SW"],
      colours: ["red", "green", "orange"],
    });
    const bare = parseRaid(new URL("http://localhost/?encounter=ocellus-p2"), "ocellus-p2", () => 8);
    const pinned = parseRaid(new URL("http://localhost/?encounter=ocellus-p2&seed=5"), "ocellus-p2", () => 8);
    expect(bare.options.seed).toBe(8);
    expect(portalOpening(bare.options.seed)).toEqual(portalOpening(8));
    expect(pinned.options.seed).toBe(5);
    const rows = project("ocellus-p2", options, 131, hold("ocellus-p2"));
    const lit = rows.flatMap((stamp) => (stamp.event.kind === "portals" && stamp.event.look === "lit" ? [stamp.event] : []));
    expect(lit).toHaveLength(18);
    expect(lit.slice(0, 6).every((event) => event.quadrant === "NE" && event.colour === "orange")).toBe(true);
    expect(lit.slice(6, 12).every((event) => event.quadrant === "SE" && event.colour === "red")).toBe(true);
    expect(lit.slice(12, 18).every((event) => event.quadrant === "SW" && event.colour === "green")).toBe(true);
    const first = rows.find((stamp) => stamp.event.kind === "attack" && stamp.event.name === "volley");
    expect(first?.event).toMatchObject({
      text: "orange · luuj A · reference C in NE, gaps 2 and 2. Next clockwise: red, then green.",
    });
  });

  it("fires six portal volleys from tick 11 and opens the orange pad", () => {
    const rows = project("ocellus-p2", options, 38, hold("ocellus-p2"));
    const volleys = rows.flatMap((stamp) => (stamp.event.kind === "attack" && stamp.event.name === "volley" ? [stamp.at] : []));
    const pad = rows.find((stamp) => stamp.event.kind === "pad");
    expect(volleys).toEqual([11, 16, 21, 26, 31, 36]);
    expect(pad?.at).toBe(38);
    expect(pad?.event).toMatchObject({ kind: "pad", next: { x: 16, y: 8 } });
  });

  it("follows the phase 3 chain and the 13-tick collapse", () => {
    const rows = project("ocellus-p3", options, 33, hold("ocellus-p3"));
    const swung = rows.flatMap((stamp) => (stamp.event.kind === "attack" && (stamp.event.name === "melee" || stamp.event.name === "wave" || stamp.event.name === "spin") ? [stamp.at] : []));
    expect(swung.slice(0, 7)).toEqual([4, 7, 10, 14, 17, 20, 24]);
    const slash = rows.find((stamp) => stamp.at === 11 && stamp.event.kind === "damage" && stamp.event.name === "wave");
    expect(slash?.event).toMatchObject({ protectedAmount: ARCHIVE.p3.slashMax, unprotectedAmount: ARCHIVE.p3.slashMax });
    const opening = rows.find((stamp) => stamp.event.kind === "damage" && stamp.event.name === "spin-open");
    expect(opening?.at).toBe(25);
    expect(opening?.event).toMatchObject({ protectedAmount: 0, unprotectedAmount: ARCHIVE.p3.spinOpenMax });
    const saw = rows.find((stamp) => stamp.event.kind === "attack" && stamp.event.name === "spin-wave");
    expect(saw?.at).toBe(29);
    const sawHit = rows.find((stamp) => stamp.at === 29 && stamp.event.kind === "damage" && stamp.event.name === "spin-wave");
    expect(sawHit?.event).toMatchObject({ protectedAmount: ARCHIVE.p3.sawMax });
    expect(rows.some((stamp) => stamp.at === 0 && stamp.event.kind === "phase" && stamp.event.name.startsWith("void-"))).toBe(false);
    const collapse = names("ocellus-p3", 13, hold("ocellus-p3", { bossHp: 3937 })).find((row) => row.name === "collapse");
    expect(collapse?.at).toBe(0);
    const hit = project("ocellus-p3", options, 13, hold("ocellus-p3", { bossHp: 3937 })).find((stamp) => stamp.event.kind === "damage" && stamp.event.name === "collapse");
    expect(hit?.at).toBe(13);
  });

  it("lands the panic shot two ticks later and leaves the sim's void patch", () => {
    const far = hold("ocellus-p3", { player: tile(0, 0), previous: tile(0, 0), prayer: "magic" });
    const rows = project("ocellus-p3", options, 8, far);
    expect(rows.some((stamp) => stamp.at === 4 && stamp.event.kind === "attack" && stamp.event.name === "void-shot")).toBe(true);
    const landed = rows.find((stamp) => stamp.at === 6 && stamp.event.kind === "damage" && stamp.event.name === "void-shot");
    expect(landed?.event).toMatchObject({ style: "magic", protectedAmount: 0, unprotectedAmount: ARCHIVE.p3.panicMax });
    const patch = rows.find((stamp) => stamp.at === 7 && stamp.event.kind === "damage" && stamp.event.name === "void-patch");
    expect(patch?.event).toMatchObject({ unprotectedAmount: ARCHIVE.p3.patchMax });
  });

  it("slams outside his footprint at U+29 and heals him from a siphon off the line", () => {
    const rows = project("ocellus-p3", options, 90, hold("ocellus-p3"));
    const untether = rows.find((stamp) => stamp.event.kind === "attack" && stamp.event.name === "untether");
    expect(untether?.at).toBe(53);
    const slam = rows.find((stamp) => stamp.event.kind === "damage" && stamp.event.name === "slam");
    expect(slam?.at).toBe(82);
    expect(slam?.event).toMatchObject({ unprotectedAmount: ARCHIVE.p3.slamMax });
    expect(rows.some((stamp) => stamp.event.kind === "damage" && stamp.event.name === "aftershock")).toBe(false);
    const seeded = { ...options, seed: seed(2) };
    const off = hold("ocellus-p3", { player: tile(0, 0), previous: tile(0, 0), bossHp: 3937 });
    const healed = project("ocellus-p3", seeded, 24, off);
    expect(healed.some((stamp) => stamp.at === 0 && stamp.event.kind === "phase" && stamp.event.name.startsWith("void-"))).toBe(false);
    expect(healed.some((stamp) => stamp.at === 20 && stamp.event.kind === "phase" && stamp.event.name === "void-siphon")).toBe(true);
    const heal = healed.find((stamp) => stamp.at === 24 && stamp.event.kind === "heal-boss");
    if (!heal || heal.event.kind !== "heal-boss") throw new Error("the siphon did not heal him");
    expect([ARCHIVE.p3.siphonHealLow, ARCHIVE.p3.siphonHealHigh]).toContain(heal.event.amount);
    const onLine = project("ocellus-p3", seeded, 24, hold("ocellus-p3", { bossHp: 3937 }));
    expect(onLine.some((stamp) => stamp.event.kind === "heal-boss")).toBe(false);
    expect(onLine.some((stamp) => stamp.event.kind === "heal-player")).toBe(false);
  });
});
