
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
    getPlayerTokens();
    //getCharacters();
});

on("change:campaign:playerpageid", function() {
    getPlayerTokens();
});

on("add:character", function(obj) {
    //getCharacters(obj);
});

function getPlayerTokens() {
    log("searching for player tokens");
    state.playerActions.tokenByPlayerName = {}
    state.playerActions.playerNameByToken = {}
    var tokens = findObjs({
        _pageid: Campaign().get("playerpageid"),
        _type: "graphic"});
    _.each(tokens, function(obj) {
        if(obj.get("represents") != "") {
            player = getObj("character", obj.get("represents"));
            state.playerActions.tokenByPlayerName[player.get("name")] = obj.id;
            state.playerActions.playerNameByToken[obj.id] = player.get("name");
        }
    });
}


function spellCast(msg) {
    log(msg);
    if (msg.content.indexOf("looks at the instructions") > -1) {
        return;
    }
    if (msg.content.indexOf("{{spellritual=1}}") &&
        msg.content.indexOf("**Cast as ritual**: y") > -1) {
        return;
    }

    var spellLevel = 0
    // This doesn't match for cantrips, and as such the level will remain 0
    var spellLevelRe = /subheaderright=.*? Level (\d+)/;
    var levelCheck = spellLevelRe.exec(msg.content);
    if (levelCheck) {
        spellLevel = levelCheck[1]
    }

    var castLevel = spellLevel
    if (msg.content.indexOf("**Cast at level:**") > -1) {
        var levelRe = /\*\*Cast at level:\*\* (\d+)/;
        var levelCheck = levelRe.exec(msg.content);
        if (levelCheck) {
            castLevel = levelCheck[1]
        }
    }

    var nameRe = /{{title=.*?}} {{subheader=(.*?)}}/
    var nameCheck = nameRe.exec(msg.content);

    if (nameCheck && spellLevel > 0) {
        useSpellSlot(nameCheck[1], spellLevel, castLevel)
    }
}

function useSpellSlot(name, spellLevel, castLevel) {
    character = findCharByName(name);
    if (character && character.get("controlledby")) {
        var normalSlotAttr = findAttrByName(character.id, "spell_slots_l" + castLevel);
        var warlockSlotAttr = findAttrByName(character.id, "warlock_spell_slots");
        var isWarlock = getAttrByName(character.id, "warlock_level")
        var slotAttr = undefined
        if (warlockSlotAttr && isWarlock > 0) {
            slotAttr = warlockSlotAttr;
        } else if (normalSlotAttr) {
            slotAttr = normalSlotAttr;
        }
        if (slotAttr) {
            current = slotAttr.get("current")
            if (current < 1) {
                wizardSays(name + ", you lack the necessary spell slots to cast that.")
            }  else {
                slotAttr.set("current", current - 1)
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
                        var token = getObj("graphic", state.playerActions.tokenByPlayerName[charName]);
                        if (token) {
                            token.set("status_strong", true);
                        }
                        var rageAttr = findAttrByName(character.id, "in_rage");
                        if (rageAttr) {
                            rageAttr.set("current", "1");
                        }
                    };
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
            wizardSays("/w " + character.get("name") + " The rest has renewed your mind. (Please manually reset your spell slots)");
//            var slotsMaxFormula = getAttrByName(character.id, "warlock_spell_slots", "max");
//            var slotsMax = 0;
//            sendChat(character.id, slotsMaxFormula, function(ops) {
//                slotsMax = ops[0];
//            });
//            log(slotsMax);
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
            if (recharge && recharge.toLowerCase().indexOf(type.toLowerCase()) > -1) {
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
