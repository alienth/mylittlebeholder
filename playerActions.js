
if ( ! state.playerActions ) {
    state.playerActions = {}
}

function debugLog(content) {
    var debug = 1;
    if (debug) sendChat("api", "/w gm " + content);
}

on("chat:message", function(msg) {
        if (msg.content.indexOf("{{classaction=") > -1) {
            classAction(msg);
        }
        if (msg.content.indexOf("{{spell=1}}") > -1) {
            spellCast(msg);
        }
        if (msg.content.indexOf("{{title=Spending Hit Dice}}")) {
            spendHitDice(msg);
        }
        if (msg.content.substr(0, 5) === "!rest") {
            restCommand(msg);
        }
        if (msg.content.substr(0, 11) === "!clear-wild") {
            wildMagicIcon(1);
        }
        if (msg.content.substr(0, 14) === "!shaped-vision") {
            shaped.getSelectedToken(msg, shaped.setTokenVision);
        }
});

on("change:graphic:represents", function(obj) {
    if(obj.get("represents") != "") {
       var character = getObj("character", obj.get("represents"));
       log(character);
    }
});


on("change:attribute:current", function(obj, prev) {
    if(obj.get("name") != "HP") return;
    var character = getObj("character", obj.get("_characterid"));
    var oldValue = prev["current"];
    var newValue = obj.get("current");
    if (newValue < oldValue && character.get("name") === "Beargen Beastcoat") {
        debugLog("ATTENTION! Beargen just took damage. If it was by a hostile, have him make a DC 15 Wis saving throw or he goes berserk!");
    }
});

on("ready", function() {
    getCharacterTokens();
    //getCharacters();
});

on("change:campaign:playerpageid", function() {
    getCharacterTokens();
});

on("add:character", function(obj) {
    //getCharacters(obj);
});

function getCharacterTokens() {
    log("searching for character tokens");
    var tokenByCharacterName = state.playerActions.tokenByCharacterName = {};
    var characterNameByToken = state.playerActions.characterNameByToken = {};
    var tokens = findObjs({
        _pageid: Campaign().get("playerpageid"),
        _type: "graphic"});
    _.each(tokens, function(token) {
        if(token.get("represents") != "") {
            var character = getObj("character", token.get("represents"));
            if (character) {
                var name = character.get("name");
                tokenByCharacterName[name] = [token.id];
                characterNameByToken[token.id] = [name];
            }
        }
    });
}


function spellCast(msg) {
    log(msg);
    if (msg.content.indexOf("looks at the instructions") > -1) {
        return;
    }
    if (msg.content.indexOf("{{spellcastritual=y}}") > -1) {
        return;
    }

    var spellLevel = 0;
    // This doesn't match for cantrips, and as such the level will remain 0
    var spellLevelRe = /{{spellfriendlylevel=Level (\d+)}}/;
    var levelCheck = spellLevelRe.exec(msg.content);
    if (levelCheck) {
        spellLevel = levelCheck[1];
    }

    var castLevel = spellLevel;
    var levelRe = /{{spell_cast_as_level=(\d+)}}/;
    var levelCheck = levelRe.exec(msg.content);
    if (levelCheck) {
        castLevel = levelCheck[1];
    }

    var charName = charNameFromRoll(msg);

    if (charName && spellLevel > 0) {
        if (charName === "Dyrbaet") {
            debugLog("ATTENTION! Dyrbaet just cast a lvl " + spellLevel + " spell. Have her roll 1d20 for Wild Magic chance.");
            wildMagicIcon();
        }
        var titleRe = /{{title=(.*?)}}/;
        var titleCheck = titleRe.exec(msg.content);
        if (titleCheck) {
            if (titleCheck[1] === "Sweeping Cinder Strike") {
                character = findCharByName(charName);
                useKi(character, 1);
                return;
            }
            if (titleCheck[1] === "Scorching Ray") {
                debugLog("ATTENTION! " + charName + " cast scorching ray. Have them manually decrement spell slots.");
                return;
            }
        }
        useSpellSlot(charName, spellLevel, castLevel);
    }
}

