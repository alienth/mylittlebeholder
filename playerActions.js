
if ( ! state.playerActions ) {
    state.playerActions = {}
}

on("chat:message", function(msg) {
        if (msg.content.indexOf("{{classaction=") > -1) {
            classAction(msg);
        }
        if (msg.content.indexOf("{{spell=1}}") > -1) {
            spellCast(msg);
        }
        if (msg.content.substr(0, 5) === "!rest") {
            restCommand(msg);
        }
});

on("change:graphic:represents", function(obj) {
    if(obj.get("represents") != "") {
       var character = getObj("character", obj.get("represents"));
       log(character);
    }
});


on("change:graphic:statusmarkers", function(obj, prev) {
    if (obj.get("status_aura")) {
        obj.set("light_radius", "20");
        obj.set("light_otherplayers", true);
    } else if (prev["statusmarkers"].indexOf("aura") > -1) {
        obj.set("light_radius", "");
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
            var name = character.get("name");
            tokenByCharacterName[name] = [token.id];
            characterNameByToken[token.id] = [name];
        }
    });
}


function spellCast(msg) {
    log(msg);
    if (msg.content.indexOf("looks at the instructions") > -1) {
        return;
    }
    if (msg.content.indexOf("{{spellritual=1}}") &&
        msg.content.indexOf("**Cast as ritual:** y") > -1) {
        return;
    }

    var spellLevel = 0;
    // This doesn't match for cantrips, and as such the level will remain 0
    var spellLevelRe = /subheaderright=.*? Level (\d+)/;
    var levelCheck = spellLevelRe.exec(msg.content);
    if (levelCheck) {
        spellLevel = levelCheck[1];
    }

    var castLevel = spellLevel;
    if (msg.content.indexOf("**Cast at level:**") > -1) {
        var levelRe = /\*\*Cast at level:\*\* (\d+)/;
        var levelCheck = levelRe.exec(msg.content);
        if (levelCheck) {
            castLevel = levelCheck[1];
        }
    }

    var nameRe = /{{title=.*?}} {{subheader=(.*?)}}/;
    var nameCheck = nameRe.exec(msg.content);

    if (nameCheck && spellLevel > 0) {
        useSpellSlot(nameCheck[1], spellLevel, castLevel);
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
                slotAttr.set("current", current - 1);
            }
        }
    }
}


function classAction(msg) {

    var actionNum = 0;
    var actionNumRe = /{{classaction=(\d+)}}/;
    var actionNumCheck = actionNumRe.exec(msg.content);
    if (actionNumCheck) {
        actionNum = actionNumCheck[1];
    }

    var nameRe = /{{title=(.*?)}} {{subheader=(.*?)}}/;
    var nameCheck = nameRe.exec(msg.content);

    if (nameCheck) {
        useClassAction(nameCheck[2], nameCheck[1], actionNum);
    }

}

function useClassAction(charName, actionName, actionNum) {
    character = findCharByName(charName);

    if (character && character.get("controlledby")) {
        var rechargeAttr = findAttrByName(character.id, "classactionrecharge" + actionNum);
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
                    resourceAttr.set("current", current - 1);
                    if (actionName === "Rage") {
                        var token = getObj("graphic", state.playerActions.tokenByCharacterName[charName]);
                        if (token) {
                            token.set("status_strong", true);
                        }
                        // TODO: Create this attr if it doesn't exist.
                        var rageAttr = findAttrByName(character.id, "in_rage");
                        if (rageAttr) {
                            rageAttr.set("current", "1");
                        }
                    } else if (actionName === "Reckless Attack") {
                        var token = getObj("graphic", state.playerActions.tokenByCharacterName[charName]);
                        if (token) {
                            token.set("status_archery-target", true);
                        }
                    }
                }
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
    if (msg.who !== "alienth (GM)") {
        log("Non-gm tried to rest. Ignoring." + msg.who);
        return;
    }
    args = msg.content.split(/\s+/);

    switch (args[1].toLowerCase()) {
        case 'long':
            rechargeSpells('long');
            rechargeActions('long');
            rechargeHitDice();
            //rechargeHP();
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
                var slotsMax = ops[0].inlinerolls["1"].results.total;
                if (slotsMax > 0) {
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
                    log("Recharged resource " + i + " for player " + character.get("name"));
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
                    current = attr.get("current");
                    if (current < max) {
                        var newCurrent = Math.min(current + restore, max);
                        attr.set("current", newCurrent);
                    }
                }
            }
        });
    });
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
