# Mechanics status

Every number in `src/content/archive/timings.ts` is labelled unverified there. This note records the grade. Where a tick was measured, the room uses that tick. The strategy text supplies the behaviour around it.

Sources: the OSRS Wiki strategies page and the Ocellus page as of 25 Oct 2026, and the measured ledger in the research notes. A value with no measured tick is a practice stand-in and is named below.

## 3D look

No map id is recorded for these rooms. The 3D view draws the coloured checkerboard as the arena floor, and the room says so.

The bosses and adds use the monster ids in `timings.ts`: Bork 16640, the Smorks 16641, Ezekiel 16652, the Archive Guardian 16659 while the shield holds and 16660 once grounded, Moia 16667, undead binders 16670, Xarth 16684, the Dagon'hai trio 16643, Ocellus phase 1 16674, the Blade 16676, Ocellus phase 3 16677 (the same monster the phase 4 view already uses), the void rift 16678, the void siphon 16679, and the void augmenter 16680. The siphon and augmenter ids are the wiki monster ids on [Void Siphon](https://oldschool.runescape.wiki/w/Void_Siphon) and [Void Augmenter](https://oldschool.runescape.wiki/w/Void_Augmenter) (25 Oct 2026). The vine id 16681 stays in the ledger. The room shows vines as tiles, not as a spawned monster.

Flying shots are coloured spheres. No projectile graphic id is recorded, and the room says so. Tile hazards keep the colours they already use in 2D.

The four censers are scenery, not monsters. [Bandosian Censer](https://oldschool.runescape.wiki/w/Bandosian_Censer) is object 62693, and the other three are objects 62695, 62697 and 62699. This view has no scenery-model reference, so the censers are coloured boxes, and the room says so. Dreadnoth (16665) is still not a room.

## Ocellus

Demonbane weapons deal 20% less. The wiki states this for Ocellus and for Xarth. The practice scythe is not a demonbane weapon, so the room only says so.

### Phase 1

He walks each corner with Protect from Melee and fires magic and ranged projectiles. At the corner: seven tendrils, then a two-tile slam. Standing on a tendril blocks it. The last one heals you. A missed tendril charges him and heals him.

At 66% and at 25% he teleports to the centre, sends two tendrils clockwise four times, slams after each pair, then shouts. "Death... awaits..." is one projectile of 18. "Embrace... annihilation..." is one projectile of 18 for each step of the measured meter, so a full meter is the wiki's 80+ total. Vines appear around him after each set. A scorching bow can root him in the live fight; this room has no scorching bow.

The slam is 35, the wiki's cap (**Likely** as a cap; **Disputed** against the ledger's 25–40 on the same blast). The corner-to-corner walk is 10 ticks, the meter step is 16, the heal after the last tendril is 10, and a missed tendril heals him 125. Those four counts are **unsourced practice stand-ins**, and the room says so when it loads. The chat names them.

### Phase 2

Orange and purple portals. The safe tile is where the two orange arms cross. Six volleys, five ticks apart, the hit four ticks later. The first volley is tick 11. Three fixed patterns, in an order taken from the seed. The purple pools and the orange pad follow the sixth volley. Stepping on the pad carries you to the next quadrant. Staying behind takes 50, an **unsourced practice stand-in** for a heavy hit, and the room says so. The quadrant lasts 130 ticks, one of the measured lengths 79, 130 and 131 (**Disputed** which length; 130 is a measured value). The Blade passes on half the damage it has stored, at ticks 46, 88 and 124. Two floors instead of three, a beam cap of 50 instead of 27, and a 2,500 hitpoint Blade are settings. The default is the better-evidenced one: three floors, cap 27, 1,000 hitpoints.

### Phase 3

You are the only player, so you are the tank. The pattern is the trainer's measured auto, auto, wave, auto, auto, wave, which sums to 20 ticks. After that cycle the charged blade spins. The first quadrant has one saw, the next two, the last three. Leaving Protect from Melee on between saws injures you.

