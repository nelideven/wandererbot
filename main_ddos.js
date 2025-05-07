/*
    WandererBot - A ready-to-use JS Minecraft bot script, using mineflayer, which lets you deploy Minecraft bots and control them, either manually (via browser, like classic.minecraft.net) or automatically (following nearby entities)
    Except this one, this script is designed to test the server's performance and stability by sending bots to it, and making them move around.
    This program is free software: you can redistribute it and/or modify it under the terms of the GNU General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version.
    This program is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public License for more details.
    You should have received a copy of the GNU General Public License along with this program. If not, see https://www.gnu.org/licenses/.
*/

const mineflayer = require("mineflayer");
const yargs = require("yargs");

// Parse arguments with yargs
const argv = yargs
    .version(false) // Disables the default version option
    .option("usernamePrefix", { alias: "up", description: "Prefix for bot usernames", type: "string", default: "Bot_" })
    .option("host", { alias: ["ip", "address"], description: "The server's host/IP address", type: "string", demandOption: true })
    .option("port", { alias: "p", description: "The server port (defaults to 25565)", type: "number", default: 25565 })
    .option("version", { alias: "v", description: "The Minecraft version (defaults to the latest version)", type: "string" })
    .option("delay", { alias: "d", description: "Delay between bot spawns in milliseconds", type: "number", default: 5000 })
    .option("cap", { alias: "c", description: "Maximum number of bots allowed to connect", type: "number", default: 10 })
    .help().alias('help', 'h').argv;

// Function to create a single bot
function createBot(username, host, port, version) {
    const bot = mineflayer.createBot({
        username,
        host,
        port,
        version,
    });

    bot.once("spawn", () => {
        console.log(`${username} has spawned!`);
    });

    bot.on("move", () => {
        try {
            const nearestEntity = bot.nearestEntity();
            if (nearestEntity) {
                bot.lookAt(nearestEntity.position.offset(0, nearestEntity.height, 0));
                bot.setControlState("forward", true);
            }
        } catch (error) {
            console.error(`${username} encountered a movement error:`, error);
        }
    });

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

    bot.on("physicsTick", () => {
        bot._client.write("keep_alive", { keepAliveId: BigInt(Date.now()) });
    });

    bot.on("kicked", (reason) => console.log(`${username} was kicked: ${reason}`));
    bot.on("error", (err) => console.error(`${username} encountered an error:`, err));
    bot.on("end", () => console.log(`${username} has disconnected.`));
}

// Function to create multiple bots at intervals with a cap
function createMultipleBots(usernamePrefix, host, port, version, delay, cap) {
    let botCounter = 0;

    const interval = setInterval(() => {
        if (botCounter >= cap) {
            console.log(`Bot limit reached (${cap}). Stopping bot creation.`);
            clearInterval(interval); // Stop creating new bots
            return;
        }

        const randomUsername = `${usernamePrefix}${Math.random().toString(36).substring(7)}`;
        createBot(randomUsername, host, port, version);
        botCounter++;
        console.log(`Bot #${botCounter} (${randomUsername}) created`);
    }, delay);
}

// Start spamming bots using the parsed arguments with a limit
createMultipleBots(argv.usernamePrefix, argv.host, argv.port, argv.version, argv.delay, argv.cap);