function useSpellSlot(name, spellLevel, castLevel) {
    character = findCharByName(name);
    if (character && character.get("controlledby")) {
        var normalSlotAttr = findAttrByName(character.id, "spell_slots_l" + castLevel);
        var warlockSlotAttr = findAttrByName(character.id, "warlock_spell_slots");
        var isWarlock = getAttrByName(character.id, "warlock_level");
        var slotAttr = undefined;
        if (warlockSlotAttr && isWarlock > 0) {
            slotAttr = warlockSlotAttr;
        } else if (normalSlotAttr) {
            slotAttr = normalSlotAttr;
        }
        if (slotAttr) {
            current = slotAttr.get("current");
            if (current < 1) {
                wizardSays(name + ", you lack the necessary spell slots to cast that.");
            }  else {
                debugLog("decrementing " + slotAttr.get("name") + " for " + name);
                slotAttr.set("current", current - 1);
            }
        }
    }
}

function useKi(character, cost) {
    var kiAttr = findAttrByName(character.id, "classactionresource20"); // hardcoded for Hunter - FIXME
    var kiCurrent = kiAttr.get("current");
    var charName = character.get("name");
    if (cost === undefined) {
        debugLog("ATTENTION! " + charName + " has used an action with an undefined ki cost. Have them manually decrement.");
        return;
    } else if (cost > +kiCurrent) {
        wizardSays(charName + ", you lack the necessary ki to use that.");
        return;
    }

    kiAttr.set("current", kiCurrent - cost);
    debugLog("decrementing " + kiAttr.get("name") + " for " + charName + " by " + cost);
    return;
}


function classAction(msg) {

    var actionNum = 0;
    var actionNumRe = /{{classaction=(\d+)}}/;
    var actionNumCheck = actionNumRe.exec(msg.content);
    if (actionNumCheck) {
        actionNum = actionNumCheck[1];
    }

    var charName = charNameFromRoll(msg);

    if (charName && actionNum) {
        useClassAction(charName, actionNum, msg);
    }
}

