/*
    New race tooltip
*/

'use strict';

// Imports
const globals = nodeRequire('./assets/js/globals');
const misc    = nodeRequire('./assets/js/misc');
const builds  = nodeRequire('./assets/data/builds');

/*
    Event handlers
*/

$(document).ready(function() {
    $('#new-race-randomize').click(function() {
        // Don't randomize the race name if we are on a test account
        if (globals.myUsername.match(/TestAccount\d+/)) {
            $('#new-race-title').val('{ test race }');
            return;
        }

        // Get some random words
        let randomNumbers = [];
        for (let i = 0; i < 2; i++) {
            while (true) {
                let randomNumber = misc.getRandomNumber(0, globals.wordList.length - 1);
                if (randomNumbers.indexOf(randomNumber) === -1) {
                    randomNumbers.push(randomNumber);
                    break;
                }
            }
        }
        let randomlyGeneratedName = '';
        for (let i = 0; i < 2; i++) {
            randomlyGeneratedName += globals.wordList[randomNumbers[i]] + ' ';
        }

        // Chop off the trailing space
        randomlyGeneratedName = randomlyGeneratedName.slice(0, -1);

        // Set it
        $('#new-race-title').val(randomlyGeneratedName);
    });

    $('#new-race-type').change(newRaceTypeChange);

    $('#new-race-format').change(function() {
        // Change the displayed icon
        let newFormat = $(this).val();
        $('#new-race-format-icon').css('background-image', 'url("assets/img/formats/' + newFormat + '.png")');

        // Change to the default character for this ruleset
        let newCharacter;
        if (newFormat === 'unseeded') {
            newCharacter = 'Judas';
        } else if (newFormat === 'seeded') {
            newCharacter = 'Judas';
        } else if (newFormat === 'diversity') {
            newCharacter = 'Judas';
        } else if (newFormat === 'exclusion') {
            newCharacter = 'Judas';
        } else if (newFormat === 'custom') {
            // The custom format has no default character, so don't change anything
            newCharacter = $('#new-race-character').val();
        }
        if ($('#new-race-character').val() !== newCharacter) {
            $('#new-race-character').val(newCharacter).change();
        }

        // Show or hide the "Custom" goal
        if (newFormat === 'custom') {
            $('#new-race-goal-custom').fadeIn(0);

            // Make the goal border flash to signify that there are new options there
            let oldColor = $('#new-race-goal').css('border-color');
            $('#new-race-goal').css('border-color', 'green');
            setTimeout(function() {
                $('#new-race-goal').css('border-color', oldColor);
            }, 350); // The CSS is set to 0.3 seconds, so we need some leeway
        } else {
            $('#new-race-goal-custom').fadeOut(0);
            if ($('#new-race-goal').val() === 'custom') {
                $('#new-race-goal').val('Blue Baby').change();
            }
        }

        // Show or hide the character, goal, and starting build row
        if (newFormat === 'seeded') {
            setTimeout(function() {
                $('#new-race-character-container').fadeIn(globals.fadeTime);
                $('#new-race-goal-container').fadeIn(globals.fadeTime);
                $('#new-race-starting-build-container').fadeIn(globals.fadeTime);
                $('#new-race-starting-build').change();
                $('#header-new-race').tooltipster('reposition'); // Redraw the tooltip
            }, globals.fadeTime);
        } else {
            let type = $('#new-race-type').val();
            if (type === 'ranked') {
                $('#new-race-character-container').fadeOut(globals.fadeTime);
                $('#new-race-goal-container').fadeOut(globals.fadeTime);
            }
            if ($('#new-race-starting-build-container').is(":visible")) {
                $('#new-race-starting-build-container').fadeOut(globals.fadeTime, function() {
                    $('#header-new-race').tooltipster('reposition'); // Redraw the tooltip
                });
            }
        }

        // Show or hide the item ban row
        if (newFormat === 'exclusion') {
            setTimeout(function() {
                $('#new-race-character-container').fadeIn(globals.fadeTime);
                $('#new-race-goal-container').fadeIn(globals.fadeTime);
                $('#new-race-exclusion-container').fadeIn(globals.fadeTime);
                $('#header-new-race').tooltipster('reposition'); // Redraw the tooltip
            }, globals.fadeTime);
        } else {
            let type = $('#new-race-type').val();
            if (type === 'ranked') {
                $('#new-race-character-container').fadeOut(globals.fadeTime);
                $('#new-race-goal-container').fadeOut(globals.fadeTime);
            }
            if ($('#new-race-exclusion-container').is(":visible")) {
                $('#new-race-exclusion-container').fadeOut(globals.fadeTime, function() {
                    $('#header-new-race').tooltipster('reposition'); // Redraw the tooltip
                });
            }
        }
    });

    $('#new-race-character').change(function() {
        // Change the displayed icon
        let newCharacter = $(this).val();
        $('#new-race-character-icon').css('background-image', 'url("assets/img/characters/' + newCharacter + '.png")');
    });

    $('#new-race-goal').change(function() {
        // Change the displayed icon
        let newGoal = $(this).val();
        $('#new-race-goal-icon').css('background-image', 'url("assets/img/goals/' + newGoal + '.png")');
    });

    // Add the options to the starting build dropdown
    for (let i = 0; i < builds.length; i++) {
        // The 0th element is an empty array
        if (i === 0) {
            continue;
        }

        // Compile the build description string
        let description = '';
        for (let item of builds[i]) {
            description += item.name + ' + ';
        }
        description = description.slice(0, -3); // Chop off the trailing " + "

        // Add the option for this build
        $('#new-race-starting-build').append(
            $('<option></option>').val(i).html(description)
        );
    }

    $('#new-race-starting-build').change(function() {
        // Change the displayed icon
        let newBuild = $(this).val();
        globals.log.info('newBuild: ' + newBuild);
        if (newBuild.startsWith('random')) {
            $('#new-race-starting-build-icon').css('background-image', 'url("assets/img/builds/random.png")');
            globals.log.info('newBuild1');
        } else {
            $('#new-race-starting-build-icon').css('background-image', 'url("assets/img/builds/' + newBuild + '.png")');
            globals.log.info('newBuild2');
        }
    });

    $('#item-exclusion-nav-button').click(function() {
        // Close the tooltip (and all error tooltips, if present)
        misc.closeAllTooltips();

        // load any additional data from globals.itemList if necessary
        $('#exclusion-item-list').html("");
        var str = "";
        for (var i = 1; i <= 525; i++) {
            if (!!globals.itemList[i]) {
                str = str + `<button class="exclude-item" type="button"><img src="assets/img/items/${i}.png" data-id="${i}" alt="${globals.itemList[i].name}"></button>`;
            }
        }
        $('#exclusion-item-list').append(str);

        $('#lobby').fadeOut(globals.fadeTime);
        $('#item-exclusion').fadeIn(globals.fadeTime, function() {
            globals.currentScreen = 'item-exclusion';
        });
    });

    $('#exclusion-item-list').on('click', '.exclude-item', function() {
        $(this).toggleClass('excluded');
        let name = $(this).find('img').attr('alt');
        let blank = $('#exclusion-item-text').text() === "";
        var list = blank ? [] : $('#exclusion-item-text').text().split(", ");
        let index = list.indexOf(name);
        if (index === -1) {
            list.push(name);
        } else {
            list.splice(index, 1);
        }
        $('#exclusion-item-text').text(list.join(", "));
    });

    $('#new-race-form').submit(function() {
        // By default, the form will reload the page, so stop this from happening
        event.preventDefault();

        // Don't do anything if we are not on the right screen
        if (globals.currentScreen !== 'lobby') {
            return;
        }

        // Get values from the form
        let title = $('#new-race-title').val().trim();
        let type = $('#new-race-type').val();
        let format = $('#new-race-format').val();
        let character = $('#new-race-character').val();
        let goal = $('#new-race-goal').val();
        let startingBuild;
        let solo = false;
        if (type === 'ranked-solo') {
            type = 'ranked';
            solo = true;
        } else if (type === 'unranked-solo') {
            type = 'unranked';
            solo = true;
        }
        if (format === 'seeded') {
            startingBuild = $('#new-race-starting-build').val();
        } else {
            startingBuild = -1;
        }

        // Validate that they are not creating a race with the same title as an existing race
        for (let raceID in globals.raceList) {
            if (globals.raceList.hasOwnProperty(raceID) === false) {
                continue;
            }

            if (globals.raceList[raceID].name === title) {
                $('#new-race-title').tooltipster('open');
                return;
            }
        }
        $('#new-race-title').tooltipster('close');

        // Truncate names longer than 100 characters (this is also enforced server-side)
        let maximumLength = 100;
        if (title.length > maximumLength) {
            title = title.substring(0, maximumLength);
        }

        // If necessary, get a random character
        if (character === 'random') {
            let characterArray = [
                'Isaac',     // 0
                'Magdalene', // 1
                'Cain',      // 2
                'Judas',     // 3
                'Blue Baby', // 4
                'Eve',       // 5
                'Samson',    // 6
                'Azazel',    // 7
                'Lazarus',   // 8
                'Eden',      // 9
                'The Lost',  // 10
                'Lilith',    // 11
                'Keeper',    // 12
                'Apollyon',  // 13
            ];
            let randomNumber = misc.getRandomNumber(0, 12);
            character = characterArray[randomNumber];
        }

        // If necessary, get a random starting build,
        if (startingBuild === 'random') {
            startingBuild = misc.getRandomNumber(1, 32); // There are 32 starts
        } else if (startingBuild === 'random-single') {
            startingBuild = misc.getRandomNumber(1, 26); // There are 26 starts that have single items
        } else if (startingBuild === 'random-treasure') {
            startingBuild = misc.getRandomNumber(1, 20); // There are 20 Treasure Room starts
        } else {
            // The value was read from the form as a string and needs to be sent to the server as an intenger
            startingBuild = parseInt(startingBuild);
        }

        // Close the tooltip (and all error tooltips, if present)
        misc.closeAllTooltips();

        // Create the race
        let rulesetObject = {
            type: type,
            solo: solo,
            format: format,
            character: character,
            goal: goal,
            startingBuild: startingBuild,
        };
        globals.currentScreen = 'waiting-for-server';
        globals.conn.send('raceCreate', {
            name: title,
            ruleset: rulesetObject,
        });

        // Return false or else the form will submit and reload the page
        return false;
    });
});

