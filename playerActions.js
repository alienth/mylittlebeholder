
if ( ! state.playerActions ) {
    state.playerActions = {}
}

on("chat:message", function(msg) {
        if (msg.content.indexOf("{{title=Rage}} {{subheader=Beargen") > -1) {
            beargenSmash();
        }
        if (msg.content.indexOf("{{spell=1}}") > -1) {
            spellCast(msg);
        }
});

on("change:graphic:represents", function(obj) {
    if(obj.get("represents") != "") {
       var character = getObj("character", obj.get("represents"));
       log(character);
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

    if (nameCheck) {
        useSpellSlot(nameCheck[1], spellLevel, castLevel)
    }
}

function useSpellSlot(name, spellLevel, castLevel) {
    character = findObjs({
        name: name,
        _type: "character",
    });

    if (character.length < 1) {
        log("Unable to find player who cast spell: " + name);
    } else if (character.length > 1) {
        log("Found too many players who cast spell: " + name);
    } else {
        log("Found player: " + character[0] + character[0].id);
        character = character[0];
        var normalSlotAttr = findAttrByName(character.id, "spell_slots_l" + castLevel);
        var warlockSlotAttr = findAttrByName(character.id, "warlock_spell_slots");
        var isWarlock = getAttrByName(character.id, "warlock_level")
        var slotAttr = undefined
        if (warlockSlotAttr.length > 0 && isWarlock > 0) {
            slotAttr = warlockSlotAttr[0];
        } else if (normalSlotAttr.length > 0) {
            slotAttr = normalSlotAttr[0];
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

function beargenSmash() {
    log("beargen entered rage")
    token = getObj("graphic", state.playerActions.tokenByPlayerName["Beargen Beastcoat"])
    if (token) {
        character = getObj("character", token.get("represents"))
        var resourceAttr = findAttrByName(character.id, "classactionresource1")
        if (resourceAttr.length > 0) {
            resourceAttr = resourceAttr[0];
            current = resourceAttr.get("current")
            if (current < 1) {
                wizardSays("Beargen, you lack the endurance necessary to rage again so soon.")
            } else {
                resourceAttr.set("current", current - 1);
                var rageAttr = findAttrByName(character.id, "in_rage")
                if (rageAttr.length > 0) {
                    rageAttr[0].set("1")
                }
                token.set("status_strong", true)
            }

        }

    }
}

function wizardSays(msg) {
    sendChat("a far away wizard says", msg)
}

function findAttrByName(char_id, name) {
    return findObjs({
        _type: "attribute",
        _characterid: char_id,
        name: name
    });
}
