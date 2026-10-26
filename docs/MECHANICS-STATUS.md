# Mechanics status

Every number in `src/content/archive/timings.ts` is labelled unverified there. This note records the grade. Where a tick was measured, the room uses that tick. The strategy text supplies the behaviour around it.

Sources: the OSRS Wiki strategies page and the Ocellus page as of 25 Oct 2026, and the measured ledger in the research notes. A value with no measured tick is a practice stand-in and is named below.

## 3D look

The rooms are instanced, with no chunk rotation. The 3D view loads the captured template from cache 2746: the Archive Guardian is region 16471, Ocellus is 16472 on plane 1, Bork is 16727, Xarth is 16726, Moia is 16216, Ezekiel is 16214, and the Dagon'hai trio is 16215. Dreadnoth's region 16728 is data only and is not loaded. The walk grid is unchanged. The map is slid so the captured boss tile sits on the room's boss tile. Ocellus plane 1 sits 6 above the region's base, so the scene is lowered by 6 onto the walk floor. That floor overlay's 3D colour is the sentinel and it has no texture, so the room paints it with the overlay's secondary colour, the colour this cache stores for the map.

The bosses and adds use the monster ids in `timings.ts`: Bork 16640, the Smorks 16641, Ezekiel 16652, the Archive Guardian 16659 while the shield holds and 16660 once grounded, the live Guardian battery 16662, Moia 16667, undead binders 16670, Xarth 16684, the Dagon'hai trio 16643, the Hooded Figure 16672, Ocellus phase 1 16674, the Blade 16676, Ocellus phase 3 16677 (the same monster the phase 4 view already uses), the void rift 16678, the void siphon 16679, and the void augmenter 16680. Stand, walk, attack and the captured death animations come from the 25 Oct 2026 render digest. The Blade's fight actor is monster 16676. It stands still because no animation was captured for that monster. Its model is an uncoloured clickbox. The coloured sword is scenery model 62699. Object 62706 places that model once, at cache local (31, 41), and sequence 14873 hides the second sword in the same mesh. The captures do not spawn a blade in phase 1, so the shared scene leaves 62706 out and only phase 2 draws the sword, on the boss's tile. Sequence 14873 leaves that sword 3.135 tiles above the model origin, and phase 2 lowers the actor by that amount so the sword stands in the centre of the 3x3. The void vine 16681 has no captured animation and stays a tile. Ocellus has no captured death animation, so none plays. Attack-frame sounds that this cache does not store are left out of the pack. A death in any of these rooms restores you so the view keeps drawing, and shows the same You died, Restart and Retry seed flow as phase 4.

Hits use the same three splats as phase 4: damage, a block for zero, and a heal. A max hit uses the damage splat, because that view has no separate max-hit image. Hitsplat type 11, seen on the Dagon'hai cauldron, has no sprite here.

Graphics that the digest names are drawn: the Smorks' bomb 4440 (it waits 1 tick, then flies the captured 4.5); the Guardian's ranged shot 4201, beam graphic 4204 and mushroom graphic 4205; Moia's 4214 and 4213; Xarth's 4034, 4374 and 4378; the trio's 4071 and 1459; phase 1's 4229 and 4232; the phase 2 bolt 4269 and the sword-repair graphic 4304, the phase 3 void shot 4297, and the phase 3 spin 4325. The beam's travel, the book throw, and the phase 1 annihilation travel stay coloured spheres. Projectiles 4056 and 4057 have no captured source and are not drawn. The four censers stay coloured boxes. They are scenery objects 62693, 62695, 62697 and 62699, and this view has no scenery-model reference.

