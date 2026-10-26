# NPC audit, 26 Oct 2026

Compared with the 25 Oct 2026 render digest and cache 2746 region placement. A trainer tile is the captured template minus the region base, then the room's scene offset: `trainerX = localX + offsetX`, `trainerY = offsetY + 63 - localY`. The digest records a position histogram, not a tile per tick, so a path is a stand-in wherever that histogram has no order.

Boss movement, the walkable tiles and the stationary ticks, is in [Boss movement](#boss-movement). Planes, animation lengths and projectile cycles are in [Visual event sync](#visual-event-sync). Status is `fixed` where this pass changed the sim to a captured value, `matched` where it already agreed, and `stand-in` where the captures do not support a value. `Disputed` means the render digest and the eight fight logs (L1 to L8, upstream #85) disagree, and the room uses the stronger count. No id was invented for a gap. The known gaps stay gaps: animations for 16676 and 16681, the Ocellus death, projectiles 4056 and 4057, and hitsplat 11.

## Bork and the Smorks

Region 16727, plane 0. Offset (-16, -19).

| NPC | field | captured value | sim value before | sim value after | status |
| --- | --- | --- | --- | --- | --- |
| Bork 16640 | spawn / mode tile | mode template (4186, 5600), plane 0; he also walks a wide box | trainer (10, 12), size 4 | trainer (10, 12), size 4 | matched |
| Bork 16640 | model | npc 16640 | npc 16640 | npc 16640 | matched |
| Bork 16640 | movement | histogram only, walk pose 14539 | stands on the mode tile | stands on the mode tile | stand-in |
| Bork 16640 | animations | idle 14540, drum 14542, stun 14545, stomp 14549 / 14550 / 14551, death 14541 | those ids | those ids | matched |
| Bork 16640 | projectiles 4056 / 4057 | source unresolved, flight 3 | not drawn | not drawn | stand-in |
| Smorks 16641 | tile | template (4190, 5598) on all 107 captures, one tile, plane 0 | trainer (6, 7), size 3 | trainer (14, 14), size 3 | fixed |
| Smorks 16641 | room | the 3×3 sits on that tile | width 15, so x 14 was outside the grid | width 17, footprint x 14–16 | fixed |
| Smorks 16641 | model | npc 16641, idle 14553, no walk | npc 16641 | npc 16641 | matched |
| Smorks 16641 | movement | does not move | stands | stands | matched |
| Smorks 16641 | bomb animation | 14555, "Big bomb! Bork watch out!" | 14555 on bomb-tell | 14555 on bomb-tell | matched |
| Smorks 16641 | bomb projectile | 4440 from 16641, flight 4.5, launch-to-hit unresolved, usually anim+1 | not drawn | graphic 4440 from the Smorks' centre, waits 1 tick, flies 4.5 | fixed |
| Smorks 16641 | auto 14554 / projectile 4045 | role low confidence, flight 4 | not drawn | not drawn | stand-in |
| Smorks 16641 | bomb cadence | 33–88 ticks, no single gap | every 33 | every 33 | stand-in |
| Bork handler 16642 | tile | one junk tile, no idle | not spawned | not spawned | stand-in |

The drum ring is centred on the Smorks, so it moves with them to (14, 14). The angry-chain safe rectangle is still the old practice box. That rectangle was not a captured path.

## Archive Guardian

Region 16471, plane 0. Offset (-18, -23).

| NPC | field | captured value | sim value before | sim value after | status |
| --- | --- | --- | --- | --- | --- |
| Archive Guardian 16659 / 16660 | mode tile | template (4125, 5597), plane 0; he also relocates | trainer (11, 11), size 5 | trainer (11, 11), size 5 | matched |
| Archive Guardian | model | 16659 shielded, 16660 grounded, idle 14745 | those ids | those ids | matched |
| Archive Guardian | movement | histogram across the arena, no tick path | stands, then the landing script | stands, then the landing script | stand-in |
| Archive Guardian | ranged | anim 14751 every 5, graphic 4201 at +2, flight about 2.3, hit +4 | anim 14751, graphic 4201, flight 4 from the attack tick | graphic waits 2 ticks then flies 2, hit still +4 | fixed |
| Archive Guardian | beam | anim 14754 every 20, graphic 4204 | anim 14754, graphic 4204, travel is a coloured sphere | same | matched |
| Archive Guardian | mushroom | anim 14753, graphic 4205 | those ids, interval 25 inside 20–30 | same | stand-in |
| Archive Guardian | takeoff / land / death | 14748, 14747, 14749 | those ids; stays 35, then 41, then 47 | same | matched |
| Archive Guardian | melee 14752 | plays when adjacent | no melee action | no melee action | stand-in |
| Battery 16662 | tiles | (4139, 5605), (4139, 5592), (4114, 5605), (4114, 5592), plane 0 | not spawned | trainer (25, 3), (25, 16), (0, 3), (0, 16), size 2 | fixed |
| Battery 16662 | model / poses | npc 16662, idle 15024, death 15025, no walk | absent | npc 16662, those poses; not a combat add | fixed |
| Battery 16662 | combat | beam alignment and shield damage | not modelled | not modelled | stand-in |
| Handler 16661 | tiles | the same four corners, no idle | not spawned | not spawned | stand-in |
| Destroyed battery 16663 | tiles | the same corners, fewer samples, idle 15024 | not spawned | not spawned | stand-in |
| Vine 16664 | positions | scattered, no single spawn | tile marks from `vinesAround` | same | stand-in |
| Vine 16664 | animations | spawn 14771 graphic 4208, loop 14768, despawn 14769 | the vine attack plays no animation | same | stand-in |

## Moia

Region 16216, plane 0. Offset (-23, -26).

| NPC | field | captured value | sim value before | sim value after | status |
| --- | --- | --- | --- | --- | --- |
| Moia 16667 | mode tile | template (4055, 5662), plane 0 | trainer (0, 7), size 3 | trainer (0, 7), size 3 | matched |
| Moia 16667 | model | npc 16667, idle 14783 | npc 16667 | npc 16667 | matched |
| Moia 16667 | movement | relocates inside a box; no tick path | practice stations | practice stations | stand-in |
| Moia 16667 | ranged | anim 14785 every 5, graphic 4214, flight under a tick, hit same tick | anim 14785, graphic 4214, travel 1, hit same tick | graphic flies 20 client cycles, hit same tick | fixed |
| Moia 16667 | relocate | anim 14788, graphic 4213, flight 5.5, hit +4 | anim 14788, graphic 4213, travel 4 | same | matched |
| Binder 16670 | mode tile | template (4061, 5665) is one of the start tiles | eight binders on y 4, x 4–7, which includes trainer (6, 4) | same | matched |
| Binder 16670 | model | npc 16670, idle 14789, walk 14790 | npc 16670 | npc 16670 | matched |
| Binder 16670 | path | histogram only | practice hop loop | practice hop loop | stand-in |
| Binder 16670 | attack / death | 14791 every 5, death 14792 | those ids | those ids | matched |
| Binder 16670 | graphic 4218 on 14786 | n=5, medium, three fights | not played | not played | stand-in |

## Xarth

Region 16726, plane 0. Offset (-23, -26).

| NPC | field | captured value | sim value before | sim value after | status |
| --- | --- | --- | --- | --- | --- |
| Xarth 16684 | tile | template (4190, 5534) on every sample, one tile, plane 0 | trainer (7, 7), size 3, does not move | same | matched |
| Xarth 16684 | model | npc 16684 | npc 16684 | npc 16684 | matched |
| Xarth 16684 | attacks | magic 14984 graphic 4034, ranged 14985 graphic 4374, tell 14992 graphic 4378, blast 14989, death 14995, flight 2 | those ids and flight 2 | same | matched |
| Rubble 16685 / 16686 | tiles | trainer (13, 5), (10, 1), (10, 11); spawn during blasts, not at load | not spawned | not spawned | stand-in |
| Corpses 16687 / 16688 | path | wide histogram; 16688 has no template tile | not spawned | not spawned | stand-in |

## Ezekiel

Region 16214, plane 0. Offset (-22, -24).

| NPC | field | captured value | sim value before | sim value after | status |
| --- | --- | --- | --- | --- | --- |
| Ezekiel 16652 | mode tile | template (4062, 5535), plane 0 | trainer (8, 8), size 3 | trainer (8, 8), size 3 | matched |
| Ezekiel 16652 | model | npc 16652 | npc 16652 | npc 16652 | matched |
| Ezekiel 16652 | movement | walks a small box; no tick path | stands | stands | stand-in |
| Ezekiel 16652 | animations | melee 14685, sword 14687, stun 14691, recover 14693, heal 14688, wave 14694 | those ids | those ids | matched |
| Ezekiel 16652 | projectiles | none resolved onto his attacks | no projectile | no projectile | matched |
| Animated sword 16653, helpers 16654 / 16655, death sword 16656 | path | moving or a visual, no stable tile | lightning tile marks | lightning tile marks | stand-in |

## Dagon'hai

Region 16215, plane 0. Offset (-26, -20). One fight.

| NPC | field | captured value | sim value before | sim value after | status |
| --- | --- | --- | --- | --- | --- |
| Elder 16643 | mode tile | template (4060, 5602), plane 0, low count | trainer (2, 9), size 2 | trainer (2, 9), size 2 | matched |
| Elder 16643 | model | npc 16643 | npc 16643 only | npc 16643 only | stand-in |
| Elders 16644–16648 | tiles | mostly unresolved, one fight | not spawned | not spawned | stand-in |
| Elder 16643 | ranged / magic | anim 14593 graphic 4071 flight 3 hit +3; anim 14597 graphic 1459 flight 1 hit +1 | graphics 4071 and 1459, both travel 5 with the hit | same | stand-in |
| Elder 16643 | book throw | no resolved graphic | coloured sphere | coloured sphere | stand-in |
| Cauldron 16649 | tiles | (4064, 5598), (4063, 5599), (4064, 5599), (4065, 5599), (4066, 5599), (4066, 5598), each once | trainer (8, 9), (9, 9), (10, 9), (11, 9), (11, 8), (11, 7) | trainer (5, 12), (6, 12), (6, 13), (7, 12), (8, 12), (8, 13) | fixed |
| Cauldron 16649 | order | not recorded | a made-up east path | west to east across the six tiles | stand-in |
| Cauldron 16649 | cadence | step every 2 from tick 23, six steps, cycle 50 | those ticks | those ticks | matched |
| Cauldron 16649 | model / anims | idle 14656; 14657 / 14678 / 14679 are n=1 | a tile mark, not an NPC | a tile mark, not an NPC | stand-in |

## Ocellus phase 1

Region 16472, plane 1. Offset (-25, -6).

| NPC | field | captured value | sim value before | sim value after | status |
| --- | --- | --- | --- | --- | --- |
| Ocellus 16674 | mode tile | template (4126, 5672), plane 1 | trainer (5, 17), size 3 | trainer (5, 17), size 3 | matched |
| Ocellus 16674 | model | npc 16674, idle 14805, no walk | npc 16674 | npc 16674 | matched |
| Ocellus 16674 | corner path | several corner tiles in the histogram, no order | practice corners | practice corners | stand-in |
| Ocellus 16674 | volley | 14806 graphic 4229, 14807 graphic 4232, flight about 2 | those ids, flight 2 | same | matched |
| Ocellus 16674 | charge / slam visuals | 14809 and 14811, each most often every 8 ticks (174 and 168 gaps, 32 files) | slam 14811 only, on the scripted blast | 14809 on ticks divisible by 8, 14811 four ticks later, during a corner | fixed |
| Ocellus 16674 | slam / strike | 14811 and 14810; the role labels are low confidence | slam 14811, strike 14810 | same | matched |
| Ocellus 16674 | 14809 / 14812 / 14813 | roles not mapped onto a sim action | not attached | not attached | stand-in |
| Ocellus 16674 | death | no captured death | none plays | none plays | stand-in |
| Hooded Figure 16672 | tile | template (4126, 5669), plane 1, all 32 captures, one tile | not spawned | trainer (5, 20), size 3 | fixed |
| Hooded Figure 16672 | model | npc 16672, idle 14804, no walk, no attack | absent | npc 16672, idle 14804, no attack | fixed |

## Ocellus phase 2

Same region and plane. Offset (-19, -10).

| NPC | field | captured value | sim value before | sim value after | status |
| --- | --- | --- | --- | --- | --- |
| The Blade 16676 | tile | template (4126, 5672), plane 1, one tile, size 3 | trainer (11, 13), centre tile (12, 12) | same | matched |
| The Blade 16676 | model | scenery model 62699, object 62706, stand 14873; the npc model is an uncoloured clickbox | model 62699, lowered 3.135 so the sword meets the marker | same | matched |
| The Blade 16676 | movement | does not move | stands | stands | matched |
| The Blade 16676 | animations | none captured | none play | none play | stand-in |
| Ocellus form 16675 | tile | digest: no template position. Logs: the form stands in the middle while 16676 takes the hits | not placed | not placed in the encounter room. The flagged phase 2 drill draws it | Disputed |
| Volley | projectile 4269 | digest: source unresolved, 314 samples. Logs L1 to L8: each lit portal's bolt | not drawn | drawn on the volley | Disputed |
| Sword repair | spotanim 4304 | digest: 1,262 spawns, life mode 3, 31 files. Logs: on the middle every 3 ticks | drawn as the volley | drawn on the sword every 3 ticks | Disputed |

## Ocellus phase 3

Same region and plane. Offset (-31, -11).

| NPC | field | captured value | sim value before | sim value after | status |
| --- | --- | --- | --- | --- | --- |
| Ocellus 16677 | mode tile | template (4132, 5666), plane 1 | trainer (5, 18), size 3 | trainer (5, 18), size 3 | matched |
| Ocellus 16677 | model | npc 16677 | npc 16677 | npc 16677 | matched |
| Ocellus 16677 | movement | quadrant tiles in the histogram, no tick path | the quadrant script | the quadrant script | stand-in |
| Ocellus 16677 | attacks | melee 14842, wave 14846, void shot 14851 graphic 4297, spin 14869 | those ids | those ids | matched |
| Ocellus 16677 | spin graphic | 4325 on 192 of 192 spins, 31 files | not drawn | graphic 4325 held on the spin | fixed |
| Ocellus 16677 | death | no captured death | none plays | none plays | stand-in |
| Void rift 16678 | spawn tile | scattered | one rift two tiles from the player | same | stand-in |
| Void rift 16678 | animations | spawn 14896, idle 14895, walk 14468, death 14897 | those ids on the one rift | same | matched |
| Void siphon 16679 | tile / projectile | scattered; projectile 4303 flight 1 | a bar, not a captured tile | same | stand-in |
| Void augmenter 16680 | tile | scattered; spawn 14904, death 14905 | a bar, not a captured tile | same | stand-in |
| Void vine 16681 | animations | none; graphic 1542 only | tile mark | tile mark | stand-in |
| Censers 62693 / 62695 / 62697 / 62699 | tiles | plane 1 at load; the west pair falls outside this 25×25 grid | practice corners (1, 22), (22, 22), (1, 1), (22, 1), coloured boxes | same | stand-in |
| Pads | tiles | not a single captured pad tile in the digest | practice pads | practice pads | stand-in |

## Ocellus phase 4

The phase 4 view, not a raid-room grid. The digest has no template position for 16677 in phase 4. The combat loop was not retuned.

| NPC | field | captured value | sim value before | sim value after | status |
| --- | --- | --- | --- | --- | --- |
| Ocellus 16677 | tile / plane | no template position | the phase 4 platform | the phase 4 platform | stand-in |
| Ocellus 16677 | model | npc 16677, idle 14840, walk 14849 | npc 16677 | npc 16677 | matched |
| Ocellus 16677 | deflect / pre-blast / melee | 14863, 14865, 14844 | those ids in the shipped loop | those ids, unchanged | matched |
| Ocellus 16677 | death | no captured death used by this view | the shipped phase 4 death handling | unchanged | stand-in |

## Ocellus, counted across the 182 segments

The raw `capture-000.jsonl` files are not in this workspace. These counts are the digest built from all 182 segments (`fights_files` is the number of segments in that phase). A value is the mode of that distribution. The spread is the other gaps the digest kept.

The digest does not record camera pitch, yaw, or zoom. The capture setup excludes those client timers. The shared camera is unchanged. Arena lighting is the cache's own light for the region. No light value was added.

| Phase | segments | What the segments support | Sim after this pass |
| --- | --- | --- | --- |
| P1 | 32 | Boss mode tile (4126, 5672) plane 1, 129 of 2,167 samples. Hooded Figure on (4126, 5669) in all 32. Charge 14809 gap 8 in 174 gaps, also 37 (55), 28 (44), 29 (22). Slam 14811 gap 8 in 168 gaps. Volley graphics 4229 (1,187) and 4232 (1,046), flight mode 2.17, hit +2. Specials 14812/14813 with graphics 4266/4267, n=92 each, but the 81-tick gap is only 5 and 4 samples. | Charge and slam alternate on the 8-tick mode during a corner. The tendril script is unchanged. 14812/14813 stay off, because the interval is not one value. |
| P2 | 31 | Blade on one tile in all 31, no animation. Ocellus form 16675 has spawn 14837 and the line 14878 in all 31, and no template tile. Graphic 4304 ×1,262, life mode 3. Projectile 4269 ×314, source unresolved in the digest. Objects 62707 and 62709 spawn once per fight (31/31) and last about 32 and 84 ticks. | One Blade, seated as before. The volley draws 4269. Repair particles 4304 play every 3 ticks. 16675 is not placed in this room. The extra blade objects are not added on top of the one sword. |
| P3 | 31 | Boss mode tile (4132, 5666). Melee 14842 gap 3 in 559 of its gaps, wave 14846 gap 10 in 313. Spin 14869 every about 89 ticks (18 at 89, 14 at 72, 12 at 86) with graphic 4325 on all 192. Void shot 14851, graphic 4297, flight mode 0.5. Untether 14857 gap about 161, only a handful of repeats. Vine 16681 has no animation. Censers 62693, 62695, 62697, 62699 are present at load; the props note says 32 files. | The hidden drill follows fight logs L1 to L8 (upstream #88): swings at 4 and 7, shadow slash 14846 at 10, panic 14851 when nobody is in reach, spin, Untether, Insolence, and the fall. The encounter room keeps the previous 20-tick pattern and the same animation ids. The 89-tick and 161-tick gaps are not a single interval. Vine and censer tiles stay stand-ins. The disagreements are in the Disputed table. |
| P4 | 8 | No template tile. Loop anims 14863 and 14864 and 14865 and 14856 and 14855 and 14844. 14863 repeats at 60 ticks in 8 of its gaps. | The shipped 60-tick loop is unchanged. It already plays 14863, 14864, 14865, and 14844. |
| Adds | 31 | Rift, siphon, and augmenter spawn and death ids as in the earlier table. Positions are scattered, a few samples per tile. Siphon projectile 4303, flight 1, on the order of 180 shots. | One rift beside the player. Spawn tiles stay a stand-in. |

Player hitsplats in these phases are type 17 for damage and type 13 for a block, plus type 6 heals. P1 boss hits are type 19 (8,203 on 16674). The view still draws the SDK damage, block, and heal images.

## Disputed with fight logs L1 to L8

The eight anonymised logs are `docs/fight-logs/L1.txt` to `L8.txt` (upstream #85). The phase 1, phase 2 and phase 3 drills behind `ARCHIVE_P1`, `ARCHIVE_P2` and `ARCHIVE_P3` (upstream #87, #79 and #88) follow those logs in full. The encounter rooms stay on in every build. Where a room number changed, the fight logs were the stronger count: they name the tick and the sample size, and the digest either had no source or was counting a different event. Phase 4's lead-in, orb and rift fixes are upstream #86 and match the same logs; the 60-tick loop was already the logged gap.

| Field | Digest / previous room | Fight logs | Default now | Why |
| --- | --- | --- | --- | --- |
| The Blade's npc | 16676 on the sword tile in all 31 phase 2 segments. 16675 had no template tile | #79's merged timings: 16676 is the hitbox players attack. 16675 is the sword form in the middle, not the hitbox | 16676 stays the attackable sword. 16675 stays unspawned in the encounter room | Both sources agree on 16676. The prompt's "Blade is 16675" does not match the merged #79 text |
| Phase 1 cracks | animation 14809 and 14811 repeat every 8 ticks (174 and 168 gaps, 32 segments) | L6 to L8: 85 of 85 cracks open every 2 ticks, seven of them, and a block costs 3 to 5, refunded on stepping off | cracks every 2 ticks; a block rolls 3 to 5 and is refunded on stepping off. The charge animation stays on the 8-tick mode | The 8-tick figure counts the animation. The 2-tick figure counts the cracks |
| Phase 1 volley damage | the room dealt 12 through prayer and 42 without | L1, L2, L6 to L8: 246 of 246 matching prayers dealt 0, and 18 misses were 0 to 27 | prayer blocks it. A miss rolls 0 to 27 | The logs count the hits. 12 and 42 were not in the digest |
| Phase 1 slam | wiki cap 35. Captures saw 25 to 40 | 12 blast hits of 26 to 34, and a separate strike of 17 to 19 | the slam stays 35, the published cap | Neither set is one value, so the labelled cap stays |
| Phase 2 rounds | the room's gap put later rounds at 47 and 83, and the phase ended at 130 | lightings at 11, 53 and 95. Phase 3 starts at 131 in all five logged phase 2s. Portals at 2, The Blade at 7, releases at 46, 88 and 124 | those ticks. The bar drops only on the release, by half of what The Blade stored | The logs give one timeline. 130 was one of three earlier lengths |
| Phase 2 volley graphic | 4304 was drawn as the volley (1,262 spawns). 4269's source was unresolved (314) | 4269 is the portal bolt. 4304 is the repair spotanim every 3 ticks, and 1,262 is about 41 spawns times 31 fights | the volley draws 4269. 4304 plays on the sword every 3 ticks | The spawn count fits the repair clock. The logs name both ids |
| Phase 2 damage | a flat hit at the beam cap, 27 | 18 to 27, typeless, prayer or not | rolls 18 to 27. The 50 cap remains a practice ceiling | The logs are a range, not one hit |
| Phase 4 rifts and orbs | a rift burst was 23 ticks, and an orb healed a tick after it glowed | #86, logs L2, L5 and L6: burst at 30 ticks as one hit, and a player already on the orb is healed as it glows. Destroying a rift resets attack delay. He is hittable in the lead-in | the phase 4 fight follows #86 | The logs replace the earlier 23-tick estimate |
| Phase 3 projectile 14851 | 182 segments: graphic 4297, flight mode 0.5, and the splat on the cast tick (0 on 297). The encounter room deals typeless 20 on that tick. The dossier ledger calls the same animation Magic, landing 2 ticks after the cast, for 12–33 | L1 and L3 to L8: animation 14851 with "Your panic... is futile...", and the hits land 2 ticks later, 0 under Protect from Magic. Upstream #88's drill uses magic, +2, and the wiki range 20–26. The logs' unprotected hits on that tick run 10–33 mixed with other hits, so they do not pin one range | the drill plays the panic shot (magic, +2, 20–26). The encounter room keeps typeless 20 on the swing tick | Three counts of one animation. The logs name the tick and the prayer. The dossier's 12–33 and the drill's 20–26 are both ranges, not one hit. The segment flight of 0.5 is the graphic, not the splat |
| Phase 3 spin's first hit | 182 segments: animation 14869 lasts about 5 ticks, graphic 4325 on all 192 spins. The dossier ledger puts the first hit at S+5, with knock-offs at S+4, S+7 and S+10. The encounter room's saws are at +4, +7 and +10 | L1 to L8: a melee hit on S+1 of every spin (0 on 256 of 257 raiders under Protect from Melee), the first saw at S+5, and the prayer severed on S+4 for 3 ticks. Upstream #88 | the drill opens with the S+1 melee hit and cuts at S+5. The encounter room keeps its saws at +4, +7 and +10 | The logs count a hit the segments did not separate from the 5-tick animation. The dossier's S+5 matches the saw, not the opening hit |

## Hitsplats

The view draws the SDK damage, block and heal images. It does not draw RuneLite hitsplat ids.

| NPC | field | captured value | sim value before | sim value after | status |
| --- | --- | --- | --- | --- | --- |
| All rooms | damage | mostly type 17; phase 1 and Dagon'hai NPC hits type 19 | SDK damage image | SDK damage image | stand-in |
| All rooms | block | types 12 and 13 | SDK block image on a zero hit | same | stand-in |
| All rooms | heal | type 6 | SDK heal image | same | stand-in |
| Cauldron | hitsplat 11 | four samples, no sprite | not drawn | not drawn | stand-in |

## Boss movement

A trainer tile is a south-west anchor. The digest stored a position histogram, and only the six most common tiles of each, so a box below is the limit of every sample and the tiles inside it that were not listed are a stand-in. An anchor outside that limit is blocked. Settings, Boss movement, tints the set the room enforces and labels the current tick STATIONARY or MOBILE.

The phase 1 drill uses the fight-log path. The encounter room uses the digest's own grid, which is a different origin, so the same monster is named twice where the grids differ.

### Walkable anchors

| Actor | Where | Set | Support | Status |
| --- | --- | --- | --- | --- |
| Bork 16640 | encounter room | box (8, 8) to (19, 21), clipped to the 17×17 room. Mode (10, 12) | 107 fights, 6,767 samples. The six listed tiles are 1,293 of them, and (10, 12) has 229 | stand-in |
| Smorks 16641 | encounter room | (14, 14) only | 107 of 107 | captured |
| Ezekiel 16652 | encounter room | box (5, 6) to (11, 12). Mode (8, 8) | 10 fights, 470 samples. Six listed tiles are 140, and (8, 8) has 27 | stand-in |
| Archive Guardian 16659 / 16660 | encounter room | box (2, −4) to (22, 36), clipped to the room. Mode (11, 11) | 175 flying fights, 318 samples. (11, 11) has 41. The one grounded sample is the same tile | stand-in |
| Battery 16662 | encounter room | (25, 3), (25, 16), (0, 3), (0, 16) | the listed rows are all 229 samples | captured |
| Moia 16667 | encounter room | (0, 7), (7, 0), (14, 7), (7, 7), (7, 14) | 3 fights, 17 samples, and these five are all of them | captured |
| Undead binder 16670 | encounter room | box (4, 2) to (12, 10) | 3 fights, 747 samples. Six listed tiles are 163 | stand-in |
| Xarth 16684 | encounter room | (7, 7) only | 40 of 40 | captured |
| Dagon'hai Elder 16643 | encounter room | box (−1, 8) to (4, 16), clipped to the room. Spawn (2, 9) | 1 fight, 17 samples. Six listed tiles sum to 7 | stand-in |
| Cauldron 16649 | encounter room | box (5, 12) to (8, 14). The visit is (5, 12), (6, 12), (6, 13), (7, 12), (8, 12), (8, 13) | 1 fight, 7 samples. Six are listed. The order was not | stand-in |
| Hooded Figure 16672 | encounter room | (5, 20) only | 32 of 32 | captured |
| Ocellus 16674 | encounter room | box (−1, 11) to (11, 23), clipped to the room. Mode (5, 17) | 32 fights, 2,167 samples. (5, 17) has 129. Corner clusters (−1, 23), (−1, 11), (11, 23), (11, 11) | disputed |
| Ocellus 16674 | phase 1 drill | every straight-then-diagonal step between the start (14, 17), the middle (14, 14) and the corners (20, 8), (20, 20), (8, 20), (8, 8) | logs L3 to L5 for the path. The 32 captures' corner clusters are those corners in the other grid | captured |
| The Blade 16676 | encounter room | (11, 13) only. The 3×3 is that anchor's footprint, and nothing beyond it is walkable | 31 of 31 | captured |
| The Blade 16676 | phase 2 drill | (14, 14) only, the same stand in that grid | logs L2 and the phase 2 raids, and the 31 captures | captured |
| Ocellus 16677 | encounter room | box (−12, 2) to (9, 22), clipped to the room. Mode (5, 18) | 31 fights, 850 samples. (5, 18) is tied at 45 | stand-in |
| Ocellus 16677 | phase 3 drill | steps toward the player while the chain is chasing. (21, 7) is the Untether corner, not his only tile | no clip pins the phase-start tile. The logs move him. The encounter room still holds (5, 18) | the logs |
| Ocellus 16677 | phase 4 drill | (4, 6) only, the 3×3 inside the 5×5 | footage of the platform. The 8 phase 4 segments have no template tile | stand-in |

Bork's blocked anchors are everything outside (8, 8)–(19, 21). Xarth, the Smorks, The Blade, the Hooded Figure and the batteries block every tile except the one they were captured on. The Blade's only anchor is (11, 13). His body is the 3×3 on that anchor, and he has no walkable tile beyond it. He stays there for the whole of phase 2: the room does not path him toward the player. Moia blocks every anchor except her five. A 3×3 or larger boss is placed by the south-west tile, so the footprint hangs east and north of that anchor.

### Tick windows

| Actor | When | Mobility | Destination | Support |
| --- | --- | --- | --- | --- |
| Bork | the whole fight | stationary | holds (10, 12) | no tick path in 107 fights |
| Smorks | the whole fight | stationary | holds (14, 14) | 107 of 107, no walk pose |
| Ezekiel | the whole fight | stationary | holds (8, 8) | no tick path in 10 fights |
| Archive Guardian | flying, landing, grounded, takeoff | stationary | holds (11, 11) | no tick path. The mode is the leading tile |
| Batteries | the whole fight | stationary | the four corners | 229 samples, four tiles |
| Moia | phase 1, except every 25 ticks from tick 20 | stationary | the station she last moved to, starting at (0, 7) | the five tiles are the whole histogram |
| Moia | phase 1, ticks 20, 45, 70, … | mobile | the next of (0, 7), (7, 14), (14, 7), (7, 0) | same 3 fights. The order of the cycle is a practice stand-in |
| Moia | vanished | stationary | hidden | she is not on a tile |
| Moia | the tick she reappears | mobile | (7, 7) | (7, 7) is 2 of the 17 samples |
| Moia | phase 2 after that tick | stationary | holds (7, 7) | same |
| Binders | every 15 ticks, including tick 0 | mobile | the next practice stop that sits inside (4, 2)–(12, 10). (4, 12) and (12, 12) are refused | the box is 747 samples. The hop order is a stand-in |
| Binders | every other tick | stationary | the tile they reached | same |
| Xarth | the whole fight | stationary | holds (7, 7) | 40 of 40 |
| Dagon'hai Elder | the whole fight | stationary | holds (2, 9) | 1 fight, no tick path |
| Cauldron | from tick 23, six steps of 2 ticks, each cycle of 50 | mobile | the next trail tile inside (5, 12)–(8, 14) | 1 fight. The order is a stand-in |
| Cauldron | every other tick | stationary | the tile it occupies | same |
| Hooded Figure | the whole fight | stationary | holds (5, 20) | 32 of 32 |
| Ocellus, encounter phase 1 | the whole fight | stationary | holds (5, 17). Corner hops such as (17, 17) are outside the box and are refused | the box is 32 fights. The hop was a practice path |
| Ocellus, phase 1 drill | arrive, before the first walk | stationary | holds (14, 17) | logs: the walk starts at A + 4 |
| Ocellus, phase 1 drill | walk-from-start, walk-from-corner, walk-from-middle | mobile | one tile a tick, straight on the longer axis, then diagonal, toward the corner he is heading for | logs L3 to L5. One tile a tick in L1 to L8 |
| Ocellus, phase 1 drill | a corner | stationary | the corner stop | logs: he charges there. 34 corners in L1 to L8 |
| Ocellus, phase 1 drill | the middle, except the teleport-in beat | stationary | the middle (14, 14) once he has arrived | logs: beats and the strike, 15 of 15 middles |
| Ocellus, phase 1 drill | the teleport-in beat, M + 4, and the same beat if an end starts off the middle | mobile | the middle (14, 14) | 15 of 15 teleports in at M + 4 |
| The Blade, both rooms | the whole fight | stationary | the one captured tile. No walkable tile beyond his 3×3, and he does not follow the player | 31 of 31, and the logs |
| Ocellus, encounter phase 3 | autos, spins, untether, the whole fight | stationary | holds (5, 18) | no tick path in 31 fights |
| Ocellus, phase 3 drill | arrive, a spin, Untether, the fall | stationary | the corner he rose in, or the tile he was on when the spin started | the logs: he stands through the spin and hovers in the corner through Untether |
| Ocellus, phase 3 drill | swings, a slash, a panic, Insolence | mobile | steps toward the player. No captured tile list; the digest's box is the other grid | the logged chain needs him in melee reach. The encounter room still holds (5, 18) and does not follow |
| Ocellus, phase 4 | lead-in, inner void, after inner, outer void, after outer | stationary | holds (4, 6). During the outer void his 3×3 blocks the player, who paths around the edge | footage. 8 segments, no template tile |

## Floor cracks and the portal grid

Phase 1's floor vines are the corner cracks from the fight logs (upstream #87), drawn on plane 1. Seven cracks open on the charge tick and every 2 ticks after. Each is 8 tiles and closes 5 ticks later. The far tile waits 60 client cycles and each tile closer waits one cycle more. The spotanim family is the direction back toward him: straight 4236–4247 and diagonal 4248–4259, start piece on the far tile, the middle piece along the line, the end piece as it closes. An x or y crack runs straight. The corner crack runs on the diagonal. The slam paints floor spotanims 4262–4265 on the tiles within 2 of his 3×3.

Phase 2's portals are the 24 locs from upstream #79. They rise at tick 2, six 2×1 portals on each arm. The gap is model 62758 (loc 62684). A lit portal is model 62757 (loc 62685). Both loop animation 14830. North, east, south and west use loc rotations 3, 0, 1 and 2. Austin called the grid purple and orange. That matches these two captured objects: the 25 Oct render digest lists 62684 (7,235 spawns) and 62685 (6,870) in the phase 2 room, and no third portal object. The room keeps those two models. Orange on the model is the gap. Purple on the model fires. The damage is the existing typeless 18–27, and prayer does not block it. The 2D floor paints the same two colours.

The sequence colour is separate from the model colour. Austin's dossier now marks the cycle Verified: the three orders run orange → red → green, clockwise through the quadrants, so volley 1 predicts all 18. The cited support is 55/55 in the captures, 87/87 in VERIFIED-REFERENCE.md, and the same order in kjc623's ocellus-portals (`PortalSequences.Colour`). The marked tile of each wave is that plugin's `(columnsOut, rowsOut)` from the quadrant's inner corner. The sim's portal bands already contain every one of those tiles. The dossier's safe-tile bands were drawn one tile further out (`x = 28 − 2·col`, `y = 43 + 2·row` on the north-west). The room does not use that shift: the marked tile stays safe, and the dossier's outer corner takes the hit.

The starting quadrant and the first colour vary between raids, so both stay Likely. The seed picks them. It does not fix north-west and orange. From that pair the quadrants run clockwise and the colours run orange, red, green.

| Order | kjc623 colour | luuj `PORTAL_SEQUENCES` | reference, which swaps A and C | Status |
| --- | --- | --- | --- | --- |
| `{{1,1},{3,1},{1,3},{1,1},{2,2},{4,1}}` | orange | A | C | Disputed |
| `{{2,2},{2,3},{1,4},{2,2},{2,4},{3,3}}` | red | B | B | the shared letter |
| `{{1,0},{1,3},{1,5},{3,3},{2,2},{3,0}}` | green | C | A | Disputed |

The spoken volley line shows the colour and both letters. There is no separate red or green portal model in the capture, so none was added.

## Visual event sync

Cache 2746 and the 25 Oct 2026 render digest. A client cycle is 20 ms, and 30 cycles are one game tick. The digest records a flight mode and, where it was timed, the delay from the animation to the launch. It does not record start height, end height or slope, and this cache reader has no projectile-config archive, so those three stay the stand-in the rooms already used: height 1.2 at both ends and slope 0, a straight line. Combat hit ticks are unchanged. Where the graphic's arrival and the audited splat disagree, the row is Disputed.

The scene mesh is shifted by the measured rise at the boss tile, `(raw height − region base) / 128`, so an actor at z 0 stands on the walk floor. Map settings bit 1 (value 2) is the bridge bit. It is clear on every seat below. Settings value 4, which the Guardian and Ocellus use, is a different bit and does not pull plane 1 down onto plane 0.

### Planes

| Room | Tile | Plane | Settings | Height byte | Raw | Below | Base | Rise | Elevation before | Elevation after | Status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Bork 16727 | local (26, 32) | 0 | none | 60 | 480 | none | 480 | 0 | 0 | 0 | matched |
| Ezekiel 16214 | local (30, 31) | 0 | none | 30 | 240 | none | 480 | −1.875 | +1.875 | +1.875 | matched |
| Guardian 16471 | local (29, 29) | 0 | 4 | 30 | 240 | none | 240 | 0 | 0 | 0 | matched |
| Moia 16216 | local (23, 30) | 0 | none | 75 | 600 | none | 480 | +0.9375 | −0.9375 | −0.9375 | matched |
| Xarth 16726 | local (30, 30) | 0 | none | 60 | 480 | none | 480 | 0 | 0 | 0 | matched |
| Dagon'hai 16215 | local (28, 34) | 0 | none | 75 | 600 | none | 480 | +0.9375 | −0.9375 | −0.9375 | matched |
| Ocellus 16472, phase 1 | local (30, 40) | 1 | 4, bridge clear | 96 | 1008 | 240 | 240 | +6 | −6 | −6 | matched |
| Ocellus 16472, Hooded Figure | local (30, 37) | 1 | 4, bridge clear | 96 | 1008 | 240 | 240 | +6 | −6 | −6 | matched |
| Ocellus 16472, The Blade | local (30, 40) | 1 | 4, bridge clear | 96 | 1008 | 240 | 240 | +6 | −6 | −6 | matched |
| Ocellus 16472, phase 3 | local (36, 34) | 1 | 4, bridge clear | 96 | 1008 | 240 | 240 | +6 | −6 | −6 | matched |

Actors, scenery, ground graphics and projectiles in a raid room share that room's scene, so they sit on the same plane as the floor. The phase drills paint their own floors and do not load region 16472. Their grids are a different origin. Ocellus in those drills is still the plane-1 fight, drawn on the drill floor at z 0.

### Projectiles

A 3×3 launches from the footprint centre, `south-west + size / 2`, not from the south-west corner and not from the SDK's `(size − 1) / 2`. The phase 1 drill and the phase 2 portal bolt use the SDK projectile, shifted so the mesh leaves that centre. Raid-room shots are the room's own graphic and do the same. Height and slope on every row are the stand-in.

| Event | Anim | Graphic | Plane | Samples | Flight | Hit | Launch delay | Sim before | Sim after | Status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Smorks bomb | 14555 | 4440 from 16641 | 0 | 535 | 4.5 ticks, 135 cycles | unresolved | 1 tick on 485, also 2 on 38 and 3 on 7 | travel 5 from the south-west tile, from the attack tick, height 1.2 | waits 30 cycles, flies 135, from the 3×3 centre, height 1.2, slope 0 | captured |
| Bork 4056 | none resolved | 4056, source unresolved | 0 | the row was not kept | 3 | 3 | none | not drawn | not drawn | stand-in |
| Bork 4057 | none resolved | 4057, source unresolved | 0 | the row was not kept | 3 | 3 | none | not drawn | not drawn | stand-in |
| Smorks auto | low confidence | 4045 from 16641 | 0 | 688 | 4 | unresolved | 0 on 461 | not drawn | not drawn | stand-in |
| Guardian ranged | 14751 | 4201 from 16659 | 0 | 6,314 | mode 2.27, 68 cycles | 2 ticks on 5,341 | 2 ticks on 4,122 | flies 4 ticks from the attack, south-west corner, height 1.2 | waits 60, flies 60, from the centre. The 8-cycle gap against 2.27 is not applied, so the graphic meets the +4 splat | captured |
| Moia ranged | 14785 | 4214 | 0 | 343 | 0.67 ticks, drawn as 20 cycles | 0 on 329 | 1 tick on 75 of 78 timed launches, not used | forced to 1 tick | 20 cycles from the attack tick. The splat stays on that tick | captured |
| Moia relocate | 14788 | 4213 | 0 | 70 | 5.5 | 4 on 39, then 5 on 20 | not a clean pair with 14788 | flies 4 ticks | flies 120 cycles, so it meets the splat. The 5.5-tick flight is the disagreement | Disputed |
| Xarth magic | 14984 | 4034 | 0 | 1,135, and a second row of 573 | 2 | 2 | 1 on 533, then 2 on 395 | flies 2 from the attack | waits 30, flies 60. The graphic ends one tick after the splat, which stays at +2 | Disputed |
| Xarth ranged | 14985 | 4374 | 0 | 1,837 | 2 | 2 | 2 on 886 | flies 2 from the attack | waits 60, flies 60. The graphic ends two ticks after the splat, which stays at +2 | Disputed |
| Xarth tell | 14992 | 4378 | 0 | 520 | 2 | unresolved | 2 on 55 | flies 2 from the attack | waits 60, flies 60. No splat to meet. The delay sample is thin | captured |
| Dagon'hai ranged | 14593 | 4071 from 16643 | 0 | 6, one fight | 3 | 3 | 2 on 2 | flies 5 from the attack | waits 60, flies 90, and arrives with the existing +5 splat | captured |
| Dagon'hai magic | 14597 | 1459 from 16643 | 0 | 5, one fight | 1 | 1 | 2 on 2 | flies 5 from the attack | waits 60, flies 30, so the graphic arrives at +3. The splat stays at +5 | Disputed |
| Phase 1 magic, raid | 14806 | 4229 from 16674 | 1 | 1,187 | 2.17 | 2 | a minority, not applied | flies 2 from the attack | flies 60 cycles from the attack, from the centre | captured |
| Phase 1 ranged, raid | 14807 | 4232 from 16674 | 1 | 1,046 | 2.17 | 2 | a minority, not applied | flies 2 from the attack | flies 60 cycles from the attack, from the centre | captured |
| Phase 1 drill volley | 14806 / 14807 | 4229 / 4232 | drill floor | logs L3 | 65 and 95 cycles in one logged fight, far shots longer | the fight's own hit | start cycle 30 | start 30, near end 95, far end 125, height 0.6 chosen by eye, end z 0.4 | the same cycles and the eye-chosen height. The mesh now leaves the 3×3 centre. Slope 0 | captured cycles, stand-in height |
| Phase 2 bolt | none in the digest | 4269, source unresolved. Logs name it as the portal bolt | 1 | 314 | 2.8, drawn as 84 cycles | the room's hit stays at 4 | none | flies 4 ticks, the hit delay | flies 84 cycles from the attack. The splat stays at 4 | Disputed |
| Phase 2 drill bolt | the portal's cast | 4269 | drill floor | the phase 2 logs | per-tile cycles already in the drill | the fight's own hit | 0 | height 0.2, from the emitter's corner | the same cycles and height. The mesh leaves the emitter tile's centre | stand-in height |
| Phase 3 void | 14851 | 4297 from 16677 | 1 | 362 | 0.5, 15 cycles | 0 on 297 | 2 on 94 | flies 1 tick from the attack | waits 60, flies 15. The splat is already on the attack tick | Disputed |
| Siphon 4303 | 16679 | 4303 | 1 | on the order of 180 | 1 | 0 | not pinned | not drawn as a travelling shot. Spawn tiles are a stand-in | unchanged | stand-in |
| Book throw | none | no graphic | 0 | one fight, no projectile id | the room's 4 | the room's book hit | none | coloured sphere, 4 ticks, south-west corner | coloured sphere, 4 ticks, from the centre. Height 1.2, slope 0 | stand-in |
| Phase 1 annihilation travel | 14810 | no graphic | 1 | no projectile id | the room's 9 | the room's hit | none | coloured sphere for 9 ticks | coloured sphere for 9 ticks, from the centre | stand-in |
| Guardian beam travel | 14754 | 4204 is held, the travel has no id | 0 | the beam graphic is separate | the chosen 10 or 12 | that delay | none | coloured sphere plus held 4204 | the same lengths, from the centre. The travel stays a coloured stand-in | stand-in |

Repair graphic 4304 and spin graphic 4325 are held spotanims, not travelling shots. 4304 stays on the sword for the room's 3 ticks. 4325 stays on the spin for the room's 5 ticks. Their heights are the spotanim models. Spotanim 4339, the phase 4 explosion, is sequence 14933, 55 client cycles, and it starts on the mark tick. The shards sit high in that model. Nothing in this pass moves them.

### Animation lengths

Lengths are client cycles from cache 2746. A Maya sequence is `end − start` with start 0. A classic sequence is the sum of its frame timings. The SDK already plays those lengths. This pass pins the numbers. It does not replace the playback.

| Sequence | Kind | Cycles | Used for |
| --- | --- | --- | --- |
| 14539 | Maya 0–60 | 60 | Bork walk |
| 14540 | Maya 0–90 | 90 | Bork idle |
| 14542 | Maya 0–90 | 90 | Bork drum |
| 14553 | Maya 0–90 | 90 | Smorks idle and walk, the same sequence |
| 14555 | Maya 0–90 | 90 | Smorks bomb |
| 14581 | classic, eight frames | 90 | Dagon'hai idle |
| 14587 | classic | 60 | Dagon'hai walk |
| 14593 | classic | 90 | Dagon'hai ranged |
| 14597 | classic | 90 | Dagon'hai magic |
| 14683 | Maya 0–120 | 120 | Ezekiel idle |
| 14684 | Maya 0–60 | 60 | Ezekiel walk |
| 14745 | Maya 0–90 | 90 | Guardian idle and walk |
| 14751 | Maya 0–90 | 90 | Guardian ranged |
| 14783 | Maya 0–90 | 90 | Moia idle and walk |
| 14785 | Maya 0–60 | 60 | Moia ranged |
| 14788 | Maya 0–34 | 34 | Moia relocate |
| 14789 | classic | 162 | Binder idle |
| 14790 | classic | 48 | Binder walk |
| 14804 | Maya 0–90 | 90 | Ocellus phase 1 and the Hooded Figure, idle |
| 14805 | Maya 0–60 | 60 | Ocellus phase 1 and the Hooded Figure, walk |
| 14806 | Maya 0–90 | 90 | Phase 1 volley start. The reference loops the last 2 ticks. The sequence itself is 3 ticks |
| 14807 | Maya 0–30 | 30 | Phase 1 volley end |
| 14809 | Maya 0–120 | 120 | Phase 1 charge. The 8-tick gap in the digest counts the repeated beat, not this sequence |
| 14811 | Maya 0–60 | 60 | Phase 1 slam |
| 14840 | Maya 0–90 | 90 | Ocellus phase 3 and 4, idle |
| 14842 | Maya 0–60 | 60 | Phase 3 melee |
| 14849 | Maya 0–60 | 60 | Ocellus phase 3 and 4, walk |
| 14851 | Maya 0–90 | 90 | Phase 3 void shot |
| 14869 | Maya 0–168 | 168 | Phase 3 spin |
| 14979 | classic | 120 | Xarth idle, and his turn |
| 14980 | classic | 90 | Xarth walk |
| 14984 | classic | 60 | Xarth magic |
| 14985 | classic | 90 | Xarth ranged |
| 15024 | classic, frames 4, 5, 5, 5, 5, 5, 5, 5 | 39 | Battery idle. Walk is −1 |
| 4269 | classic, the graphic's own sequence | 111 | Phase 2 bolt spotanim. Separate from the 84-cycle flight |
| 4440 | classic, the graphic's own sequence | 143 | Bomb spotanim. Separate from the 135-cycle flight |

The Blade, 16676, has every animation at −1. That stays a stand-in. The void vine, 16681, has no captured animation. Ocellus has no captured death.

### Idle, walk and turn

Pose index 0 is the idle sequence and index 1 is the walk sequence, which is how the client picks them. Run is −1 on every NPC in this table, so there is no run sequence to play. Turn is −1 except Xarth, whose left and right turn are his idle 14979, so a turn would play the idle. A raid actor who changes tile plays index 1 for the following render. `setLocation` snaps the tile, so without that flag the walk pose never starts. Standing still stays on index 0.

The player's walk and run stay the SDK's movement poses. Void shards over the player's head are spotanim 4339's model, from the earlier change that lifts them, and they start on the mark tick. Phase 1 cracks use the logged delays: 60 client cycles on the far tile and one more per tile back toward him, and the floor blast uses delays 0 and 2. Those timings were already the captured ones.
