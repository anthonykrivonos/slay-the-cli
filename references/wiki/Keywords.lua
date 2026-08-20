local all_data = {
  Icons = {
    ["Red Energy"] = {
      Code = "@RE",
      Text = "The [[Ironclad]]'s Energy orb. Energy is a resource used to play cards.",
      Link = "Keywords#Energy",
      Image = "RedEnergy.png",
    },
    ["Green Energy"] = {
      Code = "@GE",
      Text = "The [[Silent]]'s Energy orb. Energy is a resource used to play cards.",
      Link = "Keywords#Energy",
      Image = "GreenEnergy.png",
    },
    ["Blue Energy"] = {
      Code = "@BE",
      Text = "The [[Defect]]'s Energy orb. Energy is a resource used to play cards.",
      Link = "Keywords#Energy",
      Image = "BlueEnergy.png",
    },
    ["Purple Energy"] = {
      Code = "@PE",
      Text = "The [[Watcher]]'s Energy orb. Energy is a resource used to play cards.",
      Link = "Keywords#Energy",
      Image = "PurpleEnergy.png",
      Size = "20px",
    },
    ["Colorless Energy"] = {
      Code = "@CE",
      Text = "The generic Energy icon found on all Colorless cards. Energy is a resource used to play cards.",
      Link = "Keywords#Energy",
      Image = "ColorlessEnergy.png",
    },
    ["Lightning Orb"] = {
      Code = "@LO",
      Text = "The Defect's Lighting Orb.",
      Link = "Keywords#Orb_Types",
      Image = "LightningOrb.png",
    },
    ["Frost Orb"] = {
      Code = "@FO",
      Text = "The Defect's Frost Orb.",
      Link = "Keywords#Orb_Types",
      Image = "FrostOrb.png",
    },
    ["Dark Orb"] = {
      Code = "@DO",
      Text = "The Defect's Dark Orb.",
      Link = "Keywords#Orb_Types",
      Image = "DarkOrb.png",
    },
    ["Plasma Orb"] = {
      Code = "@PO",
      Text = "The Defect's Plasma Orb.",
      Link = "Keywords#Orb_Types",
      Image = "PlasmaOrb.png",
    },
  },
  Keywords = {
    -- Common Mechanics
    ["Block"] = {
      Code = "$Block",
      Text = "Until next turn, prevents damage.",
      Link = "Block",
      Image = "Icon_Block.png",
    },
    ["Energy"] = {
      Code = "$Energy",
      Text = "Resource used to play cards.",
      Link = "Keywords#Energy",
      Image = "ColorlessEnergy.png",
    },
    ["Ethereal"] = {
      Code = "$Ethereal",
      Text = "If an Ethereal card is in your hand at the end of your turn, it is $Exhausted. <br>$Exhausted cards are removed from your deck until the end of combat.",
      Link = "Keywords#Ethereal",
    },
    ["Exhaust"] = {
      Code = "$Exhaust",
      Text = "Removed until end of combat.",
      Link = "Keywords#Exhaust",
    },
    ["Fatal"] = {
      Code = "$Fatal",
      Text = "Fatal effects occur when a card kills a '''non-minion''' enemy.",
      Link = "Fatal"
    },
    ["Innate"] = {
      Code = "$Innate",
      Text = "Start each combat with this card in your hand.",
      Link = "Keywords#Innate",
    },
    ["Retain"] = {
      Code = "$Retain",
      Text = "Retained cards are not discarded at the end of your turn.",
      Link = "Keywords#Retain",
    },
    ["Transform"] = {
      Code = "$Transform",
      Text = "Transformed cards become a random card of any rarity.",
      Link = "Transform",
    },
    ["Upgrade"] = {
      Code = "$Upgrade",
      Text = "Upgrading cards makes them more powerful. Most cards can only be upgraded once.",
      Link = "Upgrade",
    },
    ["Unplayable"] = {
      Code = "$Unplayable",
      Text = "Unplayable cards cannot be played from your hand.",
      Link = "Keywords#Unplayable",
    },

    -- Common Effects that are also Keywords
    ["Artifact"] = {
      Code = "$Artifact",
      Text = "Negates the next debuff.",
      Link = "Artifact",
      Image = "Icon_Artifact.png",
    },
    ["Dexterity"] = {
      Code = "$Dexterity",
      Text = "Dexterity improves $Block gained from cards.",
      Link = "Dexterity",
      Image = "Icon_Dexterity.png",
    },
    ["Intangible"] = {
      Code = "$Intangible",
      -- Ingame text does not tell it lasts X turns
      Text = "Reduce ALL damage taken and HP loss to 1.",
      Link = "Buffs#Intangible",
      Image = "Icon_Intangible.png",
    },
    ["Strength"] = {
      Code = "$Strength",
      Text = "Strength adds additional damage to '''Attacks'''",
      Link = "Strength",
      Image = "Icon_Strength.png",
    },
    ["Thorns"] = {
      Image = "Icon_Thorns.png",
      Text = "When recieving '''Attack''' damage, deals damage back",
      Code = "$Thorns",
      Link = "Buffs#Thorns",
    },
    ["Vulnerable"] = {
      Code = "$Vulnerable",
      Text = "Vulnerable creatures take 50% damage from '''Attacks'''",
      Link = "Vulnerable",
      Image = "Icon_Vulnerable.png",
    },
    ["Weak"] = {
      Code = "$Weak",
      Text = "Weakened creatures deal 25% less damage with '''Attacks'''",
      Link = "Weak",
      Image = "Icon_Weak.png",
    },
    -- Common Effects, remove after the keyword/power split
    ["Buffer"] = {
      Code = "$Buffer",
      Text = "Prevent the next X times you would lose HP.",
      Link = "Buffer",
      Image = "Icon_Buffer.png",
    },
    ["Confused"] = {
      Code = "$Confused",
      Text = "Whenever you draw a card, randomize its cost.",
      Link = "Snecko_Eye",
      Image = "Icon_Confused.png",
    },
    ["Dexterity Down"] = {
      Code = "$Dexterity Down",
      Text = "At the end of this turn, lose X $Dexterity.",
      Link = "Debuffs#Dexterity_Down",
      Image = "Icon_StrengthDown.png",
    },
    ["Draw Card"] = {
      Code = "$Draw Card",
      Text = "Draw X additional cards next turn.",
      Link = "Buffs#Draw_Card",
      Image = "Icon_DrawCard.png",
    },
    ["Frail"] = {
      Code = "$Frail",
      Text = "Gain 25% less $Block from cards for X turns.",
      Link = "Debuffs#Frail",
      Image = "Icon_Frail.png",
    },
    ["Next Turn Block"] = {
      Code = "$Next Turn Block",
      Text = "Gain X $Block next turn.",
      Link = "Dodge_And_Roll",
      Image = "Icon_NextTurnBlock.png",
    },
    ["No Draw"] = {
      Code = "$No Draw",
      Text = "You may not draw additional cards this turn.",
      Link = "Debuffs#No_Draw",
      Image = "Icon_NoDraw.png",
    },
    ["Plated Armor"] = {
      Code = "$Plated Armor",
      Text = "At the end of your turn, receive X $Block. Receiving unblocked damage reduces $Plated Armor by 1.",
      Link = "Plated Armor",
      Image = "Icon_PlatedArmor.png",
    },
    ["Regen"] = {
      Code = "$Regen",
      Text = "Regen heals X HP at the end of your turn. <br>Each turn, $Regen is reduced by 1.",
      Link = "Buffs#Regen",
      Image = "Icon_Regen.png",
    },
    ["Ritual"] = {
      Code = "$Ritual",
      Text = "Gain X $Strength every turn.",
      Link = "Buffs#Ritual",
      Image = "Icon_Ritual.png",
    },
    ["Shackled"] = {
      Code = "$Shackled",
      Text = "At the end of its turn, gains X $Strength.",
      Link = "Strength#Negative Strength",
      Image = "Icon_Shackled.png",
    },

    ["Strength Down"] = {
      Code = "$Strength Down",
      Text = "At the end of this turn, lose X $Strength.",
      Link = "Strength#Negative Strength",
      Image = "Icon_StrengthDown.png",
    },
    ["Vigor"] = {
      Code = "$Vigor",
      Text = "Your next attack deals X additional damage per hit.",
      Link = "Buffs#Vigor",
      Image = "Icon_Vigor.png",
    },

    -- Ironclad Effects
    ["Double Tap"] = {
      Code = "$Double Tap",
      Text = "Your next X {{QueryLink|Cards|type:Attack|Attacks}} are played twice this turn.",
      Link = "Double_Tap",
      Image = "Icon_DoubleTap.png",
    },
    ["Flame Barrier"] = {
      Code = "$Flame Barrier",
      -- Ingame text does not specify Flame Barrier lasts 1 turn
      Text = "When attacked, deals X damage back.",
      Link = "Flame_Barrier",
      Image = "Icon_FlameBarrier.png",
    },
    ["Rage"] = {
      Code = "$Rage",
      Text = "Whenever you play an {{QueryLink|Cards|type:Attack|Attack}} this turn, gain X $Block.",
      Link = "Rage",
      Image = "Icon_Anger.png",
    },

    -- Ironclad Powers
    ["Barricade"] = {
      Code = "$Barricade",
      Text = " $Block is not removed at the beginning of your turn.",
      Link = "Barricade",
      Image = "Icon_Barricade.png",
    },
    ["Berserk"] = {
      Code = "$Berserk",
      Text = "At the start of your turn, gain X @RE '''Energy'''.",
      Link = "Berserk",
      Image = "Icon_Berserk.png",
    },
    ["Brutality"] = {
      Code = "$Brutality",
      Text = "At the start of your turn, lose X HP and draw X cards.",
      Link = "Brutality",
      Image = "Icon_Brutality.png",
    },
    ["Combust"] = {
      Code = "$Combust",
      Text = "At the end of your turn, lose X HP and deal damage to ALL enemies.",
      Link = "Combust",
      Image = "Icon_Combust.png",
    },
    ["Corruption"] = {
      Code = "$Corruption",
      Text = "{{QueryLink|Cards|type:Skill|Skills}} cost 0. Whenever you play a {{QueryLink|Cards|type:Skill|Skill}}, $Exhaust it.",
      Link = "Corruption",
      Image = "Icon_Corruption.png",
    },
    ["Dark Embrace"] = {
      Code = "$Dark Embrace",
      Text = "Whenever a card is $Exhausted, draw X cards.",
      Link = "Dark_Embrace",
      Image = "Icon_DarkEmbrace.png",
    },
    ["Demon Form"] = {
      Code = "$Demon Form",
      Text = "At the start of your turn, gain X $Strength.",
      Link = "Demon_Form",
      Image = "Icon_DemonForm.png",
    },
    ["Evolve"] = {
      Code = "$Evolve",
      Text = "Whenever you draw a {{QueryLink|Cards|type:Status|Status}} card, draw X cards.",
      Link = "Evolve",
      Image = "Icon_Evolve.png",
    },
    ["Feel No Pain"] = {
      Code = "$Feel No Pain",
      Text = "Whenever you $Exhaust a card, gain X $Block.",
      Link = "Feel No Pain",
      Image = "Icon_FeelNoPain.png",
    },
    ["Fire Breathing"] = {
      Code = "$Fire Breathing",
      Text = "Whenever you draw a {{QueryLink|Cards|type:Status|Status}} or {{QueryLink|Cards|type:Curse|Curse}} card, deal X damage to ALL enemies.",
      Link = "Fire_Breathing",
      Image = "Icon_FireBreathing.png",
    },
    ["Juggernaut"] = {
      Code = "$Juggernaut",
      Text = "Whenever you gain $Block, deal X damage to a random enemy.",
      Link = "Juggernaut",
      Image = "Icon_Juggernaut.png",
    },
    ["Metallicize"] = {
      Code = "$Metallicize",
      Text = "At the end of every turn, gain X $Block.",
      Link = "Metallicize",
      Image = "Icon_Metallicize.png",
    },
    ["Rupture"] = {
      Code = "$Rupture",
      Text = "Whenever you lose HP from a card, gain X $Strength.",
      Link = "Rupture",
      Image = "Icon_Rupture.png",
    },

    -- Silent Effects
    ["Blur"] = {
      Code = "$Blur",
      Text = "$Block is not removed at the beginning of your next X turns.",
      Link = "Blur",
      Image = "Icon_Blur.png",
    },
    ["Burst"] = {
      Code = "$Burst",
      Text = "Your next X {{QueryLink|Cards|type:Skill|Skills}} are played twice this turn.",
      Link = "Burst",
      Image = "Icon_Burst.png",
    },
    ["Corpse Explosion"] = {
      Code = "$Corpse Explosion",
      Text = "On death, deal damage equal to Max HP X times to ALL enemies.",
      Link = "Corpse_Explosion",
      Image = "Icon_CorpseExplosion.png",
    },
    ["Choked"] = {
      Code = "$Choked",
      Text = "Whenever you play a card this turn, loses X HP.",
      Link = "Choke",
      Image = "Icon_Choked.png",
    },
    ["Double Damage"] = {
      Code = "$Double Damage",
      Text = "{{QueryLink|Cards|type:Attack|Attacks}} deal double damage for X turns.",
      Link = "Phantasmal_Killer",
      Image = "Icon_DoubleDamage.png",
    },
    ["Energized (Silent)"] = {
      Code = "$EnergizedGE",
      Text = "Gain X additional @GE '''Energy''' next turn.",
      Link = "Buffs#Energized",
      Image = "Icon_EnergizedGreen.png",
    },
    ["Nightmare"] = {
      Code = "$Nightmare",
      Text = "Add X copies of the chosen card into your hand next turn.",
      Link = "Nightmare",
      Image = "Icon_Nightmare.png",
    },
    ["Phantasmal"] = {
      Code = "$Phantasmal",
      Text = "Deal '''Double Damage''' for the next X turns.",
      Link = "Phantasmal_Killer",
      Image = "Icon_Phantasmal.png",
    },
    ["Poison"] = {
      Code = "$Poison",
      Text = "Poisoned creatures lose X HP at the start of their turn. <br>Each turn, $Poison is reduced by 1.",
      Link = "Poison",
      Image = "Icon_Poison.png",
    },

    -- Silent Powers
    ["Accuracy"] = {
      Code = "$Accuracy",
      Text = "{{C|Shiv|Shivs}} deal X additional damage.",
      Link = "Accuracy",
      Image = "Icon_Accuracy.png",
    },
    ["After Image"] = {
      Code = "$After Image",
      Text = "Whenever you play a card, gain X $Block.",
      Link = "After_Image",
      Image = "Icon_AfterImage.png",
    },
    ["Envenom"] = {
      Code = "$Envenom",
      Text = "Whenever you deal unblocked damage, apply X $Poison.",
      Link = "Envenom",
      Image = "Icon_Envenom.png",
    },
    ["Infinite Blades"] = {
      Code = "$Infinite Blades",
      Text = "At the start of your turn, add X {{C|Shiv|Shivs}} to your hand.",
      Link = "Infinite_Blades",
      Image = "Icon_InfiniteBlades.png",
    },
    ["Noxious Fumes"] = {
      Code = "$Noxious Fumes",
      Text = "At the start of your turn, apply X $Poison to ALL enemies.",
      Link = "Noxious_Fumes",
      Image = "Icon_NoxiousFumes.png",
    },
    ["Retain Cards"] = {
      Code = "$Retain Cards",
      Text = "At the start of your turn, you may $Retain X cards.",
      Link = "Well-Laid_Plans",
      Image = "Icon_Equilibrium.png",
    },
    ["Thousand Cuts"] = {
      Code = "$Thousand Cuts",
      Text = "Whenever you play a card, deal X damage to ALL enemies.",
      Link = "A_Thousand_Cuts",
      Image = "Icon_ThousandCuts.png",
    },
    ["Tools Of The Trade"] = {
      Code = "$Tools Of The Trade",
      Text = "At the start of your turn, draw X cards and discard X cards.",
      Link = "Tools_Of_The_Trade",
      Image = "Icon_Tools.png",
    },
    ["Wraith Form"] = {
      Code = "$Wraith Form",
      Text = "At the start of your turn, lose X $Dexterity.",
      Link = "Wraith_Form",
      Image = "Icon_WraithForm.png",
    },

    -- Defect Mechanics
    ["Orb"] = {
    	Code = "$Orb",
    	Text = "You start with 3 Orb Slots. <br><br>#Lightning: Deal 3(8 on $Evoke) damage to a random enemy. <br>#Frost: Gain 2(5 on $Evoke) $Block. <br>#Dark: Increases damage by 6 every turn. On $Evoke, deal damage to the enemy with the lowest health. <br>#Plasma: Gain 1(2 on $Evoke) $Energy.",
    	Link = "Orbs"
    },
    ["Channel"] = {
      Code = "$Channel",
      Text = "Summons an orb in your first empty $Orb Slot. <br>If you have no empty slots, your first [[Orb]] is automatically $Evoked to make room.",
      Link = "Orbs#Channel",
    },
    ["Orb Slot"] = {
      Code = "$Orb Slot",
      Text = "Orbs can be channeled into these slots. The Defect starts with 3 slots, which can be increased with cards, relics, or potions.",
      Link = "Orbs#Orb_Slots",
      Image = "OrbSlot.png",
    },
    ["Evoke"] = {
      Code = "$Evoke",
      Text = "Consume your rightmost Orb and use its '''Evoke''' effect.",
      Link = "Orbs#Evoke",
    },
    ["Lightning"] = {
      Code = "$Lightning",
      Text = "'''Passive:''' Deal 3 (+1 per $Focus) damage to a random enemy. <br>$Evoke: Deals 8 (+1 per $Focus) damage to a random enemy.",
      Link = "Lightning",
      Image = "LightningOrb.png",
    },
    ["Frost"] = {
      Code = "$Frost",
      Text = "Passive: Gains 2 (+1 per $Focus) $Block.<br>$Evoke: Gains 5 (+1 per $Focus) $Block.",
      Link = "Frost",
      Image = "FrostOrb.png",
    },
    ["Dark"] = {
      Code = "$Dark",
      Text = "'''Passive:''' Increases damage by 6 (+1 per $Focus) every turn. <br>$Evoke: Deals damage to the enemy with the least HP equal to stored damage.",
      Link = "Dark",
      Image = "DarkOrb.png",
    },
    ["Plasma"] = {
      Code = "$Plasma",
      Text = "'''Passive:''' Gain 1 @BE '''Energy'''. <br>$Evoke: Gain 2 @BE '''Energy'''.",
      Link = "Plasma",
      Image = "PlasmaOrb.png",
    },

    -- Defect Effects
    ["Amplify"] = {
      Code = "$Amplify",
      Text = "Your next X {{QueryLink|Cards|type:Power|Power}} cards are played twice this turn.",
      Link = "Amplify",
      Image = "Icon_Amplify.png",
    },
    ["Energized (Defect)"] = {
      Code = "$EnergizedBE",
      Text = "Gain X additional @BE '''Energy''' next turn.",
      Link = "Charge_Battery",
      Image = "Icon_EnergizedBlue.png",
    },
    ["Equilibrium"] = {
      Code = "$Equilibrium",
      Text = "Retain your hand for X turns.",
      Link = "Equilibrium",
      Image = "Icon_Equilibrium.png",
    },
    ["Focus"] = {
      Code = "$Focus",
      Text = "Focus increases the effectiveness of $Channeled Orbs by X.",
      Link = "Orbs#Focus",
      Image = "Icon_Focus.png",
    },
    ["Lock-On"] = {
      Code = "$Lock On",
      Text = "Receives 50% more damage from Orbs for X turns.",
      Link = "Bullseye",
      Image = "Icon_LockOn.png",
    },
    ["Rebound"] = {
      Code = "$Rebound",
      Text = "The next card you play this turn is put on top of your draw pile.",
      Link = "Rebound",
      Image = "Icon_Rebound.png",
    },

    -- Defect Powers
    ["Bias"] = {
      Code = "$Bias",
      Text = "At the start of your turn, lose X $Focus.",
      Link = "Biased_Cognition",
      Image = "Icon_Bias.png",
    },
    ["Creative AI"] = {
      Code = "$Creative AI",
      Text = "At the start of your turn, add X random {{QueryLink|Cards|type:Power|Power}} cards into your hand.",
      Link = "Creative_AI",
      Image = "Icon_CreativeAI.png",
    },
    ["Draw"] = {
      Code = "$Draw",
      Text = "At the start of your turn, draw X additional cards.",
      Link = "Machine_Learning",
      Image = "Icon_DrawCard.png",
    },
    ["Echo Form"] = {
      Code = "$Echo Form",
      Text = "The first X cards you play each turn are played twice.",
      Link = "Echo_Form",
      Image = "Icon_EchoForm.png",
    },
    ["Electro"] = {
      Code = "$Electro",
      Text = "$Lightning hits ALL enemies.",
      Link = "Electrodynamics",
      Image = "Icon_Electro.png",
    },
    ["Heatsink"] = {
      Code = "$Heatsink",
      Text = "Whenever you play a {{QueryLink|Cards|type:Power|Power}} card, draw X cards.",
      Link = "Heatsinks",
      Image = "Icon_Heatsink.png",
    },
    ["Hello"] = {
      Code = "$Hello",
      Text = "At the start of your turn, add X random {{QueryLink|Cards|rarity:Common|Common}} cards into your hand.",
      Link = "Hello_World",
      Image = "Icon_Hello.png",
    },
    ["Loop"] = {
      Code = "$Loop",
      Text = "At the start of your turn, trigger the passive ability of your next Orb X times.",
      Link = "Loop",
      Image = "Icon_Loop.png",
    },
    ["Static Discharge"] = {
      Code = "$Static Discharge",
      -- Ingame text does not tell damage must be unblocked
      Text = "Whenever you receive attack damage, $Channel X $Lightning.",
      Link = "Static_Discharge",
      Image = "Icon_StaticDischarge.png",
    },
    ["Storm"] = {
      Code = "$Storm",
      Text = "Whenever you play a {{QueryLink|Cards|type:Power|Power}} card, $Channel X $Lightning.",
      Link = "Storm",
      Image = "Icon_Storm.png",
    },
    ["Repair"] = {
      Code = "$Repair",
      Text = "At the end of combat, heal X HP.",
      Link = "Self_Repair",
      Image = "Icon_Repair.png",
    },

    -- Watcher Mechanics
    ["Stance"] = {
      Code = "$Stance",
      Text = "You can only have one stance at a time.<br><br>'''Calm:''' Upon exiting this Stance, gain 2 @PE '''Energy'''<br><br>'''Wrath:''' In this Stance, you deal and receive double attack damage.<br><br>'''Divinity:''' Upon entering this Stance, gain 3 @PE '''Energy'''. Attacks deal triple damage. <br>Exit this Stance at the start of your next turn.<br><br>'''Empty:''' No effect.",
      Link = "Keywords#Stance",
    },
    ["Calm"] = {
      Code = "$Calm",
      Text = "Upon exiting this Stance, gain 2 @PE '''Energy'''.",
      Link = "Keywords#Stance",
    },
    ["Wrath"] = {
      Code = "$Wrath",
      Text = "In this Stance, you deal and receive double attack damage.",
      Link = "Keywords#Stance",
    },
    ["Divinity"] = {
      Code = "$Divinity",
      Text = "Upon entering this Stance, gain 3 @PE '''Energy'''. {{QueryLink|Cards|type:Attack|Attacks}} deal triple damage. <br>Exit this $Stance at the start of your next turn.",
      Link = "Keywords#Stance",
    },
    ["Scry"] = {
      Code = "$Scry",
      Text = "Look at the top X cards of your draw pile. You may discard any of them.",
      Link = "Keywords#Scry",
    },

    -- Watcher Effects
    ["Blasphemer"] = {
      Code = "$Blasphemer",
      Text = "At the start of your turn, die.",
      Link = "Blasphemy",
      Image = "Icon_Blasphemer.png",
    },
    ["Block Return"] = {
      Code = "$Block Return",
      Text = "When attacked, you gain X $Block.",
      Link = "Talk_To_The_Hand",
      Image = "Icon_BlockReturn.png",
    },
    ["Collect"] = {
      Code = "$Collect",
      Text = "At the start of your next X turns, put a {{C|Miracle|Miracle+}} into your hand.",
      Link = "Collect",
      Image = "Icon_EnergizedBlue.png",
    },
    ["Free Attack Power"] = {
      Code = "$Free Attack Power",
      Text = "Ignore energy cost on the next X {{QueryLink|Cards|type:Attack|Attacks}} you play.",
      Link = "Swivel",
      Image = "Icon_FreeAttackPower.png",
    },
    ["Mantra"] = {
      Code = "$Mantra",
      Text = "When you obtain 10 $Mantra, enter $Divinity.",
      Link = "Buffs#Mantra",
      Image = "Icon_Mantra.png",
    },
    ["Mark"] = {
      Code = "$Mark",
      Text = "Whenever you play {{C|Pressure Points}}, lose X HP.",
      Link = "Pressure_Points",
      Image = "Icon_Mark.png",
    },
    ["Simmering Rage"] = {
      Code = "$Simmering Rage",
      -- Ingame text does not specify it lasts 1 turn.
      Text = "Enter $Wrath at the start of your turn.",
      Link = "Simmering_Fury",
      Image = "Icon_Anger.png",
    },
    ["Wave of the Hand"] = {
      Code = "$Wave of the Hand",
      Text = "Whenever you gain $Block, apply X $Weak to ALL enemies.",
      Link = "Wave_of_the_Hand",
      Image = "Icon_Wave.png",
    },

    -- Watcher Powers
    ["Battle Hymn"] = {
      Code = "$Battle Hymn",
      Text = "At the start of your turn, add X {{C|Smite|Smites}} into your hand.",
      Link = "Battle_Hymn",
      Image = "Icon_BattleHymn.png",
    },
    ["Deva"] = {
      Code = "$Deva",
      Text = "At the start of your turn, gain @PE X times and increase this gain by Y.",
      Link = "Deva_Form",
      Image = "Icon_DevaForm.png",
    },
    ["Devotion"] = {
      Code = "$Devotion",
      Text = "At the start of your turn, gain X $Mantra.",
      Link = "Devotion",
      Image = "Icon_Devotion.png",
    },
    ["Establishment"] = {
      Code = "$Establishment",
      Text = "Whenever a card is $Retained, lower its cost by X.",
      Link = "Establishment",
      Image = "Icon_Establishment.png",
    },
    ["Fasting"] = {
      Code = "$Fasting",
      Text = "At the start of your turn, lose X @PE '''Energy'''.",
      Link = "Fasting",
      Image = "Icon_Fasting.png",
    },
    ["Foresight"] = {
      Code = "$Foresight",
      Text = "At the start of your turn, $Scry X.",
      Link = "Foresight",
      Image = "Icon_Foresight.png",
    },
    ["Like Water"] = {
      Code = "$Like Water",
      Text = "At the end of your turn, if you are in $Calm, gain X $Block.",
      Link = "Like_Water",
      Image = "Icon_LikeWater.png",
    },
    ["Master Reality"] = {
      Code = "$MasterReality",
      Text = "Whenever a card is created, it is $Upgraded.",
      Link = "Master_Reality",
      Image = "Icon_MasterReality.png",
    },
    ["Mental Fortress"] = {
      Code = "$Mental Fortress",
      Text = "Whenever you switch $Stances, gain X $Block.",
      Link = "Mental_Fortress",
      Image = "Icon_MentalFortress.png",
    },
    ["Nirvana"] = {
      Code = "$Nirvana",
      Text = "Whenever you $Scry, gain X $Block.",
      Link = "Nirvana",
      Image = "Icon_Nirvana.png",
    },
    ["Rushdown"] = {
      Code = "$Rushdown",
      Text = "Whenever you enter $Wrath, draw X cards.",
      Link = "Rushdown",
      Image = "Icon_Rushdown.png",
    },
    ["Study"] = {
      Code = "$Study",
      Text = "At the end of your turn, shuffle X {{C|Insight|Insights}} into your draw pile.",
      Image = "Icon_Study.png",
      Link = "Study",
    },
    ["Omega"] = {
      Code = "$Omega",
      Text = "At the end of your turn, deal X damage to ALL enemies.",
      Link = "Alpha",
      Image = "Icon_Omega.png",
    },

    -- Colorless Effects
    ["No Block"] = {
      Code = "$No Block",
      -- Ingame text does not specify how long it lasts
      Text = "You cannot gain $Block from cards.",
      Link = "Panic_Button",
      Image = "Icon_NoBlock.png",
    },
    ["The Bomb"] = {
      Code = "$The Bomb",
      Text = "At the end of X turns, deal Y damage to ALL enemies.",
      Link = "The_Bomb",
      Image = "Icon_Bomb.png",
    },
    -- used for the Pen Nib relic, wasn't sure where else to put this
    ["Pen Nib"] = {
    	Code = "$Pen Nib",
    	Text = "Your next {{QueryLink|Cards|type:Attack|Attack}} deals double damage.",
    	Link = "Pen_Nib",
    	Image = "Icon_PenNib.png"
    },

    -- Colorless Powers
    ["Magnetism"] = {
      Code = "$Magnetism",
      Text = "At the start of your turn, add X random {{QueryLink|Cards|color:Colorless|Colorless}} cards into your hand.",
      Link = "Magnetism",
      Image = "Icon_Magnetism.png",
    },
    ["Mayhem"] = {
      Code = "$Mayhem",
      Text = "At the start of your turn, play the top X cards of your draw pile.",
      Link = "Mayhem",
      Image = "Icon_Mayhem.png",
    },
    ["Panache"] = {
      Code = "$Panache",
      Text = "If you play X more cards this turn, deal Y damage to ALL enemies.",
      Link = "Panache",
      Image = "Icon_Panache.png",
    },
    ["Sadistic"] = {
      Code = "$Sadistic",
      Text = "Whenever you apply a debuff to a enemy, deal X damage.",
      Link = "Sadistic_Nature",
      Image = "Icon_Sadistic.png",
    },

    -- Enemy Effects
    ["Angry"] = {
      Code = "$Angry",
      Text = "Upon receiving attack damage, gains X $Strength.",
      Link = "Buffs#Angry",
      Image = "Icon_Rage.png",
    },
    ["Beat of Death"] = {
      Code = "$Beat of Death",
      Text = "Whenever you play a card, take X damage.",
      Link = "Corrupt_Heart",
      Image = "Icon_BeatOfDeath.png",
    },
    ["Constricted"] = {
      Code = "$Constricted",
      Text = "Take X damage at the end of your turn.",
      Link = "Spire_Growth",
      Image = "Icon_Constricted.png",
    },
    ["Curiosity"] = {
      Code = "$Curiosity",
      Text = "Whenever you play a {{QueryLink|Cards|type:Power|Power}} card, gains $Strength.",
      Link = "Awakened_One",
      Image = "Icon_Curiosity.png",
    },
    ["Curl Up"] = {
      Code = "$Curl Up",
      Text = "Gains X $Block upon first receiving attack damage.",
      Link = "Louses",
      Image = "Icon_CurlUp.png",
    },
    ["Draw Reduction"] = {
      Code = "$Draw Reduction",
      Text = "Draw X less cards next turn.",
      Link = "Time_Eater",
      Image = "Icon_DrawReduction.png",
    },
    ["Enrage"] = {
      Code = "$Enrage",
      Text = "Whenever you play a {{QueryLink|Cards|type:Skill|Skill}} card, gains X $Strength.",
      Link = "Gremlin_Nob",
      Image = "Icon_Anger.png",
    },
    ["Entangled"] = {
      Code = "$Entangled",
      Text = "You may not play any {{QueryLink|Cards|type:Attack|Attacks}} this turn.",
      Link = "Red_Slaver",
      Image = "Icon_Entangled.png",
    },
    ["Explosive"] = {
      Code = "$Explosive",
      Text = "Explodes after X turns, dealing some amount of damage.",
      Link = "Shapes#Exploder",
      Image = "Icon_Explosive.png",
    },
    ["Fading"] = {
      Code = "$Fading",
      Text = "Dies in X turns.",
      Link = "Transient",
      Image = "Icon_Fading.png",
    },
    ["Flying"] = {
      Code = "$Flying",
      Text = "Takes 50% less attack damage. Cancelled if dealt attack damage X times in one turn. Resets charges at the start of next turn if not fully removed.",
      Link = "Byrd",
      Image = "Icon_Flying.png",
    },
    ["Hex"] = {
      Code = "$Hex",
      Text = "Whenever you play a non-{{QueryLink|Cards|type:Attack|Attack}} card, shuffle X {{C|Dazed}} into your draw pile.",
      Link = "Chosen",
      Image = "Icon_Hex.png",
    },
    ["Invincible"] = {
      Code = "$Invincible",
      Text = "Can only lose X more HP this turn.",
      Link = "Corrupt_Heart",
      Image = "Icon_Invincible.png",
    },
    ["Life Link"] = {
      Code = "$Life Link",
      Text = "If other {{M|Darkling|Darklings}} are still alive, revives in 2 turns.",
      Link = "Darkling",
      Image = "Icon_LifeLink.png",
    },
    ["Malleable"] = {
      Code = "$Malleable",
      Text = "Upon receiving attack damage, gains X $Block. $Block gain increases as $Malleable is triggered. Resets at the start of your turn.",
      Link = "Malleable",
      Image = "Icon_Malleable.png",
    },
    ["Mode Shift"] = {
      Code = "$Mode Shift",
      Text = "After losing X HP, gains 20 $Block and changes current [[Intent]] to {{Int|The Guardian|Defensive Mode}}.",
      Link = "The Guardian",
      Image = "Icon_ModeShift.png",
    },
    ["Minion"] = {
      Code = "$Minion",
      Text = "Minions abandon combat without their leader.",
      Image = "Icon_Minion.png",
      Link = "Minions"
    },
    ["Painful Stabs"] = {
      Code = "$Painful Stabs",
      Text = "Whenever you receive attack damage from this enemy, add a {{C|Wound}} into your discard pile.",
      Image = "Icon_PainfulStabs.png",
    },
    ["Reactive"] = {
      Code = "$Reactive",
      Text = "Upon receiving attack damage, changes its [[Intent]].",
      Link = "Writhing_Mass",
      Image = "Icon_Reactive.png",
    },
    ["Regenerate"] = {
      Code = "$Regenerate",
      Text = "At the end of its turn, heals X HP.",
      Link = "Awakened_One",
      Image = "Icon_Regen.png",
    },
    ["Sharp Hide"] = {
      Code = "$Sharp Hide",
      Text = "Whenever you play an {{QueryLink|Cards|type:Attack|Attack}}, take X damage.",
      Link = "The Guardian",
      Image = "Icon_SharpHide.png",
    },
    ["Shifting"] = {
      Code = "$Shifting",
      Text = "Upon losing HP, loses that much $Strength until the end of the turn.",
      Link = "Transient",
      Image = "Icon_Shifting.png",
    },
    ["Slow"] = {
      Code = "$Slow",
      Text = "Whenever you play a card, target receives 10% more damage from {{QueryLink|Cards|type:Attack|Attacks}} this turn. (Receives (X+10)% more damage)",
      Link = "Giant_Head",
      Image = "Icon_Slow.png",
    },
    ["Split"] = {
      Code = "$Split",
      Text = "When its HP is at or below 50%, it will split into 2 smaller Slimes with its current HP.",
      Image = "Icon_Split.png",
    },
    ["Spore Cloud"] = {
      Code = "$Spore Cloud",
      Text = "On death, applies X $Vulnerable.",
      Link = "Buffs#Spore Cloud",
      Image = "Icon_SporeCloud.png",
    },
    ["Stasis"] = {
      Code = "$Stasis",
      Text = "On death, a stolen card is returned to your hand.",
      Link = "Bronze_Automaton",
      Image = "Icon_Stasis.png",
    },
    ["Strength Up"] = {
      Code = "$Strength Up",
      Text = "At the end of its turn, gains $Strength.",
      Link = "Orb_Walker",
      Image = "Icon_Stasis.png",
    },
    ["Surrounded"] = {
      Code = "$Surrounded",
      Text = "Receive 50% more damage if attacked from behind. Use targeting cards or potions to change your orientation.",
      Link = "Spire_Shield_and_Spire_Spear",
      Image = "Icon_Surrounded.png",
    },
    ["Back Attack"] = {
      Code = "$Back Attack",
      Text = "Deals 50% more damage as it is attacking you from behind.",
      Link = "Spire_Shield_and_Spire_Spear",
      Image = "Icon_Surrounded.png"
    },
    ["Thievery"] = {
      Code = "$Thievery",
      Text = "Steals X [[Gold]] whenever it attacks. Stolen gold is returned if this enemy is killed.",
      Link = "Thief",
      Image = "Icon_Thievery.png",
    },
    ["Time Warp"] = {
      Code = "$Time Warp",
      Text = "Whenever you play a certain number of cards, ends your turn and gains X $Strength.",
      Link = "Time_Eater",
      Image = "Icon_TimeWarp.png",
    },
    ["Unawakened"] = {
      Code = "$Unawakened",
      Text = "This enemy hasn't awakened yet...",
      Link = "Awakened_One",
      Image = "Icon_Unawakened.png",
    },
    
    -- Daily Modifiers
    ["Draft"] = {
    	Code = "$Draft",
    	Text = "'''Daily Modifier''': Draft a starting deck of cards.",
    	Link = "Custom_Mode#Draft",
    	Image = "Mod_Draft.png"
    },
    ["Sealed Deck"] = {
    	Code = "$Sealed Deck",
    	Text = "'''Daily Modifier''': Craft a deck from 30 random cards.",
    	Link = "Custom_Mode#Sealed_Deck",
    	Image = "Mod_SealedDeck.png"
    },
    ["Hoarder"] = {
    	Code = "$Hoarder",
    	Text = "'''Daily Modifier''': Whenever you add a card to your deck, add two additional copies. You can no longer remove cards from your deck at the '''Merchant'''.",
    	Link = "Custom_Mode#Hoarder",
    	Image = "Mod_Greed.png"
    },
    ["Insanity"] = {
    	Code = "$Insanity",
    	Text = "'''Daily Modifier''': Start with a random deck of 50 cards.",
    	Link = "Custom_Mode#Insanity",
    	Image = "Mod_RestlessJourney.png"
    },
    ["Chimera"] = {
    	Code = "$Chimera",
    	Text = "'''Daily Modifier''': Your starting deck is a fusion of all 4 characters.",
    	Link = "Custom_Mode#Chimera",
    	Image = "Mod_Chimera.png"
    },
    ["Shiny"] = {
    	Code = "$Shiny",
    	Text = "'''Daily Modifier''': Your starting deck is replaced with 1 of every rare card.",
    	Link = "Custom_Mode#Shiny",
    	Image = "Mod_Shiny.png"
    },
    ["Specialized"] = {
    	Code = "$Specialized",
    	Text = "'''Daily Modifier''': Start with 5 copies of a single card.",
    	Link = "Custom_Mode#Specialized",
    	Image = "Mod_Specialized.png"
    },
    ["Vintage"] = {
    	Code = "$Vintage",
    	Text = "'''Daily Modifier''': Normal Enemies drop relics instead of cards.",
    	Link = "Custom_Mode#Vintage",
    	Image = "Mod_Vintage.png"
    },
    ["Controlled Chaos"] = {
    	Code = "$Controlled Chaos",
    	Text = "'''Daily Modifier''': Start with '''Frozen Eye'''. At the start of your turn, add 10 random cards to the bottom of your draw pile.",
    	Link = "Custom_Mode#Controlled_Chaos",
    	Image = "Mod_ControlledChaos.png"
    },
    ["All Star"] = {
    	Code = "$All Star",
    	Text = "'''Daily Modifier''': Start with 5 colorless cards.",
    	Link = "Custom_Mode#All_Star",
    	Image = "Mod_AllStar.png"
    },
    ["Diverse"] = {
    	Code = "$Diverse",
    	Text = "'''Daily Modifier''': Cards are not restricted by your character.",
    	Link = "Custom_Mode#Diverse",
    	Image = "Mod_Diverse.png"
    },
    ["Red Cards"] = {
    	Code = "$Red Cards",
    	Text = "'''Daily Modifier''': Red cards now appear in rewards and shops.",
    	Link = "Custom_Mode#Red_Cards",
    	Image = "Mod_RedCards.png"
    },
    ["Green Cards"] = {
    	Code = "$Green Cards",
    	Text = "'''Daily Modifier''': Green cards now appear in rewards and shops.",
    	Link = "Custom_Mode#Green_Cards",
    	Image = "Mod_GreenCards.png"
    },
    ["Blue Cards"] = {
    	Code = "$Blue Cards",
    	Text = "'''Daily Modifier''': Blue cards now appear in rewards and shops.",
    	Link = "Custom_Mode#Blue_Cards",
    	Image = "Mod_BlueCards.png"
    },
    ["Purple Cards"] = {
    	Code = "$Purple Cards",
    	Text = "'''Daily Modifier''': Purple cards now appear in rewards and shops.",
    	Link = "Custom_Mode#Purple_Cards",
    	Image = "Mod_PurpleCards.png"
    },
    ["Colorless Cards"] = {
    	Code = "$Colorless Cards",
    	Text = "'''Daily Modifier''': Colorless cards now appear in rewards and shops.",
    	Link = "Custom_Mode#Colorless_Cards",
    	Image = "Mod_ColorlessCards.png"
    },
    ["Heirloom"] = {
    	Code = "$Heirloom",
    	Text = "'''Daily Modifier''': Start with one 1 Rare relic.",
    	Link = "Custom_Mode#Heirloom",
    	Image = "Mod_Heirloom.png"
    },
    ["Time Dilation"] = {
    	Code = "$Time Dilation",
    	Text = "'''Daily Modifier''': All enemies start with the '''Slow''' debuff.",
    	Link = "Custom_Mode#Time_Dilation",
    	Image = "Mod_TimeDilation.png"
    },
    ["Flight"] = {
    	Code = "$Flight",
    	Text = "'''Daily Modifier''': You may ignore paths when choosing the next room to travel to.",
    	Link = "Custom_Mode#Flight",
    	Image = "Mod_Flight.png"
    },
    ["Deadly Events"] = {
    	Code = "$Deadly Events",
    	Text = "'''Daily Modifier''': Unknown rooms can now contain Elites but are also more likely to contain Treasure Rooms.",
    	Link = "Custom_Mode#Deadly_Events",
    	Image = "Mod_DeadlyEvents.png"
    },
    ["Binary"] = {
    	Code = "$Binary",
    	Text = "'''Daily Modifier''': Card rewards contain only two cards.",
    	Link = "Custom_Mode#Binary",
    	Image = "Mod_Binary.png"
    },
    ["Cursed Run"] = {
    	Code = "$Cursed Run",
    	Text = "'''Daily Modifier''': Whenever you defeat a Boss, become '''Cursed'''. Your starting relic is replaced by '''Cursed Key''', '''Darkstone Periapt''', and '''Du-Vu Doll'''.",
    	Link = "Custom_Mode#Cursed_Run",
    	Image = "Mod_CursedRun.png"
    },
    ["Big Game Hunter"] = {
    	Code = "$Big Game Hunter",
    	Text = "'''Daily Modifier''': Elites are now swarming the Spire and drop better rewards.",
    	Link = "Custom_Mode#Big_Game_Hunter",
    	Image = "Mod_EliteSwarm.png"
    },
    ["Lethality"] = {
    	Code = "$Lethality",
    	Text = "'''Daily Modifier''': You start each combat with +3 '''Strength'''. All enemies start each combat with +3 '''Strength'''.",
    	Link = "Custom_Mode#Lethality",
    	Image = "Mod_LethalEnemies.png"
    },
    ["Midas"] = {
    	Code = "$Midas",
    	Text = "'''Daily Modifier''': Enemies drop 200% more Gold, but you cannot Upgrade cards at Rest Sites.",
    	Link = "Custom_Mode#Midas",
    	Image = "Mod_Midas.png"
    },
    ["Night Terrors"] = {
    	Code = "$Night Terrors",
    	Text = "'''Daily Modifier''': Resting at Rest Sites heals 100% of your HP, but costs 5 max HP.",
    	Link = "Custom_Mode#Night_Terrors",
    	Image = "Mod_NightTerrors.png"
    },
    ["Terminal"] = {
    	Code = "$Terminal",
    	Text = "'''Daily Modifier''': Whenever you enter a new room, lose 1 max HP. Start each combat with 5 '''Plated Armor'''.",
    	Link = "Custom_Mode#Terminal",
    	Image = "Mod_ToughEnemies.png"
    },
    ["Certain Future"] = {
    	Code = "$Certain Future",
    	Text = "'''Daily Modifier''': The map only contains one path.",
    	Link = "Custom_Mode#Certain_Future",
    	Image = "Mod_CertainFuture.png"
    },
    
    -- Custom Modifiers
    ["Endless"] = {
    	Code = "$Endless",
    	Text = "'''Custom Modifier''': Winning will return you to Act 1 with the same deck. But beware, the blight eventually consumes all...",
    	Link = "Custom_Mode#Custom_Modifiers",
    	Image = "Mod_Endless.png"
    },
    ["Daily Mods"] = {
    	Code = "$Daily Mods",
    	Text = "'''Custom Modifier''': Embark on a run with exactly 3 random Daily Mods.",
    	Link = "Custom_Mode#Custom_Modifiers"
    },
    ["The Ending"] = {
    	Code = "$The Ending",
    	Text = "'''Custom Modifier''': Enables the Final Act.",
    	Link = "Custom_Mode#Custom_Modifiers"
    },
    ["Blight Chests"] = {
    	Code = "$Blight Chests",
    	Text = "'''Custom Modifier''': Boss chests contain Blights after beating Act 3 on Endless.",
    	Link = "Custom_Mode#Custom_Modifiers"
    },
    ["Praise Snecko"] = {
    	Code = "$Praise Snecko",
    	Text = "'''Custom Modifier''': Replaces your starting relic with '''Snecko Eye'''.",
    	Link = "Custom_Mode#Custom_Modifiers"
    },
    ["Inception"] = {
    	Code = "$Inception",
    	Text = "'''Custom Modifier''': Replaces your starting relic with '''Unceasing Top'''.",
    	Link = "Custom_Mode#Custom_Modifiers"
    },
    ["My True Form"] = {
    	Code = "$My True Form",
    	Text = "'''Custom Modifier''': Start with a copy of '''Demon Form''', '''Wraith Form''', '''Echo Form''', and '''Deva Form'''.",
    	Link = "Custom_Mode#Custom_Modifiers"
    },
    ["One Hit Wonder"] = {
    	Code = "$One Hit Wonder",
    	Text = "'''Custom Modifier''': Start the game with 1 max HP.",
    	Link = "Custom_Mode#Custom_Modifiers"
    },
    ["Starter Deck"] = {
    	Code = "$Starter Deck",
    	Text = "'''Custom Modifier''': Start with '''Busted Crown''' and Binary, so enemies no longer drop cards.",
    	Link = "Custom_Mode#Custom_Modifiers"
    },
    
    -- Removed Modifiers
    ["Uncertain Future"] = {
    	Code = "$Uncertain Future",
    	Text = "'''Removed Modifier''': The map now only shows Unknown rooms.",
    	Link = "Custom_Mode#Removed_Modifiers",
    	Image = "Mod_UncertainFuture.png"
    },
    ["Brewmaster"] = {
    	Code = "$Brewmaster",
    	Text = "'''Removed Modifier''': Start with '''White Beast Statue''' and 5 copies of '''Alchemize'''.",
    	Link = "Custom_Mode#Removed_Modifiers",
    	Image = "Mod_Brewmaster.png"
    },
    ["Careless"] = {
    	Code = "$Careless",
    	Text = "'''Removed Modifier''': At the beginning of your turn, discard the top card of your draw pile.",
    	Link = "Custom_Mode#Removed_Modifiers",
    	Image = "Mod_TimeDilation.png"
    },
    ["Colossus"] = {
    	Code = "$Colossus",
    	Text = "'''Removed Modifier''': Enemies now have more HP but drop better rewards.",
    	Link = "Custom_Mode#Removed_Modifiers",
    	Image = "Mod_Colossus.png"
    },
    ["Restless Journey"] = {
    	Code = "$Restless Journey",
    	Text = "'''Removed Modifier''': The player no longer heals to full health when entering new Acts.",
    	Link = "Custom_Mode#Removed_Modifiers",
    	Image = "Mod_RestlessJourney.png"
    },
    ["Heartbreaker"] = {
    	Code = "$Heartbreaker",
    	Text = "'''Removed Modifier''': Enables the Final Act. (Renamed to 'The Ending')",
    	Link = "Custom_Mode#Removed_Modifiers"
    }
  }
}

local formatted_icons = {}
for name, icon in pairs(all_data.Icons) do
	icon.EditLink = "Module:Keywords/data"
	formatted_icons[name] = icon
end


local formatted_keywords = {}
for name, keyword in pairs(all_data.Keywords) do
	keyword.EditLink = "Module:Keywords/data"
	formatted_keywords[name] = keyword
end

return {
	Icons = formatted_icons,
	Keywords = formatted_keywords
}