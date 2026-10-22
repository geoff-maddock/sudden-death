/* Archetype cards for the sports that had almost none. Each sport now has a way to build for it. */
// golf: few, efficient turns: big single hits and draw
K('golf_driver', 'Driver', 'any', 'atk', 2, 'u', 'one', [['d', 22]], { sport: 'golf', home: [['freestroke']], fl: 'Fore. Mostly.' });
K('golf_chip', 'Chip Shot', 'any', 'skl', 0, 'c', 'self', [['draw', 2]], { sport: 'golf', fl: 'Soft hands.' });
K('golf_putt', 'Lag Putt', 'any', 'atk', 1, 'c', 'one', [['d', 8], ['draw', 1]], { sport: 'golf', fl: 'Inside the leather.' });
K('golf_caddie', 'Caddie’s Read', 'any', 'skl', 1, 'u', 'self', [['b', 6], ['s', 'drawnext', 2, 'self']], { sport: 'golf', fl: 'Breaks left. Everything breaks left.' });
K('golf_eagle', 'Eagle Eye', 'any', 'atk', 1, 'r', 'one', [['d', 14], ['s', 'vuln', 2]], { sport: 'golf', home: [['freestroke']], fl: 'Two under, and smug about it.' });
// bowling: hit the whole lineup
K('bwl_roll', 'Rolling Thunder', 'any', 'atk', 1, 'c', 'all', [['d', 5]], { sport: 'bowling', fl: 'Heard it from the parking lot.' });
K('bwl_hook', 'Hook Shot', 'any', 'atk', 2, 'u', 'all', [['d', 7], ['s', 'weak', 1, 'all']], { sport: 'bowling', fl: 'Breaks late into the pocket.' });
K('bwl_pinsetter', 'Pinsetter', 'any', 'skl', 1, 'c', 'self', [['b', 6], ['draw', 1]], { sport: 'bowling', fl: 'Reset. Again.' });
K('bwl_spare', 'Pick Up the Spare', 'any', 'atk', 1, 'u', 'all', [['d', 4, 2]], { sport: 'bowling', home: [['nrg', 1]], fl: 'Nobody cheers for a spare. Nobody.' });
K('bwl_gutter', 'Gutter Ball', 'any', 'atk', 0, 'c', 'all', [['d', 3]], { sport: 'bowling', fl: 'Still counts as a roll.' });
// jousting: one huge opener each turn (the tilt doubles your first Attack)
K('jst_gallop', 'Full Gallop', 'any', 'atk', 2, 'c', 'one', [['d', 16]], { sport: 'jousting', fl: 'The ground shakes. So does the knight.' });
K('jst_visor', 'Lower the Visor', 'any', 'skl', 1, 'c', 'self', [['b', 8]], { sport: 'jousting', fl: 'Eyes on the lance.' });
K('jst_couched', 'Couched Charge', 'any', 'atk', 1, 'u', 'one', [['d', 11], ['s', 'weak', 1]], { sport: 'jousting', fl: 'Braced, aimed, delivered.' });
K('jst_champion', 'Tourney Champion', 'any', 'pow', 2, 'r', 'self', [['s', 'str', 2, 'self']], { sport: 'jousting', fl: 'Ribbons on the lance, blood on the sand.' });
K('jst_unhorse', 'Unhorse', 'any', 'atk', 2, 'u', 'one', [['d', 12], ['s', 'stun', 1]], { sport: 'jousting', fl: 'Down in the dirt, armour and all.' });
// curling: hold cards, keep Block, build the house
K('crl_guard', 'Guard Stone', 'any', 'skl', 1, 'c', 'self', [['b', 8]], { sport: 'curling', retain: 1, fl: 'Sits in front. Waits.' });
K('crl_takeout', 'Takeout', 'any', 'atk', 1, 'c', 'one', [['d', 6], ['b', 4]], { sport: 'curling', fl: 'Knocked clean out of the house.' });
K('crl_button', 'Draw to the Button', 'any', 'skl', 2, 'u', 'self', [['b', 14]], { sport: 'curling', fl: 'Dead centre.' });
K('crl_hammer', 'Last Rock', 'any', 'atk', 2, 'r', 'one', [['d', 10], ['b', 10]], { sport: 'curling', retain: 1, fl: 'You have the hammer.' });
K('crl_broom', 'Broom Work', 'any', 'skl', 0, 'c', 'self', [['b', 3], ['draw', 1]], { sport: 'curling', fl: 'Heat the ice. Guide the stone.' });
// boxing: steady damage and taking rounds
K('box_jab', 'Jab', 'any', 'atk', 0, 'c', 'one', [['d', 4]], { sport: 'boxing', fl: 'Keep it working.' });
K('box_onetwo', 'One-Two', 'any', 'atk', 1, 'c', 'one', [['d', 5, 2]], { sport: 'boxing', fl: 'Textbook.' });
K('box_clinch', 'Clinch', 'any', 'skl', 1, 'c', 'one', [['b', 7], ['s', 'weak', 1]], { sport: 'boxing', fl: 'Tie them up. Catch your breath.' });
K('box_uppercut', 'Uppercut', 'any', 'atk', 2, 'u', 'one', [['d', 14], ['s', 'vuln', 1]], { sport: 'boxing', fl: 'From the floorboards.' });
K('box_rope', 'Rope-a-Dope', 'any', 'skl', 1, 'u', 'self', [['b', 12], ['s', 'drawnext', 1, 'self']], { sport: 'boxing', fl: 'Let them punch themselves out.' });

