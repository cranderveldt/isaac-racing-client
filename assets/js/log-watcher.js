/*
    Log watcher functions
*/

'use strict';

// Imports
const fs          = nodeRequire('fs-extra');
const ipcRenderer = nodeRequire('electron').ipcRenderer;
const globals     = nodeRequire('./assets/js/globals');
const settings    = nodeRequire('./assets/js/settings');
const misc        = nodeRequire('./assets/js/misc');
const isaac       = nodeRequire('./assets/js/isaac');
const modLoader   = nodeRequire('./assets/js/mod-loader');
const raceScreen  = nodeRequire('./assets/js/ui/race');

// globals.currentScreen is equal to "transition" when this is called
exports.start = function() {
    // Check to make sure the log file exists
    let logPath = settings.get('logFilePath');
    if (fs.existsSync(logPath) === false) {
        logPath = null;
        settings.set('logFilePath', null);
        settings.saveSync();
    }

    // Check to ensure that we have a valid log file path
    if (logPath === null) {
        globals.currentScreen = 'null';
        misc.errorShow('', false, true); // Show the log file path modal
        return -1;
    }

    // Check to make sure they don't have a Rebirth log.txt selected
    if (logPath.match(/[/\\]Binding of Isaac Rebirth[/\\]/)) { // Match a forward or backslash
        $('#log-file-description-1').html('<span lang="en">It appears that you have selected your Rebirth "log.txt" file, which is different than the Afterbirth+ "log.txt" file.</span>');
        globals.currentScreen = 'null';
        misc.errorShow('', false, true); // Show the log file path modal
        return -1;
    }

    // Check to make sure they don't have an Afterbirth log.txt selected
    if (logPath.match(/[/\\]Binding of Isaac Afterbirth[/\\]/)) {
        $('#log-file-description-1').html('<span lang="en">It appears that you have selected your Afterbirth "log.txt" file, which is different than the Afterbirth+ "log.txt" file.</span>');
        globals.currentScreen = 'null';
        misc.errorShow('', false, true); // Show the log file path modal
        return -1;
    }

    // Send a message to the main process to start up the log watcher
    ipcRenderer.send('asynchronous-message', 'logWatcher', logPath);
};

