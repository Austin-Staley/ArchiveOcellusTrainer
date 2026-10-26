import type { RaidId } from "./catalog";

/**
 * Every raid timing and count. Each value is unverified in this file.
 * docs/MECHANICS-STATUS.md records the ledger grade. Where the ledger measured
 * a tick, that tick is the one below. The strategy text supplies the behaviour.
 *
 * Wiki: https://oldschool.runescape.wiki/w/The_Fractured_Archive/Strategies (25 Oct 2026)
 * and https://oldschool.runescape.wiki/w/Ocellus (25 Oct 2026).
 * The 25 Oct 2026 render digest supplies the flight ticks and animation ids the rooms play.
 */

/** Ocellus reduces demonbane weapon damage by this share. Unverified. Wiki strategies, 25 Oct 2026. */
export const DEMONBANE_RESISTANCE = 0.2;

export const ARCHIVE = {
  bork: {
    npcId: 16640,
    hp: 1500,
    defence: 300,
    defenceFloor: 180,
    smorkNpcId: 16641,
    smorkHp: 600,
    smorkSize: 3,
    /** Unverified. Wiki drum callouts; ledger gaps 7/6/5/4. */
    tempo: { full: 7, threeQuarter: 6, half: 5, low: 4 },
    /** Unverified. Practice stand-in for the measured 33–88 tick bomb range. */
    bombInterval: 33,
    /** Unverified. The old whole-tick stand-in. The drawn graphic waits 1 tick and flies 4.5. No hitsplat used this number. */
    bombFlight: 5,
    prayed: 10,
    unprayed: 33,
    angryHit: 51,
    chain: { oof: 5, veryAngry: 19, stomp: 21, hit: 22, after: 27, resume: 38 },
  },
  ezekiel: {
    npcId: 16652,
    hp: 3000,
    defence: 130,
    defenceFloor: 78,
    meleeInterval: 5,
    /** Unverified. The prayed cap is 10; the unprayed swing has no single measured max in this file. */
    unprayed: 28,
    specialInterval: 36,
    firstSpecial: 10,
    lightning: { first: 3, second: 5, damage: 34 },
    meleeAfterSpecial: [7, 12, 26, 31],
    stunAt: 14,
    /** Unverified. Render digest 25 Oct 2026: the stun animation ends 8 ticks after it starts. */
    stunRecover: 8,
    /** Unverified. The enrage NPC animation. Spotanim 4175 and tile graphics 4196–4198 are not this animation. */
    waveAnim: 14694,
    healAt: 16,
    healAmount: 91,
    waveInterval: 11,
    waveDamage: 36,
    prayed: 10,
  },
  guardian: {
    flyingNpcId: 16659,
    groundedNpcId: 16660,
    /** The live battery. The inert handler 16661 and the destroyed form 16663 share its corners and are not spawned. */
    batteryNpcId: 16662,
    batterySize: 2,
    shield: 550,
    hp: 1100,
    defence: 260,
    defenceFloor: 156,
    autoInterval: 5,
    /** Unverified. The ranged graphic starts 2 ticks into the attack and flies about 2.3, landing with this 4-tick hit. */
    autoFlight: 4,
    landDelay: 3,
    /** Unverified. Render digest cross-check 25 Oct 2026: the first grounding is 35, then 41, then 47, and later stays hold 47. */
    groundedStays: [35, 41, 47],
    takeoff: 3,
    autoAfterTakeoff: 4,
    vineFirst: 5,
    vineInterval: 3,
    vineBeforeTakeoff: 6,
    landingDamage: 28,
    landingReach: 2,
    swipe: { tell: [2, 5, 8], hit: [3, 6, 9], prayed: 11, unprayed: 19 },
    ranged: { prayed: 10, unprayed: 30 },
    beamInterval: 20,
    beamAligned: 13,
    beamPrayed: 16,
    beamUnprayed: 100,
    /** Unverified. Unsourced practice stand-in inside the 20–30 tick mushroom range. */
    mushroomInterval: 25,
    mushroomArm: 3,
    /** Wiki strategies, 25 Oct 2026: within one tile the mushroom deals 10. */
    mushroomClose: 10,
    /** Wiki strategies, 25 Oct 2026: two tiles away deals 3–4. The room uses the top of that range. */
    mushroomEdge: 4,
  },
  moia: {
    npcId: 16667,
    defence: 195,
    defenceFloor: 117,
    autoInterval: 5,
    relocateFirst: 20,
    relocateInterval: 25,
    /** Unverified. Three fights in the 25 Oct 2026 digest: the ranged hit is the same tick as the attack. Low confidence. */
    rangedFlight: 0,
    /** Unverified. Those same three fights: the relocate hit is 4 ticks after the teleport. Low confidence. */
    magicFlight: 4,
    ranged: { prayed: 1, unprayed: 32 },
    magic: { prayed: 0, unprayed: 39 },
    binderNpcId: 16670,
    binderHp: 95,
    bindersAtStart: 8,
    bindersPerChant: 6,
    binderHop: 15,
    binderReach: 2,
    /** Unverified. Render digest 25 Oct 2026: binders attack every 5 ticks. */
    binderAttack: 5,
    binderDamage: 20,
    enragePercent: 33,
    /** Unverified. Practice stand-in inside the 10–14 tick vanish. */
    vanish: 12,
    chantLead: 6,
    chantGaps: [41, 39, 37, 35],
    /** Unverified. Unsourced point inside the wiki's roughly 20–30 per living binder. */
    detonationEach: 25,
    markLead: 5,
  },
  xarth: {
    npcId: 16684,
    hp: 2600,
    defence: 170,
    defenceFloor: 102,
    autoInterval: 4,
    /** Unverified. Render digest 25 Oct 2026: magic and ranged land 2 ticks after the attack. */
    autoFlight: 2,
    autosBeforeBlast: 5,
    tellAfterAuto: 4,
    blastAfterTell: 3,
    tellInterval: 31,
    blastsBeforePhase: 3,
    exposed: 45,
    phaseTwoLead: 4,
    ranged: { prayed: 0, unprayed: 35 },
    magic: { prayed: 12, unprayed: 45 },
  },
  dagonhai: {
    npcId: 16643,
    shield: 640,
    defence: 100,
    defenceFloor: 0,
    autoInterval: 5,
    /** Unverified. One fight measured flights of 3 and 1. The room keeps 5 so the graphic and the hit land together. Low confidence. */
    autoFlight: 5,
    chip: { prayed: 14, unprayed: 35 },
    channelFirst: 19,
    channelInterval: 18,
    interruptWindow: 5,
    stun: 11,
    cauldronFirst: 23,
    cauldronStep: 2,
    cauldronSteps: 6,
    cycle: 50,
    /** Unverified. One fight's book-throw gap. */
    bookInterval: 36,
    bookFirst: 31,
    bookTell: 4,
    bookFlight: 4,
    bookDamage: 26,
  },
  p1: {
    npcId: 16674,
    /** Present on one tile in every phase 1 capture. No attack animation was recorded. */
    hoodedNpcId: 16672,
    hoodedSize: 3,
    hp: 2500,
    defence: 215,
    defenceFloor: 129,
    bossSize: 3,
    volleyInterval: 5,
    /**
     * Logs L1, L2, L3, L6 to L8. A volley lands 3 ticks later within 4 of his 3×3, and 4 ticks later beyond that.
     * The digest's flight mode of about 2 counts the graphic, not this landing.
     */
    volleyNearWithin: 4,
    volleyFlightNear: 3,
    volleyFlightFar: 4,
    /** 14 switches in 65 captured volleys. The first element is an even roll. */
    switchChance: 14 / 65,
    /**
     * Disputed. The room used to deal 12 through the matching prayer and 42 without.
     * Fight logs L1, L2 and L6 to L8: 246 of 246 matching prayers dealt 0, and 18 misses were 0 to 27.
     * The room prays to 0 and rolls the rest from volleyMin to volleyMax.
     */
    volleyMin: 0,
    volleyMax: 27,
    tendrilCount: 7,
    /**
     * Disputed with the digest. Animation 14809 and 14811 repeat most often every 8 ticks (174 and 168 gaps, 32 files).
     * Fight logs L6 to L8: 85 of 85 corner cracks open on the charge tick and every 2 ticks after. The cracks use 2.
     */
    tendrilGap: 2,
    /** Logs L6 to L8: 85 of 85 corner cracks are 8 tiles. The captures' 9 is one longer. */
    tendrilLength: 8,
    /** Logs L6 to L8: each crack closes 5 ticks after it opens. */
    tendrilGreen: 5,
    /** Logs L6 to L8: 330 blocks of 3 to 5, refunded on the first tick the player stands on no open crack. */
    blockMin: 3,
    blockMax: 5,
    /** A missed crack charges the bar by 2 of 96. Captures, phase 1 meter. */
    meterStep: 2,
    meterMax: 96,
    /**
     * Disputed. The room used to heal 125, about 5% of 2,500. The captures heal 2 for a crack nobody stands on.
     */
    tendrilBossHeal: 2,
    /** One of three lines at C + 15 in 31 of 34 corners. Which line is a seeded pick. */
    tauntAt: 15,
    /** Logs L1 to L8: the explode pose and spotanim 4261 at C + 18 in 31 of 33 corners. */
    explodeAt: 18,
    /** Logs L6 to L8: floor spotanims 4262 to 4265 one tick after the explode pose, at C + 19 and B + 7. */
    blastAfter: 1,
    /** Within 2 of his 3×3. 37 tiles at a captured corner and 40 in the middle. */
    blastRadius: 2,
    /**
     * Disputed. Twelve logged hits are 26 to 34. The wiki cap is 35. The captures give 28 to 30.
     * The room rolls the logged range.
     */
    blastMin: 26,
    blastMax: 34,
    /** The corner stage lasts this many ticks: the next walk's first volley is at C + 21, so the corner is offsets 0 to 20. */
    cornerLength: 21,
    /** On a volley tick that is also his arrival, he charges this many ticks later. 6 after 19 such poses. */
    chargeAfterArrival: 6,
    /** A walk that arrives between volleys plays the end pose for this many ticks, then the corner starts. */
    walkEndPose: 1,
    /** The opening line, then the first walk at A + 4. Six fights logged from the shout. */
    arrive: 4,
    /** Hidden after the teleport out, standing in the middle at M + 4. 15 of 15. */
    teleportIn: 4,
    beatsFirst: 8,
    beatsEvery: 8,
    beatsCount: 4,
    beatExplode: 6,
    /** The two cracks of a beat close 4 and 6 ticks after it opens. */
    beatCloseFirst: 4,
    beatCloseSecond: 6,
    /** The strike is told 2 ticks after the last explode, cast 2 later, and lands 1 after the cast. */
    strikeToldAfter: 2,
    strikeCastAfter: 2,
    strikeFlight: 1,
    strikeMin: 17,
    strikeMax: 19,
    /** One extra shot per 24 of the bar. The captures' engine; the logs never show the second shot. */
    meterPerExtra: 24,
    /** The next walk starts 9 ticks after the strike is told, M + 49, in 11 of 11. */
    walkAfterTold: 9,
    /** The red outline appears this many ticks before a blast and stays until that blast. */
    outlineLead: 5,
    /** The stand countdown draws 4, then 3, then 2, then 1, each one tick, and the 4 is this many ticks before he should start moving. */
    countdownLead: 4,
    /** A running player covers two tiles a tick. A walking player covers one. Control-click walks. */
    runTiles: 2,
    walkTiles: 1,
    shieldPercent: [66, 25],
  },
  p2: {
    npcId: 16676,
    /** The sword form. Fight logs place it in the middle; the digest recorded no template tile, so the room does not spawn it. */
    formNpcId: 16675,
    defence: 250,
    defenceFloor: 0,
    /** Fight logs: the 24 portals stand 2 ticks in. The room draws them on that tick. */
    portalsRise: 2,
    firstVolley: 11,
    volleys: 6,
    spacing: 5,
    /** Unverified. A lit bolt is over a near tile on the firing tick. The room's shot lasts this many ticks. */
    hitDelay: 4,
    padAfterSixth: 2,
    voidAfterSixth: 3,
    /**
     * Disputed. 9 made the later rounds start at 47 and 83.
     * Fight logs: rounds light at 11, 53 and 95, so the gap after a pad is 15.
     */
    nextAfterPad: 15,
    /** Unverified. The low end of a missed-pad hit described as heavy. */
    padMiss: 50,
    /**
     * Disputed. One note listed 79, 130 and 131.
     * Fight logs: phase 3 starts 131 ticks after phase 2 in all five logged phase 2s.
     */
    end: 131,
    enoughBeforeEnd: 8,
    bladeOpens: 7,
    /** Fight logs: spotanim 4304 on the middle every 3 ticks from early in the phase until "This... is enough...". */
    repairFirst: 1,
    repairEvery: 3,
    /** Fight logs L1 to L8: typeless 18 to 27, under prayer or not. The beam-cap setting can raise the top. */
    volleyMin: 18,
    volleyMax: 27,
    banks: [46, 88, 124],
    quadrants: ["NW", "NE", "SE", "SW"],
  },
  p3: {
    npcId: 16677,
    /** Same monster as the phase 4 void rift. https://oldschool.runescape.wiki/w/Void_rift (25 Oct 2026). */
    riftNpcId: 16678,
    /** https://oldschool.runescape.wiki/w/Void_Siphon (25 Oct 2026). */
    siphonNpcId: 16679,
    /** https://oldschool.runescape.wiki/w/Void_Augmenter (25 Oct 2026). */
    augmenterNpcId: 16680,
    hp: 5250,
    defence: 250,
    defenceFloor: 150,
    collapseDelay: 13,
    /** Unverified. The jump tick on the obliteration line; stones fall with it. */
    stoneFall: 17,
    collapseDamage: 99,
    thresholds: [75, 50, 25],
    order: ["NW", "SW", "SE", "NE"],
    /**
     * The encounter room's previous 20-tick pattern: swing, swing, wave, twice.
     * Disputed. The phase 3 drill follows the logged chain (swings at 4 and 7, shadow slash at 10). Upstream #88.
     */
    autos: [
      { attack: "melee", next: 3 },
      { attack: "melee", next: 4 },
      { attack: "wave", next: 3 },
      { attack: "melee", next: 3 },
      { attack: "melee", next: 4 },
      { attack: "wave", next: 3 },
    ] as const,
    /**
     * Typeless 20, dealt on the swing tick when he cannot reach.
     * Disputed. Animation 14851 is the drill's panic shot: magic, landing 2 ticks after the cast.
     * The dossier's range is 12–33. The drill uses the wiki's 20–26. The 182 segments timed graphic 4297 at flight 0.5 with the splat on the cast tick.
     */
    voidShot: 20,
    spinAt: 20,
    /** Unverified. Render digest 25 Oct 2026, 31 phase 3 files: animation 14869 lasts 5 ticks and carries graphic 4325 on all 192 spins. */
    spinGraphicTicks: 5,
    spinWave: [4, 7, 10],
    spinPrayed: 8,
    spinUnprayed: 42,
    insolenceAt: 40,
    insolenceGap: 4,
    insolenceWaves: 3,
    insolenceDamage: 45,
    fieldDamage: 6,
    untetherAt: 60,
    untetherWaves: [10, 14, 18, 22],
    glowFirst: 24,
    glows: 4,
    eruption: 28,
    eruptionDamage: 40,
    magicPrayed: 10,
    magicUnprayed: 40,
    vineAt: 30,
    /** Unverified. Unsourced practice stand-in inside the 10–12 tick vine window. Solo cannot strike their own vine. */
    vineDelay: 12,
    vineDamage: 50,
    vineNpcId: 16681,
    /** Unverified. Unsourced practice stand-in inside the 15–20 tick charge. */
    voidCharge: 18,
    voidBurst: 30,
    siphonHeal: 22,
    /**
     * Killing an augmenter sets these levels when the player started at 99.
     * https://oldschool.runescape.wiki/w/Void_Augmenter (25 Oct 2026).
     * The same page lists 44 hitpoints.
     */
    augmenterAttack: 116,
    augmenterStrength: 116,
    augmenterRanged: 112,
    augmenterMagic: 112,
    augmenterHp: 44,
    censerHeal: 50,
    censerPrayer: 50,
  },
} as const;

