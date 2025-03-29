/*
    WandererBot - A ready-to-use JS Minecraft bot script, using mineflayer, which lets you deploy Minecraft bots and control them, either manually (via browser, like classic.minecraft.net) or automatically (following nearby entities)
    This program is free software: you can redistribute it and/or modify it under the terms of the GNU General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version.
    This program is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public License for more details.
    You should have received a copy of the GNU General Public License along with this program. If not, see https://www.gnu.org/licenses/.
*/

const mineflayer = require("mineflayer");
const readline = require("readline");
const yargs = require('yargs');

// Parse arguments with yargs
const argv = yargs
    .version(false) // Disables the default version option
    .option('username', { alias: 'u', description: 'The bot\'s username', type: 'string', demandOption: true })
    .option('host', { alias: ['ip', 'address'], description: 'The server\'s host/IP address', type: 'string', demandOption: true })
    .option('password', { alias: 'w', description: 'Password for Microsoft authentication (optional)', type: 'string' })
    .option('port', { alias: 'p', description: 'The server port (defaults to 25565)', type: 'number', default: 25565 })
    .option('version', { alias: 'v', description: 'The Minecraft version (defaults to the latest version)', type: 'string' })
    .option('flybug', { description: 'Enable flybug mode (well, flying)', type: 'boolean', default: false })
    .option('manual', { alias: 'm', description: 'Enable manual movement mode (website controls, wasd)', type: 'boolean', default: false })
    .option('nomove', { alias: 'n', description: 'Disable automatic movement towards the nearest entity', type: 'boolean', default: false })
    .option('viewoff', { alias: 'vo', description: 'Disable the bot view (disables prismarine-viewer)', type: 'boolean', default: false })
    .check((argv) => {
        // Check for invalid combinations explicitly
        if (argv.manual && argv.viewoff) {
            throw new Error('The --manual option cannot be used with --viewoff (How can you control the bot without seeing it?)');
        }
        if (argv.manual && argv.nomove) {
            throw new Error('The --manual option cannot be used with --nomove.');
        }
        if (argv.manual && argv.flybug) {
            console.log('The --flybug causes the bot to fly uncontrollably, which may make you struggle to move the bot entirely.');
        }
        return true; // Everything is fine
    })
    .help().alias('help', 'h').argv;

async function flybugConfirm() {
    console.log("WARNING!")
    console.log("You have enabled the flybug mode. This may cause the bot to fly uncontrollably.");
    console.log("This mode is not recommended for use in multiplayer servers as it may cause permanent bans.");
    if (argv.password) {
        console.log("You are using an OFFICIAL MINECRAFT account. Your account may or WILL be at risk.");
        console.log("Any damage caused to your account is solely by your own responsibility. As per the GPLv3 license, I (the developer) are NOT liable for any damages, including but not limited to account bans, loss of items, or any other consequences that may arise from the use of this specific feature.");
        console.log("This chance lets you RECONSIDER the use of this feature. Should you be aware AND accept the consequences caused, you may proceed.");
    } else {
        console.log("Although you are probably not using an official minecraft account, you are still prone to IP bans.")
        console.log("You should proceed with caution. Any ban sentences are solely your responsibility.")
    }
    return new Promise((resolve) => {
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });
        rl.question("Do you want to proceed? (y/n): ", (answer) => {
            rl.close();
            if (answer.toLowerCase() === "y") {
                resolve(true); // Resolve the promise to continue execution
            } else {
                console.log("Abort");
                process.exit(0); // Stop execution entirely
            }
        });
    });
}