/*
    New race tooltip functions
*/

function newRaceTypeChange() {
    let newType = $('#new-race-type').val();

    // Make the format border flash to signify that there are new options there
    let oldColor = $('#new-race-format').css('border-color');
    $('#new-race-format').css('border-color', 'green');
    setTimeout(function() {
        $('#new-race-format').css('border-color', oldColor);
    }, 350); // The CSS is set to 0.3 seconds, so we need some leeway

    // Change the subsequent options accordingly
    let format = $('#new-race-format').val();
    if (newType === 'ranked-solo') {
        // Change the format dropdown
        $('#new-race-format').val('unseeded').change();
        $('#new-race-character').val('Judas').change();
        $('#new-race-goal').val('Blue Baby').change();

        // Hide the format, character and goal dropdowns if it is not a seeded race
        $('#new-race-format-container').fadeOut(globals.fadeTime);
        $('#new-race-character-container').fadeOut(globals.fadeTime);
        $('#new-race-goal-container').fadeOut(globals.fadeTime, function() {
            $('#header-new-race').tooltipster('reposition'); // Redraw the tooltip
        });
    } else if (newType === 'unranked-solo') {
        // Change the format dropdown
        $('#new-race-format-seeded').fadeIn(0);
        $('#new-race-format-diversity').fadeIn(0);
        $('#new-race-format-custom').fadeIn(0);

        // Show the character and goal dropdowns
        setTimeout(function() {
            $('#new-race-format-container').fadeIn(globals.fadeTime);
            $('#new-race-character-container').fadeIn(globals.fadeTime);
            $('#new-race-goal-container').fadeIn(globals.fadeTime);
            $('#header-new-race').tooltipster('reposition'); // Redraw the tooltip
        }, globals.fadeTime);
    } else if (newType === 'ranked') {
        // Show the format dropdown
        setTimeout(function() {
            $('#new-race-format-container').fadeIn(globals.fadeTime);
            $('#header-new-race').tooltipster('reposition'); // Redraw the tooltip
        }, globals.fadeTime);

        // Change the format dropdown
        if (format === 'diversity' || format === 'custom') {
            $('#new-race-format').val('unseeded').change();
            $('#new-race-character').val('Judas').change();
            $('#new-race-goal').val('Blue Baby').change();
        }
        $('#new-race-format-seeded').fadeIn(0);
        $('#new-race-format-diversity').fadeOut(0);
        $('#new-race-format-custom').fadeOut(0);

        // Hide the character and goal dropdowns if it is not a seeded race
        if (format !== 'seeded') {
            $('#new-race-character-container').fadeOut(globals.fadeTime);
            $('#new-race-goal-container').fadeOut(globals.fadeTime, function() {
                $('#header-new-race').tooltipster('reposition'); // Redraw the tooltip
            });
        }
    } else if (newType === 'unranked') {
        // Change the format dropdown
        $('#new-race-format-diversity').fadeIn(0);
        $('#new-race-format-custom').fadeIn(0);

        // Show the character and goal dropdowns (if it is a seeded race, they should be already shown)
        if (format !== 'seeded') {
            setTimeout(function() {
                $('#new-race-format-container').fadeIn(globals.fadeTime);
                $('#new-race-character-container').fadeIn(globals.fadeTime);
                $('#new-race-goal-container').fadeIn(globals.fadeTime);
                $('#header-new-race').tooltipster('reposition'); // Redraw the tooltip
            }, globals.fadeTime);
        }
    }

    // Change the displayed icon
    $('#new-race-type-icon').css('background-image', 'url("assets/img/types/' + newType + '.png")');
}