function useClassAction(charName, actionNum, msg) {
    var character = findCharByName(charName);
    if (!(character && character.get("controlledby"))) {
        return
    }

    var sorcPointActions = {
        "Careful Spell": 1,
        "Distant Spell": 1,
        "Empowered Spell": 1,
        "Extend Spell": 1,
        "Heightened Spell": 3,
        "Quickened Spell": 2,
        "Subtle Spell": 1,
        "Twinned Spell": undefined,
        "Create Spell Slot": undefined
    }

    var kiActions = {
        "flurry of blows": 1,
        "patient defense": 1,
        "step of the wind": 1,
        "water whip": undefined,
        "fist of unbroken air": undefined
    }

    var createSpellSlotCost = {
        1: 2,
        2: 3,
        3: 5,
        4: 6,
        5: 7
    }

    var rechargeAttr = findAttrByName(character.id, "classactionrecharge" + actionNum);
    var actionName = getAttrByName(character.id, "classactionname" + actionNum, "current");

    // Sorc point stuff
    if (sorcPointActions.hasOwnProperty(actionName)) {
        var spAttr = findAttrByName(character.id, "sorcery_points");
        var spCurrent = spAttr.get("current");
        cost = sorcPointActions[actionName];

        if (actionName == "Create Spell Slot") {
            var spellSlotLevel = msg.inlinerolls["0"].results.total;
            if (spellSlotLevel) {
                cost = createSpellSlotCost[spellSlotLevel];
                if (cost > spCurrent) {
                    wizardSays(charName + ", you lack the necessary sorcery points to use that.");
                    return;
                }
                slotAttr = findAttrByName(character.id, "spell_slots_l" + spellSlotLevel);
                if (slotAttr) {
                    current = slotAttr.get("current");
                    max = slotAttr.get("max");
                    if (max && current >= max) {
                        wizardSays(charName + ", you are already at the maximum number of level " + spellSlotLevel + " spell slots.");
                        return;
                    }
                    if (current) {
                        // Increment spell slots
                        slotAttr.set("current", +current + 1);
                        debugLog("incrementing " + slotAttr.get("name") + " for " + charName);

                        // Decrement sorc points
                        spAttr.set("current", +spCurrent - +cost);
                        debugLog("decrementing " + spAttr.get("name") + " for " + charName + " by " + cost);
                    }
                }
            }
            return;
        }
        if (cost === undefined) {
            debugLog("ATTENTION! " + charName + " has used an action with an undefined sorc point cost. Have them manually decrement.");
            return;
        } else if (cost > +spCurrent) {
            wizardSays(charName + ", you lack the necessary sorcery points to use that.");
            return;
        }

        spAttr.set("current", spCurrent - cost);
        debugLog("decrementing " + spAttr.get("name") + " for " + charName + " by " + cost);
        return;
    }

    // Ki stuff
    if (kiActions.hasOwnProperty(actionName.toLowerCase())) {
        cost = kiActions[actionName.toLowerCase()];
        useKi(character, cost);
        return;
    }

    if (actionName === "Reckless Attack") {
        var token = getObj("graphic", state.playerActions.tokenByCharacterName[charName]);
        if (token) {
            debugLog("setting status_archery-target on " + charName);
            token.set("status_archery-target", true);
        }
        return;
    }

    // Class actions which use a local resource are below
    if (! rechargeAttr) {
        return;
    } else if (rechargeAttr.get("current") === "None") {
        return;
    } else {
        var resourceAttr = findAttrByName(character.id, "classactionresource" + actionNum);
        if (resourceAttr) {
            current = resourceAttr.get("current");
            max = resourceAttr.get("max");
            if (max > 0 && current < 1) {
                wizardSays(charName + ", you must take a " + rechargeAttr.get("current").toLowerCase() + " before you can do that.");
            } else {
                if (actionName === "Rage") {
                    var token = getObj("graphic", state.playerActions.tokenByCharacterName[charName]);
                    if (token) {
                        token.set("status_strong", true);
                        debugLog("setting status_strong on " + charName);
                    }
                    // TODO: Create this attr if it doesn't exist.
                    var rageAttr = findAttrByName(character.id, "in_rage");
                    if (rageAttr) {
                        debugLog("setting in_rage on " + charName);
                        rageAttr.set("current", "1");
                    }
                } else if (actionName === "Rod of the Pact Keeper") {
                    var rodRe = /warlock spell slot/g;
                    var rodCheck = rodRe.exec(msg.content);
                    if (rodCheck) {
                        var slotAttr = findAttrByName(character.id, "warlock_spell_slots");
                        var slotCurrent = slotAttr.get("current");
                        var slotsMaxFormula = getAttrByName(character.id, "warlock_spell_slots", "max");
                        // Make the formula an inline roll so that we can gather its result via sendChat()
                        slotsMaxFormula = "[[" + slotsMaxFormula.replace(/@{warlock_level}/g, "@{" + character.get("name") + "|warlock_level}") + "]]";
                        sendChat(character.id, slotsMaxFormula, function(ops) {
                            slotsMax = ops[0].inlinerolls["0"].results.total;
                            if (slotsMax > 0) {
                                if (+slotCurrent >= slotsMax) {
                                    wizardSays(charName + ", you already have the maximum number of warlock spell slots.");
                                    return;
                                }
                                debugLog("incrementing " + slotAttr.get("name") + " for " + charName);
                                slotAttr.set("current", +slotCurrent + 1);
                                resourceAttr.set("current", current - 1);
                                debugLog("decrementing " + resourceAttr.get("name") + " for " + charName);
                            }
                        });
                        return; // we decrement in the sendChat calbac, so dont want to have the final decrement run - FIXME
                    }
                }
                resourceAttr.set("current", current - 1);
                debugLog("decrementing " + resourceAttr.get("name") + " for " + charName);
            }
        }
    }
}


function wizardSays(msg) {
    sendChat("a far away wizard says", msg);
};

