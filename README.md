
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


## Cleric spell book implementation thoughts.

    Have the DM create a specially named page 'spell book'.

    When API sees this page, initializes it with the following:
        Desired width, height.
        Disable grid.
        Add map layer of a 'spell book.'
        Top-right: an area describing the spell you've selected.
        Bottom-right: List of spells.
            Spells are graphic icons which are controllable by the player viewing the page.
        Left page: Spells you currently have prepared.
        Bottom left: Max you can prepare, and number you have prepared.
        Mid-left: Always prepared.
        Above spell book: Character name who visited it.

        Opening the spellbook will cause the left side to be auto-populated with the spells currently
        have prepared.

        Adding or removing spells on the left will cause the spellbook to sync to your charsheet spellbook.

        Repeating IDs of the spell items should be based upon the name of the spell.

        Vitaal should have a chat command he can use to navigate back and forth from the spellbook.
