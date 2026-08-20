local all_data = {
  ["Burning Blood"] = {
    Image = "BurningBlood.png",
    Description = "At the end of combat, heal 6 HP.",
    Rarity = "Starter",
    Character = "Ironclad",
    Flavor = "Your body's own blood burns with an undying rage.",
  },
  ["Ring of the Snake"] = {
    Image = "RingoftheSnake.png",
    Description = "At the start of each combat, draw 2 additional cards.",
    Rarity = "Starter",
    Character = "Silent",
    Flavor = "Made from a fossilized snake. Represents great skill as a huntress.",
  },
  ["Cracked Core"] = {
    Image = "CrackedCore.png",
    Description = "At the start of each combat, $Channel 1 $Lightning.",
    Rarity = "Starter",
    Character = "Defect",
    Flavor = "The mysterious life force which powers the Automatons within the Spire. It appears to be cracked.",
  },
  ["Pure Water"] = {
    Image = "PureWater.png",
    Description = "At the start of each combat, add 1 {{C|Miracle}} into your hand.",
    Rarity = "Starter",
    Character = "Watcher",
    Flavor = "Filtered through fine sand and free of impurities.",
  },
  ["Akabeko"] = {
    Image = "Akabeko.png",
    Description = "Your first {{QueryLink|Cards|type:Attack|Attack}} each combat deals 8 additional damage",
    Rarity = "Common",
    Flavor = "Muuu~",
  },
  ["Anchor"] = {
    Image = "Anchor.png",
    Description = "Start each combat with 10 $Block.",
    Rarity = "Common",
    Flavor = "Holding this miniature trinket, you feel heavier and more stable.",
  },
  ["Ancient Tea Set"] = {
    Image = "AncientTeaSet.png",
    Description = "Whenever you enter a Rest Site, start the next combat with 2 extra $Energy.",
    Rarity = "Common",
    Flavor = "The key to a refreshing night's rest.",
    Requirement = {
        max_floor = 49
    }
  },
  ["Art of War"] = {
    Image = "ArtofWar.png",
    Description = "If you do not play any {{QueryLink|Cards|type:Attack|Attacks}} during your turn, gain an additional $Energy next turn.",
    Rarity = "Common",
    Flavor = "This ancient manuscript contains wisdom from a past age.",
  },
  ["Bag of Marbles"] = {
    Image = "BagofMarbles.png",
    Description = "At the start of each combat, apply 1 $Vulnerable to ALL enemies.",
    Rarity = "Common",
    Flavor = "A once popular toy in the City. Useful for throwing enemies off balance.",
  },
  ["Bag of Preparation"] = {
    Image = "BagofPreparation.png",
    Description = "At the start of each combat, draw 2 additional cards.",
    Rarity = "Common",
    Flavor = "Oversized adventurer's pack. Has many pockets and straps.",
  },
  ["Blood Vial"] = {
    Image = "BloodVial.png",
    Description = "At the start of each combat, heal 2 HP.",
    Rarity = "Common",
    Flavor = "A vial containing the blood of a pure and elder vampire.",
  },
  ["Bronze Scales"] = {
    Image = "BronzeScales.png",
    Description = "Start each combat with 3 $Thorns.",
    Rarity = "Common",
    Flavor = "The sharp scales of the Guardian. Rearranges itself to protect its user.",
  },
  ["Centennial Puzzle"] = {
    Image = "CentennialPuzzle.png",
    Description = "The first time you lose HP each combat, draw 3 cards.",
    Rarity = "Common",
    Flavor = "Upon solving the puzzle you feel a powerful warmth in your chest.",
  },
  ["Ceramic Fish"] = {
    Image = "CeramicFish.png",
    Description = "Whenever you add a card to your deck, gain 9 [[Gold]].",
    Rarity = "Common",
    Flavor = "Meticulously painted, these fish were revered to bring great fortune.",
    Requirement = {
        max_floor = 49
    }
  },
  ["Dream Catcher"] = {
    Image = "DreamCatcher.png",
    Description = "Whenever you Rest, you may add a card to your deck.",
    Rarity = "Common",
    Flavor = "The northern tribes would often use dream catchers at night, believing they led to self improvement.",
    Requirement = {
        max_floor = 49
    }
  },
  ["Happy Flower"] = {
    Image = "HappyFlower.png",
    Description = "Every 3 turns, gain 1 $Energy.",
    Rarity = "Common",
    Flavor = "This unceasingly joyous plant is a popular novelty item among nobles.",
  },
  ["Juzu Bracelet"] = {
    Image = "JuzuBracelet.png",
    Description = "Regular enemy combats are no longer encountered in ? rooms.",
    Rarity = "Common",
    Flavor = "A ward against the unknown.",
    Requirement = {
        max_floor = 49
    }
  },
  ["Lantern"] = {
    Image = "Lantern.png",
    Description = "Gain 1 $Energy on the first turn of each combat.",
    Rarity = "Common",
    Flavor = "An eerie lantern which illuminates only for the wielder.",
  },
  ["Maw Bank"] = {
    Image = "MawBank.png",
    Description = "Whenever you climb a floor, gain 12 [[Gold]]. No longer works when you spend any [[Gold]] at a shop.",
    Rarity = "Common",
    Flavor = "Surprisingly popular, despite maw attacks being a regular occurrence.",
    Requirement = {
        max_floor = 49,
        not_shop = true
    }
  },
  ["Meal Ticket"] = {
    Image = "MealTicket.png",
    Description = "Whenever you enter a shop, heal 15 HP.",
    Rarity = "Common",
    Flavor = "Complimentary meatballs with every visit!",
    Requirement = {
        max_floor = 49
    }
  },
  ["Nunchaku"] = {
    Image = "Nunchaku.png",
    Description = "Every time you play 10 {{QueryLink|Cards|type:Attack|Attacks}}, gain 1 $Energy.",
    Rarity = "Common",
    Flavor = "A good training tool. Improves the posture and agility of the wielder.",
  },
  ["Oddly Smooth Stone"] = {
    Image = "OddlySmoothStone.png",
    Description = "At the start of each combat, gain 1 $Dexterity.",
    Rarity = "Common",
    Flavor = "You have never seen something so smooth and pristine. This must be the work of the Ancients.",
  },
  ["Omamori"] = {
    Image = "Omamori.png",
    Description = "Negate the next 2 {{QueryLink|Cards|type:Curse|Curses}} you obtain.",
    Rarity = "Common",
    Flavor = "A common charm for staving off vile spirits. This one seems to possess a spark of divine energy.",
    Requirement = {
        max_floor = 49
    }
  },
  ["Orichalcum"] = {
    Image = "Orichalcum.png",
    Description = "If you end your turn without $Block, gain 6 $Block.",
    Rarity = "Common",
    Flavor = "A green tinted metal of an unknown origin. Seemingly indestructible.",
  },
  ["Pen Nib"] = {
    Image = "PenNib.png",
    Description = "Every 10th {{QueryLink|Cards|type:Attack|Attack}} you play deals double damage.",
    Rarity = "Common",
    Flavor = "Holding the nib, you can see everyone ever slain by a previous owner of the pen. A violent history.",
  },
  ["Potion Belt"] = {
    Image = "PotionBelt.png",
    Description = "Upon pickup, gain 2 [[Potions|Potion]] slots.",
    Rarity = "Common",
    Flavor = "I can hold more Potions using this belt!",
    Requirement = {
        max_floor = 49
    }
  },
  ["Preserved Insect"] = {
    Image = "PreservedInsect.png",
    Description = "Enemies in Elite combats have 25% less HP.",
    Rarity = "Common",
    Flavor = "The insect seems to create a shrinking aura that targets particularly large enemies.",
    Requirement = {
        max_floor = 53
    }
  },
  ["Regal Pillow"] = {
    Image = "RegalPillow.png",
    Description = "Whenever you Rest, heal an additional 15 HP.",
    Rarity = "Common",
    Flavor = "Now you can get a proper night's rest.",
    Requirement = {
        max_floor = 49
    }
  },
  ["Smiling Mask"] = {
    Image = "SmilingMask.png",
    Description = "The merchant's card removal service now always costs 50 [[Gold]].",
    Rarity = "Common",
    Flavor = "Mask worn by the merchant. He must have spares...",
    Requirement = {
        max_floor = 49,
        not_shop = true
    }
  },
  ["Strawberry"] = {
    Image = "Strawberry.png",
    Description = "Upon pickup, raise your Max HP by 7.",
    Rarity = "Common",
    Flavor = "\"Delicious! Haven't seen any of these since the blight.\" - Ranwid",
  },
  ["The Boot"] = {
    Image = "Boot.png",
    Description = "Whenever you would deal 4 or less unblocked {{QueryLink|Cards|type:Attack|Attack}} damage, increase it to 5.",
    ID = "Boot",
    Rarity = "Common",
    Flavor = "When wound up, the boot grows larger in size.",
  },
  ["Tiny Chest"] = {
    Image = "TinyChest.png",
    Description = "Every 4th ? room is a Treasure room.",
    Rarity = "Common",
    Flavor = "\"A fine prototype.\" - The Architect",
    Requirement = {
        max_floor = 36
    }
  },
  ["Toy Ornithopter"] = {
    Image = "ToyOrnithopter.png",
    Description = "Whenever you use a [[Potions|potion]], heal 5 HP.",
    Rarity = "Common",
    Flavor = "\"This little toy is the perfect companion for the lone adventurer!\"",
  },
  ["Vajra"] = {
    Image = "Vajra.png",
    Description = "At the start of each combat, gain 1 $Strength.",
    Rarity = "Common",
    Flavor = "An ornamental relic given to warriors displaying glory in battle.",
  },
  ["War Paint"] = {
    Image = "WarPaint.png",
    Description = "Upon pick up, $Upgrade 2 random {{QueryLink|Cards|type:Skill|Skills}}.",
    Rarity = "Common",
    Flavor = "In the past, Ironclads would create wards using enchanted war paint before charging into battle.",
  },
  ["Whetstone"] = {
    Image = "Whetstone.png",
    Description = "Upon pickup, $Upgrade 2 random {{QueryLink|Cards|type:Attack|Attacks}}.",
    Rarity = "Common",
    Flavor = "\"Flesh never beats steel.\" - Kublai the Great",
    Requirement = {
        non_screenless = true
    }
  },
  ["Red Skull"] = {
    Image = "RedSkull.png",
    Description = "While your HP is at or below 50%, you have 3 additional $Strength.",
    Rarity = "Common",
    Character = "Ironclad",
    Flavor = "A small skull covered in ornamental paint.",
  },
  ["Snecko Skull"] = {
    Image = "SnakeSkull.png",
    Description = "Whenever you apply $Poison, apply an additional 1 $Poison.",
    ID = "Snake Skull",
    Rarity = "Common",
    Character = "Silent",
    Flavor = "A snecko skull in pristine condition. Mysteriously clean and smooth, dirt and grime fall off inexplicably.",
  },
  ["Data Disk"] = {
    Image = "DataDisk.png",
    Description = "Start each combat with 1 $Focus.",
    Rarity = "Common",
    Character = "Defect",
    Flavor = "This disk contains precious data on birds and snakes.",
  },
  ["Damaru"] = {
    Image = "damaru.png",
    Description = "At the start of your turn, gain 1 $Mantra.",
    Rarity = "Common",
    Character = "Watcher",
    Flavor = "The sound of the small drum keeps your mind awake, revealing a path forward.",
  },
  ["Blue Candle"] = {
    Image = "BlueCandle.png",
    Description = "$Unplayable {{QueryLink|Cards|type:Curse|Curse}} cards can now be played. <br>Whenever you play a {{QueryLink|Cards|type:Curse|Curse}}, lose 1 HP and $Exhaust it.",
    Rarity = "Uncommon",
    Flavor = "The flame ignites when shrouded in darkness.",
  },
  ["Bottled Flame"] = {
    Image = "BottledFlame.png",
    Description = "Upon pickup, choose an {{QueryLink|Cards|type:Attack|Attack}} card. <br>At the start of each combat, this card will be in your hand.",
    Rarity = "Uncommon",
    Flavor = "Inside the bottle resides a flame that eternally burns.",
    Requirement = {
        non_screenless = true,
        deck = "Attack"
    }
  },
  ["Bottled Lightning"] = {
    Image = "BottledLightning.png",
    Description = "Upon pickup, choose a {{QueryLink|Cards|type:Skill|Skill}} card. <br>At the start of each combat, this card will be in your hand.",
    Rarity = "Uncommon",
    Flavor = "Peering into the swirling maelstrom, you see a part of yourself staring back.",
    Requirement = {
        non_screenless = true,
        deck = "Skill"
    }
  },
  ["Bottled Tornado"] = {
    Image = "BottledTornado.png",
    Description = "Upon pickup, choose a {{QueryLink|Cards|type:Power|Power}} card. <br>At the start of each combat, this card will be in your hand.",
    Rarity = "Uncommon",
    Flavor = "The bottle gently hums and whirs.",
    Requirement = {
        non_screenless = true,
        deck = "Power"
    }
  },
  ["Darkstone Periapt"] = {
    Image = "DarkstonePeriapt.png",
    Description = "Whenever you obtain a {{QueryLink|Cards|type:Curse|Curse}}, increase your Max HP by 6",
    Rarity = "Uncommon",
    Flavor = "The stone draws power from dark energy, converting it into vitality for the wearer.",
    Requirement = {
        max_floor = 49
    }
  },
  ["Eternal Feather"] = {
    Image = "EternalFeather.png",
    Description = "For every 5 cards in your deck, heal 3 HP whenever you enter a Rest Site.",
    Rarity = "Uncommon",
    Flavor = "This feather appears to be completely indestructible. What bird does this possibly come from? ",
  },
  ["Frozen Egg"] = {
    Image = "FrozenEgg2.png",
    Description = "Whenever you add a {{QueryLink|Cards|type:Power|Power}} card to your deck, $Upgrade it.",
    ID = "Frozen Egg",
    Rarity = "Uncommon",
    Flavor = "The egg lies inert and frozen, never to hatch.",
    Requirement = {
        max_floor = 49
    }
  },
  ["Gremlin Horn"] = {
    Image = "GremlinHorn.png",
    Description = "Whenever an enemy dies, gain 1 $Energy and draw 1 card.",
    Rarity = "Uncommon",
    Flavor = "\"Gremlin Nobs are capable of growing until the day they die. Remarkable.\" - Ranwid",
  },
  ["Horn Cleat"] = {
    Image = "HornCleat.png",
    Description = "At the start of your 2nd turn, gain 14 $Block.",
    Rarity = "Uncommon",
    Flavor = "Pleasant to hold in the hand. What was it for?",
  },
  ["Ink Bottle"] = {
    Image = "InkBottle.png",
    Description = "Whenever you play 10 cards, draw 1 card.",
    Rarity = "Uncommon",
    Flavor = "Once exhausted, appears to refill itself in a different color.",
  },
  ["Kunai"] = {
    Image = "Kunai.png",
    Description = "Every time you play 3 {{QueryLink|Cards|type:Attack|Attacks}} in a single turn, gain 1 $Dexterity",
    Rarity = "Uncommon",
    Flavor = "A blade favored by assassins for its lethality at range.",
  },
  ["Letter Opener"] = {
    Image = "LetterOpener.png",
    Description = "Every time you play 3 {{QueryLink|Cards|type:Skill|Skills}} in a single turn, deal 5 damage to ALL enemies.",
    Rarity = "Uncommon",
    Flavor = "Unnaturally sharp.",
  },
  ["Matryoshka"] = {
    Image = "Matryoshka.png",
    Description = "The next 2 non-boss chests you open contain 2 Relics.",
    Rarity = "Uncommon",
    Flavor = "A stackable set of painted dolls. The paint depicts an unknown bird with white eyes and blue feathers.",
    Requirement = {
        max_floor = 41
    }
  },
  ["Meat on the Bone"] = {
    Image = "MeatontheBone.png",
    Description = "If your HP is at or below 50% at the end of combat, heal 12 HP.",
    Rarity = "Uncommon",
    Flavor = "The meat keeps replenishing, never seeming to fully run out.",
    Requirement = {
        max_floor = 49
    }
  },
  ["Mercury Hourglass"] = {
    Image = "MercuryHourglass.png",
    Description = "At the start of your turn, deal 3 damage to ALL enemies.",
    Rarity = "Uncommon",
    Flavor = "An enchanted hourglass that endlessly drips.",
  },
  ["Molten Egg"] = {
    Image = "MoltenEgg2.png",
    Description = "Whenever you add an {{QueryLink|Cards|type:Attack|Attack}} card to your deck, $Upgrade it.",
    ID = "Molten Egg",
    Rarity = "Uncommon",
    Flavor = "The egg of a Phoenix. It glows red hot with a simmering lava.",
    Requirement = {
        max_floor = 49
    }
  },
  ["Mummified Hand"] = {
    Image = "MummifiedHand.png",
    Description = "Whenever you play a {{QueryLink|Cards|type:Power|Power}} card, a random card in your hand costs 0 that turn.",
    Rarity = "Uncommon",
    Flavor = "Frequently twitches, especially when your pulse is high.",
  },
  ["Ornamental Fan"] = {
    Image = "OrnamentalFan.png",
    Description = "Every time you play 3 {{QueryLink|Cards|type:Attack|Attacks}} in a single turn, gain 4 $Block.",
    Rarity = "Uncommon",
    Flavor = "The fan seems to extend and harden as blood is spilled.",
  },
  ["Pantograph"] = {
    Image = "Pantograph.png",
    Description = "At the start of Boss combats, heal 25 HP.",
    Rarity = "Uncommon",
    Flavor = "\"Solid foundations are not accidental. Tools for planning are a must.\" - The Architect",
  },
  ["Pear"] = {
    Image = "Pear.png",
    Description = "Upon pickup, raise your Max HP by 10.",
    Rarity = "Uncommon",
    Flavor = "A common fruit before the Spireblight.",
  },
  ["Question Card"] = {
    Image = "QuestionCard.png",
    Description = "Future card rewards have 1 additional card to choose from.",
    Rarity = "Uncommon",
    Flavor = "\"Those with more choices minimize the downside to chaos.\" - Kublai the Great",
    Requirement = {
        max_floor = 49
    }
  },
  ["Shuriken"] = {
    Image = "Shuriken.png",
    Description = "Every time you play 3 {{QueryLink|Cards|type:Attack|Attacks}} in a single turn, gain 1 $Strength.",
    Rarity = "Uncommon",
    Flavor = "Lightweight throwing weapons. Recommend going for the eyes.",
  },
  ["Singing Bowl"] = {
    Image = "SingingBowl.png",
    Description = "When adding cards to your deck, you may raise your Max HP by 2 instead.",
    Rarity = "Uncommon",
    Flavor = "This well-used artifact rings out with a beautiful melody when struck.",
    Requirement = {
        max_floor = 49
    }
  },
  ["Strike Dummy"] = {
    Image = "StrikeDummy.png",
    Description = "Cards containing \"Strike\" deal 3 additional damage.",
    Rarity = "Uncommon",
    Flavor = "It's beat up.",
  },
  ["Sundial"] = {
    Image = "Sundial.png",
    Description = "Every 3 times you shuffle your draw pile, gain 2 $Energy.",
    Rarity = "Uncommon",
    Flavor = "\"Early man's foolish obsession with time caused them to look to the sky for guidance, hoping for something permanent.\" - Zoroth",
  },
  ["The Courier"] = {
    Image = "TheCourier.png",
    Description = "The Merchant restocks [[Cards|cards]], [[Relics|relics]], and [[Potions|potions]]. All prices are reduced by 20%.",
    Rarity = "Uncommon",
    Flavor = "The merchant's personal pet!",
    Requirement = {
        max_floor = 49,
        not_shop = true
    }
  },
  ["Toxic Egg"] = {
    Image = "ToxicEgg2.png",
    Description = "Whenever you add a {{QueryLink|Cards|type:Skill|Skill}} card to your deck, $Upgrade it.",
    ID = "Toxic Egg",
    Rarity = "Uncommon",
    Flavor = "\"What a marvelous discovery! This appears to be the inert egg of some magical creature. Who or what created this?\" - Ranwid",
	Requirement = {
        max_floor = 49
    }
  },
  ["White Beast Statue"] = {
    Image = "WhiteBeastStatue.png",
    Description = "[[Potions]] always appear in combat rewards.",
    Rarity = "Uncommon",
    Flavor = "A small white statue of a creature you have never seen before.",
  },
  ["Paper Phrog"] = {
    Image = "PaperFrog.png",
    Description = "Enemies with $Vulnerable take 75% more damage rather than 50%.",
    ID = "Paper Frog",
    Rarity = "Uncommon",
    Character = "Ironclad",
    Flavor = "The paper continually folds and unfolds itself into the shape of a small creature.",
  },
  ["Self-Forming Clay"] = {
    Image = "SelfFormingClay.png",
    Description = "Whenever you lose HP, gain 3 $Block next turn.",
    ID = "Self Forming Clay",
    Rarity = "Uncommon",
    Character = "Ironclad",
    Flavor = "\"Most curious! It appears to form itself loosely on my thoughts! Tele-clay?\" - Ranwid",
  },
  ["Ninja Scroll"] = {
    Image = "NinjaScroll.png",
    Description = "At the start each combat, add 3 {{C|Shiv|Shivs}} into your hand.",
    Rarity = "Uncommon",
    Character = "Silent",
    Flavor = "Contains the secrets of assassination.",
  },
  ["Paper Krane"] = {
    Image = "PaperCrane.png",
    Description = "Enemies with $Weak deal 40% less damage rather than 25%.",
    ID = "Paper Crane",
    Rarity = "Uncommon",
    Character = "Silent",
    Flavor = "An origami of a creature from a past age.",
  },
  ["Gold-Plated Cables"] = {
    Image = "Cables.png",
    Description = "Your rightmost $Orb triggers its passive an additional time.",
    Rarity = "Uncommon",
    Character = "Defect",
    Flavor = "\"Interesting! Even automatons are affected by placebo.\" - Ranwid",
  },
  ["Symbiotic Virus"] = {
    Image = "SymbioticVirus.png",
    Description = "At the start of each combat, $Channel 1 $Dark.",
    Rarity = "Uncommon",
    Character = "Defect",
    Flavor = "A little bit of bad can do a lot of good.",
  },
  ["Duality"] = {
    Image = "Duality.png",
    Description = "Whenever you play an {{QueryLink|Cards|type:Attack|Attack}}, gain 1 temporary $Dexterity.",
    Rarity = "Uncommon",
    Character = "Watcher",
    Flavor = "\"And the sun was extinguished forever, as if curtains fell before it.\" - Zoroth",
  },
  ["Teardrop Locket"] = {
    Image = "TeardropLocket.png",
    Description = "Start each combat in $Calm.",
    Rarity = "Uncommon",
    Character = "Watcher",
    Flavor = "Its owner blind, its contents unseen.",
  },
  ["Bird-Faced Urn"] = {
    Image = "BirdFacedUrn.png",
    Description = "Whenever you play a {{QueryLink|Cards|type:Power|Power}} card, heal 2 HP.",
    ID = "Bird Faced Urn",
    Rarity = "Rare",
    Flavor = "This urn shows the crow god Mazaleth looking mischievous.",
  },
  ["Calipers"] = {
    Image = "Calipers.png",
    Description = "At the start of your turn, lose 15 $Block rather than all of your $Block.",
    Rarity = "Rare",
    Flavor = "\"Mechanical precision leads to greatness\" - The Architect",
  },
  ["Captain's Wheel"] = {
    Image = "CaptainsWheel.png",
    Description = "At the start of your 3rd turn, gain 18 $Block.",
    Rarity = "Rare",
    Flavor = "Wooden trinket carved with delicate precision. A name is carved into it but the language is foreign.",
  },
  ["Dead Branch"] = {
    Image = "DeadBranch.png",
    Description = "Whenever you $Exhaust a card, add a random card to your hand.",
    Rarity = "Rare",
    Flavor = "The branch of a tree from a forgotten era.",
  },
  ["Du-Vu Doll"] = {
    Image = "Du-VuDoll.png",
    Description = "For each {{QueryLink|Cards|type:Curse|Curse}} in your deck, start each combat with 1 $Strength.",
    Rarity = "Rare",
    Flavor = "A doll devised to gain strength from malicious energy.",
  },
  ["Fossilized Helix"] = {
    Image = "FossilizedHelix.png",
    Description = "Prevent the first time you would lose HP in combat.",
    Rarity = "Rare",
    Flavor = "Seemingly indestructible, you wonder what kind of creature this belonged to.",
  },
  ["Gambling Chip"] = {
    Image = "GamblingChip.png",
    Description = "At the start of each combat, discard any number of cards, then draw that many cards.",
    Rarity = "Rare",
    Flavor = "You can see a small inscription on one side. It reads: \"Bear's Lucky Chip!\"",
  },
  ["Ginger"] = {
    Image = "Ginger.png",
    Description = "You can no longer become $Weakened.",
    Rarity = "Rare",
    Flavor = "A potent tool in many tonics.",
  },
  ["Girya"] = {
    Image = "Girya.png",
    Description = "You can now gain $Strength at Rest Sites (up to 3 times).",
    Rarity = "Rare",
    Flavor = "This Girya is unfathomably heavy. You could train with this to get significantly stronger.",
    Requirement = {
        max_floor = 49,
        campfire = true
    }
  },
  ["Ice Cream"] = {
    Image = "IceCream.png",
    Description = "$Energy is now conserved between turns.",
    Rarity = "Rare",
    Flavor = "Delicious!",
  },
  ["Incense Burner"] = {
    Image = "IncenseBurner.png",
    Description = "Every 6 turns, gain 1 $Intangible.",
    Rarity = "Rare",
    Flavor = "The smoke imbues its owner with the spirit of the burned.",
  },
  ["Lizard Tail"] = {
    Image = "LizardTail.png",
    Description = "When you would die, heal to 50% of your Max HP instead (works once).",
    Rarity = "Rare",
    Flavor = "A fake tail to trick enemies during combat.",
  },
  ["Mango"] = {
    Image = "Mango.png",
    Description = "Upon pickup, raise your Max HP by 14.",
    Rarity = "Rare",
    Flavor = "The most coveted forgotten fruit. Impeccably preserved with no signs of Spireblight.",
  },
  ["Old Coin"] = {
    Image = "OldCoin.png",
    Description = "Upon pickup, gain 300 [[Gold]].",
    Rarity = "Rare",
    Flavor = "Unique coins are highly valued by Merchants for their historical value and rare metallic composition.",
    Requirement = {
        max_floor = 49,
        not_shop = true
    }
  },
  ["Peace Pipe"] = {
    Image = "PeacePipe.png",
    Description = "You can now remove cards from your deck at Rest Sites.",
    Rarity = "Rare",
    Flavor = "Clears the mind and cleanses the soul.",
    Requirement = {
        max_floor = 49,
        campfire = true
    }
  },
  ["Pocketwatch"] = {
    Image = "Pocketwatch.png",
    Description = "Whenever you play 3 or less cards during your turn, draw 3 additional cards at the start of your next turn.",
    Rarity = "Rare",
    Flavor = "The hands seem stuck on the 3 o'clock position.",
  },
  ["Prayer Wheel"] = {
    Image = "PrayerWheel.png",
    Description = "Normal enemies drop an additional card reward.",
    Rarity = "Rare",
    Flavor = "The wheel continues to spin, never stopping.",
    Requirement = {
        max_floor = 49
    }
  },
  ["Shovel"] = {
    Image = "Shovel.png",
    Description = "You can now Dig for relics at Rest Sites.",
    Rarity = "Rare",
    Flavor = "The Spire houses all number of relics from past civilizations and powerful adventurers lost to time. Time to go dig them up!",
	Requirement = {
        max_floor = 49,
        campfire = true
    }
  },
  ["Stone Calendar"] = {
    Image = "StoneCalendar.png",
    Description = "At the end of turn 7, deal 52 damage to ALL enemies.",
    ID = "Calendar",
    Rarity = "Rare",
    Flavor = "The passage of time is imperceptible in the Spire.",
  },
  ["Thread and Needle"] = {
    Image = "ThreadandNeedle.png",
    Description = "At the start of each combat, gain 4 $Plated Armor.",
    Rarity = "Rare",
    Flavor = "Wrapping the magical thread around your body, you feel harder to the touch.",
  },
  ["Torii"] = {
    Image = "Torii.png",
    Description = "Whenever you would receive 5 or less unblocked {{QueryLink|Cards|type:Attack|Attack}} damage, reduce it to 1.",
    Rarity = "Rare",
    Flavor = "Holding the small Torii, you feel a sense of calm and safety drift through your mind.",
  },
  ["Tungsten Rod"] = {
    Image = "TungstenRod.png",
    Description = "Whenever you would lose HP, lose 1 less.",
    Rarity = "Rare",
    Flavor = "It's very very heavy.",
  },
  ["Turnip"] = {
    Image = "Turnip.png",
    Description = "You can no longer become $Frail.",
    Rarity = "Rare",
    Flavor = "Best with Ginger.",
  },
  ["Unceasing Top"] = {
    Image = "UnceasingTop.png",
    Description = "Whenever you have no cards in hand during your turn, draw a card.",
    Rarity = "Rare",
    Flavor = "The top continues to spin effortlessly as if you were in a dream.",
  },
  ["Wing Boots"] = {
    Image = "WingedGreaves.png",
    Description = "You may ignore paths when choosing the next room to travel to 3 times.",
    Rarity = "Rare",
    Flavor = "Stylish.",
    Requirement = {
        max_floor = 41
    }
  },
  ["Champion Belt"] = {
    Image = "ChampionBelt.png",
    Description = "Whenever you apply $Vulnerable, also apply 1 $Weak.",
    Rarity = "Rare",
    Character = "Ironclad",
    Flavor = "Only the greatest may wear this belt.",
  },
  ["Charon's Ashes"] = {
    Image = "CharonsAshes.png",
    Description = "Whenever you $Exhaust a card, deal 3 damage to ALL enemies.",
    Rarity = "Rare",
    Character = "Ironclad",
    Flavor = "Charon was said to be the god of rebirth, eternally dying and reviving in a burst of flame.",
  },
  ["Magic Flower"] = {
    Image = "MagicFlower.png",
    Description = "Healing is 50% more effective during combat.",
    Rarity = "Rare",
    Character = "Ironclad",
    Flavor = "A flower long thought extinct, somehow preserved in perfect condition.",
  },
  ["The Specimen"] = {
    Image = "TheSpecimen.png",
    Description = "Whenever an enemy dies, transfer any $Poison it has to a random enemy.",
    Rarity = "Rare",
    Character = "Silent",
    Flavor = "\"Fascinating! I found a mutated creature demonstrating astounding toxic properties. Storing a sample for later examination.\" - Ranwid",
  },
  ["Tingsha"] = {
    Image = "Tingsha.png",
    Description = "Whenever you discard a card during your turn, deal 3 damage to a random enemy.",
    Rarity = "Rare",
    Character = "Silent",
    Flavor = "The sound this instrument generates seems to be capable of reverberating to painful levels of volume.",
  },
  ["Tough Bandages"] = {
    Image = "ToughBandages.png",
    Description = "Whenever you discard a card during your turn, gain 3 $Block.",
    Rarity = "Rare",
    Character = "Silent",
    Flavor = "Loss gives strength.",
  },
  ["Emotion Chip"] = {
    Image = "EmotionChip.png",
    Description = "If you lost HP during the previous turn, trigger the passive ability of all $Orbs at the start of your turn.",
    Rarity = "Rare",
    Character = "Defect",
    Flavor = "...<3...?",
  },
  ["Cloak Clasp"] = {
    Image = "CloakClasp.png",
    Description = "At the end of your turn, gain 1 $Block for each card in your hand.",
    Rarity = "Rare",
    Character = "Watcher",
    Flavor = "A simple but sturdy design.",
  },
  ["Golden Eye"] = {
    Image = "GoldenEye.png",
    Description = "Whenever you $Scry, $Scry 2 additional cards.",
    Rarity = "Rare",
    Character = "Watcher",
    Flavor = "See into the minds of those nearby, predicting their future moves.",
  },
  ["Cauldron"] = {
    Image = "Cauldron.png",
    Description = "When obtained, brews 5 random [[Potions|potions]].",
    Rarity = "Shop",
    Flavor = "The Merchant is actually a rather skilled potion brewer. Buy 4 get 1 free.",
  },
  ["Chemical X"] = {
    Image = "ChemicalX.png",
    Description = "The effects of your cost X cards are increased by 2.",
    Rarity = "Shop",
    Flavor = "WARNING: Do not combine with sugar, spice, and everything nice.",
  },
  ["Clockwork Souvenir"] = {
    Image = "ClockworkSouvenir.png",
    Description = "Start each combat with 1 $Artifact.",
    Rarity = "Shop",
    Flavor = "So many intricate gears.",
  },
  ["Dolly's Mirror"] = {
    Image = "DollysMirror.png",
    Description = "Upon pickup, obtain an additional copy of a card in your deck.",
    Rarity = "Shop",
    Flavor = "I look funny in this.",
  },
  ["Frozen Eye"] = {
    Image = "FrozenEye.png",
    Description = "When viewing your Draw Pile, the cards are now shown in order.",
    ID = "Frozen Eye",
    Rarity = "Shop",
    Flavor = "Staring into the eye, you see a glimpse of your future.",
  },
  ["Hand Drill"] = {
    Image = "HandDrill.png",
    Description = "Whenever you break an enemy's $Block, apply 2 $Vulnerable.",
    Rarity = "Shop",
    Flavor = "Spirals are dangerous.",
  },
  ["Lee's Waffle"] = {
    Image = "LeesWaffle.png",
    Description = "Upon pickup, raise your Max HP by 7 and heal all of your HP.",
    Rarity = "Shop",
    Flavor = "\"Tastiest treat you will find in all the Spire! Baked today just for you.\"",
  },
  ["Medical Kit"] = {
    Image = "MedicalKit.png",
    Description = "$Unplayable {{QueryLink|Cards|type:Status|Status}} cards can now be played. Whenever you play a {{QueryLink|Cards|type:Status|Status}} card, $Exhaust it.",
    Rarity = "Shop",
    Flavor = "\"Has everything you need! Anti-itch, anti-burn, anti-venom, and more!\"",
  },
  ["Membership Card"] = {
    Image = "MembershipCard.png",
    Description = "50% discount on all products!",
    Rarity = "Shop",
    Flavor = "\"Bonus membership offer for my most valuable customers!\"",
  },
  ["Orange Pellets"] = {
    Image = "OrangePellets.png",
    Description = "Whenever you play a {{QueryLink|Cards|type:Power|Power}}, {{QueryLink|Cards|type:Attack|Attack}}, and {{QueryLink|Cards|type:Skill|Skill}} in the same turn, remove all of your [[Debuffs|debuffs]].",
    Rarity = "Shop",
    Flavor = "Made from various fungi found throughout the Spire, they will stave off any affliction.",
  },
  ["Orrery"] = {
    Image = "Orrery.png",
    Description = "Upon pickup, choose and add 5 cards to your deck.",
    Rarity = "Shop",
    Flavor = "\"Once you understand the universe...\" - Zoroth",
  },
  ["Prismatic Shard"] = {
    Image = "PrismaticShard.png",
    Description = "Combat reward screens now contain {{QueryLink|Cards|color:Colorless|Colorless}} cards and cards from other colors.",
    Rarity = "Shop",
    Flavor = "Looking through the shard, you are able to see entirely new perspectives.",
  },
  ["Sling of Courage"] = {
    Image = "Sling.png",
    Description = "Start each Elite combat with 2 $Strength.",
    Rarity = "Shop",
    Flavor = "A handy tool for dealing with particularly tough opponents.",
  },
  ["Strange Spoon"] = {
    Image = "StrangeSpoon.png",
    Description = "Cards which $Exhaust when played will instead discard 50% of the time.",
    Rarity = "Shop",
    Flavor = "Staring at the spoon, it appears to bend and twist around before your eyes.",
  },
  ["The Abacus"] = {
    Image = "TheAbacus.png",
    Description = "Whenever you shuffle your draw pile, gain 6 $Block.",
    ID = "Abacus",
    Rarity = "Shop",
    Flavor = "One...Two...Three...",
  },
  ["Toolbox"] = {
    Image = "Toolbox.png",
    Description = "At the start of each combat, choose 1 of 3 random {{QueryLink|Cards|color:Colorless|Colorless}} cards and add the chosen card into your hand.",
    Rarity = "Shop",
    Flavor = "A tool for every job.",
  },
  ["Brimstone"] = {
    Image = "Brimstone.png",
    Description = "At the start of your turn, gain 2 $Strength and ALL enemies gain 1 $Strength.",
    Rarity = "Shop",
    Character = "Ironclad",
    Flavor = "Emanates an infernal heat.",
  },
  ["Twisted Funnel"] = {
    Image = "TwistedFunnel.png",
    Description = "At the start of each combat, apply 4 $Poison to ALL enemies.",
    ID = "Funnel",
    Rarity = "Shop",
    Character = "Silent",
    Flavor = "I wouldn't drink out of it.",
  },
  ["Runic Capacitor"] = {
    Image = "RunicCapacitor.png",
    Description = "Start each combat with 3 additional $Orb slots.",
    Rarity = "Shop",
    Character = "Defect",
    Flavor = "More is better.",
  },
  ["Melange"] = {
    Image = "Melange.png",
    Description = "Whenever you shuffle your draw pile, $Scry 3.",
    Rarity = "Shop",
    Character = "Watcher",
    Flavor = "Mysterious sands from an unknown origin. Smells of cinnamon.",
  },
  ["Astrolabe"] = {
    Image = "Astrolabe.png",
    Description = "Upon pickup, $Transform 3 cards, then $Upgrade them.",
    Rarity = "Boss",
    Flavor = "A tool to glean invaluable knowledge from the stars.",
  },
  ["Black Star"] = {
    Image = "BlackStar.png",
    Description = "Elites now drop an additional relic when defeated.",
    Rarity = "Boss",
    Flavor = "Originally discovered in the town of the serpent, aside a solitary candle.",
  },
  ["Busted Crown"] = {
    Image = "BustedCrown.png",
    Description = "Gain 1 $Energy at the start of your turn. Future card rewards have 2 less cards to choose from.",
    Rarity = "Boss",
    Flavor = "The Champ's crown... or a pale imitation?",
  },
  ["Calling Bell"] = {
    Image = "CallingBell.png",
    Description = "Upon pickup, obtain a unique {{QueryLink|Cards|type:Curse|Curse}} and 3 relics.",
    Rarity = "Boss",
    Flavor = "This dark iron bell rang 3 times when you found it, but now stays silent.",
  },
  ["Coffee Dripper"] = {
    Image = "CoffeeDripper.png",
    Description = "Gain 1 $Energy at the start of your turn. You can no longer Rest at Rest Sites.",
    Rarity = "Boss",
    Flavor = "\"Yes, another cup please. Back to work. Back to work!\" - The Architect",
  },
  ["Cursed Key"] = {
    Image = "CursedKey.png",
    Description = "Gain 1 $Energy at the start of your turn. Whenever you open a non-Boss chest, obtain a {{QueryLink|Cards|type:Curse|Curse}}.",
    Rarity = "Boss",
    Flavor = "You can feel the malicious energy emanating from the key. Power comes at a price.",
  },
  ["Ectoplasm"] = {
    Image = "Ectoplasm.png",
    Description = "Gain 1 $Energy at the start of your turn. You can no longer gain [[Gold]].",
    Rarity = "Boss",
    Flavor = "This blob of slime and energy seems to pulse with life.",
    Requirement = {
        max_floor = 18
    }
  },
  ["Empty Cage"] = {
    Image = "EmptyCage.png",
    Description = "Upon pickup, remove 2 cards from your deck.",
    Rarity = "Boss",
    Flavor = "\"How unusual to cage that which you worship.\" - Ranwid",
  },
  ["Fusion Hammer"] = {
    Image = "FusionHammer.png",
    Description = "Gain 1 $Energy at the start of your turn. You can no longer Smith at Rest Sites.",
    Rarity = "Boss",
    Flavor = "Once wielded, the owner can never let go.",
  },
  ["Pandora's Box"] = {
    Image = "PandorasBox.png",
    Description = "Upon pickup, $Transform all Strike and Defend cards.",
    Rarity = "Boss",
    Flavor = "You have a bad feeling about opening this.",
  },
  ["Philosopher's Stone"] = {
    Image = "PhilosophersStone.png",
    Description = "Gain 1 $Energy at the start of your turn. ALL enemies start combat with 1 $Strength.",
    Rarity = "Boss",
    Flavor = "Raw energy emanates from the stone, empowering all nearby.",
  },
  ["Runic Dome"] = {
    Image = "RunicDome.png",
    Description = "Gain 1 $Energy at the start of your turn. You can no longer see enemy intents.",
    Rarity = "Boss",
    Flavor = "The runes are indecipherable.",
  },
  ["Runic Pyramid"] = {
    Image = "RunicPyramid.png",
    Description = "At the end of your turn, you no longer discard your hand.",
    Rarity = "Boss",
    Flavor = "The runes are indecipherable.",
  },
  ["Sacred Bark"] = {
    Image = "SacredBark.png",
    Description = "Double the effectiveness of [[Potions|potions]].",
    Rarity = "Boss",
    Flavor = "A bark rumored to originate from the World tree.",
  },
  ["Slaver's Collar"] = {
    Image = "SlaversCollar.png",
    Description = "During Boss and Elite combats, gain 1 $Energy at the start of your turn.",
    Rarity = "Boss",
    Flavor = "Rusty miserable chains.",
  },
  ["Snecko Eye"] = {
    Image = "SneckoEye.png",
    Description = "At the start of your turn, draw 2 additional cards. Start each combat $Confused.",
    Rarity = "Boss",
    Flavor = "An eye of a fallen snecko. Much larger than you imagined.",
  },
  ["Sozu"] = {
    Image = "Sozu.png",
    Description = "Gain 1 $Energy at the start of your turn. You can no longer obtain [[Potions|potions]].",
    Rarity = "Boss",
    Flavor = "You notice that magical liquids seem to lose their properties when near this relic.",
  },
  ["Tiny House"] = {
    Image = "TinyHouse.png",
    Description = "Upon pickup, obtain 1 [[Potions|Potion]]. <br>Gain 50 [[Gold]]. <br>Raise your Max HP by 5. <br>Obtain 1 card. <br>$Upgrade 1 random card.",
    Rarity = "Boss",
    Flavor = "\"A near perfect implementation of miniaturization. My finest work to date, but still not adequate.\" - The Architect",
  },
  ["Velvet Choker"] = {
    Image = "VelvetChoker.png",
    Description = "Gain 1 $Energy at the start of your turn. You cannot play more than 6 cards per turn.",
    Rarity = "Boss",
    Flavor = "\"Immense power, but too limited.\" - Kublai the Great",
  },
  ["Black Blood"] = {
    Image = "BlackBlood.png",
    Description = "Replaces {{R|Burning Blood}}. At the end of combat, heal 12 HP.",
    Rarity = "Boss",
    Character = "Ironclad",
    Flavor = "The rage grows darker.",
  },
  ["Mark of Pain"] = {
    Image = "MarkofPain.png",
    Description = "Gain 1 $Energy at the start of your turn. At the start of combat, shuffle 2 {{C|Wound|Wounds}} into your draw pile.",
    Rarity = "Boss",
    Character = "Ironclad",
    Flavor = "This brand was used by the northern tribes to signify warriors who had mastered pain in battle.",
  },
  ["Runic Cube"] = {
    Image = "RunicCube.png",
    Description = "Whenever you lose HP, draw 1 card.",
    Rarity = "Boss",
    Character = "Ironclad",
    Flavor = "The runes are indecipherable.",
  },
  ["Hovering Kite"] = {
    Image = "HoveringKite.png",
    Description = "The first time you discard a card each turn, gain 1 $Energy.",
    Rarity = "Boss",
    Character = "Silent",
    Flavor = "The Kite floats around you in battle, propelled by a mysterious force.",
  },
  ["Ring of the Serpent"] = {
    Image = "RingoftheSerpent.png",
    Description = "Replaces {{R|Ring of the Snake}}. At the start of your turn, draw 1 additional card.",
    Rarity = "Boss",
    Character = "Silent",
    Flavor = "Your ring has morphed and changed forms.",
  },
  ["Wrist Blade"] = {
    Image = "WristBlade.png",
    Description = "{{QueryLink|Cards|type:Attack|Attacks}} that cost 0 deal 4 additional damage.",
    Rarity = "Boss",
    Character = "Silent",
    Flavor = "Handy for assassinations.",
  },
  ["Frozen Core"] = {
    Image = "FrozenCore.png",
    Description = "Replaces {{R|Cracked Core}}. If you end your turn with any empty $Orb slots, $Channel 1 $Frost.",
    Rarity = "Boss",
    Character = "Defect",
    Flavor = "The crack in your core has been filled with a pulsating cold energy.",
  },
  ["Inserter"] = {
    Image = "Inserter.png",
    Description = "Every 2 turns, gain 1 $Orb slot.",
    Rarity = "Boss",
    Character = "Defect",
    Flavor = "Push. Pull. Stack. Repeat.",
  },
  ["Nuclear Battery"] = {
    Image = "NuclearBattery.png",
    Description = "At the start of each combat, $Channel 1 $Plasma.",
    Rarity = "Boss",
    Character = "Defect",
    Flavor = "Ooooh...",
  },
  ["Holy Water"] = {
    Image = "HolyWater.png",
    Description = "Replaces {{R|Pure Water}}. At the start of each combat, add 3 {{C|Miracle|Miracles}} into your hand.",
    Rarity = "Boss",
    Character = "Watcher",
    Flavor = "Collected from a time before the Spire.",
  },
  ["Violet Lotus"] = {
    Image = "VioletLotus.png",
    Description = "Whenever you exit $Calm, gain an additional $Energy.",
    Rarity = "Boss",
    Character = "Watcher",
    Flavor = "The old texts describe that the surface of \"mana pools\" were littered with these flowers.",
  },
  ["Bloody Idol"] = {
    Image = "BloodyIdol.png",
    Description = "Whenever you gain [[Gold]], heal 5 HP.",
    Flavor = "The idol now weeps a constant stream of blood.",
    Rarity = "Event",
    EventIcon = "ForgottenAltar.png",
    EventName = "Forgotten Altar",
  },
  ["Cultist Headpiece"] = {
    Image = "CultistMask.png",
    Description = "You feel more talkative.",
    Flavor = "Part of the Flock!",
    Rarity = "Event",
    EventIcon = "FaceTrader.png",
    EventName = "Face Trader",
  },
  ["Enchiridion"] = {
    Image = "Enchiridion.png",
    Description = "At the start of each combat, add a random {{QueryLink|Cards|type:Power|Power}} card into your hand. It costs 0 for that turn.",
    Flavor = "The legendary journal of an ancient lich.",
    Rarity = "Event",
    EventIcon = "CursedTome.png",
    EventName = "Cursed Tome",
  },
  ["Face of Cleric"] = {
    Image = "FaceOfCleric.png",
    Description = "At the end of combat, raise your Max HP by 1.",
    Flavor = "Everyone loves Cleric.",
    Rarity = "Event",
    EventIcon = "FaceTrader.png",
    EventName = "Face Trader",
  },
  ["Golden Idol"] = {
    Image = "GoldenIdol.png",
    Description = "Enemies drop 25% more [[Gold]].",
    Flavor = "Made of solid gold, you feel richer just holding it.",
    Link = "Golden_Idol_(Relic)",
    Rarity = "Event",
    EventIcon = "GoldenIdol.png",
    EventName = "Golden Idol",
  },
  ["Gremlin Visage"] = {
    Image = "GremlinMask.png",
    Description = "Start each combat with 1 $Weak.",
    Flavor = "Time to run.",
    Rarity = "Event",
    EventIcon = "FaceTrader.png",
    EventName = "Face Trader",
  },
  ["Mark of the Bloom"] = {
    Image = "MarkoftheBloom.png",
    Description = "You can no longer heal.",
    Flavor = "In the Beyond, thoughts and reality are one.",
    Rarity = "Event",
    EventIcon = "MindBloom.png",
    EventName = "Mind Bloom",
  },
  ["Mutagenic Strength"] = {
    Image = "MutagenicStrength.png",
    Description = "Start each combat with 3 $Strength. At the end of your first turn, lose 3 $Strength.",
    Flavor = "\"The results seem fleeting, triggering when the subject is in danger.\" - Unknown",
    Rarity = "Event",
    EventIcon = "Augmenter.png",
    EventName = "Augmenter",
  },
  ["N'loth's Gift"] = {
    Image = "NlothsGift.png",
    Description = "Triples the chance of finding {{QueryLink|Cards|rarity:Rare|Rare}} cards from combat rewards.",
    Flavor = "The strange gift from N'loth. Whenever you try and unwrap it, another wrapped box of the same size lies within.",
    Rarity = "Event",
    EventIcon = "Nloth.png",
    EventName = "N'loth",
  },
  ["N'loth's Hungry Face"] = {
    Image = "NlothsMask.png",
    Description = "The next non-Boss chest you open is empty.",
    Flavor = "You feel hungry.",
    Rarity = "Event",
    EventIcon = "FaceTrader.png",
    EventName = "Face Trader",
  },
  ["Necronomicon"] = {
    Image = "Necronomicon.png",
    Description = "The first {{QueryLink|Cards|type:Attack|Attack}} played each turn that costs 2 or more is played twice. Upon pickup, obtain a special {{QueryLink|Cards|type:Curse|Curse}}.",
    Flavor = "Only a fool would try and harness this evil power. At night your dreams are haunted by images of the book devouring your mind.",
    Rarity = "Event",
    EventIcon = "CursedTome.png",
    EventName = "Cursed Tome",
  },
  ["Neow's Lament"] = {
    Flavor = "The blessing of lamentation bestowed by Neow.",
    Image = "NeowsBlessing.png",
    Description = "Enemies in your first 3 combats will have 1 HP.",
    ID = "NeowsBlessing",
    Rarity = "Event",
    EventIcon = "Neow.png",
    EventName = "Neow",
  },
  ["Nilry's Codex"] = {
    Image = "NilrysCodex.png",
    Description = "At the end of each turn, you may shuffle 1 of 3 random cards to shuffle into your draw pile.",
    Flavor = "Crafted by the infamous game master himself. Said to expand one's mind.",
    Rarity = "Event",
    EventIcon = "CursedTome.png",
    EventName = "Cursed Tome",
  },
  ["Odd Mushroom"] = {
    Image = "OddMushroom.png",
    Description = "When $Vulnerable, take 25% more attack damage rather than 50%.",
    Flavor = "\"After consuming trichella parastius I felt larger and less... susceptible.\" - Ranwid ",
    Rarity = "Event",
    EventIcon = "HypnotizeMushroom.png",
    EventName = "Hypnotizing Colored Mushroom",
  },
  ["Red Mask"] = {
    Image = "RedMask.png",
    Event02Name = "Tome of Lord Red Mask",
    EventName = "Masked Bandits",
    Event02Icon = "RedMaskTomeIcon.png",
    Description = "At the start of each combat, apply 1 $Weak to ALL enemies.",
    Rarity = "Event",
    Flavor = "This very stylish looking mask belongs to the leader of the Red Mask Bandits. Technically that makes you the leader now?",
    EventIcon = "BanditsIcon.png",
  },
  ["Spirit Poop"] = {
    Image = "SpiritPoop.png",
    Description = "It's unpleasant.",
    Flavor = "The charred remains of your offering to the spirits.",
    Rarity = "Event",
    EventIcon = "Bonfire.png",
    EventName = "Bonfire Spirits",
  },
  ["Ssserpent Head"] = {
    Flavor = "The most fulfilling of lives is that in which you can buy anything!",
    Image = "SsserpentHead.png",
    Description = "Whenever you enter a ? room, gain 50 [[Gold]].",
    ID = "Serpent Head",
    Rarity = "Event",
    EventIcon = "FaceTrader.png",
    EventName = "Face Trader",
  },
  ["Warped Tongs"] = {
    Image = "WarpedTongs.png",
    Description = "At the start of your turn, $Upgrade a random card in your hand for the rest of combat.",
    Flavor = "The cursed tongs emit a strong desire to return to where they were stolen from.",
    Rarity = "Event",
    EventIcon = "OminiousForge.png",
    EventName = "Ominous Forge",
  },
  ["Circlet"] = {
    Image = "Circlet.png",
    Description = "Collect as many as you can.",
    Rarity = "Special",
    Flavor = "You ran out of relics to find. Impressive!",
  },
  ["Red Circlet"] = {
    Image = "RedCirclet.png",
    Rarity = "Special",
    Flavor = "Looks very pretty.",
    Description = "You ran out of relics. Impressive!",
  },
  ["Grotesque Trophy"] = {
    Image = "GrotesqueTrophy.png",
    Description = "Upon pickup, obtain 3 {{C|Pride|Prides}}.",
    Rarity = "Blight",
    Requirement = { endless = true },
    Link = "Custom_Mode#Blights",
  },
  ["Mimic Infestation"] = {
    Image = "MimicInfestation.png",
    Description = "Treasure rooms in future acts are replaced by Elites. Elites no longer drop Relics.",
    Rarity = "Blight",
    Requirement = { endless = true },
    Link = "Custom_Mode#Blights",
  },
  ["Muzzle"] = {
    Image = "Muzzle.png",
    Description = "You can no longer increase your Max HP. All healing is halved.",
    Rarity = "Blight",
    Requirement = { endless = true },
    Link = "Custom_Mode#Blights",
  },
  ["Shield of Blight"] = {
    Image = "BlightShield.png",
    Description = "Enemies have 50% more HP.",
    Rarity = "Blight",
    Requirement = { endless = true },
    Link = "Custom_Mode#Blights",
  },
  ["Spear of Blight"] = {
    Image = "BlightSpear.png",
    Description = "Enemies deal 100% more damage.",
    Rarity = "Blight",
    Requirement = { endless = true },
    Link = "Custom_Mode#Blights",
  },
  ["Time Maze"] = {
    Image = "TimeMaze.png",
    Description = "	You cannot play more than 15 cards per turn.",
    Rarity = "Blight",
    Requirement = { endless = true },
    Link = "Custom_Mode#Blights",
  },
  ["Accursed"] = {
    Image = "Accursed.png",
    Description = "Whenever you defeat a Boss, obtain 2 random {{QueryLink|Cards|type:Curse|Curses}}.",
    Requirement = { blight_chest = true },
    Rarity = "Blight",
    Link = "Custom_Mode#Blights",
  },
  ["Ancient Augmentation"] = {
    Image = "AncientAugmentation.png",
    Description = "Enemies start combat with 1 $Artifact, 10 $Plated Armor, and 10 $Regenerate.",
    Requirement = { blight_chest = true },
    Rarity = "Blight",
    Link = "Custom_Mode#Blights",
  },
  ["Post-Durian"] = {
    Image = "Durian.png",
    Description = "Lose 50% of your Max HP.",
    Requirement = { blight_chest = true },
    Rarity = "Blight",
    Link = "Custom_Mode#Blights",
  },
  ["Hauntings"] = {
    Image = "Hauntings.png",
    Description = "Enemies start combat with 1 $Intangible.",
    Requirement = { blight_chest = true },
    Rarity = "Blight",
    Link = "Custom_Mode#Blights",
  },
  ["Scatterbrain"] = {
    Image = "Scatterbrain.png",
    Description = "Draw 1 less card a turn.",
    Requirement = { blight_chest = true },
    Rarity = "Blight",
    Link = "Custom_Mode#Blights",
  },
  ["Twisting Mind"] = {
    Image = "TwistingMind.png",
    Description = "At the end of your turn, add 1 random {{QueryLink|Cards|type:Status|Status}} card to the top of your draw pile.",
    Requirement = { blight_chest = true },
    Rarity = "Blight",
    Link = "Custom_Mode#Blights",
  },
  ["Void Essence"] = {
    Image = "VoidEssence.png",
    Description = "	Lose 1 $Energy permanently.",
    Requirement = { blight_chest = true },
    Rarity = "Blight",
    Link = "Custom_Mode#Blights",
  },
}

local formatted = {}
for name, relic in pairs(all_data) do
	relic.EditLink = "Module:Relics/data"
	formatted[name] = relic
end

return formatted