function findAttrByName(char_id, name) {
    attrs = findObjs({
        _type: "attribute",
        _characterid: char_id,
        name: name
    });

    if (attrs.length < 1) {
        return;
    } else if (attrs.length === 1) {
        return attrs[0];
    } else {
        log("Found multiple attrs in findAttrByName call");
        return;
    }
};

function findCharByName(name) {
    character = findObjs({
        name: name,
        _type: "character",
    });

    if (character.length === 1) {
        return(character[0]);
    } else if (character.length > 1) {
        log("Found too many players who cast spell: " + name);
    } else {
        log("Unable to find char: " + name);
    }
}

function getPlayerCharacters() {
    characters = filterObjs(function(obj) {
        if (obj.get("type") === "character" && obj.get("controlledby")) {
            return true;
        } else {
            return false;
        }
    });
    return characters;
}

function restCommand(msg) {
    if (!playerIsGM(msg.playerid)) {
        debugLog("Non-GM tried to issue rest command. Ignoring.");
        return;
    }
    args = msg.content.split(/\s+/);

    switch (args[1].toLowerCase()) {
        case 'long':
            rechargeSpells('long');
            rechargeActions('long');
            rechargeHitDice();
            //rechargeHP();
            debugLog("Tell everyone to restore all lost HP.");
            break;
        case 'short':
            rechargeSpells('short');
            rechargeActions('short');
            break;
        default:
            wizardSays("Usage: !rest (long|short)");
    }
}

function rechargeSpells(type) {
    _.each(getPlayerCharacters(), function(character) {

        var isWarlock = getAttrByName(character.id, "warlock_level")

        // Spell slots - non warlocks
        if (type === "long") {
            for (i = 1; i <= 9; i++) {
                slotAttr = findAttrByName(character.id, "spell_slots_l" + i);
                if (slotAttr) {
                    max = slotAttr.get("max");
                    if (max) {
                        slotAttr.set("current", max);
                        debugLog("recharing " + slotAttr.get("name") + " for " + charName);
                    }
                }
            }
        }

        if (isWarlock > 0 && (type === "long" || type === "short")) {
            var charName = character.get("name");
            var slotAttr = findAttrByName(character.id, "warlock_spell_slots");
            var slotsMaxFormula = getAttrByName(character.id, "warlock_spell_slots", "max");
            // Make the formula an inline roll so that we can gather its result via sendChat()
            slotsMaxFormula = "[[" + slotsMaxFormula.replace(/@{warlock_level}/g, "@{" + character.get("name") + "|warlock_level}") + "]]";
            sendChat(character.id, slotsMaxFormula, function(ops) {
                var slotsMax = ops[0].inlinerolls["0"].results.total;
                if (slotsMax > 0) {
                    debugLog("recharing " + slotAttr.get("name") + " for " + charName);
                    slotAttr.set("current", slotsMax);
                }
            });
        }
    });
}

function rechargeActions(type) {
    _.each(getPlayerCharacters(), function(character) {
        // The charsheet has 20 actions, at the moment
        for (i = 1; i <= 20; i++) {
            rechargeAttr = findAttrByName(character.id, "classactionrecharge" + i);
            recharge = undefined;
            if (rechargeAttr) {
                recharge = rechargeAttr.get("current");
            }
            // TODO: Clean this mess up
            if (recharge && (recharge.toLowerCase().indexOf(type.toLowerCase()) > -1 || (type === "long" && recharge.toLowerCase().indexOf("short") > -1))) {
                resourceAttr = findAttrByName(character.id, "classactionresource" + i);
                current = max = undefined;
                if (resourceAttr) {
                    current = resourceAttr.get("current");
                    max = resourceAttr.get("max");
                }
                if (max) {
                    resourceAttr.set("current", max);
                    debugLog("Recharged class action resource " + i + " for player " + character.get("name"));
                }
            }
        }
    });
}

