# NPC audit, 26 Oct 2026

Compared with the 25 Oct 2026 render digest and cache 2746 region placement. A trainer tile is the captured template minus the region base, then the room's scene offset: `trainerX = localX + offsetX`, `trainerY = offsetY + 63 - localY`. The digest records a position histogram, not a tile per tick, so a path is a stand-in wherever that histogram has no order.

Status is `fixed` where this pass changed the sim to a captured value, `matched` where it already agreed, and `stand-in` where the captures do not support a value. No id was invented for a gap. The known gaps stay gaps: animations for 16676 and 16681, the Ocellus death, projectiles 4056, 4057 and 4269, and hitsplat 11.

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
| Smorks 16641 | bomb projectile | 4440 from 16641, flight 4.5, launch-to-hit unresolved, usually anim+1 | not drawn | graphic 4440 from the Smorks tile, travel 5, toward the player | fixed |
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
| Archive Guardian | ranged | anim 14751 every 5, graphic 4201 at +2, flight about 2.3, hit +4 | anim 14751, graphic 4201, flight 4 | same | matched |
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
| Moia 16667 | ranged | anim 14785 every 5, graphic 4214, flight under a tick, hit same tick | anim 14785, graphic 4214, travel 1, hit same tick | same | matched |
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
| Ocellus form 16675 | tile | no template position | not placed | not placed | stand-in |
| Volley | projectile 4269 | source unresolved | coloured sphere, hit delay 4 | coloured sphere, hit delay 4 | stand-in |

## Ocellus phase 3

Same region and plane. Offset (-31, -11).

| NPC | field | captured value | sim value before | sim value after | status |
| --- | --- | --- | --- | --- | --- |
| Ocellus 16677 | mode tile | template (4132, 5666), plane 1 | trainer (5, 18), size 3 | trainer (5, 18), size 3 | matched |
| Ocellus 16677 | model | npc 16677 | npc 16677 | npc 16677 | matched |
| Ocellus 16677 | movement | quadrant tiles in the histogram, no tick path | the quadrant script | the quadrant script | stand-in |
| Ocellus 16677 | attacks | melee 14842, wave 14846, void shot 14851 graphic 4297, spin 14869 | those ids | those ids | matched |
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

## Hitsplats

The view draws the SDK damage, block and heal images. It does not draw RuneLite hitsplat ids.

| NPC | field | captured value | sim value before | sim value after | status |
| --- | --- | --- | --- | --- | --- |
| All rooms | damage | mostly type 17; phase 1 and Dagon'hai NPC hits type 19 | SDK damage image | SDK damage image | stand-in |
| All rooms | block | types 12 and 13 | SDK block image on a zero hit | same | stand-in |
| All rooms | heal | type 6 | SDK heal image | same | stand-in |
| Cauldron | hitsplat 11 | four samples, no sprite | not drawn | not drawn | stand-in |