Each room defaults to a ranged or crush set, and Settings can switch it. Ranged is a twisted bow on rapid with Masori (f), Zaryte vambraces, Dizana's quiver, a necklace of rupture, Avernic treads (max), a venator ring and dragon arrows. Crush is a scythe on jab with Inquisitor's helm, hauberk and plateskirt, ferocious gloves, an infernal cape, an amulet of rancour, the same boots, an ultor ring and dragon arrows. Captures of the crush rooms wore an amulet of blood fury. This room wears rancour, because that model is the one already shipped. The twisted bow plays its block animation when a hit lands. The scythe does not invent one.

Moia's section of the digest is 3 fights, the Dagon'hai section is 1 fight, and phase 4 is 8 fights. Roles marked low confidence in those samples are not used to retune a fight that was already measured more carefully. Phase 4's loop is unchanged.

## Ocellus

Demonbane weapons deal 20% less. The wiki states this for Ocellus and for Xarth. The practice scythe is not a demonbane weapon, so the room only says so.

### Phase 1

The Hooded Figure's captured tile is trainer (5, 20), cache template (4126, 5669) plane 1, the only tile in the phase 1 captures. Npc 16672 shares models 62668 and 62669 with Ocellus 16674, so the room draws the combat form only. A missed tendril's 125 heal lands on that one body. Ocellus walks each corner with Protect from Melee and fires magic and ranged projectiles. The volley lands 2 ticks later, the digest's launch-to-hit. The animations are 14806 and 14807. The projectile graphics stay 4229 and 4232. During a corner he also plays 14809 and 14811 on the 8-tick beat that is the mode across the 32 phase 1 files. Other gaps are common, so that beat is the mode. At the corner: seven tendrils, then a two-tile slam. The digest and the ledger also describe a slam at C+18. This room still plays the seven-tendril script, and the chat keeps the unsourced counts that script needs. Standing on a tendril blocks it. The last one heals you. A missed tendril charges him and heals him.

The tendrils are the captured floor cracks: eight tiles, spotanims 4236–4259, on plane 1, opening every 2 ticks and closing after 5. At 66% and at 25% he teleports to the centre, sends two tendrils clockwise four times, slams after each pair, then shouts. "Death... awaits..." is one projectile of 18. "Embrace... annihilation..." is one projectile of 18 for each step of the measured meter, so a full meter is the wiki's 80+ total. The slam paints the floor blast, spotanims 4262–4265, around him. A scorching bow can root him in the live fight; this room has no scorching bow.

The slam is 35, the wiki's cap (**Likely** as a cap; **Disputed** against the ledger's 25–40 on the same blast). The corner-to-corner walk is 10 ticks, the meter step is 16, the heal after the last tendril is 10, and a missed tendril heals him 125. Those four counts are **unsourced practice stand-ins**, and the room says so when it loads. The chat names them.

### Phase 2

Orange and purple portals stand in a grid of 24 from tick 2. Orange is the gap, the colour to stand in. Purple fires, and the hit is typeless. The safe tile is where the two orange arms cross. The lit arms turn with the round, at 11, 53 and 95. The 2D floor paints the same colours. Six volleys, five ticks apart, the hit four ticks later. The volley draws projectile 4269. The fight logs name it as the portal bolt; the digest had not resolved its source. Graphic 4304, 1,262 spawns across 31 fights, plays on the sword every 3 ticks, which is the repair spotanim those logs describe. The room defaults to crush. The captures wore a twisted bow, and Settings can switch to that ranged set. The first volley is tick 11. The three orders are the verified orange → red → green cycle, running clockwise, so the first volley predicts all 18. The seed picks the starting quadrant and the first colour, because those vary and are only Likely. The quadrant is `seed % 4` over NW, NE, SE, SW, and the colour is `floor(seed / 4) % 3` over orange, red, green. A load with no seed draws a new random 32-bit seed. Seed 5 opens red in the north-east. The screen labels the current colour and quadrant. Each volley line shows the colour and both disputed letter names. The safe tile is the marked tile inside the gap, one tile in from the band the dossier drew. The purple pools and the orange pad follow the sixth volley. Stepping on the pad carries you to the next quadrant. Staying behind takes 50, an **unsourced practice stand-in** for a heavy hit, and the room says so. The phase lasts 131 ticks. Lengths of 79, 130 and 131 were all measured (**Disputed**); the five logged phase 2s end at 131. The Blade is scenery model 62699 in that model's cache colours, standing in the centre of its 3x3. He stays on that tile for the whole phase and does not follow the player. It stores damage, and the boss bar drops only when it passes on half, at ticks 46, 88 and 124. Two floors instead of three, a beam cap of 50 instead of 27, and a 2,500 hitpoint Blade are settings. The default is the better-evidenced one: three floors, cap 27, 1,000 hitpoints.

