
# Current features

## Class actions

    * Class actions with resources are automatically decremented when used.
    * Sorcery Point consuming actions will consume sorcery points.
    * 'Create Spell Slot' Sorc spell will consume sorc points and increment spell levels.
    * Lvl 3 Ki actions will decrement Ki resource.
        * Currently hardcoded: Ki resource must be set on classactionresource20.
    * 'Rage' action will set the 'strong' token icon.
    * 'Reckless Attack' action will set the 'archery-target' token icon.
    * 'Rod of the Pact Keeper' action will refil one warlock spell slot.


## Resting

    * '!rest long' will auto recharge spell slots, class action resources, and HD.
        * Assumes any 'short' reset items are also applied.
    * '!rest short' will auto recharge warlock spell slots and class action resources.

## Hit Dice

    * Spending hit dice auto-decrements the dice count, and heals.

# Todo

## Modify GM execution of player actions/spells to be more robust.

    If a GM executes a player action or spell, we read the spell chat message
    to determine what player actually cast it, so that we can use the spell
    slots appropriately.

    If the charsheet could let the GM choose who executed the action/spell,
    then we could check playerid rather than pulling the name out of the chat
    message.

## Memoize getPlayerCharacters

## ~~Use processInlineRolls on rechargeSpells for Warlock & Sorc Points~~

## Implement rechargeSpells

## Implement rechargeHP

## Add Reckless Attack status check

## Append to tokenByChar/charByToken when a new char is added to the page.