async function main() {
    // Define settings for Mineflayer bot
    var settings = { username: argv.username, host: argv.host, port: argv.port, version: argv.version };

    if (argv.password) {
        settings.auth = "microsoft";
        settings.password = argv.password;
    }

    if (argv.flybug) {
        await flybugConfirm(); // Call the flybug confirmation function
    }

    const bot = mineflayer.createBot(settings);

    bot.once("spawn", () => {
        try {
            console.log("Bot has spawned!");
        } catch (error) {
            console.error("An error occurred during bot spawn:", error);
        }
    });

    bot.on("end", () => { console.log("Bot has disconnected"); process.exit(); });
    bot.on("kicked", (reason) => { console.log(`Bot was kicked for reason: ${reason.toString()}`); process.exit(); });
    bot.on("error", (err) => { console.error("An error occurred:", err); process.exit(); });

    if (argv.manual) {
        bot.once("spawn", () => {
            if (argv.viewoff === false) {
                const { mineflayer: mineflayerViewer } = require('prismarine-viewer');
                mineflayerViewer(bot, { port: 3007, firstPerson: true });
            }
        });
        const express = require('express');
        const http = require('http');
        const { Server } = require('socket.io');

        const app = express();
        const server = http.createServer(app);
        const io = new Server(server);

        app.use(express.static('.')); // Serve your frontend files

        server.listen(3006, () => {
            console.log('Control panel running on port 3006');
        });

        io.on('connection', (socket) => {
            console.log('A user connected');

            socket.on('move', (direction) => {
                bot.setControlState(direction, true);
            });

            socket.on('stop', (direction) => {
                bot.setControlState(direction, false);
            });

            socket.on('rotateCamera', ({ deltaX, deltaY }) => {
                const yaw = bot.entity.yaw - deltaX * 0.002; // Adjust sensitivity
                const pitch = bot.entity.pitch - deltaY * 0.002;
                bot.look(yaw, pitch, false);
            });

            socket.on('action', (action) => {
                if (action === 'mine') {
                    const target = bot.entityAtCursor(5); // Checks for entities within 5 blocks in the bot's crosshair
                    if (target) {
                        bot.attack(target); // Attack the entity in the crosshair
                    } else {
                        bot.swingArm(); // Default swing if nothing is in the crosshair
                    }
                }
                if (action === 'place') {
                    const block = bot.blockAtCursor(5); // Checks for blocks within 5 blocks in the bot's crosshair4
                    const entity = bot.entityAtCursor(5); // Checks for entities within 5 blocks in the cursor
                    if (entity) {
                        bot.activateEntity(entity); // Interact with the block in the crosshair
                    } else if (block) {
                        bot.activateBlock(block); // Interact (right-click) with the entity
                        console.log(`Attempting interaction with ${entity.name || entity.objectType}. This might not work as expected.`);
                    } else {
                        bot.swingArm(); // Default swing if nothing is in the crosshair
                    }
                }
                if (action === 'jump') bot.setControlState('jump', true);
            });

            socket.on('disconnect', () => {
                console.log('A user disconnected');
            });
            
            if (argv.flybug) {
                bot.on("physicsTick", () => { // The way this works is because of a bug that allows the bot to jump over non-solid blocks, combined with a physicsTick that is faster due to the bug.
                    try {
                        const directionVector = bot.entity.velocity.normalize(); // Get the normalized movement direction
                        const blockAhead = bot.blockAt(bot.entity.position.offset(directionVector.x, 0, directionVector.z)); // Check directly in front
        
                        if (blockAhead && blockAhead.boundingBox === 'block') {
                            bot.setControlState("jump", true); // Jump only if a block is ahead
                        } else {
                            bot.setControlState("jump", false); // Stop jumping if no block is ahead
                        }
                    } catch (error) {
                        console.error("An error occurred during physicsTick event (flybug):", error);
                    }
                });
            }
        });
    } else if (argv.nomove) {
        console.log("Argument 'nomove' specified. Bot will not move.");
        bot.once("spawn", () => {
            if (argv.viewoff === false) {
                const { mineflayer: mineflayerViewer } = require('prismarine-viewer');
                mineflayerViewer(bot, { port: 3006, firstPerson: true });
            }
        });
    } else {
        bot.once("spawn", () => {
            if (argv.viewoff === false) {
                const { mineflayer: mineflayerViewer } = require('prismarine-viewer');
                mineflayerViewer(bot, { port: 3006, firstPerson: true });
            }
        });
        bot.on("move", () => {
            try {
                let friend = bot.nearestEntity();
                if (friend) {
                    bot.lookAt(friend.position.offset(0, friend.height, 0));
                    bot.setControlState("forward", true);
                }
            } catch (error) {
                console.error("An error occurred during bot move event:", error);
            }
        });

        if (argv.flybug) {
            bot.on("physicsTick", () => { // The way this works is because of a bug that allows the bot to jump over non-solid blocks, combined with a physicTick that is faster due to the bug.
                try {
                    const directionVector = bot.entity.velocity.normalize(); // Get the normalized movement direction
                    const blockAhead = bot.blockAt(bot.entity.position.offset(directionVector.x, 0, directionVector.z)); // Check directly in front

                    if (blockAhead && blockAhead.boundingBox === 'block') {
                        bot.setControlState("jump", true); // Jump only if a block is ahead
                    } else {
                        bot.setControlState("jump", false); // Stop jumping if no block is ahead
                    }
                } catch (error) {
                    console.error("An error occurred during physicsTick event (flybug):", error);
                }
            });
        } else {
            bot.on("physicsTick", () => { // Enables the bot to be able to jump a block
                try {
                    const blockAhead1 = bot.blockAt(bot.entity.position.offset(0, 0, 1)); // Adjust offset as needed
                    const blockAhead2 = bot.blockAt(bot.entity.position.offset(0, 0, -1)); // Adjust offset as needed
                    const blockAhead3 = bot.blockAt(bot.entity.position.offset(1, 0, 0)); // Adjust offset as needed
                    const blockAhead4 = bot.blockAt(bot.entity.position.offset(-1, 0, 0)); // Adjust offset as needed

                    if ((blockAhead1 && blockAhead1.boundingBox === 'block') || (blockAhead2 && blockAhead2.boundingBox === 'block') || (blockAhead3 && blockAhead3.boundingBox === 'block') || (blockAhead4 && blockAhead4.boundingBox === 'block')) { // Checks if there's a block ahead
                        bot.setControlState("jump", true); // Jump over the block
                    } else {
                        bot.setControlState("jump", false); // Stop jumping when no block is detected
                    }
                } catch (error) {
                    console.error("An error occurred during physicsTick event:", error);
                }
            });
        }
        
    }

    // Chat functionality
    bot.on("message", (jsonMsg) => { 
        try {
            const message = jsonMsg.toString(); // Extract the text message
            const extraData = jsonMsg?.unsigned?.json?.with?.[0]?.extra; // Extract the extra array
            if (Array.isArray(extraData)) {
                const playerName = extraData[0]; // The player's name
                const chatMessage = extraData[1]; // The chat message
                console.log(`${playerName}${chatMessage}`); // Log the properly formatted message 
            } else console.log(`${message}`); // Fallback to the plain message text 
        } catch (error) {console.error("Error processing chat message:", error);}
    });

    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    rl.on("line", (input) => {
        try {
            bot.chat(input);
        } catch (error) {
            console.error("An error occurred while sending chat message:", error);
        }
    });
}

main().catch((error) => { console.error("An error occurred:", error); });