### Phase 3

You are the only player, so you are the tank. This room's pattern is still the measured auto, auto, wave, auto, auto, wave, which sums to 20 ticks. After that cycle the charged blade spins. The first quadrant has one saw, the next two, the last three. Leaving Protect from Melee on between saws injures you. The hidden phase 3 drill, behind `ARCHIVE_P3`, runs quadrant 1 as the fight logs do: swings at 4 and 7, a shadow slash at 10, a magic panic shot when nobody is in reach, then spin, Untether, spin and Insolence. The quadrant falls the tick after his hitpoints reach the floor. That chain and this room disagree on the void shot and on the spin's first hit. Both readings are in the audit, marked **Disputed**.

Insolence is three waves that leave a field. Untether: step under him and leave on the final glow. This room uses four glows, the measured count. The strategy paste says the border glows twice. That count is still disputed.

Obliteration kills you 13 ticks after the shout if you are still in the quadrant, and the three rock hops fall at the jump tick, 17. A void vine roots a solo and they cannot cut it; it hits for 50 after 12 ticks, inside the 10–12 tick window.

Each quadrant spawns a different void: a rift, then a siphon, then an augmenter. Killing the rift resets your attack. Killing the siphon heals 22 (**Verified**, strategies page). Killing the augmenter sets Attack and Strength to 116 and Magic and Ranged to 112 when those stats started at 99 (**Verified**, [Void Augmenter](https://oldschool.runescape.wiki/w/Void_Augmenter), 25 Oct 2026). The same page lists 44 hitpoints, which is the add's hitpoints here. Another base is left unchanged, because the page gives no scale for it. If a void lives 18 ticks it bursts. The 18 is an **unsourced practice stand-in** inside the 15–20 tick charge, and the room says so. The vine's 12 ticks are an **unsourced practice stand-in** inside 10–12, and the room says so. You are the tank, so the void pools that spawn under everyone else do not spawn under you. The censers are clickable by attacking them. Saradomin heals 50 and restores 50 prayer, as the wiki says (**Verified** as the wiki figure; **Disputed** against captures of 28–40, which the chat also names). Bandos and Armadyl call the next hit a max hit.

### Phase 4

The digest's phase 4 section is 8 fights. That sample is too small to retune the shipped loop, so the existing phase 4 fight is unchanged. The airborne half is Deflect Melee. The grounded half is Deflect Range. The loop is 60 ticks, the halves are 30, and the deflect windows are 21 and 19 ticks. "End..." is four ticks before the loop the ledger measured. The trainer's own cycle, counted from 1, is the one the fight still plays.

A perfect dodge halves the weapon cooldown, rounded down. Settings can switch that to cooldown minus 3. Both cut a 5-tick weapon to 2 and a 6-tick weapon to 3. A 4-tick weapon becomes 2 or 1. The strategy paste still marks "minus 3" as unconfirmed, so halved is the default. Void rifts spawn on later rises, not the first. The lifeforce hit is half your current hitpoints, rounded down.

## The other rooms

Bork drums every 7, 6, 5, then 4 ticks as the Smorks fall, and the angry chain is measured off the bomb tell. The Smorks stand on trainer tile (14, 14), cache template (4190, 5598), the only tile in 107 captures. Their bomb plays animation 14555 and graphic 4440. The capture's flight is 4.5 ticks after a 1-tick wait, and the hit tile was not resolved, so the graphic travels toward you. The bomb every 33 ticks is an **unsourced practice stand-in** inside the measured 33–88 range, and the room says so. Projectiles 4056 and 4057 stay undrawn. Smorks defence defaults to 220, with 150 in settings. If the Smorks die while Bork lives, the room wipes you.

Ezekiel's melee is every 5 ticks and the special is every 36. The sword stuns at the special plus 14 and the stun animation ends 8 ticks later, or he heals 91 at the special plus 16 if settings say the sword does not cross him. The enrage animation is 14694. The pit's tile graphics are not played as his animation. The wave still hits 4, 5 and 6 ticks after the tell. Unprayed melee of 28 is an **unsourced practice stand-in** (no single measured maximum), and the room says so. The enrage pit defaults to 33%, with 23% in settings. The safe shapes cycle three ways.

Four live batteries, monster 16662, stand on the four captured corners and are not combat adds. The inert handler 16661 and the destroyed form 16663 are not spawned. The Archive Guardian flies until the shield breaks, lands 3 ticks later, and stays grounded 35 ticks, then 41, then 47. Later stays hold 47. Vines start at landing + 5 and repeat every 3 until 6 ticks before takeoff. The ranged hit stays 4 ticks after the attack, which is when the captured graphic lands. After the first enrage beam the ranged auto stops. The enrage beams default to 33% and a 10-tick travel, with 30% and 12 ticks in settings. Mushrooms every 25 ticks are an **unsourced practice stand-in** inside 20–30, and the room says so. Within one tile a mushroom deals 10 (**Verified**, strategies page, 25 Oct 2026). Two tiles away it deals 4, the top of the published 3–4 (**Likely**).

Moia attacks every 5 ticks and relocates every 25 after the first at tick 20. The digest's three fights put the ranged hit on the attack tick and the relocate hit 4 ticks later. The ranged graphic is drawn for one tick, because the captured flight is under a tick. Those flights are **low confidence** because the sample is three fights, and the room says so. The projectile counts behind 4214 are larger than the role label. Binders attack every 5 ticks. She vanishes under 33% for 12 ticks, an **unsourced practice stand-in** inside 10–14, and the room says so. Reappearing heals 0, an **unsourced practice stand-in** inside 0–5%, and the reappear line says so. Each living binder detonates for 25, an **unsourced** point inside the strategies page's roughly 20–30, and the room says so. Eight binders at the start, six per chant. Her hitpoints default to 1,900, with 785 in settings. The strategies page estimates the first chant at 40 ticks and then 5 ticks shorter each time. This room keeps 41, 39, 37, 35 (**Disputed** against that estimate). The default gear is ranged. One full outfit in the captures was void, which this view does not wear. It wears the Masori ranged set.

Xarth fires five magic autos, then the pillar tell, then the blast. Magic and ranged land 2 ticks after the attack. The safe tiles are the three pillar shadows, in order. After the third blast he uses ranged. The contradicted animation set 14842, 14835 and 4224 is not used.

The Dagon'hai trio channels fire, earth, water, then air. Standing on the matching pad during the 5-tick window stuns them. The cauldron steps every 2 ticks from tick 23, six steps, across the six tiles of the one captured fight, and the next cycle starts at tick 73. That fight did not record an order, so the visit runs west to east. The book every 36 ticks is one fight's gap, kept as an **unsourced practice stand-in**, and the room says so. Standing on the cauldron trail blocks it. The digest has one fight. It measured a ranged flight of 3 and a magic flight of 1. Those are **low confidence**, so the hit stays at 5 ticks and the graphics travel for those same 5, which keeps the splat and the shot together. The room says so. The cauldron move is an NPC step, not an animation. Imps and rifts from that one fight are not added.

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