/** Spoken once when a room loads. Xarth has no unsourced count, so its notice is empty. */
export function standInNotice(id: RaidId): string {
  switch (id) {
    case "bork":
      return `The bomb every ${ARCHIVE.bork.bombInterval} ticks is an unsourced practice stand-in inside the measured 33–88 tick range.`;
    case "ezekiel":
      return `Unprayed melee of ${ARCHIVE.ezekiel.unprayed} is an unsourced practice stand-in. No single measured maximum is recorded.`;
    case "guardian":
      return `Mushrooms every ${ARCHIVE.guardian.mushroomInterval} ticks are an unsourced practice stand-in inside 20–30. Within one tile a mushroom deals ${ARCHIVE.guardian.mushroomClose}. Two tiles away it deals ${ARCHIVE.guardian.mushroomEdge}, the top of the published 3–4.`;
    case "moia":
      return `The ${ARCHIVE.moia.vanish}-tick vanish is an unsourced practice stand-in inside 10–14. Each living binder detonates for ${ARCHIVE.moia.detonationEach}, an unsourced point inside the published roughly 20–30.`;
    case "xarth":
      return "";
    case "dagonhai":
      return `The book every ${ARCHIVE.dagonhai.bookInterval} ticks is one fight's gap, kept as an unsourced practice stand-in.`;
    case "ocellus-p1":
      return `The west corners in the captures sit on column -1, outside this room, so he charges on the last tile of that path still inside it. A missed crack heals him ${ARCHIVE.p1.tendrilBossHeal}. The blast rolls ${ARCHIVE.p1.blastMin} to ${ARCHIVE.p1.blastMax}.`;
    case "ocellus-p2":
      return `Missing the orange pad deals ${ARCHIVE.p2.padMiss}, an unsourced practice stand-in for a heavy hit.`;
    case "ocellus-p3":
      return `The vine hits after ${ARCHIVE.p3.vineDelay} ticks, an unsourced practice stand-in inside 10–12. A void that lives ${ARCHIVE.p3.voidCharge} ticks bursts; that charge is an unsourced practice stand-in inside 15–20.`;
    default: {
      const unhandled: never = id;
      return unhandled;
    }
  }
}
