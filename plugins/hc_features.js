import fs from "fs";
import path from "path";
import AdmZip from "adm-zip";
import { downloadAndSaveMedia, isOwner } from "../lib/utils.js";

// SESSION & DATABASE CONFIG
const hcSession = {}; // Penyimpanan sesi interaktif sementara
const dbBugPath = "./DATABASE/bug_list.json"; // Database Template Bug
const dbHC = "./DATABASE/HC"; // Folder penyimpanan file config

// Fungsi Load/Save Database Bug
const getBugs = () => {
    if (!fs.existsSync("./DATABASE")) fs.mkdirSync("./DATABASE");
    if (!fs.existsSync(dbBugPath)) fs.writeFileSync(dbBugPath, "[]");
    return JSON.parse(fs.readFileSync(dbBugPath));
};
const saveBugs = (data) => fs.writeFileSync(dbBugPath, JSON.stringify(data, null, 2));

async function hcFeatures(sock, chatId, text, key, msg) {
    const sender = msg.key.participant || msg.key.remoteJid;
    const textTrimmed = text.trim();
    const cmd = text.split(" ")[0].toLowerCase();
    const args = text.split(" ").slice(1).join(" ");
    
    // Pastikan folder database tersedia
    if (!fs.existsSync(dbHC)) fs.mkdirSync(dbHC, { recursive: true });
    
    // Cek Owner (Menggunakan logika dari kode Anda)
    const isCreator = isOwner(sender);

    // Bagian ini menangani input angka/nama saat user sedang membuat config
    // ============================================================
    if (hcSession[sender]) {
        const session = hcSession[sender];

        // Fitur Batal
        if (text.toLowerCase() === "batal" || text.toLowerCase() === "cancel") {
            delete hcSession[sender];
            return sock.sendMessage(chatId, { text: "❌ Proses dibatalkan." });
        }

        //  PILIH BUG
        if (session.step === "select_bug") {
            const selection = parseInt(textTrimmed);
            const bugs = getBugs();

            if (isNaN(selection) || selection < 1 || selection > bugs.length) {
                return sock.sendMessage(chatId, { text: "⚠️ Pilihan salah. Masukkan nomor yang benar atau ketik *batal*." });
            }

            session.bugData = bugs[selection - 1];
            session.step = "input_name"; 

            return sock.sendMessage(chatId, { 
                text: `✅ Bug Terpilih: *${session.bugData.name}*\n\n📝 *Sekarang, masukkan NAMA untuk config ini:*\n(Contoh: ConfigMalam)` 
            });
        }

        // STEP 2: INPUT NAMA & GENERATE
        if (session.step === "input_name") {
            const customName = textTrimmed;
            const link = session.link;
            const selectedBug = session.bugData;

            try {
                let finalLink = "";
                let generatedSNI = "";
                let protocol = link.split("://")[0];
                let originalServer = "";

                if (protocol === "vmess") {
                    const b64 = link.replace("vmess://", "");
                    let vmessObj = JSON.parse(Buffer.from(b64, 'base64').toString('utf-8'));
                    originalServer = vmessObj.add;

                    if (selectedBug.mode === "wildcard") {
                        generatedSNI = `${selectedBug.domain}.${originalServer}`; 
                    } else {
                        generatedSNI = originalServer; 
                    }
                    
                    vmessObj.add = selectedBug.domain;       
                    vmessObj.host = generatedSNI;  
                    vmessObj.sni = generatedSNI;   
                    vmessObj.ps = customName;
                    
                    finalLink = "vmess://" + Buffer.from(JSON.stringify(vmessObj)).toString('base64');
                } else {
                    const tempLink = link.replace(`${protocol}://`, "http://");
                    const url = new URL(tempLink);
                    originalServer = url.hostname;

                    if (selectedBug.mode === "wildcard") {
                        generatedSNI = `${selectedBug.domain}.${originalServer}`; 
                    } else {
                        generatedSNI = originalServer; 
                    }

                    url.hostname = selectedBug.domain; 
                    url.searchParams.set("host", generatedSNI);
                    url.searchParams.set("sni", generatedSNI);
                    if(url.searchParams.get("encryption") === "none") url.searchParams.delete("encryption");
                    url.hash = "#" + encodeURIComponent(customName);
                    
                    finalLink = url.toString().replace("http://", `${protocol}://`);
                    if (finalLink.endsWith("/") && !link.endsWith("/")) finalLink = finalLink.slice(0, -1);
                }

                // KIRIM HASIL
                await sock.sendMessage(chatId, { text: finalLink });

            } catch (e) {
                console.error(e);
                delete hcSession[sender];
                sock.sendMessage(chatId, { text: "❌ Gagal memproses config. Link mungkin rusak." });
            }
            return;
        }
    }

    // .addhc (Simpan Manual)
    if (cmd === ".addhc" && isCreator) {
        const q = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
        if (!q?.documentMessage) return sock.sendMessage(chatId, { text: "❌ Reply file dokumen!" });
        
        const name = args || q.documentMessage.fileName;
        const targetPath = path.join(dbHC, name);

        if (fs.existsSync(targetPath)) {
            fs.rmSync(targetPath, { recursive: true, force: true });
        }

        const p = await downloadAndSaveMedia(sock, q, name);
        fs.renameSync(p, targetPath);
        return sock.sendMessage(chatId, { text: `✅ Saved: ${name}` });
    }

    // #uploadhc (Upload ZIP)
    if (cmd === "#uploadhc" && isCreator) {
        const q = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
        const isZip = q?.documentMessage?.fileName.endsWith(".zip") || q?.documentMessage?.mimetype === "application/zip";
        
        if (!isZip) return sock.sendMessage(chatId, { text: "❌ Reply file ZIP!" });

        try {
            const p = await downloadAndSaveMedia(sock, q, "temp.zip");
            const zip = new AdmZip(p);
            const zipEntries = zip.getEntries();
            let count = 0;
            
            zipEntries.forEach((entry) => {
                if (!entry.isDirectory) {
                    const filename = entry.name;
                    if (filename && !filename.startsWith('.') && !filename.startsWith('__')) {
                        const targetPath = path.join(dbHC, filename);
                        if (fs.existsSync(targetPath)) fs.rmSync(targetPath, { recursive: true, force: true });
                        fs.writeFileSync(targetPath, entry.getData());
                        count++;
                    }
                }
            });
            fs.unlinkSync(p);
            
            if (count > 0) return sock.sendMessage(chatId, { text: `✅ Sukses!\n📂 ${count} file diekstrak & disimpan.\n(Folder lama dibersihkan)` });
            else return sock.sendMessage(chatId, { text: "⚠️ File ZIP kosong atau tidak valid." });

        } catch (e) {
            console.error(e);
            return sock.sendMessage(chatId, { text: `❌ Error: ${e.message}` });
        }
    }

    // #wintuneling (Kirim Semua Config)
    if (cmd === "#wintuneling") {
        const files = fs.readdirSync(dbHC);
        const validFiles = files.filter(f => fs.statSync(path.join(dbHC, f)).isFile());

        if (validFiles.length === 0) return sock.sendMessage(chatId, { text: "📂 Database Kosong." });
        
        for (const f of validFiles) {
            try {
                await sock.sendMessage(chatId, { 
                    document: fs.readFileSync(path.join(dbHC, f)), 
                    fileName: f, 
                    mimetype: 'application/octet-stream',
                    caption: "" 
                });
                await new Promise(r => setTimeout(r, 2000));
            } catch {}
        }
        return;
    }

    // .listhc (Cek Daftar File)
    if (cmd === ".listhc") {
        const files = fs.readdirSync(dbHC);
        const validFiles = files.filter(f => fs.statSync(path.join(dbHC, f)).isFile());
        
        if (validFiles.length === 0) return sock.sendMessage(chatId, { text: "📂 Database Kosong." });
        let t = `📂 *DATABASE CONFIG (${validFiles.length})*\n\n` + validFiles.map((f, i) => `${i+1}. #${f}`).join("\n");
        return sock.sendMessage(chatId, { text: t });
    }

    // #namafile (Pencarian Parsial)
    if (text.startsWith("#") && cmd !== "#uploadhc" && cmd !== "#wintuneling") {
        const query = text.slice(1).trim().toLowerCase();
        if (!query) return;

        const files = fs.readdirSync(dbHC);
        const validFiles = files.filter(f => fs.statSync(path.join(dbHC, f)).isFile());
        const matched = validFiles.filter(f => f.toLowerCase().includes(query));

        if (matched.length === 0) {
            return sock.sendMessage(chatId, { text: `❌ File "${query}" tidak ditemukan.` });
        } else if (matched.length === 1) {
            const f = matched[0];
            return sock.sendMessage(chatId, { 
                document: fs.readFileSync(path.join(dbHC, f)), 
                fileName: f, 
                mimetype: 'application/octet-stream',
                caption: "" 
            });
        } else {
            let list = `🔍 *Ditemukan ${matched.length} file mirip:*\n\n`;
            list += matched.map((f, i) => `${i+1}. #${f}`).join("\n");
            list += `\n⚠️ Ketik nama lebih spesifik.`;
            return sock.sendMessage(chatId, { text: list });
        }
    }

    // .delhc (Hapus Satu File)
    if (cmd === ".delhc" && isCreator) {
        const fileName = args;
        const p = path.join(dbHC, fileName);
        if (fs.existsSync(p)) { 
            fs.rmSync(p, { recursive: true, force: true });
            return sock.sendMessage(chatId, { text: `✅ Berhasil menghapus ${fileName}` }); 
        } else { 
            return sock.sendMessage(chatId, { text: "❌ File tidak ditemukan." }); 
        }
    }

    // .delallhc (Hapus SEMUA File)
    if (cmd === ".delallhc" && isCreator) {
        try {
            const files = fs.readdirSync(dbHC);
            if (files.length === 0) return sock.sendMessage(chatId, { text: "⚠️ Database HC sudah kosong." });
            let count = 0;
            files.forEach(file => {
                const filePath = path.join(dbHC, file);
                fs.rmSync(filePath, { recursive: true, force: true });
                count++;
            });
            return sock.sendMessage(chatId, { text: `✅ *SUKSES MENGHAPUS DATABASE*\n\n🗑️ Total: ${count} item dihapus bersih.` });
        } catch (e) {
            return sock.sendMessage(chatId, { text: `❌ Gagal menghapus: ${e.message}` });
        }
    }

    // MANAJEMEN TEMPLATE BUG (.addbug, .delbug, .listbug)
    
    // ADD BUG
    if (cmd === ".addbug" && isCreator) {
        const content = args; // Menggunakan args yg sudah diparsing
        const [name, domain, mode] = content.split("|");

        if (!name || !domain) {
            return sock.sendMessage(chatId, { 
                text: "⚠️ Format Salah!\n\nUse: `.addbug Nama|Domain|Mode`\n\nContoh:\n`.addbug Opok Tsel|m.facebook.com|standard`\n`.addbug Cloudflare|104.17.3.81|wildcard`" 
            });
        }

        const bugs = getBugs();
        bugs.push({ 
            name: name.trim(), 
            domain: domain.trim(), 
            mode: (mode && mode.trim() === "wildcard") ? "wildcard" : "standard" 
        });
        saveBugs(bugs);
        return sock.sendMessage(chatId, { text: `✅ Bug *${name}* berhasil ditambahkan.` });
    }

    // DEL BUG
    if (cmd === ".delbug" && isCreator) {
        const content = args;
        let bugs = getBugs();
        
        // Hapus by index
        if (!isNaN(content) && parseInt(content) > 0) {
            const index = parseInt(content) - 1;
            if (index < bugs.length) {
                const deleted = bugs[index];
                bugs.splice(index, 1);
                saveBugs(bugs);
                return sock.sendMessage(chatId, { text: `✅ Bug *${deleted.name}* dihapus.` });
            }
        }
        
        // Hapus by nama
        const newBugs = bugs.filter(b => b.name.toLowerCase() !== content.toLowerCase());
        if (newBugs.length < bugs.length) {
            saveBugs(newBugs);
            return sock.sendMessage(chatId, { text: `✅ Bug *${content}* berhasil dihapus.` });
        } else {
            return sock.sendMessage(chatId, { text: "❌ Bug tidak ditemukan." });
        }
    }

    // LIST BUG
    if (cmd === ".listbug") {
        const bugs = getBugs();
        if (bugs.length === 0) return sock.sendMessage(chatId, { text: "📂 Database Bug Kosong." });
        let msg = "📋 *DAFTAR BUG TERSIMPAN:*\n\n";
        bugs.forEach((b, i) => {
            msg += `*${i + 1}. ${b.name}*\n   🌐 ${b.domain} (${b.mode})\n\n`;
        });
        return sock.sendMessage(chatId, { text: msg });
    }
    
    // .createhc
    if (cmd === ".createhc" || cmd === ".buathc") {
        const link = args; // Mengambil semua text setelah command

        if (!link) return sock.sendMessage(chatId, { text: "⚠️ Masukkan Link Vmess/Vless/Trojan.\nContoh: `.createhc vmess://...`" });
        if (!link.match(/^(vmess|vless|trojan):\/\//)) return sock.sendMessage(chatId, { text: "❌ Link tidak valid." });

        const bugs = getBugs();
        if (bugs.length === 0) return sock.sendMessage(chatId, { text: "⚠️ Belum ada Bug tersimpan. Tambahkan dulu pakai `.addbug`." });

        // --- MULAI SESI ---
        hcSession[sender] = {
            step: "select_bug",
            link: link,
            bugData: null
        };

        // Tampilkan Daftar Pilihan
        let menu = "🛠️ *PILIH TEMPLATE BUG:*\nSilakan balas dengan nomor urut.\n\n";
        bugs.forEach((b, i) => {
            menu += `*${i + 1}. ${b.name}*\n`;
        });
        menu += "\n_Ketik 'batal' untuk membatalkan._";

        return sock.sendMessage(chatId, { text: menu });
    }
}

export default hcFeatures;