// Monitor for notifications from the child process that is doing the log watching
const logWatcher = function(event, message) {
    // Don't log everything to reduce spam
    if (message.startsWith('New floor: ') === false &&
        message.startsWith('New room: ') === false &&
        message.startsWith('New item: ') === false) {

        globals.log.info('Recieved log-watcher notification: ' + message);
    }

    if (message.startsWith("error: ")) {
        // First, parse for errors
        let error = message.match(/^error: (.+)/)[1];
        misc.errorShow('Something went wrong with the log monitoring program: ' + error);
        return;
    }

    // Do some things regardless of whether we are in a race or not
    // (all relating to the Racing+ Lua mod)
    if (message === 'Title menu initialized.') {
        globals.modLoader.blckCndlOn = false;
        modLoader.send();
        globals.gameState.inGame = false;
        globals.gameState.hardMode = false;
        raceScreen.checkReadyValid();

    } else if (message === 'BLCK CNDL on.') {
        globals.modLoader.blckCndlOn = true;
        modLoader.send();
        raceScreen.checkReadyValid();

    } else if (message === 'Hard mode on.') {
        globals.gameState.hardMode = true;
        raceScreen.checkReadyValid();

    } else if (message.startsWith('New character: ')) {
        let m = message.match(/New character: (.+)/);
        if (m) {
            let character = m[1];

            // Convert the character from a number to a string
            if (character === '0')  {
                character = 'Isaac';
            } else if (character === '1') {
                character = 'Magdalene';
            } else if (character === '2') {
                character = 'Cain';
            } else if (character === '3') {
                character = 'Judas';
            } else if (character === '4') {
                character = 'Blue Baby';
            } else if (character === '5') {
                character = 'Eve';
            } else if (character === '6') {
                character = 'Samson';
            } else if (character === '7') {
                character = 'Azazel';
            } else if (character === '8') {
                character = 'Lazarus';
            } else if (character === '9') {
                character = 'Eden';
            } else if (character === '10') {
                character = 'The Lost';
            } else if (character === '13') {
                character = 'Lilith';
            } else if (character === '14') {
                character = 'Keeper';
            } else if (character === '15') {
                character = 'Apollyon';
            } else {
                misc.errorShow('Failed to parse the character from the log file: ' + character);
            }

            globals.gameState.character = character;

            // We will get this message every time they enter the game from the menu
            globals.gameState.inGame = true;
            raceScreen.checkReadyValid();
        } else {
            misc.errorShow('Failed to parse the new character.');
        }

    } else if (message.startsWith('New seed: ')) {
        let m = message.match(/New seed: (.... ....)/);
        if (m) {
            let seed = m[1];
            globals.modLoader.currentSeed = seed;
            modLoader.send();
            raceScreen.checkReadyValid();
        } else {
            misc.errorShow('Failed to parse the new seed.');
        }
    }

    /*
        The rest of the log actions involve sending a message to the server
    */

    // Don't do anything if we are not in a race
    if (globals.currentScreen !== 'race' || globals.currentRaceID === false) {
        return;
    }

    // Don't do anything if the race is over
    if (globals.raceList.hasOwnProperty(globals.currentRaceID) === false) {
        return;
    }

    // Don't do anything if we have not started yet or we have quit
    for (let i = 0; i < globals.raceList[globals.currentRaceID].racerList.length; i++) {
        if (globals.raceList[globals.currentRaceID].racerList[i].name === globals.myUsername) {
            if (globals.raceList[globals.currentRaceID].racerList[i].status !== 'racing') {
                return;
            }
            break;
        }
    }

    // Parse the message
    if (message.startsWith('New seed: ')) {
        let m = message.match(/New seed: (.... ....)/);
        if (m) {
            let seed = m[1];
            globals.conn.send('raceSeed', {
                id:   globals.currentRaceID,
                seed: seed,
            });
        } else {
            misc.errorShow('Failed to parse the new seed.');
        }
    } else if (message.startsWith('New floor: ')) {
        let m = message.match(/New floor: (\d+)-(\d+)/);
        if (m) {
            let floorNum = parseInt(m[1]); // The server expects this to be an integer
            let stageType = parseInt(m[2]); // The server expects this to be an integer
            globals.conn.send('raceFloor', {
                id:        globals.currentRaceID,
                floorNum:  floorNum,
                stageType: stageType,
            });
        } else {
            misc.errorShow('Failed to parse the new floor.');
        }
    } else if (message.startsWith('New room: ')) {
        let m = message.match(/New room: (.+)/);
        if (m) {
            let roomID = m[1];
            globals.conn.send('raceRoom', {
                id:   globals.currentRaceID,
                roomID: roomID,
            });
        } else {
            misc.errorShow('Failed to parse the new room.');
        }
    } else if (message.startsWith('New item: ')) {
        let m = message.match(/New item: (\d+)/);
        if (m) {
            let itemID = parseInt(m[1]); // The server expects this to be an integer
            globals.conn.send('raceItem', {
                id:     globals.currentRaceID,
                itemID: itemID,
            });
        } else {
            misc.errorShow('Failed to parse the new item.');
        }
    } else if (message === 'Finished run: Blue Baby') {
        if (globals.raceList[globals.currentRaceID].ruleset.goal === 'Blue Baby') {
            globals.conn.send('raceFinish', {
                id: globals.currentRaceID,
            });
        }
    } else if (message === 'Finished run: The Lamb') {
        if (globals.raceList[globals.currentRaceID].ruleset.goal === 'The Lamb') {
            globals.conn.send('raceFinish', {
                id: globals.currentRaceID,
            });
        }
    } else if (message === 'Finished run: Mega Satan') {
        if (globals.raceList[globals.currentRaceID].ruleset.goal === 'Mega Satan') {
            globals.conn.send('raceFinish', {
                id: globals.currentRaceID,
            });
        }
    }
};
ipcRenderer.on('logWatcher', logWatcher);