Insolence is three waves that leave a field. Untether: step under him and leave on the final glow. This room uses four glows, the measured count. The strategy paste says the border glows twice. That count is still disputed.

Obliteration kills you 13 ticks after the shout if you are still in the quadrant, and the three rock hops fall at the jump tick, 17. A void vine roots a solo and they cannot cut it; it hits for 50 after 12 ticks, inside the 10–12 tick window.

Each quadrant spawns a different void: a rift, then a siphon, then an augmenter. Killing the rift resets your attack. Killing the siphon heals 22 (**Verified**, strategies page). Killing the augmenter sets Attack and Strength to 116 and Magic and Ranged to 112 when those stats started at 99 (**Verified**, [Void Augmenter](https://oldschool.runescape.wiki/w/Void_Augmenter), 25 Oct 2026). The same page lists 44 hitpoints, which is the add's hitpoints here. Another base is left unchanged, because the page gives no scale for it. If a void lives 18 ticks it bursts. The 18 is an **unsourced practice stand-in** inside the 15–20 tick charge, and the room says so. The vine's 12 ticks are an **unsourced practice stand-in** inside 10–12, and the room says so. You are the tank, so the void pools that spawn under everyone else do not spawn under you. The censers are clickable by attacking them. Saradomin heals 50 and restores 50 prayer, as the wiki says (**Verified** as the wiki figure; **Disputed** against captures of 28–40, which the chat also names). Bandos and Armadyl call the next hit a max hit.

### Phase 4

The existing phase 4 fight is unchanged. The airborne half is Deflect Melee. The grounded half is Deflect Range. The loop is 60 ticks, the halves are 30, and the deflect windows are 21 and 19 ticks. "End..." is four ticks before the loop the ledger measured. The trainer's own cycle, counted from 1, is the one the fight still plays.

A perfect dodge halves the weapon cooldown, rounded down. Settings can switch that to cooldown minus 3. Both cut a 5-tick weapon to 2 and a 6-tick weapon to 3. A 4-tick weapon becomes 2 or 1. The strategy paste still marks "minus 3" as unconfirmed, so halved is the default. Void rifts spawn on later rises, not the first. The lifeforce hit is half your current hitpoints, rounded down.

## The other rooms

Bork drums every 7, 6, 5, then 4 ticks as the Smorks fall, and the angry chain is measured off the bomb tell. The bomb every 33 ticks is an **unsourced practice stand-in** inside the measured 33–88 range, and the room says so. Smorks defence defaults to 220, with 150 in settings. If the Smorks die while Bork lives, the room wipes you.

Ezekiel's melee is every 5 ticks and the special is every 36. The sword stuns for 8 ticks, or heals 91 if settings say the sword does not cross him. Unprayed melee of 28 is an **unsourced practice stand-in** (no single measured maximum), and the room says so. The enrage pit defaults to 33%, with 23% in settings. The safe shapes cycle three ways.

The Archive Guardian flies until the shield breaks, lands 3 ticks later, and stays grounded 35 ticks. Vines start at landing + 5 and repeat every 3 until 6 ticks before takeoff. The enrage beams default to 33% and a 10-tick travel, with 30% and 12 ticks in settings. Mushrooms every 25 ticks are an **unsourced practice stand-in** inside 20–30, and the room says so. Within one tile a mushroom deals 10 (**Verified**, strategies page, 25 Oct 2026). Two tiles away it deals 4, the top of the published 3–4 (**Likely**).

Moia attacks every 5 ticks and relocates every 25 after the first at tick 20. She vanishes under 33% for 12 ticks, an **unsourced practice stand-in** inside 10–14, and the room says so. Reappearing heals 0, an **unsourced practice stand-in** inside 0–5%, and the reappear line says so. Each living binder detonates for 25, an **unsourced** point inside the strategies page's roughly 20–30, and the room says so. Eight binders at the start, six per chant. Her hitpoints default to 1,900, with 785 in settings. The strategies page estimates the first chant at 40 ticks and then 5 ticks shorter each time. This room keeps 41, 39, 37, 35 (**Disputed** against that estimate).

Xarth fires five magic autos, then the pillar tell, then the blast. The safe tiles are the three pillar shadows, in order. After the third blast he uses ranged.

The Dagon'hai trio channels fire, earth, water, then air. Standing on the matching pad during the 5-tick window stuns them. The cauldron steps every 2 ticks, six steps, then waits out a 50-tick cycle. The book every 36 ticks is one fight's gap, kept as an **unsourced practice stand-in**, and the room says so. Standing on the cauldron trail blocks it.

Xarth's counts in this file are the measured auto, tell and blast timings. The room has no unsourced practice stand-in to name.

## Dreadnoth the Jellied

Dreadnoth is a Fractured Archive boss. He is the east-path third boss, the alternative to Moia. Bork and the Smorks, Dreadnoth, and Xarth are on the east side; Ezekiel, Moia and the Dagon'hai trio are on the west. The quartermaster arrives after the third boss. Sources read on 25 Oct 2026: [Dreadnoth the Jellied](https://oldschool.runescape.wiki/w/Dreadnoth_the_Jellied), [The Fractured Archive/Strategies](https://oldschool.runescape.wiki/w/The_Fractured_Archive/Strategies), and the defence-cap note in [The Fractured Archive - Out Today](https://oldschool.runescape.wiki/w/Update:The_Fractured_Archive_-_Out_Today).

He is not a room in this trainer. The pages describe the fight and leave the tick script unspecified, so the counts below are not invented.

**Verified**

- Third boss, chosen instead of Moia. East side of the archive.
- NPC 16665, combat level 888, size 5×5, demon. Attack speed 4 ticks (2.4 seconds). Attack style melee and ranged. Max hit is blank on the page.
- Hitpoints by team size: 1 and 2 are 2,100, 3 is 3,050, 4 is 3,930, 5 is 4,810, 6 is 5,690, 8 is 7,460. The cell for team size 7 is empty.
- Defence 125. The defence-reduction table takes him to 0, and the update post lists him among the bosses with no defence cap.
- Demonbane resistance 75%. Fire spells 85% susceptibility. Freeze resistance 40%. Poison 100% resistance. Cannons immune. Thralls and burn are not immune. Venom is blank.
- He moves about one tile every two ticks and his melee hits players around him.
- At 85%, 65% and 45% of his hitpoints he does an arena-wide slam, then three ranged attacks. Each sequential slam adds a hit, up to three slams, with three ranged attacks between them. The slams also spawn jellies. The jellies attack with melee and drain prayer even when the hit is blocked.
- At 25% he says "glub glub" and jumps toward a player. Missing Protect from Melee deals damage wherever you stand. The slam heals him if it lands on a jelly, because he absorbs it.
- On death he explodes into jellies, and killing those jellies ends the encounter. The Scorching bow special can root him.

**Likely**

- "Around one tile every two ticks" is the movement line, not a measured path.
- "Roughly ten" jellies spawn when he dies.
- A failed slam heals him about 30–40.
- Jelly left on a tile deals 6–8 damage per tick. The strategies page also calls these tiles jelly, and an older copy of the same section called them blood.

**Disputed**

- Whether 85%, 65% and 45% are one slam, then two, then three, or one repeating special that escalates. The sentence supports both readings.
- The heal when he absorbs a jelly has no separate amount from the 30–40 missed-slam heal.

**Unspecified, so this trainer does not play him**

- Ticks from the hitpoint threshold to the slam, ticks between the three ranged attacks, and ticks between the extra slams.
- How many jellies spawn at 85%, 65% and 45%, and each jelly's hitpoints, size, attack speed and prayer drain.
- The melee splash radius in tiles.
- His spawn tile, and the arena's tile map.
- How often the 25% jumps repeat. The page says he begins to jump toward a player and gives no interval.
- How long the Scorching bow root lasts.
- A single puddle damage inside 6–8, and a single missed-slam heal inside 30–40.
- Team size 7 hitpoints, venom immunity, and his max hit.
