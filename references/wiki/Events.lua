return {
	-- Common Events (Appears in all Acts)
	["A Note For Yourself"] = {
		Name = "A Note For Yourself",
		Description = "You find a note containing a card. You may choose to ''Take'' the stored card and ''Give'' a card in your deck in return, leaving it with a note so that you may have a chance to retrieve it in another run.",
		Flavor = "You spot a loose brick within a pillar that catches your eye.",
		Image = "SelfNote.png",
		Shrine = true
	},
	["Bonfire Spirits"] = {
		Name = "Bonfire Spirits",
		Description = "You come across a bonfire surrounded by spirits. You may choose to ''Offer'' a card to the spirits and receive a reward according to its rarity.",
		Flavor = "You happen upon a group of what looks like purple fire spirits dancing around a large bonfire.",
		Image = "BonfireSpirits.png",
		Shrine = true
	},
	["The Divine Fountain"] = {
		Name = "The Divine Fountain",
		Description = "You encounter a fountain of sacred water with a power to cleanse you of '''Curses'''.",
		Flavor = "You come across shimmering water flowing endlessly from a fountain on a nearby wall.",
		Image = "DivineFountain.png",
		Shrine = true
	},
	["Duplicator"] = {
		Name = "Duplicator",
		Description = "You encounter a shrine with the power to duplicate a card in your deck.",
		Flavor = "Before you lies a decorated altar to some ancient entity.",
		Image = "Duplicator.png",
		Shrine = true
	},
	["Golden Shrine"] = {
		Name = "Golden Shrine",
		Description = "You encounter a shrine made of gold. You can choose to pray for gold or destroy it for more and become '''Cursed'''.",
		Flavor = "Before you lies an elaborate shrine to an ancient spirit.",
		Image = "GoldenShrine.png",
		Shrine = true
	},
	["Lab"] = {
		Name = "Lab",
		Description = "You find a lab filled with potions, collecting 3 of them.",
		Flavor = "You find yourself in a room filled with racks of test tubes, pinch clamps, funnels, and even a rare spiral tube of glass.",
		Image = "Lab.png",
		Shrine = true
	},
	["Match and Keep"] = {
		Name = "Match and Keep",
		Description = "You are forced to play a card matching game. You get 5 attempts, any cards you match will be added to your deck, even '''Curses'''.",
		Flavor = "\"Twelve cards! Match them to keep them! Five tries, no do-overs.\"",
		Image = "MatchAndKeep.png",
		Shrine = true
	},
	["Ominous Forge"] = {
		Name = "Ominous Forge",
		Description = "You come across a forge, you can choose to '''Upgrade''' a card or obtain a '''Relic''' along with a '''Curse'''.",
		Flavor = "You duck into a small hut. Inside, you find what appears to be a forge. You feel on edge...",
		Image = "OminousForge.png"
	},
	["Purifier"] = {
		Name = "Purifier",
		Description = "You encounter a shrine with the power to remove a card from your deck.",
		Flavor = "Before you lies an elaborate shrine to a forgotten spirit.",
		Image = "Purifier.png",
		Shrine = true
	},
	["Transmogrifier"] = {
		Name = "Transmogrifier",
		Description = "You encounter a shrine with the power to transform a card in your deck.",
		Flavor = "Before you lies an elaborate shrine to a forgotten spirit.",
		Image = "Transmogrifier.png",
		Shrine = true
	},
	["Upgrade Shrine"] = {
		Name = "Upgrade Shrine",
		Description = "You encounter a shrine with the power to upgrade a card in your deck.",
		Flavor = "Before you lies an elaborate shrine to a forgotten spirit.",
		Image = "UpgradeShrine.png",
		Shrine = true
	},
	["We Meet Again!"] = {
		Name = "We Meet Again!",
		Description = "You encounter an eccentric man who offers a relic in exchange for gold, a potion, or a card.",
		Flavor = "A cheery disheveled fellow approaches you gleefully. You do not know this man.",
		Image = "WeMeetAgain.png",
		Shrine = true
	},
	["Wheel of Change"] = {
		Name = "Wheel of Change",
		Description = "You are forced to spin a wheel to gain a prize, not all of which are positive.",
		Flavor = "\"It's time to spin the wheel! Are you R E A D Y ? Of course you are!\"",
		Image = "SpinTheWheel.png",
		Shrine = true
	},
	["The Woman in Blue"] = {
		Name = "The Woman in Blue",
		Description = "A woman pulls you into a shop and forces you to buy her potions.",
		Flavor = "From the darkness, an arm pulls you into a small shop. As your eyes adjust, you see a pale woman in sharp clothes gesturing towards a wall of potions. \"Buy a potion. Now!\"",
		Image = "LadyInBlue.jpg",
		Shrine = true
	},
	["Designer In-Spire"] = {
		Name = "Designer In-Spire",
		Act = {"2", "3"},
		Description = "You encounter a snobby shop owner who reluctantly offers his services. His services can '''Upgrade''', '''Transform''', or remove some cards from your deck.",
		Flavor = "\"This will not do, no no. What is this style? Disgusting! Are you bleeeeding? Groooss. Business?? You a customer? Fine. Whaaatever.\"",
		Image = "Designer.png",
		Shrine = true
	},
	["Face Trader"] = {
		Name = "Face Trader",
		Act = {"1", "2"},
		Description = "You encounter a strange man who offers a selection of face relics. You can also choose to touch the man, gaining gold in exchange for health.",
		Flavor = "You walk by an eerie statue holding several masks... \"Face. Let me touch? Maybe trade?\"",
		Image = "FaceTrader.png",
		Shrine = true
	},
	-- Act 1 Events
	["Big Fish"] = {
		Name = "Big Fish",
		Act = "1",
		Description = "You choose between a reward of max health, healing, or a relic. However, choosing the relic '''Curses''' you.",
		Flavor = "As you make your way down a long corridor you see a banana, a donut, and a box floating about. What do you do?",
		Image = "BigFish.png"
	},
	["The Cleric"] = {
		Name = "The Cleric",
		Act = "1",
		Description = "You come across a loud and friendly cleric who you can pay to heal you or remove a card from your deck.",
		Flavor = "\"Hello friend! I am Cleric! Are you interested in my services?!\"",
		Image = "Cleric.png"
	},
	["Dead Adventurer"] = {
		Name = "Dead Adventurer",
		Act = "1",
		Description = "You come across an adventurer killed by an elite enemy. You can choose to search for a relic or some gold with the chance that the creature will return.",
		Flavor = "You come across a dead adventurer on the floor. Though his possesions are still intact, you're in no mind to find out what happened here...",
		Image = "DeadAdventurer.png"
	},
	["Golden Idol"] = {
		Name = "Golden Idol",
		Act = "1",
		Link = "Golden_Idol_(Event)",
		Description = "You come across a golden idol. You can choose to walk past, or grab it and choose how to defend yourself.",
		Flavor = "You come across an inconspicuous pedestal with a shining gold idol sitting peacefully atop. It looks incredibly valuable.",
		Image = "GoldenIdol.png"
	},
	["Hypnotizing Colored Mushrooms"] = {
		Name = "Hypnotizing Colored Mushrooms",
		Act = "1",
		Description = "You find an area full of brightly colored mushrooms. You can choose to eat one to heal but obtain a '''Curse''' or fight Fungi Beasts to obtain a special Relic.",
		Flavor = "You enter a corridor full of hypnotizing colored mushrooms. You want to escape, but feel oddly compelled to eat a mushroom.",
		Image = "Mushrooms.png"
	},
	["Living Wall"] = {
		Name = "Living Wall",
		Act = "1",
		Description = "The walls come down around you, in order to pass you must either remove, '''Transform''', or '''Upgrade''' a card.",
		Flavor = "As you come to a dead-end and begin to turn around, walls slam down from the ceiling, trapping you!",
		Image = "LivingWall.png"
	},
	["Scrap Ooze"] = {
		Name = "Scrap Ooze",
		Act = "1",
		Description = "You come across a slime creature who has eaten large amounts of metal scrap. You can choose to pass it, or spend health for a chance to obtain a Relic.",
		Flavor = "Before you is a slime-like creature that ate too much scrap for its own good. It looks like you can get some treasure if you just reach inside its... opening.",
		Image = "ScrapOoze.png"
	},
	["Shining Light"] = {
		Name = "Shining Light",
		Act = "1",
		Description = "You come across a mass of bright light. You can either pass or spend health to '''Upgrade''' two cards.",
		Flavor = "You find a shimmering mass of light encompassing the center of the room. Its warm glow and enchanting patterns invite you in.",
		Image = "ShiningLight.png"
	},
	["The Ssssserpent"] = {
		Name = 'The Ssssserpent',
		Act = "1",
		Description = "You come across a serpent who tempts you to give in to your greed. You can choose to leave, or gain gold and become '''Cursed'''.",
		Flavor = "\"The most fulfilling of lives is that in which you can buy anything! Do you agree?\"",
		Image = "Serpent.png"
	},
	["World of Goop"] = {
		Name = "World of Goop",
		Act = "1",
		Description = "You fall into a puddle of slime which makes you lose some of your gold. You can choose to retrieve it, damaging yourself, or leave it behind.",
		Flavor = "You fall into a puddle. IT'S MADE OF SLIME GOOP!! Frantically, you claw yourself out over several minutes as you feel the goop starting to burn.",
		Image = "Goop.png"
	},
	["Wing Statue"] = {
		Name = "Wing Statue",
		Act = "1",
		Description = "You encounter an ornate wing-shaped statue. You can pray to it to remove a card in exchange for health, or destroy it for some gold.",
		Flavor = "Among the stone and boulders, you notice an intricate large blue statue resembling a wing. You find gold spilling from its cracks. Maybe there is more inside...",
		Image = "WingStatue.png"
	},
	-- Act 2 events. TODO: Add description fields.
	["Ancient Writing"] = {
		Name = "Ancient Writing",
		Act = "2",
		Description = "You encounter a wall covered with the writing of the ancients. You can either remove a single card from your deck or '''Upgrade''' all Strikes and Defends.",
		Flavor = "Scaling the city, you notice a wall covered in the writing of Ancients. As you try and wrap your head around what the puzzling symbols and glyphs could mean, the writing begins to glow.",
		Image = "AncientWriting.png"
	},
	["Augmenter"] = {
		Name = "Augmenter",
		Act = "2",
		Description = "A shady man approaches who wants to do an experiment on you. You choose between {{C|J.A.X.}}, transforming two cards in your deck, and {{R|Mutagenic Strength}}.",
		Flavor = "\"Hey there stranger. Interested in advancing science? I can make you stronger than any training or blessing. You're gonna need it if you're one of those heroes with a death wish.\"",
		Image = "Augmenter.png"
	},
	["The Colosseum"] = {
		Name = "The Colosseum",
		Act = "2",
		Description = "You are kidnapped and trapped in an arena, forced to fight two Slavers. Afterwards, you can either leave or fight a Taskmaster and a Gremlin Nob together for 100 Gold, a card reward, an Uncommon Relic and a Rare Relic.",
		Flavor = "Groggy and with a throbbing head, you awaken to find yourself thrown in the center of a massive stadium with an overflowing audience of Slavers, Cultists, and other denizens of the City!",
		Image = "Colosseum.png"
	},
	["Council of Ghosts"] = {
		Name = "Council of Ghosts",
		Act = "2",
		Description = "A group of apparitions approaches you. One of them offers a taste of their power. You can refuse, or obtain 3 '''Apparitions''' and lose half of your max health.",
		Flavor = "As you continue your ascent, thick black smoke begins to billow out of the ground and walls around you, coalescing into three masked forms that start to speak.",
		Image = "Ghosts.png"
	},
	["Cursed Tome"] = {
		Name = "Cursed Tome",
		Act = "2",
		Description = "You find a cursed tome with insight into Neow's origins. If you choose to read through it, you are damaged by its power. Once finished, you can obtain one of {{R|Necronomicon}}, {{R|Enchiridion}}, {{R|Nilry's Codex}} at random, or leave without it.",
		Flavor = "In an abandoned temple, you find a giant book, open, riddled with cryptic writings. As you try to interpret the elaborate script, it begins to shift and morph into writing you are familiar with.",
		Image = "CursedTome.png"
	},
	["Forgotten Altar"] = {
		Name = "Forgotten Altar",
		Act = "2",
		Description = "You find a statue that requires an offering. Your options are to offer {{R|Golden Idol}} in exchange for {{R|Bloody Idol}}, gain max health but become damaged, or desecrate it and become '''Cursed'''.",
		Flavor = "In front of you sits an altar to a forgotten god. Atop the altar sits an ornate female statue with arms outstretched. She calls out to you, demanding sacrifice.",
		Image = "ForgottenAltar.png"
	},
	["The Joust"] = {
		Name = "The Joust",
		Act = "2",
		Description = "A knight settles the score with the murderer of his pet. He tells you to bet on who you think will emerge victorious.",
		Flavor = "A knight forcefully gestures you to stop with its giant lance. \"Today is the day I must settle the score with the murderer of my beloved pet, Noodles.\" \"Fellow witness, why don't you bet on who you think will emerge victorious?\"",
		Image = "Joust.png",
		Shrine = true
	},
	["Knowing Skull"] = {
		Name = "Knowing Skull",
		Act = "2",
		Description = "You encounter a talking skull that can grant many rewards in exchange for health.",
		Flavor = "You find yourself in an old, decorated chamber. In the center of the room, a large skull sits atop an ornate pedestal. As you approach, the skull bursts into flames and turns to face you.",
		Image = "KnowingSkull.png",
		Shrine = true
	},
	["The Library"] = {
		Name = "The Library",
		Act = "2",
		Description = "You encounter an ornate library. You can rest to restore your health, or choose from a selection of 20 cards to add to your deck.",
		Flavor = "You come across an ornate building which appears abandoned. A plaque that has been torn free from a wall is on the floor. It reads, \"THE LIBRARY\".",
		Image = "Library.png"
	},
	["Masked Bandits"] = {
		Name = "Masked Bandits",
		Act = "2",
		Description = "A group of bandits stops you and forces you to pay all of your gold to pass. You can fight the bandits for {{R|Red Mask}}, or pay up to skip the fight.",
		Flavor = "You encounter a group of bandits wearing large red masks. \"Hello, pay up to pass... a reasonable fee of ALL your gold will do! Heh heh!\"",
		Image = "MaskedBandits.png"
	},
	["The Mausoleum"] = {
		Name = "The Mausoleum",
		Act = "2",
		Description = "You find a large sarcophagus with black goo leaking out of it. You can either leave safely, or open it for a Relic and possibly ({{Asc|15|definitely}}) become '''Cursed''' with {{C|Writhe}}.",
		Flavor = "Venturing through a series of tombs, you are faced with a large sarcophagus studded with gems. You cannot make out the writing on the coffin, however, you do notice black goo seeping out from the sides.",
		Image = "Mausoleum.png"
	},
	["The Nest"] = {
		Name = "The Nest",
		Act = "2",
		Description = "You join a long line of Cultists. You see a donation box that you can safely loot 99 {{Asc|15|(50)}} Gold from, or keep following and steal the {{C|Ritual Dagger}} by taking part in the ritual.",
		Flavor = "A long line of hooded figures can be seen entering an unassuming cathedral. Naturally, you join the line and are quickly surrounded by Cultists! They ignore you as they gleefully chant and wave their weapons around.",
		Image = "TheNest.png"
	},
	["N'loth"] = {
		Name = "N'loth",
		Act = "2",
		Description = "A strange creature offers you a gift in exchange for a relic for him to feed on.",
		Flavor = "An odd creature with a hunched back sprouting several tentacles is scrounging through a pile of trash in front of you. He shuffles towards you in a non-threatening manner. \"N'loth hungry. Feed N'loth.\"",
		Image = "Nloth.png",
		Shrine = true
	},
	["Old Beggar"] = {
		Name = "Old Beggar",
		Act = "2",
		Description = "An old beggar asks for you to give some Gold to him.",
		Flavor = "An old beggar cloaked in fur reaches his hands out towards you as you pass. \"Spare some coin, child?\"",
		Image = "Beggar.png"
	},
	["Pleading Vagrant"] = {
		Name = "Pleading Vagrant",
		Act = "2",
		Description = "You encounter a homeless beggar who offers a Relic in exchange for gold. You can also rob him of it and become '''Cursed''', or leave.",
		Flavor = "While sneaking past a group of shrouded figures, one of them approaches you. \"Got anything for me friend? Please... maybe some Coin?\" \"I just need somewhere to stay, I have treasures I can trade...\"",
		Image = "Vagrant.png"
	},
	["Vampires"] = {
		Name = "Vampires(?)",
		Act = "2",
		Description = "A group of hooded figures taking part in some kind of ritual offer to let you join. Joining the ritual replaces all Strikes with {{C|Bite}} cards in exchange for 30% of your max HP. If you have the {{R|Blood Vial}}, you may exchange it instead of losing max HP.",
		Flavor = "Navigating an unlit street, you come across several hooded figures in the midst of some dark ritual. The tallest among them bares fanged teeth and extends a long, pale hand towards you.",
		Image = "Vampires.png"
	},
	-- Act 3 Events
	["Falling"] = {
		Name = "Falling",
		Act = "3",
		Description = "You slip off one of the floating platforms in the Beyond. In order to land safely, you are forced to sacrifice a card.",
		Flavor = "As you head upwards hopping from one floating shape to another, you slip. You begin to fall. While in free fall you consider your options...",
		Image = "Falling.png"
	},
	["Mind Bloom"] = {
		Name = "Mind Bloom",
		Act = "3",
		Description = "Your imagination manifests into reality. In this ephemeral moment, all your wishes can come true, though not without consequences.",
		Flavor = "While walking and traversing through the chaos of the Spire, your thoughts suddenly begin to feel very... real... Imaginings of monsters and riches begin to manifest themselves into reality.",
		Image = "MindBloom.png"
	},
	["The Moai Head"] = {
		Name = "The Moai Head",
		Act = "3",
		Description = "An oddly placed Moai head is along your path. It is covered with depictions of people throwing themselves into its mouth. You can choose to do the same, or offer {{R|Golden Idol}} for riches.",
		Flavor = "You stumble across something that feels * very* out of place. Before you, an enormous stony head emerges from a large wall segment that does not shift and change like the rest of this area.",
		Image = "MoaiHead.png"
	},
	["Mysterious Sphere"] = {
		Name = "Mysterious Sphere",
		Act = "3",
		Description = "You come across a treasure encased in a sphere of bone, with automatons guarding it.",
		Flavor = "Jutting from the chaotic terrain around you, a bony sphere surrounds a mysterious glowing object within. While you are curious what lies inside, you notice some sentries keeping an eye on it.",
		Image = "Sphere.png"
	},
	["Secret Portal"] = {
		Name = "Secret Portal",
		Act = "3",
		Description = "You encounter a strange mystical portal with the power to send you directly to the boss of the Beyond.",
		Flavor = "Strangely placed into one of the living walls of the Beyond is an enclosed stone entrance filled with a swirling magical portal. You aren't sure where it leads, but maybe it could speed your journey through the Spire.",
		Image = "SecretPortal.png",
		Shrine = true
	},
	["Sensory Stone"] = {
		Name = "Sensory Stone",
		Act = "3",
		Description = "You find a glowing tesseract containing distant memories. It offers Colorless cards, but the more you ask for, the more damage you take.",
		Flavor = "Navigating through the Beyond, you discover a glowing tesseract spinning and shifting gently in the air. You touch it. A sharp pain flows through you, followed by vivid flashes of a distant memory. ...whose memories are these?",
		Image = "SensoryStone.png"
	},
	["Tomb of Lord Red Mask"] = {
		Name = "Tomb of Lord Red Mask",
		Act = "3",
		Description = "You come across a mysterious tomb in the Beyond. You can offer all of your coins for the {{R|Red Mask}}, or put it on yourself for Gold if you already have it.",
		Flavor = "A highly ornamented tomb can be seen on the other side of a floating path. Upon reaching the tomb, you notice a slot for gold coins with a scratched out inscription above it.",
		Image = "RedMaskTomb.png"
	},
	["Winding Halls"] = {
		Name = "Winding Halls",
		Act = "3",
		Description = "You get lost in the ever-shifting labyrinth of the Beyond, all while disembodied whispers drive you into madness. You must choose how to proceed.",
		Flavor = "As you slowly make your way up the twisting pathways, you constantly find yourself losing your way as the walls and ground seem to inexplicably shift before your eyes.",
		Image = "WindingHalls.png"
	}
}