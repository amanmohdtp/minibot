import makeWASocket, {
    useMultiFileAuthState,
    makeCacheableSignalKeyStore,
    fetchLatestBaileysVersion
} from "@whiskeysockets/baileys";
import Pino from "pino";
import fs from "fs";

const config = JSON.parse(fs.readFileSync("./config.json"));
let warns = {};
let antiLink = true;

async function start() {
    const { state, saveCreds } = await useMultiFileAuthState("./auth");
    const { version } = await fetchLatestBaileysVersion();

    const sock = makeWASocket({
        logger: Pino({ level: "silent" }),
        printQRInTerminal: false,
        browser: ["MiniBot", "Chrome", "1.0"],
        auth: {
            creds: state.creds,
            keys: makeCacheableSignalKeyStore(state.keys, Pino({ level: "fatal" }))
        },
        version
    });

    // Generate pairing code
    if (!sock.authState.creds.registered) {
        const code = await sock.requestPairingCode(config.owner);
        console.log("\n🔗 Pair Code:", code, "\n");
    }

    sock.ev.on("creds.update", saveCreds);

    sock.ev.on("messages.upsert", async ({ messages }) => {
        const m = messages[0];
        if (!m.message) return;

        const from = m.key.remoteJid;
        const isGroup = from.endsWith("@g.us");
        const sender = m.key.participant || m.key.remoteJid;

        const text =
            m.message.conversation ||
            m.message.extendedTextMessage?.text ||
            "";

        // Admin check
        let isAdmin = false;
        if (isGroup) {
            const group = await sock.groupMetadata(from);
            const admins = group.participants.filter(p => p.admin);
            isAdmin = admins.some(a => a.id === sender);
        }

        // ========= ANTI-LINK ========= //
        const linkPattern = /(https?:\/\/[^\s]+)/gi;

        if (antiLink && linkPattern.test(text) && isGroup && !isAdmin) {
            try { await sock.sendMessage(from, { delete: m.key }); } catch {}

            warns[sender] = (warns[sender] || 0) + 1;

            await sock.sendMessage(from, {
                text: `⚠️ @${sender.split("@")[0]} sent a link!\nWarning: *${warns[sender]}/${config.warnLimit}*`,
                mentions: [sender]
            });

            if (warns[sender] >= config.warnLimit) {
                await sock.groupParticipantsUpdate(from, [sender], "remove");
                await sock.sendMessage(from, {
                    text: `🚨 @${sender.split("@")[0]} removed (max warnings reached)`,
                    mentions: [sender]
                });
                warns[sender] = 0;
            }
        }

        // Ignore non-commands
        if (!text.startsWith(".")) return;
        const cmd = text.split(" ")[0].toLowerCase();

        // Block non-admins from commands
        const adminOnly = [".tagall", ".kick", ".warn", ".open", ".close", ".antilink"];
        if (adminOnly.includes(cmd) && !isAdmin) {
            return sock.sendMessage(from, { text: "❌ Only *admins* can use this command." });
        }

        // ========= COMMANDS ========= //

        // .ping
        if (cmd === ".ping") {
            return await sock.sendMessage(from, { text: "🏓 Pong!" });
        }

        // .antilink on/off
        if (cmd === ".antilink") {
            if (text.includes("on")) {
                antiLink = true;
                return sock.sendMessage(from, { text: "🔰 Anti-Link Activated" });
            }
            if (text.includes("off")) {
                antiLink = false;
                return sock.sendMessage(from, { text: "⭕ Anti-Link Deactivated" });
            }
        }

        // .tagall
        if (cmd === ".tagall" && isGroup) {
            const group = await sock.groupMetadata(from);
            let mentions = [];
            let msg = "📢 *Tagging Everyone:*\n\n";

            group.participants.forEach(p => {
                mentions.push(p.id);
                msg += `@${p.id.split("@")[0]}\n`;
            });

            return await sock.sendMessage(from, { text: msg, mentions });
        }

        // .kick
        if (cmd === ".kick" && isGroup) {
            let target = m.message.extendedTextMessage?.contextInfo?.participant;
            if (!target) return sock.sendMessage(from, { text: "Mention a user to kick." });

            await sock.groupParticipantsUpdate(from, [target], "remove");
            return await sock.sendMessage(from, {
                text: `👢 Kicked @${target.split("@")[0]}`,
                mentions: [target]
            });
        }

        // .warn
        if (cmd === ".warn" && isGroup) {
            let target = m.message.extendedTextMessage?.contextInfo?.participant;
            if (!target) return sock.sendMessage(from, { text: "Mention a user." });

            warns[target] = (warns[target] || 0) + 1;

            await sock.sendMessage(from, {
                text: `⚠️ @${target.split("@")[0]} warned (${warns[target]}/${config.warnLimit})`,
                mentions: [target]
            });

            if (warns[target] >= config.warnLimit) {
                await sock.groupParticipantsUpdate(from, [target], "remove");
                await sock.sendMessage(from, {
                    text: `🚨 @${target.split("@")[0]} removed (max warnings reached)`,
                    mentions: [target]
                });
                warns[target] = 0;
            }
            return;
        }

        // .open
        if (cmd === ".open" && isGroup) {
            await sock.groupSettingUpdate(from, "not_announcement");
            return sock.sendMessage(from, { text: "🔓 Group opened." });
        }

        // .close
        if (cmd === ".close" && isGroup) {
            await sock.groupSettingUpdate(from, "announcement");
            return sock.sendMessage(from, { text: "🔒 Group closed (admins only)." });
        }

        // ========= MENU ========= //
        if (cmd === ".menu") {
            let uptime = process.uptime();
            let h = Math.floor(uptime / 3600);
            let mnt = Math.floor((uptime % 3600) / 60);
            let s = Math.floor(uptime % 60);

            const menu = `
╔══✦ *MiniBot Menu* ✦══╗

👑 *Owner:* ${config.owner}
🧩 *Anti-Link:* ${antiLink ? "ON ✅" : "OFF ❌"}
⚡ *Uptime:* ${h}h ${mnt}m ${s}s

🎯 *Commands*
• .menu
• .ping
• .tagall
• .kick
• .warn
• .open
• .close
• .antilink on/off

╚════════════════════╝
`;

            return await sock.sendMessage(from, { text: menu });
        }
    });
}

