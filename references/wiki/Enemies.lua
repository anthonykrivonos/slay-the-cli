local all_data = {
	
------------ Act 1 ------------
-- Monsters
	["Acid Slime (L)"] = {
		Type = "Normal",
		BaseHP = "65-69",
		AscHP = "68-72",
		Image = "AcidSlimeL.png",
		Link = "Slimes#Acid_Slime_(L)",
		Debut = "Act 1",
		StartsWith = "$Split",
		Intents = {
			{	Name = "Corrosive Spit",
				Text = "Deals 11 ({{Asc|2|12}}) damage. Adds 2 {{C|Slimed}} into your discard pile.",
				Icon = "Intent DebuffAttack3.png",
				AscText = {
					"Deals 11 damage. Adds 2 {{C|Slimed}} into your discard pile.",
					"Deals {{Asc|2|12}} damage. Adds 2 {{C|Slimed}} into your discard pile."
				}
			},
			{	Name = "Lick",
				Text = "Applies 2 {{KW|Weak}}.",
				Icon = "Intent Debuff.png"
			},
			{	Name = "Tackle",
				-- Internal name "NORMAL_TACKLE"
				Text = "Deals 16 ({{Asc|2|18}}) damage.",
				Icon = "Intent Attack4.png",
				AscText = {
					"Deals 16 damage.",
					"Deals {{Asc|2|18}} damage."
				}
			},
			{	Name = "Split",
				Text = "Disappears and spawns 2 {{M|Acid Slime (M)|Acid Slimes (M)}} with its current HP.",
				Icon = "Intent Unknown.png"
			}
		}
	},
	["Acid Slime (M)"] = {
		Type = "Normal",
		BaseHP = "28-32",
		AscHP = "29-34",
		Image = "AcidSlimeM.png",
		Link = "Slimes#Acid_Slime_(M)",
		Debut = "Act 1",
		Intents = {
			{	Name = "Corrosive Spit",
				Text = "Deals 7 ({{Asc|2|8}}) damage. Adds a {{C|Slimed}} into your discard pile.",
				Icon = "Intent DebuffAttack2.png",
				AscText = {
					"Deals 7 damage. Adds a {{C|Slimed}} into your discard pile.",
					"Deals {{Asc|2|8}} damage. Adds a {{C|Slimed}} into your discard pile."
				}
			},
			{	Name = "Lick",
				Text = "Applies 1 {{KW|Weak}}.",
				Icon = "Intent Debuff.png"
			},
			{	Name = "Tackle",
				-- internal name "NORMAL_TACKLE"
				Text = "Deals 10 ({{Asc|2|12}}) damage.",
				Icon = "Intent Attack3.png",
				AscText = {
					"Deals 10 damage.",
					"Deals {{Asc|2|12}} damage."
				}
			}
		}
	},
	["Acid Slime (S)"] = {
		Type = "Normal",
		BaseHP = "8-12",
		AscHP = "9-13",
		Image = "AcidSlimeS.png",
		Link = "Slimes#Acid_Slime_(S)",
		Debut = "Act 1",
		Intents = {
			{	Name = "Lick",
				-- Internal name "DEBUFF"
				Text = "Applies 1 {{KW|Weak}}.",
				Icon = "Intent Debuff.png"
			},
			{	Name = "Tackle",
				Text = "Deals 3 ({{Asc|2|4}}) damage.",
				Icon = "Intent Attack1.png",
				AscText = {
					"Deals 3 damage.",
					"Deals {{Asc|2|4}} damage."
				}
			}
		}
	},
	["Blue Slaver"] = {
		Type = "Normal",
		BaseHP = "46-50",
		AscHP = "48-52",
		Image = "SlaverBlue.png",
		Link = "Slavers#Blue_Slaver",
		Debut = "Act 1",
		Intents = {
			{	Name = "Stab",
				Text = "Deals 12 ({{Asc|2|13}}) damage.",
				Icon = "Intent Attack3.png",
				AscText = {
					"Deals 12 damage.",
					"Deals {{Asc|2|13}} damage."
				}
			},
			{	Name = "Rake",
				Text = "Deals 7 ({{Asc|2|8}}) damage. Applies 1 ({{Asc|17|2}}) {{KW|Weak}}.",
				Icon = "Intent DebuffAttack2.png",
				AscText = {
					"Deals 7 damage. Applies 1 {{KW|Weak}}.",
					"Deals {{Asc|2|8}} damage. Applies 1 {{KW|Weak}}.",
					"Deals {{Asc|2|8}} damage. Applies {{Asc|17|2}} {{KW|Weak}}."
				}
			}
		}
	},
	["Cultist"] = {
		Type = "Normal",
		BaseHP = "48-54",
		AscHP = "50-56",
		Image = "Cultist.png",
		Debut = "Act 1",
		Intents = {
			{	Name = "Incantation",
				Text = "Gains 3 ({{Asc|2|4}} | {{Asc|17|5}}) {{KW|Ritual}}.",
				Icon = "Intent Buff.png",
				AscText = {
					"Gains 3 {{KW|Ritual}}.",
					"Gains {{Asc|2|4}} {{KW|Ritual}}.",
					"Gains {{Asc|17|5}} {{KW|Ritual}}."
				}
			},
			{	Name = "Dark Strike",
				Text = "Deals 6 damage.",
				Icon = "Intent Attack2.png"
			}
		}
	},
	["Fat Gremlin"] = {
		Type = "Normal",
		BaseHP = "13-17",
		AscHP = "14-18",
		Image = "GremlinFat.png",
		Link = "Gremlins#Fat_Gremlin",
		Debut = "Act 1",
		Intents = {
			{	Name = "Smash",
				Text = "Deals 4 ({{Asc|2|5}}) damage. Applies 1 {{KW|Weak}} and {{Asc|17|1}} {{KW|Frail}}.",
				Icon = "Intent DebuffAttack1.png",
				AscText = {
					"Deals 4 damage. Applies 1 {{KW|Weak}}.",
					"Deals {{Asc|2|5}} damage. Applies 1 {{KW|Weak}}.",
					"Deals {{Asc|2|5}} damage. Applies 1 {{KW|Weak}} and {{Asc|17|1}} {{KW|Frail}}."
				}
			}
		}
	},
	["Fungi Beast"] = {
		Type = "Normal",
		BaseHP = "22-28",
		AscHP = "24-28",
		Image = "FungiBeast.png",
		Debut = "Act 1",
		StartsWith = "$Spore Cloud 2",
		Intents = {
			{	Name = "Bite",
				Text = "Deals 6 damage.",
				Icon = "Intent Attack2.png"
			},
			{	Name = "Grow",
				Text = "Gains 3 ({{Asc|2|4}} | {{Asc|17|5}}) {{KW|Strength}}.",
				Icon = "Intent Buff.png",
				AscText = {
					"Gains 3 {{KW|Strength}}.",
					"Gains {{Asc|2|4}} {{KW|Strength}}.",
					"Gains {{Asc|17|5}} {{KW|Strength}}."
				}
			}
		}
	},
	["Green Louse"] = {
		Type = "Normal",
		BaseHP = "11-17",
		AscHP = "12-18",
		Image = "GreenLouse.png",
		Link = "Louses#Green_Louse",
		Debut = "Act 1",
		StartsWith = "$Curl Up N, where N is random between 3-7 ({{Asc|7|4-8}} | {{Asc|17|9-12}})",
		Intents = {
			{	Name = "Bite",
				Text = "Deals N damage. N = Number between 5-7 ({{Asc|2|6-8}}), chosen at the start of combat.",
				Icon = "Intent Attack2.png",
				AscText = {
					"Deals N damage. N = Number between 5-7, chosen at the start of combat.",
					"Deals N damage. N = Number between {{Asc|2|6-8}}, chosen at the start of combat."
				}
			},
			{	Name = "Spit Web",
				Text = "Applies 2 {{KW|Weak}}.",
				Icon = "Intent Debuff.png"
			}
		}
	},
	["Gremlin Wizard"] = {
		Type = "Normal",
		BaseHP = "21-25",
		AscHP = "22-26",
		Image = "GremlinWizard.png",
		Link = "Gremlins#Gremlin_Wizard",
		Debut = "Act 1",
		Intents = {
			{	Name = "Charging",
				Text = "Does nothing.",
				Icon = "Intent Unknown.png"
			},
			{	Name = "Ultimate Blast",
				Text = "Deals 25 ({{Asc|2|30}}) damage.",
				Icon = "Intent Attack6.png",
				AscText = {
					"Deals 25 damage.",
					"Deals {{Asc|2|30}} damage."
				}
			}
		}
	},
	["Jaw Worm"] = {
		Type = "Normal",
		BaseHP = "40-44",
		AscHP = "42-46",
		Image = "JawWorm.png",
		Debut = "Act 1",
		Intents = {
			{	Name = "Chomp",
				Text = "Deals 11 ({{Asc|2|12}}) damage.",
				Icon = "Intent Attack3.png",
				AscText = {
					"Deals 11 damage.",
					"Deals {{Asc|2|12}} damage."
				}
			},
			{	Name = "Bellow",
				Text = "Gains 3 ({{Asc|2|4}} | {{Asc|17|5}}) {{KW|Strength}}. Gains 6 ({{Asc|17|9}}) {{KW|Block}}.",
				Icon = "Intent DefendBuff.png",
				AscText = {
					"Gains 3 {{KW|Strength}}. Gains 6 {{KW|Block}}.",
					"Gains {{Asc|2|4}} {{KW|Strength}}. Gains 6 {{KW|Block}}.",
					"Gains {{Asc|17|5}} {{KW|Strength}}. Gains {{Asc|17|9}} {{KW|Block}}."
				}
			},
			{	Name = "Thrash",
				Text = "Deals 7 damage. Gains 5 {{KW|Block}}.",
				Icon = "Intent DefendAttack2.png"
			}
		}
	},
	["Looter"] = {
		Type = "Normal",
		BaseHP = "44-48",
		AscHP = "46-50",
		Image = "Looter.png",
		Link = "Thieves#Looter",
		Debut = "Act 1",
		StartsWith = "$Thievery 15 ({{Asc|17|20}})",
		Intents = {
			{	Name = "Mug",
				Text = "Deals 10 ({{Asc|2|11}}) damage.",
				Icon = "Intent Attack3.png",
				AscText = {
					"Deals 10 damage.",
					"Deals {{Asc|2|11}} damage."
				}
			},
			{	Name = "Lunge",
				Text = "Deals 12 ({{Asc|2|14}}) damage.",
				Icon = "Intent Attack3.png",
				AscText = {
					"Deals 12 damage.",
					"Deals {{Asc|2|14}} damage."
				}
			},
			{	Name = "Smoke Bomb",
				Text = "Gains 6 {{KW|Block}}.",
				Icon = "Intent Defend.png"
			},
			{	Name = "Escape",
				Text = "Flees combat with your [[Gold]].",
				Icon = "Intent Escape.png"
			}
		}
	},
	["Mad Gremlin"] = {
		Type = "Normal",
		BaseHP = "20-24",
		AscHP = "21-25",
		Image = "MadGremlin.png",
		Link = "Gremlins#Mad_Gremlin",
		Debut = "Act 1",
		StartsWith = "$Angry 1 ({{Asc|17|2}})",
		Intents = {
			{	Name = "Scratch",
				-- There is an unused entry called "Claw" in loc files
				Text = "Deals 4 ({{Asc|2|5}}) damage.",
				Icon = "Intent Attack1.png",
				AscText = {
					"Deals 4 damage.",
					"Deals {{Asc|2|5}} damage."
				}
			}
		}
	},
	["Red Louse"] = {
		Type = "Normal",
		BaseHP = "10-15",
		AscHP = "11-16",
		Image = "RedLouse.png",
		Link = "Louses#Red_Louse",
		Debut = "Act 1",
		StartsWith = "$Curl Up N, where N is random between 3-7 ({{Asc|7|4-8}} | {{Asc|17|9-12}})",
		Intents = {
			{	Name = "Bite",
				Text = "Deals N damage. N = Number between 5-7 ({{Asc|2|6-8}}), chosen at the start of combat.",
				Icon = "Intent Attack2.png",
				AscText = {
					"Deals N damage. N = Number between 5-7, chosen at the start of combat.",
					"Deals N damage. N = Number between {{Asc|2|6-8}}, chosen at the start of combat.",
				}
			},
			{	Name = "Grow",
				Text = "Gains 3 ({{Asc|17|4}}) {{KW|Strength}}.",
				Icon = "Intent Buff.png",
				AscText = {
					"Gains 3 {{KW|Strength}}.",
					"Gains {{Asc|17|4}} {{KW|Strength}}.",
				}
			}
		}
	},
	["Red Slaver"] = {
		Type = "Normal",
		BaseHP = "46-50",
		AscHP = "48-52",
		Image = "SlaverRed.png",
		Link = "Slavers#Red_Slaver",
		Debut = "Act 1",
		Intents = {
			{	Name = "Stab",
				Text = "Deals 13 ({{Asc|2|14}}) damage.",
				Icon = "Intent Attack3.png",
				AscText = {
					"Deals 13 damage.",
					"Deals {{Asc|2|14}} damage.",
				}
			},
			{	Name = "Scrape",
				Text = "Deals 8 ({{Asc|2|9}}) damage. Applies 1 ({{Asc|17|2}}) {{KW|Vulnerable}}.",
				Icon = "Intent DebuffAttack2.png",
				AscText = {
					"Deals 8 damage. Applies 1 {{KW|Vulnerable}}.",
					"Deals {{Asc|2|9}} damage. Applies 1 {{KW|Vulnerable}}.",
					"Deals {{Asc|2|9}} damage. Applies {{Asc|17|2}} {{KW|Vulnerable}}.",
				}
			},
			{	Name = "Entangle",
				Text = "Applies 1 {{KW|Entangled}}.",
				Icon = "Intent DebuffStrong.png"
			}
		}
	},
	["Shield Gremlin"] = {
		Type = "Normal",
		BaseHP = "12-15",
		AscHP = "13-17",
		Image = "GremlinTsundere.png",
		Link = "Gremlins#Shield_Gremlin",
		Debut = "Act 1",
		Intents = {
			-- Is the block increase on Asc 2 or Asc 7?
			{	Name = "Protect",
				Text = "Random enemy gains 7 ({{Asc|2|8}} | {{Asc|17|11}}) {{KW|Block}}. Only chooses self if alone.",
				Icon = "Intent Defend.png",
				AscText = {
					"Random enemy gains 7 {{KW|Block}}. Only chooses self if alone.",
					"Random enemy gains {{Asc|2|8}} {{KW|Block}}. Only chooses self if alone.",
					"Random enemy gains {{Asc|17|11}} {{KW|Block}}. Only chooses self if alone.",
				}
			},
			{	Name = "Shield Bash",
				Text = "Deals 6 ({{Asc|2|8}}) damage.",
				Icon = "Intent Attack2.png",
				AscText = {
					"Deals 6 damage.",
					"Deals {{Asc|2|8}} damage."
				}
			}
		}
	},
	["Sneaky Gremlin"] = {
		Type = "Normal",
		BaseHP = "10-14",
		AscHP = "11-15",
		Image = "GremlinThief.png",
		Link = "Gremlins#Sneaky_Gremlin",
		Debut = "Act 1",
		Intents = {
			{	Name = "Puncture",
				Text = "Deals 9 ({{Asc|2|10}}) damage.",
				Icon = "Intent Attack2.png",
				AscText = {
					"Deals 9 damage.",
					"Deals {{Asc|2|10}} damage."
				}
			}
		}
	},
	["Spike Slime (L)"] = {
		Type = "Normal",
		BaseHP = "64-70",
		AscHP = "67-73",
		Image = "SpikeSlimeL.png",
		Link = "Slimes#Spike_Slime_(L)",
		StartsWith = "$Split",
		Debut = "Act 1",
		Intents = {
			{	Name = "Lick",
				Text = "Applies 2 ({{Asc|17|3}}) {{KW|Frail}}.",
				Icon = "Intent Debuff.png",
				AscText = {
					"Applies 2 {{KW|Frail}}.",
					"Applies {{Asc|17|3}} {{KW|Frail}}."
				}
			},
			{	Name = "Flame Tackle",
				Text = "Deals 16 ({{Asc|2|18}}) damage. Adds 2 {{C|Slimed}} into your discard pile.",
				Icon = "Intent DebuffAttack4.png",
				AscText = {
					"Deals 16 damage. Adds 2 {{C|Slimed}} into your discard pile.",
					"Deals {{Asc|2|18}}. Adds 2 {{C|Slimed}} into your discard pile."
				}
			},
			{	Name = "Split",
				Text = "Disappears and spawns 2 {{M|Spike Slime (M)|Spike Slimes (M)}} with its current HP.",
				Icon = "Intent Unknown.png"
			}
		}
	},
	["Spike Slime (M)"] = {
		Type = "Normal",
		BaseHP = "28-32",
		AscHP = "29-34",
		Image = "SpikeSlimeM.png",
		Link = "Slimes#Spike_Slime_(M)",
		Debut = "Act 1",
		Intents = {
			{	Name = "Lick",
				Text = "Applies 1 {{KW|Frail}}.",
				Icon = "Intent Debuff.png"
			},
			{	Name = "Flame Tackle",
				Text = "Deals 8 ({{Asc|2|10}}) damage. Adds a {{C|Slimed}} into your discard pile.",
				Icon = "Intent DebuffAttack2.png",
				AscText = {
					"Deals 8 damage. Adds a {{C|Slimed}} into your discard pile.",
					"Deals {{Asc|2|10}} damage. Adds a {{C|Slimed}} into your discard pile."
				}
			}
		}
	},
	["Spike Slime (S)"] = {
		Type = "Normal",
		BaseHP = "10-14",
		AscHP = "11-15",
		Image = "SpikeSlimeS.png",
		Link = "Slimes#Spike_Slime_(S)",
		Debut = "Act 1",
		Intents = {
			{	Name = "Tackle",
				Text = "Deals 5 ({{Asc|2|6}}) damage.",
				Icon = "Intent Attack2.png",
				AscText = {
					"Deals 5 damage.",
					"Deals {{Asc|2|6}} damage."
				}
			}
		}
	},

-- Elites
	["Gremlin Nob"] = {
		Type = "Elite",
		BaseHP = "82-86",
		AscHP = "85-90",
		Image = "GremlinNob.png",
		Debut = "Act 1",
		Intents = {
			{	Name = "Bellow",
				Text = "Gains 2 ({{Asc|18|3}}) {{KW|Enrage}}.",
				Icon = "Intent Buff.png",
				AscText = {
					"Gains 2 {{KW|Enrage}}.",
					"Gains {{Asc|18|3}} {{KW|Enrage}}."
				}
			},
			{	Name = "Skull Bash",
				Text = "Deals 6 ({{Asc|3|8}}) damage. Applies 2 {{KW|Vulnerable}}.",
				Icon = "Intent DebuffAttack2.png",
				AscText = {
					"Deals 6 damage. Applies 2 {{KW|Vulnerable}}.",
					"Deals {{Asc|3|8}} damage. Applies 2 {{KW|Vulnerable}}."
				}
			},
			{	Name = "Bull Rush",
				Text = "Deals 14 ({{Asc|3|16}}) damage.",
				Icon = "Intent Attack3.png",
				AscText = {
					"Deals 14 damage.",
					"Deals {{Asc|3|16}} damage."
				}
			}
		}
	},
	["Lagavulin"] = {
		Type = "Elite",
		BaseHP = "109-111",
		AscHP = "112-115",
		Image = "LagavulinAwake.png",
		Debut = "Act 1",
		StartsWith = "$Metallicize 8 <br> $Block 8",
		Intents = {
			{	Name = "Sleep",
				-- Internal name "IDLE"
				Text = "Does nothing.",
				Icon = "Intent Sleep.png"
			},
			{	Name = "Stunned",
				-- Internal name "OPEN"
				Text = "Does nothing.",
				Icon = "Intent Stunned.png"
			},
			{	Name = "Attack",
				-- Internal name "STRONG_ATK"
				Text = "Deals 18 ({{Asc|3|20}}) damage.",
				Icon = "Intent Attack4.png",
				AscText = {
					"Deals 18 damage.",
					"Deals {{Asc|3|20}} damage."
				}
			},
			{	Name = "Siphon Soul",
				Text = "Applies -1 ({{Asc|18|-2}}) {{KW|Dexterity}} and -1 ({{Asc|18|-2}}) {{KW|Strength}}.",
				Icon = "Intent DebuffStrong.png",
				AscText = {
					"Applies -1 {{KW|Dexterity}} and -1 {{KW|Strength}}.",
					"Applies {{Asc|18|-2}} {{KW|Dexterity}} and {{Asc|18|-2}} {{KW|Strength}}."
				}
			}
		}
	},
	["Sentry"] = {
		Type = "Elite",
		BaseHP = "38-42",
		AscHP = "39-45",
		Image = "Sentry.png",
		Debut = "Act 1",
		StartsWith = "$Artifact 1",
		Intents = {
			{	Name = "Bolt",
				Text = "Adds 2 ({{Asc|18|3}}) {{C|Dazed}} into your discard pile.",
				Icon = "Intent Debuff.png",
				AscText = {
					"Adds 2 {{C|Dazed}} into your discard pile.",
					"Adds {{Asc|18|3}} {{C|Dazed}} into your discard pile."
				}
			},
			{	Name = "Beam",
				-- There is an unused entry called "Disintegrate" in loc files
				Text = "Deals 9 ({{Asc|3|10}}) damage.",
				Icon = "Intent Attack2.png",
				AscText = {
					"Deals 9 damage.",
					"Deals {{Asc|3|10}} damage."
				}
			}
		}
	},

-- Bosses
	["Hexaghost"] = {
		Type = "Boss",
		BaseHP = "250",
		AscHP = "264",
		Image = "Hexaghost.png",
		Icon = "Map-Hexaghost.png",
		Debut = "Act 1",
		Intents = {
			{	Name = "Activate",
				Text = "Does nothing.",
				Icon = "Intent Unknown.png"
			},
			{	Name = "Divider",
				Text = "Deals (N+1)×6 damage. N = Player's HP at the start of the turn, divided by 12 (rounded down).",
				Icon = "Intent Attack7.png"
			},
			{	Name = "Sear",
				Text = "Deals 6 damage. Adds 1 ({{Asc|19|2}}) {{C|Burn|Burns}} into your discard pile.",
				Icon = "Intent DebuffAttack2.png",
				AscText = {
					"Deals 6 damage. Adds a {{C|Burn}} into your discard pile.",
					"Deals 6 damage. Adds {{Asc|19|2}} {{C|Burn|Burns}} into your discard pile."
				}
			},
			{	Name = "Tackle",
				Text = "Deals 5×2 ({{Asc|4|6×2}}) damage.",
				Icon = "Intent Attack3.png",
				AscText = {
					"Deals 5×2 damage.",
					"Deals {{Asc|4|6×2}} damage."
				}
			},
			{	Name = "Inflame",
				Text = "Gains 12 {{KW|Block}} and 2 ({{Asc|19|3}}) {{KW|Strength}}.",
				Icon = "Intent DefendBuff.png",
				AscText = {
					"Gains 12 {{KW|Block}} and 2 {{KW|Strength}}.",
					"Gains 12 {{KW|Block}} and {{Asc|19|3}} {{KW|Strength}}."
				}
			},
			{	Name = "Inferno",
				Text = "Deals 2×6 ({{Asc|4|3x6}}) damage. Adds 3 {{C|Burn|Burns+}} into your discard pile. Upgrades all {{C|Burn|Burns}}. For the rest of combat, any {{C|Burn}} created by {{Int|Hexaghost|Sear}} will be upgraded.",
				Icon = "Intent DebuffAttack5.png",
				AscText = {
					"Deals 2×6 damage. Adds 3 {{C|Burn|Burns+}} into your discard pile. Upgrades all {{C|Burn|Burns}}. For the rest of combat, any {{C|Burn}} created by {{Int|Hexaghost|Sear}} will be upgraded.",
					"Deals {{Asc|4|3×6}} damage. Adds 3 {{C|Burn|Burns+}} into your discard pile. Upgrades all {{C|Burn|Burns}}. For the rest of combat, any {{C|Burn}} created by {{Int|Hexaghost|Sear}} will be upgraded."
				}
			}
		}
	},
	["Slime Boss"] = {
		Type = "Boss",
		BaseHP = "140",
		AscHP = "150",
		Image = "SlimeBoss.png",
		Icon = "Map-SlimeBoss.png",
		Debut = "Act 1",
		StartsWith = "$Split",
		Intents = {
			{	Name = "Goop Spray",
				Text = "Adds 3 ({{Asc|19|5}}) {{C|Slimed}} into your discard pile.",
				Icon = "Intent DebuffStrong.png",
				AscText = {
					"Adds 3 {{C|Slimed}} into your discard pile.",
					"Adds {{Asc|19|5}} {{C|Slimed}} into your discard pile."
				}
			},
			{	Name = "Preparing",
				Text = "Does nothing.",
				Icon = "Intent Unknown.png"
			},
			{	Name = "Slam",
				Text = "Deals 35 ({{Asc|4|38}}) damage.",
				Icon = "Intent Attack7.png",
				AscText = {
					"Deals 35 damage.",
					"Deals {{Asc|4|38}} damage."
				}
			},
			{	Name = "Split",
				Text = "Disappears and spawns 1 {{M|Acid Slime (L)}} and 1 {{M|Spike Slime (L)}} with its current HP.",
				Icon = "Intent Unknown.png"
			}
		}
	},
	["The Guardian"] = {
		Type = "Boss",
		BaseHP = "240",
		AscHP = "250",
		Image = "TheGuardian.png",
		Icon = "Map-Guardian.png",
		Debut = "Act 1",
		StartsWith = "$Mode Shift 30 ({{Asc|9|35}} | {{Asc|19|40}})",
		Intents = {
			{	Name = "Charging Up",
				Text = "Gains 9 {{KW|Block}}.",
				Icon = "Intent Defend.png"
			},
			{	Name = "Fierce Bash",
				Text = "Deals 32 ({{Asc|4|36}}) damage.",
				Icon = "Intent Attack7.png",
				AscText = {
					"Deals 32 damage.",
					"Deals {{Asc|4|36}} damage."
				}
			},
			{	Name = "Vent Steam",
				Text = "Applies 2 {{KW|Weak}} and 2 {{KW|Vulnerable}}.",
				Icon = "Intent DebuffStrong.png"
			},
			{	Name = "Whirlwind",
				Text = "Deals 5×4 damage.",
				Icon = "Intent Attack5.png"
			},
			{	Name = "Defensive Mode",
				Text = "Gains 3 ({{Asc|19|4}}) {{KW|Sharp Hide}}.",
				Icon = "Intent Buff.png",
				AscText = {
					"Gains 3 {{KW|Sharp Hide}}.",
					"Gains {{Asc|19|4}} {{KW|Sharp Hide}}."
				}
			},
			{	Name = "Roll Attack",
				-- There is an unused entry called "Roll" in loc files
				Text = "Deals 9 ({{Asc|4|10}}) damage.",
				Icon = "Intent Attack2.png",
				AscText = {
					"Deals 9 damage.",
					"Deals {{Asc|4|10}} damage."
				}
			},
			-- Does Twin Slam uses BuffAttack Intent?
			{	Name = "Twin Slam",
				Text = "Deals 8×2 damage. Loses {{KW|Sharp Hide}}. Gains 30 ({{Asc|9|35}} | {{Asc|19|40}}) {{KW|Mode Shift}}, increased by 10 for each time {{KW|Mode Shift}} triggered this combat.",
				Icon = "Intent Attack4.png",
				AscText = {
					"Deals 8×2 damage. Loses {{KW|Sharp Hide}}. Gains 30 {{KW|Mode Shift}}, increased by 10 for each time {{KW|Mode Shift}} triggered this combat.",
					"Deals 8×2 damage. Loses {{KW|Sharp Hide}}. Gains {{Asc|9|35}} {{KW|Mode Shift}}, increased by 10 for each time {{KW|Mode Shift}} triggered this combat.",
					"Deals 8×2 damage. Loses {{KW|Sharp Hide}}. Gains {{Asc|19|40}} {{KW|Mode Shift}}, increased by 10 for each time {{KW|Mode Shift}} triggered this combat.",
				}
			}
		}
	},

------------ Act 2 ------------
-- Monsters
	["Byrd"] = {
		Type = "Normal",
		BaseHP = "25-31",
		AscHP = "26-33",
		Image = "Byrd.png",
		Debut = "Act 2",
		StartsWith = "$Flying 3 ({{Asc|17|4}})",
		Intents = {
			{	Name = "Peck",
				Text = "Deals 1×5 ({{Asc|2|1×6}}) damage.",
				Icon = "Intent Attack2.png",
				AscText = {
					"Deals 1×5 damage.",
					"Deals {{Asc|2|1×6}} damage.",
				}
			},
			{	Name = "Caw",
				Text = "Gains 1 {{KW|Strength}}.",
				Icon = "Intent Buff.png"
			},
			{	Name = "Swoop",
				Text = "Deals 12 ({{Asc|2|14}}) damage.",
				Icon = "Intent Attack3.png",
				AscText = {
					"Deals 12 damage.",
					"Deals {{Asc|2|14}} damage."
				}
			},
			{	Name = "Stunned",
				Text = "Does nothing.",
				Icon = "Intent Stunned.png"
			},
			{	Name = "Headbutt",
				Text = "Deals 3 damage.",
				Icon = "Intent Attack1.png"
			},
			{	Name = "Go Airborne",
				Text = "Gains 3 ({{Asc|17|4}}) {{KW|Flying}}.",
				Icon = "Intent Unknown.png",
				AscText = {
					"Gains 3 {{KW|Flying}}.",
					"Gains {{Asc|17|4}} {{KW|Flying}}."
				}
			}
		}
	},
	["Centurion"] = {
		Type = "Normal",
		BaseHP = "76-80",
		AscHP = "78-83",
		Image = "Centurion.png",
		Link = "Centurion_and_Mystic#Centurion",
		Debut = "Act 2",
		Intents = {
			-- Probability of using defend vs Slash?
			{	Name = "Slash",
				Text = "Deals 12 ({{Asc|2|14}}) damage.",
				Icon = "Intent Attack3.png",
				AscText = {
					"Deals 12 damage.",
					"Deals {{Asc|2|14}} damage."
				}
			},
			{	Name = "Protect",
				Text = "{{M|Mystic}} gains 15 ({{Asc|17|20}}) {{KW|Block}}. If alone, instead gains 15 ({{Asc|17|20}}) {{KW|Block}}.",
				Icon = "Intent Defend.png",
				AscText = {
					"{{M|Mystic}} gains 15 {{KW|Block}}. If alone, instead gains 15 {{KW|Block}}.",
					"{{M|Mystic}} gains {{Asc|17|20}} {{KW|Block}}. If alone, instead gains {{Asc|17|20}} {{KW|Block}}."
				}
			},
			{	Name = "Fury",
				Text = "Deals 6×3 ({{Asc|2|7×3}}) damage.",
				Icon = "Intent Attack4.png",
				AscText = {
					"Deals 6×3 damage.",
					"Deals {{Asc|2|7×3}} damage."
				}
			}
		}
	},
	["Chosen"] = {
		Type = "Normal",
		BaseHP = "95-99",
		AscHP = "98-103",
		Image = "Chosen.png",
		Debut = "Act 2",
		Intents = {
			{	Name = "Poke",
				Text = "Deals 5×2 ({{Asc|2|6×2}}) damage.",
				Icon = "Intent Attack3.png",
				AscText = {
					"Deals 5×2 damage.",
					"Deals {{Asc|2|6×2}} damage."
				}
			},
			{	Name = "Hex",
				Text = "Applies {{KW|Hex}}.",
				Icon = "Intent DebuffStrong.png"
			},
			{	Name = "Debilitate",
				Text = "Deals 10 ({{Asc|2|12}}) damage. Applies 2 {{KW|Vulnerable}}.",
				Icon = "Intent DebuffAttack3.png",
				AscText = {
					"Deals 10 damage. Applies 2 {{KW|Vulnerable}}.",
					"Deals {{Asc|2|12}} damage. Applies 2 {{KW|Vulnerable}}.",
				}
			},
			{	Name = "Drain",
				Text = "Applies 3 {{KW|Weak}}. Gain 3 {{KW|Strength}}.",
				Icon = "Intent DebuffDefend.png"
			},
			{	Name = "Zap",
				Text = "Deals 18 ({{Asc|2|21}}) damage.",
				Icon = "Intent Attack4.png",
				AscText = {
					"Deals 18 damage.",
					"Deals {{Asc|2|21}} damage."
				}
			}
		}
	},
	["Mugger"] = {
		Type = "Normal",
		BaseHP = "48-52",
		AscHP = "50-54",
		Image = "Mugger.png",
		Link = "Thieves#Mugger",
		Debut = "Act 2",
		StartsWith = "$Thievery 15 ({{Asc|17|20}})",
		Intents = {
			{	Name = "Mug",
				Text = "Deals 10 ({{Asc|2|11}}) damage.",
				Icon = "Intent Attack3.png",
				AscText = {
					"Deals 10 damage.",
					"Deals {{Asc|2|11}} damage."
				}
			},
			{	Name = "Lunge",
				Text = "Deals 16 ({{Asc|2|18}}) damage.",
				Icon = "Intent Attack4.png",
				AscText = {
					"Deals 16 damage.",
					"Deals {{Asc|2|18}} damage."
				}
			},
			{	Name = "Smoke Bomb",
				Text = "Gains 11 ({{Asc|17|17}}) {{KW|Block}}.",
				Icon = "Intent Defend.png",
				AscText = {
					"Gains 11 {{KW|Block}}.",
					 "Gains {{Asc|17|17}} {{KW|Block}}."
				}
			},
			{	Name = "Escape",
				Text = "Flees combat with your [[Gold]].",
				Icon = "Intent Escape.png"
			}
		}
	},
	["Mystic"] = {
		Type = "Normal",
		BaseHP = "48-56",
		AscHP = "50-58",
		Image = "Healer.png",
		Link = "Centurion_and_Mystic#Mystic",
		Debut = "Act 2",
		Intents = {
			{	Name = "Attack",
				Text = "Deals 8 ({{Asc|2|9}}) damage. Applies 2 {{KW|Frail}}.",
				Icon = "Intent DebuffAttack2.png",
				AscText = {
					"Deals 8 damage. Applies 2 {{KW|Frail}}.",
					"Deals {{Asc|2|9}} damage. Applies 2 {{KW|Frail}}."
				}
			},
			{	Name = "Buff",
				Text = "All enemies gain 2 ({{Asc|2|3}} | {{Asc|17|4}}) {{KW|Strength}}.",
				Icon = "Intent Buff.png",
				AscText = {
					"All enemies gain 2 {{KW|Strength}}.",
					"All enemies gain {{Asc|2|3}} {{KW|Strength}}.",
					"All enemies gain {{Asc|17|4}} {{KW|Strength}}."
				}
			},
			-- Is heal 20 or 21?
			-- Is the heal condition a single enemy missing 16 HP or can it be distributed between both?
			{	Name = "Heal",
				Text = "All enemies heal 16 ({{Asc|17|20}}) HP.",
				Icon = "Intent Buff.png",
				AscText = {
					"All enemies heal 16 HP.",
					"All enemies heal {{Asc|17|20}} HP."
				}
			}
		}
	},
	["Shelled Parasite"] = {
		Type = "Normal",
		BaseHP = "68-72",
		AscHP = "70-75",
		Image = "ShelledParasite.png",
		Debut = "Act 2",
		StartsWith = "$Plated Armor 14",
		Intents = {
			{	Name = "Double Strike",
				Text = "Deals 6×2 ({{Asc|2|7×2}}) damage.",
				Icon = "Intent Attack3.png",
				AscText = {
					"Deals 6×2 damage.",
					"Deals {{Asc|2|7×2}} damage."
				}
			},
			{	Name = "Life Suck",
				Text = "Deals 10 ({{Asc|2|12}}) damage. Heals HP equal to unblocked damage dealt.",
				Icon = "Intent BuffAttack3.png",
				AscText = {
					"Deals 10 damage. Heals HP equal to unblocked damage dealt.",
					"Deals {{Asc|2|12}} damage. Heals HP equal to unblocked damage dealt."
				}
			},
			{	Name = "Fell",
				Text = "Deals 18 ({{Asc|2|21}}) damage. Applies 2 {{KW|Frail}}.",
				Icon = "Intent DebuffAttack4.png",
				AscText = {
					"Deals 18 damage. Applies 2 {{KW|Frail}}.",
					"Deals {{Asc|2|21}} damage. Applies 2 {{KW|Frail}}."
				}
			},
			{	Name = "Stunned",
				Text = "Does nothing.",
				Icon = "Intent Stunned.png"
			}
		}
	},
	["Snake Plant"] = {
		Type = "Normal",
		BaseHP = "75-79",
		AscHP = "78-82",
		Image = "SnakePlant.png",
		Debut = "Act 2",
		StartsWith = "$Malleable 3",
		Intents = {
			{	Name = "Chomp Chomp",
				-- Internal name "CHOMPY_CHOMPS"
				Text = "Deals 7×3 ({{Asc|2|8×3}}) damage.",
				Icon = "Intent Attack5.png",
				AscText = {
					"Deals 7×3 damage.",
					"Deals {{Asc|2|8×3}} damage."
				}
			},
			{	Name = "Enfeebling Spores",
				Text = "Applies 2 {{KW|Frail}} and 2 {{KW|Weak}}.",
				Icon = "Intent DebuffStrong.png"
			}
		}
	},
	["Snecko"] = {
		Type = "Normal",
		BaseHP = "114-120",
		AscHP = "120-125",
		Image = "Snecko.png",
		Debut = "Act 2",
		Intents = {
			{	Name = "Perplexing Glare",
				Text = "Applies {{KW|Confused}}.",
				Icon = "Intent DebuffStrong.png"
			},
			{	Name = "Bite",
				Text = "Deals 15 ({{Asc|2|18}}) damage.",
				Icon = "Intent Attack4.png",
				AscText = {
					"Deals 15 damage.",
					"Deals {{Asc|2|18}} damage."
				}
			},
			-- Is Weak applied before Vul?
			{	Name = "Tail Whip",
				Text = "Deals 8 ({{Asc|2|10}}) damage. Applies {{Asc|17|2}} {{KW|Weak}} and 2 {{KW|Vulnerable}}.",
				Icon = "Intent DebuffAttack2.png",
				AscText = {
					"Deals 8 damage. Applies 2 {{KW|Vulnerable}}.",
					"Deals {{Asc|2|10}} damage. Applies 2 {{KW|Vulnerable}}.",
					"Deals {{Asc|2|10}} damage. Applies {{Asc|17|2}} {{KW|Weak}} and 2 {{KW|Vulnerable}}.",
				}
			}
		}
	},
	["Spheric Guardian"] = {
		Type = "Normal",
		BaseHP = "20",
		Image = "SphericGuardian.png",
		Debut = "Act 2",
		StartsWith = "$Artifact 3 <br> $Block 40 <br> $Barricade",
		Intents = {
			{	Name = "Activate",
				-- Internal name "INITIAL_BLOCK_GAIN"
				Text = "Gains 25 ({{Asc|17|35}}) {{KW|Block}}.",
				Icon = "Intent Defend.png",
				AscText = {
					"Gains 25 {{KW|Block}}.",
					"Gains {{Asc|17|35}} {{KW|Block}}."
				}
			},
			{	Name = "Debuff Attack",
				-- Internal name "FRAIL_ATTACK"
				Text = "Deals 10 ({{Asc|2|11}}) damage. Applies 5 {{KW|Frail}}.",
				Icon = "Intent DebuffAttack3.png",
				AscText = {
					"Deals 10 damage. Applies 5 {{KW|Frail}}.",
					"Deals {{Asc|2|11}} damage. Applies 5 {{KW|Frail}}."
				}
			},
			{	Name = "Slam",
				-- Internal name "BIG_ATTACK"
				Text = "Deals 10×2 ({{Asc|2|11×2}}) damage.",
				Icon = "Intent Attack5.png",
				AscText = {
					"Deals 10×2 damage.",
					"Deals {{Asc|2|11×2}} damage."
				}
			},
			{	Name = "Harden",
				-- Internal name "ATTACK_BLOCK"
				Text = "Deals 10 ({{Asc|2|11}}) damage. Gains 15 {{KW|Block}}.",
				Icon = "Intent DefendAttack3.png",
				AscText = {
					"Deals 10 damage. Gains 15 {{KW|Block}}.",
					"Deals {{Asc|2|11}} damage. Gains 15 {{KW|Block}}."
				}
			}
		}
	},

-- Elite
	["Book of Stabbing"] = {
		Type = "Elite",
		BaseHP = "160-164",
		AscHP = "168-172",
		Image = "BookOfStabbing.png",
		Debut = "Act 2",
		StartsWith = "$Painful Stabs",
		Intents = {
			{	Name = "Multi Stab",
				-- Internal name "STAB"
				Text = "Deals 6×N ({{Asc|3|7×N}}) damage. N = Number of times {{Int|Book of Stabbing|Multi Stab}} was used this combat, plus 2. On <span class=ascension-label>[[Ascension|Ascension <span class=ascension-glow>18+</span>]]</span>, N = Current turn, plus 1.",
				Icon = "Intent Attack3.png",
				AscText = {
					"Deals 6×N damage. N = Number of times {{Int|Book of Stabbing|Multi Stab}} was used this combat, plus 2.",
					"Deals {{Asc|3|7×N}} damage. N = Number of times {{Int|Book of Stabbing|Multi Stab}} was used this combat, plus 2.",
					"Deals {{Asc|18|7×N}} damage. N = Current turn, plus 1.",
				}
			},
			{	Name = "Big Stab",
				Text = "Deals 21 ({{Asc|3|24}}) damage.",
				Icon = "Intent Attack5.png",
				AscText = {
					"Deals 21 damage.",
					"Deals {{Asc|3|24}} damage."
				}
			}
		}
	},
	["Gremlin Leader"] = {
		Type = "Elite",
		BaseHP = "140-148",
		AscHP = "145-155",
		Image = "GremlinLeader.png",
		Debut = "Act 2",
		Intents = {
			{	Name = "Encourage",
				Text = "All enemies gain 3 ({{Asc|3|4}} | {{Asc|18|5}}) {{KW|Strength}}. Other enemies gain 6 ({{Asc|18|10}}) {{KW|Block}}.",
				Icon = "Intent DefendBuff.png",
				AscText = {
					"All enemies gain 3 {{KW|Strength}}. Other enemies gain 6 {{KW|Block}}.",
					"All enemies gain {{Asc|3|4}} {{KW|Strength}}. Other enemies gain 6 {{KW|Block}}.",
					"All enemies gain {{Asc|18|5}} {{KW|Strength}}. Other enemies gain {{Asc|18|10}} {{KW|Block}}."
				}
			},
			{	Name = "Stab",
				Text = "Deals 6×3 damage.",
				Icon = "Intent Attack4.png"
			},
			{	Name = "Rally!",
				Text = "Summon 2 random [[Gremlins]].",
				Icon = "Intent Unknown.png",
			}
		}
	},
	["Taskmaster"] = {
		Type = "Elite",
		BaseHP = "54-60",
		AscHP = "57-64",
		Image = "Taskmaster.png",
		Debut = "Act 2",
		Intents = {
			{	Name = "Scouring Whip",
				Text = "Deals 7 damage. Adds 1 ({{Asc|2|2}} | {{Asc|18|3}}) {{C|Wound|Wounds}} into your discard pile. Gains {{Asc|18|1}} {{KW|Strength}}.",
				Icon = "Intent DebuffAttack2.png",
				AscText = {
					"Deals 7 damage. Adds a {{C|Wound}} into your discard pile.",
					"Deals 7 damage. Adds {{Asc|3|2}} {{C|Wound|Wounds}} into your discard pile.",
					"Deals 7 damage. Adds {{Asc|18|3}} {{C|Wound|Wounds}} into your discard pile. Gains {{Asc|18|1}} {{KW|Strength}}."
				}
			}
		}
	},

-- Bosses
	["Bronze Automaton"] = {
		Type = "Boss",
		BaseHP = "300",
		AscHP = "320",
		Image = "BronzeAutomaton.png",
		Icon = "Map-Automaton.png",
		Debut = "Act 2",
		StartsWith = "$Artifact 3",
		Intents = {
			{	Name = "Spawn Orbs",
				Text = "Summons 2 {{M|Bronze Orb|Bronze Orbs}}.",
				Icon = "Intent Unknown.png"
			},
			{	Name = "Flail",
				Text = "Deals 7×2 ({{Asc|4|8x2}}) damage.",
				Icon = "Intent Attack3.png",
				AscText = {
					"Deals 7×2 damage.",
					"Deals {{Asc|4|8×2}} damage."
				}
			},
			{	Name = "Boost",
				Text = "Gains 3 ({{Asc|4|4}}) {{KW|Strength}} and 9 ({{Asc|9|12}}) {{KW|Block}}.",
				Icon = "Intent DefendBuff.png",
				AscText = {
					"Gains 3 {{KW|Strength}} and 9 {{KW|Block}}.",
					"Gains {{Asc|4|4}} {{KW|Strength}} and 9 {{KW|Block}}.",
					"Gains {{Asc|4|4}} {{KW|Strength}} and {{Asc|9|12}} {{KW|Block}}."
				}
			},
			{	Name = "HYPER BEAM",
				Text = "Deals 45 ({{Asc|4|50}}) damage.",
				Icon = "Intent Attack7.png",
				AscText = {
					"Deals 45 damage.",
					"Deals {{Asc|4|50}} damage."
				}
			},
			{	Name = "Stunned",
				Text = "Does nothing.",
				Icon = "Intent Unknown.png",
			}
		}
	},
	["Bronze Orb"] = {
		Type = "Minion",
		BaseHP = "52-58",
		AscHP = "54-60",
		Image = "BronzeOrb.png",
		Debut = "Act 2",
		StartsWith = "$Minion",
		Intents = {
			{	Name = "Stasis",
				Text = "{{KW|Stasis|Steals}} a random card of the highest rarity from your draw pile (or discard pile, if the draw pile is empty). On death, returns the card to your hand.",
				Icon = "Intent DebuffStrong.png"
			},
			{	Name = "Support Beam",
				Text = "{{M|Bronze Automaton}} gains 12 {{KW|Block}}.",
				Icon = "Intent Defend.png"
			},
			{	Name = "Beam",
				Text = "Deals 8 damage.",
				Icon = "Intent Attack2.png"
			}
		}
	},
	["The Champ"] = {
		Type = "Boss",
		BaseHP = "420",
		AscHP = "440",
		Image = "Champ.png",
		Icon = "Map-Champ.png",
		Debut = "Act 2",
		Intents = {
			{	Name = "Heavy Slash",
				Text = "Deals 16 ({{Asc|4|18}}) damage.",
				TextAsc0 = "Deals 16 damage.",
				TextAsc4 = "Deals 18 damage.",
				Icon = "Intent Attack4.png",
				AscText = {
					"Deals 16 damage.",
					"Deals {{Asc|4|18}} damage."
				}
			},
			{	Name = "Face Slap",
				Text = "Deals 12 ({{Asc|4|14}}) damage. Applies 2 {{KW|Frail}} and 2 {{KW|Vulnerable}}",
				Icon = "Intent DebuffAttack3.png",
				AscText = {
					"Deals 12  damage. Applies 2 {{KW|Frail}} and 2 {{KW|Vulnerable}}",
					"Deals {{Asc|4|14}} damage. Applies 2 {{KW|Frail}} and 2 {{KW|Vulnerable}}",
				}
			},
			{	Name = "Defensive Stance",
				Text = "Gains 15 ({{Asc|9|18}} | {{Asc|19|20}}) {{KW|Block}} and 5 ({{Asc|9|6}} | {{Asc|19|7}}) {{KW|Metallicize}}.",
				Icon = "Intent DefendBuff.png",
				AscText = {
					"Gains 15 {{KW|Block}} and 5 {{KW|Metallicize}}.",
					"Gains {{Asc|9|18}} {{KW|Block}} and {{Asc|9|6}} {{KW|Metallicize}}.",
					"Gains {{Asc|19|20}} {{KW|Block}} and {{Asc|19|7}} {{KW|Metallicize}}."
				}
			},
			{	Name = "Gloat",
				Text = "Gains 2 ({{Asc|4|3}} | {{Asc|19|4}}) {{KW|Strength}}.",
				Icon = "Intent Buff.png",
				AscText = {
					"Gains 2 {{KW|Strength}}.",
					"Gains {{Asc|4|3}} {{KW|Strength}}.",
					"Gains {{Asc|19|4}} {{KW|Strength}}."
				}
			},
			{	Name = "Taunt",
				Text = "Applies 2 {{KW|Weak}} and 2 {{KW|Vulnerable}}.",
				Icon = "Intent Unknown.png",
			},
			{	Name = "Anger",
				Text = "Removes all [[Debuffs]]. Gains 6 ({{Asc|4|9}} | {{Asc|19|12}}) {{KW|Strength}}.",
				Icon = "Intent Buff.png",
				AscText = {
					"Removes all [[Debuffs]]. Gains 6 {{KW|Strength}}.",
					"Removes all [[Debuffs]]. Gains {{Asc|4|9}} {{KW|Strength}}.",
					"Removes all [[Debuffs]]. Gains {{Asc|19|12}} {{KW|Strength}}."
				}
			},
			{	Name = "Execute",
				Text = "Deals 10×2 damage.",
				Icon = "Intent Attack7.png"
			}
		}
	},
	["The Collector"] = {
		Type = "Boss",
		BaseHP = "282",
		AscHP = "300",
		Image = "TheCollector.png",
		Icon = "Map-Collector.png",
		Debut = "Act 2",
		Intents = {
			{	Name = "Spawn",
				-- Internally "SPAWN" and "REVIVE" are two different Intents
				Text = "Summons up to 2 {{M|Torch Head|Torch Heads}}.",
				Icon = "Intent Unknown.png",
			},
			{	Name = "Fireball",
				Text = "Deals 18 ({{Asc|4|21}}) damage.",
				Icon = "Intent Attack4.png",
				AscText = {
					"Deals 18 damage.",
					"Deals {{Asc|4|21}} damage."
				}
			},
			{	Name = "Buff",
				Text = "All enemies gain 3 ({{Asc|4|4}} | {{Asc|19|5}}) {{KW|Strength}}. Gains 15 ({{Asc|9|18}} | {{Asc|19|23}}) {{KW|Block}}.",
				Icon = "Intent DefendBuff.png",
				AscText = {
					"All enemies gain 3 {{KW|Strength}}. Gains 15 {{KW|Block}}.",
					"All enemies gain {{Asc|4|4}} {{KW|Strength}}. Gains 15 {{KW|Block}}.",
					"All enemies gain {{Asc|4|4}} {{KW|Strength}}. Gains {{Asc|9|18}} {{KW|Block}}.",
					"All enemies gain {{Asc|19|5}} {{KW|Strength}}. Gains {{Asc|19|23}} {{KW|Block}}."
				}
			},
			{	Name = "Mega Debuff",
				Text = "Applies 3 ({{Asc|19|5}}) {{KW|Weak}}, 3 ({{Asc|19|5}}) {{KW|Vulnerable}} and 3 ({{Asc|19|5}}) {{KW|Frail}}.",
				Icon = "Intent DebuffStrong.png",
				AscText = {
					"Applies 3 {{KW|Weak}}, 3 {{KW|Vulnerable}} and 3 {{KW|Frail}}.",
					"Applies {{Asc|19|5}} {{KW|Weak}}, {{Asc|19|5}} {{KW|Vulnerable}} and {{Asc|19|5}} {{KW|Frail}}."
				}
			}
		}
	},
	["Torch Head"] = {
		Type = "Minion",
		BaseHP = "38-40",
		AscHP = "40-45",
		Image = "TorchHead.png",
		Link = "The_Collector#Torch_Head",
		Debut = "Act 2",
		StartsWith = "$Minion",
		Intents = {
			{	Name = "Tackle",
				Text = "Deals 7 damage.",
				Icon = "Intent Attack2.png"
			}
		}
	},

-- Event
	["Bear"] = {
		Type = "Event",
		BaseHP = "38-42",
		AscHP = "40-44",
		Image = "Bear.png",
		Link = "Masked_Bandits#Bear",
		Debut = "Act 2",
		Intents = {
			{	Name = "Bear Hug",
				Text = "Applies -2 ({{Asc|17|-4}}) {{KW|Dexterity}}.",
				Icon = "Intent Debuff.png",
				AscText = {
					"Applies -2 {{KW|Dexterity}}.",
					"Applies {{Asc|17|-4}} {{KW|Dexterity}}."
				}
			},
			{	Name = "Lunge",
				Text = "Deals 9 ({{Asc|2|10}}) damage. Gains 9 {{KW|Block}}.",
				Icon = "Intent DefendAttack2.png",
				AscText = {
					"Deals 9 damage. Gains 9 {{KW|Block}}.",
					"Deals {{Asc|2|10}} damage. Gains 9 {{KW|Block}}."
				}
			},
			{	Name = "Maul",
				Text = "Deals 18 ({{Asc|2|20}}) damage.",
				Icon = "Intent Attack4.png",
				AscText = {
					"Deals 18 damage.",
					"Deals {{Asc|2|20}} damage."
				}
			}
		}
	},
	["Romeo"] = {
		Type = "Event",
		BaseHP = "35-39",
		AscHP = "37-41",
		Image = "Romeo.png",
		Link = "Masked_Bandits#Romeo",
		Debut = "Act 2",
		Intents = {
			{	Name = "Mock",
				Text = "Does nothing.",
				Icon = "Intent Unknown.png"
			},
			{	Name = "Agonizing Slash",
				Text = "Deals 10 ({{Asc|2|12}}) damage. Applies 2 ({{Asc|17|3}}) {{KW|Weak}}.",
				Icon = "Intent DebuffAttack3.png",
				AscText = {
					"Deals 10 damage. Applies 2 {{KW|Weak}}.",
					"Deals {{Asc|2|12}} damage. Applies 2 {{KW|Weak}}.",
					"Deals {{Asc|2|12}} damage. Applies {{Asc|17|3}} {{KW|Weak}}."
				}
			},
			{	Name = "Cross Slash",
				Text = "Deals 15 ({{Asc|2|17}}) damage.",
				Icon = "Intent Attack4.png",
				AscText = {
					"Deals 15 damage.",
					"Deals {{Asc|2|17}} damage."
				}
			}
		}
	},
	["Pointy"] = {
		Type = "Event",
		BaseHP = "30",
		AscHP = "34",
		Image = "Pointy.png",
		Link = "Masked_Bandits#Pointy",
		Debut = "Act 2",
		Intents = {
			{	Name = "Pointy Special",
				Text = "Deals 5×2 ({{Asc|2|6×2}}) damage.",
				Icon = "Intent Attack3.png",
				AscText = {
					"Deals 5×2 damage.",
					"Deals {{Asc|2|6x2}} damage."
				}
			}
		}
	},

------------ Act 3 ------------
-- Monsters
	["Darkling"] = {
		Type = "Normal",
		BaseHP = "48-56",
		AscHP = "50-59",
		Image = "Darkling.png",
		Debut = "Act 3",
		StartsWith = "$Life Link",
		Intents = {
			{	Name = "Harden",
				Text = "Gains 12 {{KW|Block}} and {{Asc|17|2}} {{KW|Strength}}.",
				Icon = "Intent Defend.png",
				AscText = {
					"Gains 12 {{KW|Block}}.",
					"Gains 12 {{KW|Block}} and {{Asc|17|2}} {{KW|Strength}}.",
				}
			},
			{	Name = "Nip",
				Text = "Deals N damage. N = Number between 7-11 ({{Asc|2|9-13}}), chosen at the start of combat.",
				Icon = "Intent Attack2.png",
				AscText = {
					"Deals N damage. N = Number between 7-11, chosen at the start of combat.",
					"Deals N damage. N = Number between {{Asc|2|9-13}}, chosen at the start of combat.",
				}
			},
			{	Name = "Chomp",
				-- There is an unused entry called "Chomp Chomp!" in loc files
				Text = "Deals 8×2 ({{Asc|2|9×2}}) damage.",
				Icon = "Intent Attack4.png",
				AscText = {
					"Deals 8×2 damage.",
					"Deals {{Asc|2|9×2}} damage."
				}
			},
			{	Name = "Regrowing...",
				Text = "Does nothing.",
				Icon = "Intent Unknown.png"
			},
			{	Name = "Reincarnate",
				Text = "Revives with 50% HP.",
				Icon = "Intent Buff.png"
			}
		}
	},
	["Exploder"] = {
		Type = "Normal",
		BaseHP = "30",
		AscHP = "30-35",
		Image = "Exploder.png",
		Link = "Shapes#Exploder",
		Debut = "Act 3",
		StartsWith = "$Explosive 3",
		Intents = {
			{	Name = "Attack",
				Text = "Deals 9 ({{Asc|2|11}}) damage.",
				Icon = "Intent Attack2.png",
				AscText = {
					"Deals 9 damage.",
					"Deals {{Asc|2|11}} damage."
				}
			},
			-- Does it trigger Gremlin Horn?
			{	Name = "Explode",
				-- Internal name "BLOCK". Don't ask...
				Text = "Deals 30 damage. Dies.",
				Icon = "Intent Unknown.png"
			}
		}
	},
	["Jaw Worm (Hard)"] = {
		Type = "Normal",
		BaseHP = "40-44",
		AscHP = "42-46",
		Image = "JawWorm.png",
		Debut = "Act 3",
		StartsWith = "$Strength 3 ({{Asc|2|4}} | {{Asc|17|5}}) <br> $Block  6 ({{Asc|17|9}})",
		Intents = {
			-- Not needed, this enemy entry is only for showing the powers that they gain in Act 3.
		}
	},
	["Orb Walker"] = {
		Type = "Normal",
		BaseHP = "90-96",
		AscHP = "92-102",
		Image = "OrbWalker.png",
		Debut = "Act 3",
		StartsWith = "{{KW|Strength Up}} 3 ({{Asc|17|5}})",
		Intents = {
			{	Name = "Laser",
				Text = "Deals 10 ({{Asc|2|11}}) damage. Adds a {{C|Burn}} into your draw pile, and another {{C|Burn}} in your discard pile.",
				Icon = "Intent DebuffAttack3.png",
				AscText = {
					"Deals 10 damage. Adds a {{C|Burn}} into your draw pile, and another {{C|Burn}} into your discard pile.",
					"Deals {{Asc|2|11}} damage. Adds a {{C|Burn}} into your draw pile, and another {{C|Burn}} into your discard pile."
				}
			},
			{	Name = "Claw",
				Text = "Deals 15 ({{Asc|2|16}}) damage.",
				Icon = "Intent Attack4.png",
				AscText = {
					"Deals 15 damage.",
					"Deals {{Asc|2|16}} damage."
				}
			}
		}
	},
	["Repulsor"] = {
		Type = "Normal",
		BaseHP = "29-35",
		AscHP = "31-38",
		Image = "Repulsor.png",
		Link = "Shapes#Repulsor",
		Debut = "Act 3",
		Intents = {
			{	Name = "Daze",
				Text = "Adds 2 {{C|Dazed}} into your draw pile.",
				Icon = "Intent Debuff.png"
			},
			{	Name = "Attack",
				Text = "Deals 11 ({{Asc|2|13}}) damage.",
				Icon = "Intent Attack3.png",
				AscText = {
					"Deals 11 damage.",
					"Deals {{Asc|2|13}} damage."
				}
			}
		}
	},
	["Spiker"] = {
		Type = "Normal",
		BaseHP = "42-56",
		AscHP = "44-60",
		Image = "Spiker.png",
		Link = "Shapes#Spiker",
		Debut = "Act 3",
		StartsWith = "$Thorns 3 ({{Asc|2|4}} | {{Asc|17|7}})",
		Intents = {
			{	Name = "Attack",
				Text = "Deals 7 ({{Asc|2|9}}) damage.",
				Icon = "Intent Attack2.png",
				AscText = {
					"Deals 7 damage.",
					"Deals {{Asc|2|9}} damage."
				}
			},
			{	Name = "Buff Thorns",
				Text = "Gains 2 {{KW|Thorns}}.",
				Icon = "Intent Buff.png"
			}
		}
	},
	["Spire Growth"] = {
		Type = "Normal",
		BaseHP = "170",
		AscHP = "190",
		Image = "SpireGrowth.png",
		Debut = "Act 3",
		Intents = {
			{	Name = "Constrict",
				Text = "Applies 10 ({{Asc|2|12}}) {{KW|Constricted}}.",
				Icon = "Intent DebuffStrong.png",
				AscText = {
					"Applies 10 {{KW|Constricted}}.",
					"Applies {{Asc|2|12}} {{KW|Constricted}}.",
				}
			},
			{	Name = "Quick Tackle",
				Text = "Deals 16 ({{Asc|2|18}}) damage.",
				Icon = "Intent Attack4.png",
				AscText = {
					"Deals 16 damage.",
					"Deals {{Asc|2|18}} damage."
				}
			},
			{	Name = "Smash",
				Text = "Deals 22 ({{Asc|2|25}}) damage.",
				Icon = "Intent Attack5.png",
				AscText = {
					"Deals 22 damage.",
					"Deals {{Asc|2|25}} damage."
				}
			}
		}
	},
	["The Maw"] = {
		Type = "Normal",
		BaseHP = "300",
		Image = "Maw.png",
		Debut = "Act 3",
		Intents = {
			{	Name = "Roar",
				Text = "Applies 3 ({{Asc|17|5}}) {{KW|Weak}} and 3 ({{Asc|17|5}}) {{KW|Frail}}.",
				Icon = "Intent DebuffStrong.png",
				AscText = {
					"Applies 3 {{KW|Weak}} and 3 {{KW|Frail}}.",
					"Applies {{Asc|17|5}} {{KW|Weak}} and {{Asc|17|5}} {{KW|Frail}}."
				}
			},
			{	Name = "Slam",
				Text = "Deals 25 ({{Asc|2|30}}) damage.",
				Icon = "Intent Attack6.png",
				AscText = {
					"Deals 25 damage.",
					"Deals {{Asc|2|30}} damage."
				}
			},
			{	Name = "Nom Nom",
				-- Internal name "NOMNOMNOM"
				Text = "Deals 5×N damage. N = Current turn, divided by two (rounded up).",
				Icon = "Intent Attack2.png"
			},
			{	Name = "Drool",
				Text = "Gains 3 ({{Asc|17|5}}) {{KW|Strength}}.",
				Icon = "Intent Buff.png",
				AscText = {
					"Gains 3 {{KW|Strength}}.",
					"Gains {{Asc|17|5}} {{KW|Strength}}."
				}
			}
		}
	},
	["Transient"] = {
		Type = "Normal",
		BaseHP = "999",
		Image = "Transient.png",
		Debut = "Act 3",
		StartsWith = "$Fading 5 ({{Asc|17|6}}) <br> $Shifting",
		Intents = {
			{	Name = "Attack",
				Text = "Deals 20+N ({{Asc|2|30+N}}) damage. N = Current turn, multiplied by 10.",
				Icon = "Intent Attack7.png",
				AscText = {
					"Deals 20+N damage. N = Current turn, multiplied by 10.",
					"Deals {{Asc|2|30+N}} damage. N = Current turn, multiplied by 10."
				}
			}
		}
	},
	["Writhing Mass"] = {
		Type = "Normal",
		BaseHP = "160",
		AscHP = "175",
		Image = "WrithingMass.png",
		Debut = "Act 3",
		StartsWith = "$Malleable 4 <br> $Reactive",
		Intents = {
			-- Can use Defend Attack on first turn?
			-- Can Malleable reroll Parasite on first turn?
			{	Name = "Multi Hit",
				Text = "Deals 7×3 ({{Asc|2|9x3}}) damage.",
				Icon = "Intent Attack5.png",
				AscText = {
					"Deals 7×3 damage.",
					"Deals {{Asc|2|9×3}} damage."
				}
			},
			{	Name = "Debuff Attack",
				-- Internal name "ATTACK_DEBUFF"
				Text = "Deals 10 ({{Asc|2|12}}) damage. Applies 2 {{KW|Weak}} and 2 {{KW|Vulnerable}}.",
				Icon = "Intent DebuffAttack3.png",
				AscText = {
					"Deals 10 damage. Applies 2 {{KW|Weak}} and 2 {{KW|Vulnerable}}.",
					"Deals {{Asc|2|12}} damage. Applies 2 {{KW|Weak}} and 2 {{KW|Vulnerable}}."
				}
			},
			{	Name = "Big Hit",
				Text = "Deals 32 ({{Asc|2|38}}) damage.",
				Icon = "Intent Attack7.png",
				AscText = {
					"Deals 32 damage.",
					"Deals {{Asc|2|38}} damage."
				}
			},
			-- Does Block increase with Asc?
			{	Name = "Block Attack",
				-- Internal name "ATTACK_BLOCK"
				Text = "Deals 15 ({{Asc|2|16}}) damage. Gains 16 {{KW|Block}}.",
				Icon = "Intent DefendAttack4.png",
				AscText = {
					"Deals 15 damage. Gains 16 {{KW|Block}}.",
					"Deals {{Asc|2|16}} damage. Gains 16 {{KW|Block}}."
				}
			},
			{	Name = "Parasite",
				-- Internal name "MEGA_DEBUFF"
				Text = "Permanently adds a {{C|Parasite}} to your deck.",
				Icon = "Intent DebuffStrong.png"
			}
		}
	},

-- Elites
	["Giant Head"] = {
		Type = "Elite",
		BaseHP = "500",
		AscHP = "520",
		Image = "GiantHead.png",
		Debut = "Act 3",
		StartsWith = "$Slow",
		Intents = {
			{	Name = "Count",
				Text = "Deals 13 damage.",
				Icon = "Intent Attack3.png"
			},
			{	Name = "Glare",
				Text = "Applies 1 {{KW|Weak}}.",
				Icon = "Intent Debuff.png"
			},
			{	Name = "It Is Time",
				Text = "Deals 30 ({{Asc|3|40}}) damage, increased by 5 for each time {{Int|Giant Head|It Is Time}} has been used this combat (up to a maximum of 60 ({{Asc|3|70}}) damage).",
				Icon = "Intent Attack7.png",
				AscText = {
					"Deals 30 damage, increased by 5 for each time {{Int|Giant Head|It Is Time}} has been used this combat (up to a maximum of 60 damage).",
					"Deals {{Asc|3|40}} damage, increased by 5 for each time {{Int|Giant Head|It Is Time}} has been used this combat (up to a maximum of {{Asc|3|70}} damage)."
				}
			}
		}
	},
	["Nemesis"] = {
		Type = "Elite",
		BaseHP = "185",
		AscHP = "200",
		Image = "Nemesis.png",
		Debut = "Act 3",
		StartsWith = "$Intangible every other turn",
		Intents = {
			{	Name = "Tri Attack",
				Text = "Deals 6×3 ({{Asc|3|7×3}}) damage.",
				Icon = "Intent Attack4.png",
				AscText = {
					"Deals 6×3 damage.",
					"Deals {{Asc|3|7×3}} damage."
				}
			},
			{	Name = "Tri Burn",
				Text = "Adds 3 ({{Asc|18|5}}) {{C|Burn|Burns}} into your discard pile.",
				Icon = "Intent Debuff.png",
				AscText = {
					"Adds 3 {{C|Burn|Burns}} into your discard pile.",
					"Adds {{Asc|18|5}} {{C|Burn|Burns}} into your discard pile."
				}
			},
			{	Name = "Scythe",
				Text = "Deals 45 damage.",
				Icon = "Intent Attack7.png"
			}
		}
	},
	["Reptomancer"] = {
		Type = "Elite",
		BaseHP = "180-190",
		AscHP = "190-200",
		Image = "Reptomancer.png",
		Debut = "Act 3",
		Intents = {
			{	Name = "Spawn Dagger",
				Text = "Summons 1 ({{Asc|18|2}}) {{M|Dagger|Daggers}} (up to a maximum of 4).",
				Icon = "Intent Unknown.png",
				AscText = {
					"Summons a {{M|Dagger}}.",
					"Summons {{Asc|18|2}} {{M|Dagger|Daggers}} (up to a maximum of 4)."
				}
			},
			{	Name = "Big Bite",
				Text = "Deals 30 ({{Asc|3|34}}) damage.",
				Icon = "Intent Attack7.png",
				AscText = {
					"Deals 30 damage.",
					"Deals {{Asc|3|34}} damage."
				}
			},
			{	Name = "Snake Strike",
				Text = "Deals 13×2 ({{Asc|3|16×2}}) damage. Applies 1 {{KW|Weak}}.",
				Icon = "Intent DebuffAttack6.png",
				AscText = {
					"Deals 13×2 damage. Applies 1 {{KW|Weak}}.",
					"Deals {{Asc|3|16×2}} damage. Applies 1 {{KW|Weak}}."
				}
			}
		}
	},
	["Dagger"] = {
		Type = "Minion",
		BaseHP = "20-25",
		AscHP = "20-25",
		Image = "Dagger.png",
		Link = "Reptomancer#Dagger",
		Debut = "Act 3",
		StartsWith = "$Minion",
		Intents = {
			{	Name = "Wound",
				Text = "Deals 9 damage. Adds a {{C|Wound}} into your discard pile.",
				Icon = "Intent DebuffAttack2.png"
			},
			{	Name = "Explode",
				Text = "Deals 25 damage. Dies",
				Icon = "Intent Attack6.png"
			}
		}
	},
-- Bosses
	["Awakened One"] = {
		Type = "Boss",
		BaseHP = "300",
		AscHP = "320",
		Image = "AwakenedOne.png",
		Icon = "Map-Awakened.png",
		Debut = "Act 3",
		StartsWith = "$Regenerate 10 ({{Asc|19|15}}) <br> $Curiosity 1 ({{Asc|19|2}}) <br> ($Strength 2 {{Asc|4}})",
		Intents = {
			{	Name = "Slash",
				Text = "Deals 20 damage.",
				Icon = "Intent Attack5.png"
			},
			{	Name = "Soul Strike",
				Text = "Deals 6×4 damage.",
				Icon = "Intent Attack5.png"
			},
			{	Name = "Rebirth",
				-- There is an unused entry called "Cleanse" in loc files
				Text = "Heals to full HP. Removes all [[Debuffs]]. Loses {{KW|Curiosity}}.",
				Icon = "Intent Unknown.png"
			},
			{	Name = "Dark Echo",
				Text = "Deals 40 damage.",
				Icon = "Intent Attack7.png"
			},
			{	Name = "Sludge",
				Text = "Deals 18 damage. Adds a {{C|Void}} into your draw pile.",
				Icon = "Intent DebuffAttack4.png"
			},
			{	Name = "Tackle",
				Text = "Deals 10×3 damage.",
				Icon = "Intent Attack7.png"
			}
		}
	},
	["Deca"] = {
		Type = "Boss",
		BaseHP = "250",
		AscHP = "265",
		Image = "Deca.png",
		Link = "Donu_and_Deca#Deca",
		Icon = "Map-DonuDeca.png",
		Debut = "Act 3",
		StartsWith = "$Artifact 2 ({{Asc|19|3}})",
		Intents = {
			{	Name = "Beam",
				Text = "Deals 10×2 ({{Asc|4|12×2}}) damage. Adds 2 {{C|Dazed}} into your discard pile.",
				Icon = "Intent DebuffAttack5.png",
				AscText = {
					"Deals 10×2 damage. Adds 2 {{C|Dazed}} into your discard pile.",
					"Deals {{Asc|4|12×2}} damage. Adds 2 {{C|Dazed}} into your discard pile."
				}
			},
			{	Name = "Square of Protection",
				Text = "All enemies gain 16 {{KW|Block}} and {{Asc|19|3}} {{KW|Plated Armor}}.",
				Icon = "Intent Defend.png",
				AscText = {
					"All enemies gain 16 {{KW|Block}}.",
					"All enemies gain 16 {{KW|Block}} and {{Asc|19|3}} {{KW|Plated Armor}}.",
				}
			}
		}
	},
	["Donu"] = {
		Type = "Boss",
		BaseHP = "250",
		AscHP = "265",
		Image = "Donu.png",
		Link = "Donu_and_Deca#Donu",
		Icon = "Map-DonuDeca.png",
		Debut = "Act 3",
		StartsWith = "$Artifact 2 ({{Asc|19|3}})",
		Intents = {
			{	Name = "Circle of Power",
				Text = "All enemies gain 3 {{KW|Strength}}.",
				Icon = "Intent Buff.png"
			},
			{	Name = "Beam",
				Text = "Deals 10×2 ({{Asc|4|12×2}}) damage.",
				Icon = "Intent Attack6.png",
				AscText = {
					"Deals 10×2 damage.",
					"Deals {{Asc|4|12×2}} damage."
				}
			}
		}
	},
	["Time Eater"] = {
		Type = "Boss",
		BaseHP = "456",
		AscHP = "480",
		Image = "TimeEater.png",
		Icon = "Map-TimeEater.png",
		Debut = "Act 3",
		StartsWith = "$Time Warp",
		Intents = {
			{	Name = "Reverberate",
				Text = "Deals 7×3 ({{Asc|4|8×3}}) damage.",
				Icon = "Intent Attack5.png",
				AscText = {
					"Deals 7×3 damage.",
					"Deals {{Asc|4|8×3}} damage."
				}
			},
			{	Name = "Head Slam",
				Text = "Deals 26 ({{Asc|4|32}}) damage. Applies 1 {{KW|Draw Reduction}}. Adds {{Asc|19|2}} {{C|Slimed}} into your discard pile.",
				Icon = "Intent DebuffAttack6.png",
				AscText = {
					"Deals 26 damage. Applies 1 {{KW|Draw Reduction}}.",
					"Deals {{Asc|4|32}} damage. Applies 1 {{KW|Draw Reduction}}.",
					"Deals {{Asc|4|32}} damage. Applies 1 {{KW|Draw Reduction}}. Adds {{Asc|19|2}} {{C|Slimed}} into your discard pile."
				}
			},
			{	Name = "Ripple",
				Text = "Gains 20 {{KW|Block}}. Applies 1 {{KW|Vulnerable}}, 1 {{KW|Weak}} and {{Asc|19|1}} {{KW|Frail}}.",
				Icon = "Intent DebuffDefend.png",
				AscText = {
					"Gains 20 {{KW|Block}}. Applies 1 {{KW|Vulnerable}} and 1 {{KW|Weak}}.",
					"Gains 20 {{KW|Block}}. Applies 1 {{KW|Vulnerable}}, 1 {{KW|Weak}} and {{Asc|19|1}} {{KW|Frail}}."
				}
			},
			{	Name = "Haste",
				Text = "Removes all [[Debuffs]]. Heals to 50% HP. Gains {{Asc|19|32}} {{KW|Block}}.",
				Icon = "Intent Buff.png",
				AscText = {
					"Removes all [[Debuffs]]. Heals to 50% HP.",
					"Removes all [[Debuffs]]. Heals to 50% HP. Gains {{Asc|19|32}} {{KW|Block}}.",
				}
			}
		}
	},

------------ Act 4 ------------
-- Elites
	["Spire Shield"] = {
		Type = "Elite",
		BaseHP = "110",
		AscHP = "125",
		Image = "SpireShield.png",
		Link = "Spire_Shield_and_Spire_Spear#Spire_Shield",
		StartsWith = "$Artifact 1 ({{Asc|18|2}})",
		Debut = "Act 4",
		Intents = {
			{	Name = "Bash",
				Text = "Deals 12 ({{Asc|3|14}}) damage. If the Player has an [[Orbs#Orb_Slot|Orb Slot]], there is 50% chance to apply -1 {{KW|Focus}}. Otherwise applies -1 {{KW|Strength}}.",
				Icon = "Intent DebuffAttack3.png",
				AscText = {
					"Deals 12 damage. If the Player has an [[Orbs#Orb_Slot|Orb Slot]], there is 50% chance to apply -1 {{KW|Focus}}. Otherwise applies -1 {{KW|Strength}}.",
					"Deals {{Asc|3|14}} damage. If the Player has an [[Orbs#Orb_Slot|Orb Slot]], there is 50% chance to apply -1 {{KW|Focus}}. Otherwise applies -1 {{KW|Strength}}."
				}
			},
			{	Name = "Fortify",
				Text = "All enemies gain 30 {{KW|Block}}.",
				Icon = "Intent Defend.png"
			},
			-- TODO TEST: Is the block gained from Smash reduced by Intangible?
			{	Name = "Smash",
				Text = "Deals 34 ({{Asc|3|38}}) damage. Gains {{KW|Block}} equal to damage dealt. On <span class=ascension-label>[[Ascension|Ascension <span class=ascension-glow>18+</span>]]</span>, instead always gains 99 {{KW|Block}}.",
				Icon = "Intent DefendAttack7.png",
				AscText = {
					"Deals 34 damage. Gains {{KW|Block}} equal to damage dealt.",
					"Deals {{Asc|3|38}} damage. Gains {{KW|Block}} equal to damage dealt.",
					"Deals {{Asc|3|38}} damage. Gains {{Asc|18|99}} {{KW|Block}}."
				}
			}
		}
	},
	["Spire Spear"] = {
		Type = "Elite",
		BaseHP = "160",
		AscHP = "180",
		Image = "SpireSpear.png",
		Link = "Spire_Shield_and_Spire_Spear#Spire_Spear",
		Debut = "Act 4",
		StartsWith = "$Artifact 1 ({{Asc|18|2}})",
		Intents = {
			{	Name = "Burn Strike",
				Text = "Deals 5×2 ({{Asc|3|6×2}}) damage. Adds 2 {{C|Burn|Burns}} into your discard pile. On <span class=ascension-label>[[Ascension|Ascension <span class=ascension-glow>18+</span>]]</span>, the {{C|Burn|Burns}} are instead added on top of your draw pile.",
				Icon = "Intent DebuffAttack3.png",
				AscText = {
					"Deals 5×2 damage. Adds 2 {{C|Burn|Burns}} into your discard pile.",
					"Deals {{Asc|3|6×2}} damage. Adds 2 {{C|Burn|Burns}} into your discard pile.",
					"Deals {{Asc|3|6×2}} damage. Adds 2 {{C|Burn|Burns}} {{Asc|18|on top of your draw pile}}."
				}
			},
			{	Name = "Skewer",
				Text = "Deals 10×3 ({{Asc|3|10×4}}) damage.",
				Icon = "Intent Attack7.png",
				AscText = {
					"Deals 10×3 damage.",
					"Deals {{Asc|3|10×4}} damage."
				}
			},
			{	Name = "Piercer",
				Text = "All enemies gain 2 {{KW|Strength}}.",
				Icon = "Intent Buff.png"
			}
		}
	},

-- Bosses
	["Corrupt Heart"] = {
		Type = "Boss",
		BaseHP = "750",
		AscHP = "800",
		Image = "CorruptHeart.png",
		Icon = "Map-CorruptHeart.png",
		Debut = "Act 4",
		StartsWith = "$Beat of Death 1 ({{Asc|19|2}}) <br> $Invincible 300 ({{Asc|19|200}})",
		Intents = {
			{	Name = "Debilitate",
				Text = "Applies 2 {{KW|Vulnerable}}, 2 {{KW|Weak}} and 2 {{KW|Frail}}. Adds 1 {{C|Burn}}, 1 {{C|Dazed}}, 1 {{C|Slimed}}, 1 {{C|Void}} and 1 {{C|Wound}} into your draw pile.",
				Icon = "Intent DebuffStrong.png"
			},
			{	Name = "Blood Shots",
				Text = "Deals 2×12 ({{Asc|4|2×15}}) damage.",
				Icon = "Intent Attack7.png",
				AscText = {
					"Deals 2×12 damage.",
					"Deals {{Asc|4|2×15}} damage."
				}
			},
			{	Name = "Echo",
				-- Internal name "ECHO_ATTACK"
				Text = "Deals 40 ({{Asc|4|45}}) damage.",
				Icon = "Intent Attack7.png",
				AscText = {
					"Deals 40 damage.",
					"Deals {{Asc|4|45}} damage."
				}
			},
			{	Name = "Buff",
				-- Internal name "GAIN_ONE_STRENGTH"
				Text = "Loses all negative {{KW|Strength}}, then gains 2 {{KW|Strength}}. Gains an additional [[Buffs|Buff]]:<ul><li>1st buff: 2 {{KW|Artifact}}</li><li>2nd buff: 1 {{KW|Beat of Death}}</li><li>3rd buff: {{KW|Painful Stabs}}</li><li>4th buff: 10 {{KW|Strength}}</li><li>5th buff: 50 {{KW|Strength}}</li></ul>",
				Icon = "Intent Buff.png"
			}
		}
	},
}

local formatted = {}
for name, enemy in pairs(all_data) do
	enemy.EditLink = "Module:Enemies/data"
	formatted[name] = enemy
end

return formatted