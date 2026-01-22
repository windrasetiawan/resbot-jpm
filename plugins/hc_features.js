import fs from "fs";
import path from "path";
import AdmZip from "adm-zip";
import { downloadAndSaveMedia, isOwner } from "../lib/utils.js";

async function hcFeatures(sock, chatId, text, key, msg) {
    const textTrimmed = text.trim();
    const rawArgs = textTrimmed.split(/\s+/);
    const cmd = rawArgs[0].toLowerCase();
    const args = textTrimmed.split(" ").slice(1).join(" "); 
    
    // Setup Database Folder
    const dbHC = "./DATABASE/HC";
    const tmpDir = "./tmp";
    if (!fs.existsSync(dbHC)) fs.mkdirSync(dbHC, { recursive: true });
    if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
    
    const isCreator = isOwner ? isOwner(msg.key.participant || msg.key.remoteJid) : true;

    // ==========================================
    // 1. MANAJEMEN FILE (.addhc, #uploadhc, dll)
    // ==========================================
    
    // .addhc (Simpan Manual)
    if (cmd === ".addhc" && isCreator) {
        const q = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
        if (!q?.documentMessage) return sock.sendMessage(chatId, { text: "❌ Reply file dokumen!" });
        
        let name = args || q.documentMessage.fileName;
        if (!name.endsWith(".hc") && !name.endsWith(".txt")) name += ".hc";

        const targetPath = path.join(dbHC, name);
        if (fs.existsSync(targetPath)) fs.rmSync(targetPath, { recursive: true, force: true });

        const p = await downloadAndSaveMedia(sock, q, name);
        fs.renameSync(p, targetPath);
        return sock.sendMessage(chatId, { text: `✅ Berhasil disimpan: ${name}` });
    }

    // #uploadhc (Upload ZIP)
    if (cmd === "#uploadhc" && isCreator) {
        const q = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
        if (!q?.documentMessage?.fileName.endsWith(".zip")) return sock.sendMessage(chatId, { text: "❌ Reply file ZIP!" });

        try {
            const p = await downloadAndSaveMedia(sock, q, "temp.zip");
            const zip = new AdmZip(p);
            const zipEntries = zip.getEntries();
            let count = 0;
            
            zipEntries.forEach((entry) => {
                if (!entry.isDirectory && entry.name && !entry.name.startsWith('.') && !entry.name.startsWith('__')) {
                    const targetPath = path.join(dbHC, entry.name);
                    if (fs.existsSync(targetPath)) fs.rmSync(targetPath, { recursive: true, force: true });
                    fs.writeFileSync(targetPath, entry.getData());
                    count++;
                }
            });
            fs.unlinkSync(p);
            return sock.sendMessage(chatId, { text: `✅ Sukses! ${count} file config diekstrak.` });
        } catch (e) {
            return sock.sendMessage(chatId, { text: `❌ Error ZIP: ${e.message}` });
        }
    }

    // .listhc, .delallhc, .delhc
    if (cmd === ".listhc") {
        const files = fs.readdirSync(dbHC).filter(f => fs.statSync(path.join(dbHC, f)).isFile());
        if (files.length === 0) return sock.sendMessage(chatId, { text: "📂 Database Kosong." });
        return sock.sendMessage(chatId, { text: `📂 *LIST CONFIG:*\n\n${files.map((f,i)=>`${i+1}. #${f}`).join("\n")}` });
    }
    if (cmd === ".delallhc" && isCreator) {
        fs.readdirSync(dbHC).forEach(f => fs.rmSync(path.join(dbHC, f), { recursive: true, force: true }));
        return sock.sendMessage(chatId, { text: "✅ Database bersih." });
    }
    if (cmd === ".delhc" && isCreator) {
        if (fs.existsSync(path.join(dbHC, args))) {
            fs.rmSync(path.join(dbHC, args), { recursive: true, force: true });
            return sock.sendMessage(chatId, { text: `✅ File ${args} dihapus.` });
        }
        return sock.sendMessage(chatId, { text: "❌ File tidak ditemukan." });
    }

    // #wintuneling (Send All Silent)
    if (cmd === "#wintuneling") {
        const files = fs.readdirSync(dbHC).filter(f => fs.statSync(path.join(dbHC, f)).isFile());
        if (files.length === 0) return sock.sendMessage(chatId, { text: "📂 Database Kosong." });
        for (const f of files) {
            await sock.sendMessage(chatId, { document: fs.readFileSync(path.join(dbHC, f)), fileName: f, mimetype: 'application/octet-stream', caption: "" });
            await new Promise(r => setTimeout(r, 1500));
        }
        return;
    }

    // ==========================================
    // 2. CREATE CONFIG (SUPPORT VMESS, VLESS, TROJAN)
    // ==========================================
    if (cmd.startsWith(".createhc") || cmd.startsWith(".buathc")) {
        const inputs = textTrimmed.split(/\s+/);
        
        // Format (Sama untuk semua mode):
        // .cmd <bug> <link> <nama>
        const inputBug = inputs[1];
        const link = inputs[2];
        const customName = inputs.slice(3).join(" ");
        
        if (!inputBug || !link || !customName) {
            return sock.sendMessage(chatId, { 
                text: `⚠️ *Format Salah!*\n\n` +
                      `🅰️ *Standard:* .createhc <bug> <link> <nama>\n` +
                      `🅱️ *Wildcard:* .createhcwild <bug> <link> <nama>\n` +
                      `_(Support: Vmess, Vless, Trojan)_`
            });
        }

        const isWildcardMode = cmd.includes("wild");

        // Cek Protokol
        if (!link.match(/^(vmess|vless|trojan):\/\//)) {
            return sock.sendMessage(chatId, { text: "❌ Hanya support Vmess, Vless, dan Trojan." });
        }

        try {
            let finalLink = "";
            let originalServer = "";
            let generatedSNI = "";
            let port = "80";
            let typeInfo = "🔓 Non-TLS";
            let protocol = link.split("://")[0];

            // --- A. LOGIC VMESS (JSON Base64) ---
            if (protocol === "vmess") {
                const b64 = link.replace("vmess://", "");
                let vmessObj = JSON.parse(Buffer.from(b64, 'base64').toString('utf-8'));
                
                originalServer = vmessObj.add;
                port = vmessObj.port || "80";
                if (vmessObj.tls === "tls" || port === "443") typeInfo = "🔒 TLS";

                // Tentukan SNI
                if (isWildcardMode) {
                    generatedSNI = `${inputBug}.${originalServer}`; // Auto Subdomain
                } else {
                    generatedSNI = originalServer; // Original
                }
                
                // Apply Config
                vmessObj.add = inputBug;       // Address = Bug
                vmessObj.host = generatedSNI;  // Host
                vmessObj.sni = generatedSNI;   // SNI
                
                vmessObj.ps = customName;
                finalLink = "vmess://" + Buffer.from(JSON.stringify(vmessObj)).toString('base64');
            } 
            
            // --- B. LOGIC VLESS & TROJAN (URL Format) ---
            else {
                // Hack: Ubah ke http agar bisa diparsing URL object
                const tempLink = link.replace(`${protocol}://`, "http://");
                const url = new URL(tempLink);

                originalServer = url.hostname;
                port = url.port || (protocol === "trojan" ? "443" : "80");
                if (port === "443" || url.searchParams.get("security") === "tls") typeInfo = "🔒 TLS";

                // Tentukan SNI
                if (isWildcardMode) {
                    generatedSNI = `${inputBug}.${originalServer}`; // Auto Subdomain
                } else {
                    generatedSNI = originalServer; // Original
                }

                // Apply Config
                url.hostname = inputBug; // Address = Bug
                url.searchParams.set("host", generatedSNI);
                url.searchParams.set("sni", generatedSNI);
                
                // Hapus Encryption None jika ada (opsional, biar bersih)
                if(url.searchParams.get("encryption") === "none") url.searchParams.delete("encryption");

                url.hash = "#" + encodeURIComponent(customName);
                
                // Kembalikan Protokol
                finalLink = url.toString().replace("http://", `${protocol}://`);
                // Hapus trailing slash
                if (finalLink.endsWith("/") && !link.endsWith("/")) finalLink = finalLink.slice(0, -1);
            }

            // SIMPAN & KIRIM
            let finalFileName = customName.endsWith(".hc") ? customName : customName + ".hc";
            const filePath = path.join(tmpDir, finalFileName);
            fs.writeFileSync(filePath, finalLink);

            let caption = `✅ *Config ${protocol.toUpperCase()} Created*\n\n`;
            caption += `⚙️ *Mode:* ${isWildcardMode ? "Wildcard" : "Bug WS"}\n`;
            caption += `🛡️ *Type:* ${typeInfo}\n`;
            caption += `🔌 *Port:* ${port}\n\n`;
            
            caption += `🐞 *Bug/Addr:* ${inputBug}\n`;
            caption += `🌐 *SNI/Host:* ${generatedSNI}\n`;
            caption += `\n📝 *File:* ${finalFileName}`;

            await sock.sendMessage(chatId, { 
                document: fs.readFileSync(filePath), 
                fileName: finalFileName, 
                mimetype: 'application/octet-stream',
                caption: caption
            }, { quoted: msg });

            setTimeout(() => { if (fs.existsSync(filePath)) fs.unlinkSync(filePath); }, 5000);

        } catch (e) {
            console.error(e);
            sock.sendMessage(chatId, { text: "❌ Link tidak valid atau format salah." });
        }
        return;
    }

    // SEARCH & AUTO-SEND (#namafile)
    if (text.startsWith("#") && !text.startsWith("#upload") && !text.startsWith("#wintuneling")) {
        const query = text.slice(1).trim().toLowerCase();
        if (!query) return;

        const files = fs.readdirSync(dbHC).filter(f => fs.statSync(path.join(dbHC, f)).isFile());
        const matched = files.filter(f => f.toLowerCase().includes(query));

        if (matched.length === 0) return sock.sendMessage(chatId, { text: `❌ File "${query}" tidak ditemukan.` });
        
        if (matched.length === 1) {
            return sock.sendMessage(chatId, { document: fs.readFileSync(path.join(dbHC, matched[0])), fileName: matched[0], mimetype: 'application/octet-stream', caption: "" });
        } else {
            return sock.sendMessage(chatId, { text: `🔍 *Ditemukan ${matched.length} file:*\n\n${matched.map((f,i)=>`${i+1}. #${f}`).join("\n")}\n\n⚠️ Ketik nama lebih spesifik.` });
        }
    }
}

export default hcFeatures;
