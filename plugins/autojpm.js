import { spintax, readWhitelist } from "../lib/utils.js";
import { saveStatus } from "../lib/resumeAutoJPM.js";

async function autojpm(sock, chatId, text, key, msg) {
    if (!text.toLowerCase().startsWith(".autojpm")) return;
    const args = text.split(" ");
    const cmd = args[1]?.toLowerCase();
    const val = args.slice(2).join(" ");

    if (cmd === "set") {
        const min = parseInt(val);
        if (isNaN(min)) return sock.sendMessage(chatId, { text: "⚠️ Masukkan angka!" });
        global.autojpm.loopDelayHours = min / 60;
        return sock.sendMessage(chatId, { text: `✅ Jeda diatur: ${min} menit.` });
    }

    if (cmd === "on" && val) {
        global.autojpmRunning = true;
        saveStatus(true, val, null);
        sock.sendMessage(chatId, { text: "🚀 AUTO JPM AKTIF" });
        
        while (global.autojpmRunning) {
            const groups = await sock.groupFetchAllParticipating();
            const targets = Object.values(groups).filter(g => !readWhitelist().includes(g.id));
            
            for (const g of targets) {
                if (!global.autojpmRunning) break;
                await sock.sendMessage(g.id, { text: spintax(val) }).catch(() => {});
                await new Promise(r => setTimeout(r, 20000 + Math.floor(Math.random() * 10000)));
            }
            
            if (!global.autojpmRunning) break;
            const delayMs = (global.autojpm.loopDelayHours || 1) * 3600000;
            await new Promise(r => setTimeout(r, delayMs));
        }
    }

    if (cmd === "off") {
        global.autojpmRunning = false;
        saveStatus(false, null, null);
        sock.sendMessage(chatId, { text: "🛑 AUTO JPM MATI" });
    }
}
export default autojpm;