function rechargeHitDice() {
    dieType = [ "d6", "d8", "d10", "d12" ];
    _.each(getPlayerCharacters(), function(character) {
        dieType.forEach(function(type) {
            max = getMaxHitDice(character, type);
            if (max > 0) {
                restore = Math.floor(max/2);
                attr = findAttrByName(character.id, "hd_" + type);
                if (attr) {
                    current = +attr.get("current");
                    if (current < max) {
                        var newCurrent = Math.min(current + restore, max);
                        attr.set("current", newCurrent);
                        debugLog("Recharged hit dice " + type + " for " + character.get("name"));
                    }
                }
            }
        });
    });
}

function spendHitDice(msg) {
    var hitDiceRe = /{{title=Spending Hit Dice}} {{subheader=(.*?)}}/;
    var hdCheck = hitDiceRe.exec(msg.content);
    if (hdCheck) {
        var type = hdCheck[1];
        var charName = charNameFromRoll(msg);
        var character = findCharByName(charName);

        if (character) {
            var max = getMaxHitDice(character, type);
            var diceAttr = findAttrByName(character.id, "hd_" + type);
            var hpAttr = findAttrByName(character.id, "HP");
            var dieRoll = msg.inlinerolls["1"].results.total;
            if (max > 0 && diceAttr && hpAttr) {
                currentDice = +diceAttr.get("current");
                currentHP = +hpAttr.get("current");
                maxHP = +hpAttr.get("max");
                if (maxHP == currentHP) {
                    wizardSays(charName + ", you're already at full health.");
                    return;
                }
                if (currentDice > 0) {
                    var restoreHP = Math.min(currentHP + dieRoll, maxHP);
                    hpAttr.set("current", restoreHP);
                    diceAttr.set("current", --currentDice);
                    debugLog("Healing " + charName + " to " + restoreHP);
                    debugLog("Decremented die " + diceAttr.get("name"));
                } else {
                    wizardSays(charName + ", your hit dice are already exhausted.");
                }
            }
        }
    }

}

function getMaxHitDice(character, type) {
    // var max = getAttrByName(characterID, "hd_" + type, "max");
    // The formula is currently unfetchable from the character sheet
    // (possibly due to the attr being duplicated for the NPC sheet)
    // As such, we're reproducing the formula here.

    // TODO: Get the custom classes in here, too
    // Unfortunately they're formulas, so they'll need the sendChat treatment
    var attrs = [ ];
    if (type === "d6") {
        attrs = [ "sorcerer_level", "wizard_level" ];
    } else if (type === "d8") {
        attrs = [ "bard_level", "cleric_level", "druid_level", "rogue_level", "monk_level", "warlock_level" ];
    } else if (type === "d10") {
        attrs = [ "fighter_level" , "paladin_level", "ranger_level" ];
    } else if (type === "d12") {
        attrs = [ "barbarian_level" ];
    }

    var total = 0;
    for (i = 0; i < attrs.length; i++) {
        count = getAttrByName(character.id, attrs[i]);
        if (count) {
            total += +count;
        }
    }
    return total;
}

function charNameFromRoll (msg) {
    var nameRe = /{{character_name=(.*?)}}/;
    var nameCheck = nameRe.exec(msg.content);

    if (nameCheck) {
        return nameCheck[1];
    }
}

function wildMagicIcon (remove) {
    var token = findObjs({
        _pageid: Campaign().get("playerpageid"),
        _type: "graphic",
        name: "Dyrbaet"});

    if(token.length < 1) {
        return;
    }

    var dyrbaet = token[0];

    var token = findObjs({
    _pageid: Campaign().get("playerpageid"),
    _type: "graphic",
    name: "wild-magic-aura"});

    if(token.length > 0) {
        if (remove === 1) {
            token[0].remove();
            return;
        }
        log("wild-magic token already exists");
        return;
    }

    createObj("graphic", {
        name: "wild-magic-aura",
        pageid: Campaign().get("playerpageid"),
        imgsrc: "https://s3.amazonaws.com/files.d20.io/images/642812/YwEa-jyRrrox48aw8IdsrA/thumb.png?1360584955",
        left: dyrbaet.get("left"),
        top: dyrbaet.get("top"),
        layer: 'gmlayer',
        width: 200,
        height: 200,
    });

}
