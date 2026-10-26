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
    /** Unverified. Render digest 25 Oct 2026: projectile 4440 flies 4.5 ticks. The room shows 5. */
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
    volleyInterval: 5,
    /** Unverified. Render digest 25 Oct 2026: the volley lands about 2 ticks after the attack. The room uses 2. */
    volleyFlight: 2,
    prayed: 12,
    unprayed: 42,
    tendrilCount: 7,
    tendrilGap: 6,
    tendrilGreen: 5,
    tendrilChip: 4,
    /** Unverified. The heal after the last tendril has no measured amount. */
    tendrilHeal: 10,
    /** Unverified. One missed tendril's meter step, so the annihilation formula can run. */
    meterStep: 16,
    /** Unverified. About 5% of the solo hitpoints, from the tendril heal-the-boss note. */
    tendrilBossHeal: 125,
    slamDelay: 3,
    slamReach: 2,
    /** Wiki cap. The ledger saw 25–40 on the same blast. */
    slamDamage: 35,
    centrePairs: 4,
    pairLength: 15,
    lowMeter: 16,
    annihilationLow: 18,
    annihilationDelay: 9,
    /** Unverified. Corner-to-corner walk, not one captured number. */
    walk: 10,
    shieldPercent: [66, 25],
  },
  p2: {
    npcId: 16676,
    defence: 250,
    defenceFloor: 0,
    firstVolley: 11,
    volleys: 6,
    spacing: 5,
    /** Unverified. The orange volley is a ground graphic whose hit is 4 ticks later. Projectile 4269's source was not resolved, so that graphic is not this delay. */
    hitDelay: 4,
    padAfterSixth: 2,
    voidAfterSixth: 3,
    nextAfterPad: 9,
    /** Unverified. The low end of a missed-pad hit described as heavy. */
    padMiss: 50,
    /** Unverified. Measured lengths were 79, 130 and 131. */
    end: 130,
    enoughBeforeEnd: 8,
    bladeOpens: 7,
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
    spinAt: 20,
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
      return `Corner walks are ${ARCHIVE.p1.walk} ticks, the meter step is ${ARCHIVE.p1.meterStep}, a blocked tendril heals ${ARCHIVE.p1.tendrilHeal}, and a miss heals him ${ARCHIVE.p1.tendrilBossHeal}. Those four counts are unsourced practice stand-ins. The slam deals ${ARCHIVE.p1.slamDamage}, the published cap; captures saw 25–40.`;
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