// The "functionBefore" function for Tooltipster
exports.tooltipFunctionBefore = function() {
    if (globals.currentScreen !== 'lobby') {
        return false;
    }

    $('#gui').fadeTo(globals.fadeTime, 0.1);
    return true;
};

// The "functionReady" function for Tooltipster
exports.tooltipFunctionReady = function() {
    // Set default background images
    $('#new-race-type-icon').css('background-image', 'url("assets/img/types/' + $('#new-race-type').val() + '.png")');
    $('#new-race-format-icon').css('background-image', 'url("assets/img/formats/' + $('#new-race-format').val() + '.png")');
    $('#new-race-character-icon').css('background-image', 'url("assets/img/characters/' + $('#new-race-character').val() + '.png")');
    $('#new-race-goal-icon').css('background-image', 'url("assets/img/goals/' + $('#new-race-goal').val() + '.png")');

    // Randomize the race title every time we start a new race
    $('#new-race-randomize').click();
    $('#new-race-title').focus();


    /*
        Tooltips within tooltips seem to be buggy and can sometimes be uninitialized
        So, check for this every time the tooltip is opened and reinitialize them if necessary
    */

    if ($('#new-race-title').hasClass('tooltipstered') === false) {
        $('#new-race-title').tooltipster({
            theme: 'tooltipster-shadow',
            delay: 0,
            trigger: 'custom',
        });
    }
};