start();                try { await sock.sendMessage(from, { delete: m.key }); } catch {}

                warns[sender] = (warns[sender] || 0) + 1;

                await sock.sendMessage(from, {
                    text: `⚠️ @${sender.split("@")[0]} sent a link!\nWarning: *${warns[sender]}/${config.warnLimit}*`,
                    mentions: [sender]
                });

                if (warns[sender] >= config.warnLimit) {
                    await sock.groupParticipantsUpdate(from, [sender], "remove");
                    await sock.sendMessage(from, {
                        text: `🚨 @${sender.split("@")[0]} removed (max warnings reached)`,
                        mentions: [sender]
                    });
                    warns[sender] = 0;
                }
            }
        }

        // COMMANDS — Only Admins + Owner
        if (!text.startsWith(".")) return;
        const cmd = text.split(" ")[0].toLowerCase();

        if (!isOwner && !isAdmin) {
            return sock.sendMessage(from, { text: "⛔ Admins only." });
        }

        // .ping
        if (cmd === ".ping") {
            await sock.sendMessage(from, { text: "pong 🏓" });
        }

        // .antilink on/off
        if (cmd === ".antilink") {
            if (text.includes("on")) {
                antiLink = true;
                return await sock.sendMessage(from, { text: "🔰 Anti-Link Enabled" });
            }
            if (text.includes("off")) {
                antiLink = false;
                return await sock.sendMessage(from, { text: "⭕ Anti-Link Disabled" });
            }
        }

        // .tagall
        if (cmd === ".tagall" && isGroup) {
            const group = await sock.groupMetadata(from);
            let mentions = [];
            let msg = "📢 *Tagging Everyone:*\n\n";

            group.participants.forEach(p => {
                mentions.push(p.id);
                msg += `@${p.id.split("@")[0]}\n`;
            });

            await sock.sendMessage(from, { text: msg, mentions });
        }

        // .kick
        if (cmd === ".kick" && isGroup) {
            let target = m.message.extendedTextMessage?.contextInfo?.participant;
            if (!target) return sock.sendMessage(from, { text: "Mention a user to kick." });

            await sock.groupParticipantsUpdate(from, [target], "remove");
            await sock.sendMessage(from, {
                text: `Kicked @${target.split("@")[0]}`,
                mentions: [target]
            });
        }

        // .warn
        if (cmd === ".warn" && isGroup) {
            let target = m.message.extendedTextMessage?.contextInfo?.participant;
            if (!target) return sock.sendMessage(from, { text: "Mention a user." });

            warns[target] = (warns[target] || 0) + 1;

            await sock.sendMessage(from, {
                text: `⚠️ @${target.split("@")[0]} warned (${warns[target]}/${config.warnLimit})`,
                mentions: [target]
            });

            if (warns[target] >= config.warnLimit) {
                await sock.groupParticipantsUpdate(from, [target], "remove");
                await sock.sendMessage(from, {
                    text: `🚨 @${target.split("@")[0]} removed (max warnings reached)`,
                    mentions: [target]
                });
                warns[target] = 0;
            }
        }

        // .open
        if (cmd === ".open" && isGroup) {
            await sock.groupSettingUpdate(from, "not_announcement");
            await sock.sendMessage(from, { text: "🔓 Group opened for chatting." });
        }

        // .close
        if (cmd === ".close" && isGroup) {
            await sock.groupSettingUpdate(from, "announcement");
            await sock.sendMessage(from, { text: "🔒 Group closed (admins only)." });
        }

        // .menu
        if (cmd === ".menu") {
            let uptime = process.uptime();
            let h = Math.floor(uptime / 3600);
            let mnt = Math.floor((uptime % 3600) / 60);
            let s = Math.floor(uptime % 60);

            const menu = `
╔══✦ *MiniBot Fancy Menu* ✦══╗

👑 *Owner:* ${config.owner}
⚡ *Uptime:* ${h}h ${mnt}m ${s}s
🧩 *Anti-Link:* ${antiLink ? "ON ✅" : "OFF ❌"}

🎯 *Commands*
• .menu
• .ping
• .tagall
• .kick
• .warn
• .open
• .close
• .antilink on/off

╚════════════════════╝
`;

            await sock.sendMessage(from, { text: menu });
        }
    });
}

start();                            text: `🚨 @${sender.split("@")[0]} removed (max warnings reached)`,
                            mentions: [sender]
                        });
                        warns[sender] = 0;
                    }
                }
            }
        }

        // ===================== COMMANDS ======================== //
        if (!text.startsWith(".")) return;
        const cmd = text.split(" ")[0].toLowerCase();

        // .ping
        if (cmd === ".ping") {
            await sock.sendMessage(from, { text: "pong 🏓" });
        }

        // .antilink on/off
        if (cmd === ".antilink") {
            if (text.includes("on")) {
                antiLink = true;
                return await sock.sendMessage(from, { text: "🔰 Anti-Link Enabled" });
            }
            if (text.includes("off")) {
                antiLink = false;
                return await sock.sendMessage(from, { text: "⭕ Anti-Link Disabled" });
            }
        }

        // .tagall
        if (cmd === ".tagall" && isGroup) {
            const group = await sock.groupMetadata(from);
            let mentions = [];
            let msg = "📢 *Tagging Everyone:*\n\n";

            group.participants.forEach(p => {
                mentions.push(p.id);
                msg += `@${p.id.split("@")[0]}\n`;
            });

            await sock.sendMessage(from, { text: msg, mentions });
        }

        // .kick
        if (cmd === ".kick" && isGroup) {
            let target = m.message.extendedTextMessage?.contextInfo?.participant;
            if (!target) return sock.sendMessage(from, { text: "Mention a user to kick." });

            await sock.groupParticipantsUpdate(from, [target], "remove");
            await sock.sendMessage(from, {
                text: `Kicked @${target.split("@")[0]}`,
                mentions: [target]
            });
        }

        // .warn
        if (cmd === ".warn" && isGroup) {
            let target = m.message.extendedTextMessage?.contextInfo?.participant;
            if (!target) return sock.sendMessage(from, { text: "Mention a user." });

            warns[target] = (warns[target] || 0) + 1;

            await sock.sendMessage(from, {
                text: `⚠️ @${target.split("@")[0]} warned (${warns[target]}/${config.warnLimit})`,
                mentions: [target]
            });

            if (warns[target] >= config.warnLimit) {
                await sock.groupParticipantsUpdate(from, [target], "remove");
                await sock.sendMessage(from, {
                    text: `🚨 @${target.split("@")[0]} removed (max warnings reached)`,
                    mentions: [target]
                });
                warns[target] = 0;
            }
        }

        // .open (open group)
        if (cmd === ".open" && isGroup) {
            await sock.groupSettingUpdate(from, "not_announcement");
            await sock.sendMessage(from, { text: "🔓 Group opened for chatting." });
        }

        // .close (close group)
        if (cmd === ".close" && isGroup) {
            await sock.groupSettingUpdate(from, "announcement");
            await sock.sendMessage(from, { text: "🔒 Group closed (admins only)." });
        }

        // =============== FANCY MENU =============== //
        if (cmd === ".menu") {

            let uptime = process.uptime();
            let h = Math.floor(uptime / 3600);
            let mnt = Math.floor((uptime % 3600) / 60);
            let s = Math.floor(uptime % 60);

            const menu = `
╔══✦ *MiniBot Fancy Menu* ✦══╗

👑 *Owner:* ${config.owner}
⚡ *Uptime:* ${h}h ${mnt}m ${s}s
🧩 *Anti-Link:* ${antiLink ? "ON ✅" : "OFF ❌"}

🎯 *Commands*
• .menu
• .ping
• .tagall
• .kick
• .warn
• .open
• .close
• .antilink on/off

╚════════════════════╝
`;

            await sock.sendMessage(from, {
                text: menu,
                footer: "MiniBot • WhatsApp Node.js",
                templateButtons: [
                    { index: 1, quickReplyButton: { displayText: "📡 Ping", id: ".ping" } },
                    { index: 2, quickReplyButton: { displayText: "👥 Tagall", id: ".tagall" } },
                    { index: 3, quickReplyButton: { displayText: "⚠️ Warn", id: ".warn" } }
                ]
            });
        }
    });
}

start();
