import fs from "fs";
import path from "path";
import clc from "cli-color";
import { isOwner, downloadAndSaveMedia } from "../lib/utils.js";

const ID_SALURAN_TESTI = "120363405429396163@newsletter"; 
const countPath = path.join(process.cwd(), "DATABASE", "testi_count.json");

// Variabel memori untuk menyimpan sesi tanya jawab
const sessions = {};

const pertanyaanTesti1 = ["ISP", "Protokol", "Produk", "Region", "Config", "Device", "Harga", "Durasi"];
const pertanyaanTesti2 = ["Produk", "Harga", "Masa Aktif"];

function getTestiCount() {
    try {
        if (fs.existsSync(countPath)) return JSON.parse(fs.readFileSync(countPath)).count || 829; 
    } catch (e) {}
    return 829; 
}

function saveTestiCount(count) {
    if (!fs.existsSync(path.dirname(countPath))) fs.mkdirSync(path.dirname(countPath), { recursive: true });
    fs.writeFileSync(countPath, JSON.stringify({ count: count }));
}

export default async function testi(sock, chatId, text, key, msg) {
    // FIX PENTING: Jangan biarkan bot merespon pesannya sendiri!
    if (msg.key.fromMe) return;

    const sender = msg.key.participant || msg.key.remoteJid;
    
    // Fitur ini khusus Owner
    if (!isOwner(sender)) return;

    const cmd = text.toLowerCase().split(" ")[0];

    // --- 1. FITUR UBAH ANGKA MANUAL (.testi set 900) ---
    if (cmd === ".testi" && text.toLowerCase().includes("set ")) {
        const args = text.split(" ");
        if (args[1] === "set" && !isNaN(args[2])) {
            const angkaBaru = parseInt(args[2]);
            saveTestiCount(angkaBaru);
            return sock.sendMessage(chatId, { text: `✅ Angka hitungan testimoni diubah ke: *${angkaBaru}*` }, { quoted: msg });
        }
    }

    // --- 2. JIKA SEDANG DALAM SESI TANYA JAWAB ---
    if (sessions[sender]) {
        const sesi = sessions[sender];

        // Jika owner ingin membatalkan
        if (text.toLowerCase() === "batal" || text.toLowerCase() === "cancel") {
            delete sessions[sender];
            return sock.sendMessage(chatId, { text: "❌ Proses pembuatan Testimoni dibatalkan." }, { quoted: msg });
        }

        // Simpan jawaban owner
        sesi.jawaban.push(text.trim());
        sesi.step++;

        const daftarPertanyaan = sesi.tipe === ".testi" ? pertanyaanTesti1 : pertanyaanTesti2;

        // Jika pertanyaan masih ada, tanyakan selanjutnya
        if (sesi.step < daftarPertanyaan.length) {
            return sock.sendMessage(chatId, { 
                text: `Lanjut! Masukkan *${daftarPertanyaan[sesi.step]}*:\n\n_(Ketik *batal* untuk membatalkan, atau *-* jika ingin dikosongkan)_` 
            }, { quoted: msg });
        } 
        // Jika pertanyaan sudah habis, POSTING!
        else {
            await sock.sendMessage(chatId, { text: "⏳ Data lengkap! Sedang menyusun & memposting ke Saluran..." }, { quoted: msg });

            try {
                let currentCount = getTestiCount();
                let finalCaption = "";
                let data = sesi.jawaban; // Array jawaban dari owner

                // FORMAT 1 (VPN BIASA DENGAN EMOJI)
                if (sesi.tipe === ".testi") {
                    finalCaption = `✨PEMBELIAN BERHASIL✨  \n◇━━━━━━━━━━━━━━━━━◇ \n🗄️ ISP : ${data[0]}\n🌐 Protokol : ${data[1]}\n📦 Produk : ${data[2]}\n🌍 Region : ${data[3]}\n⚡ Config : ${data[4]}\n💻 Device : ${data[5]}\n💰 Harga : Rp ${data[6]}\n⏳ Durasi : ${data[7]}\n\n◇━━━━━━━━━━━━━━━━━◇ \n✅ TRANSAKSI SUKSES (${currentCount}) \n📂 Grup Sharing Config  \nhttps://chat.whatsapp.com/IRaOCbFdgaO6Rmx0tsgyyb?mode=ems_copy_t \n📞 Kontak Admin \n👉 wa.me/6285921645742\n\n*BOT VPN ➙* t.me/wintunelingvpnbot\n*BOT ZIVPN ➙* t.me/wintunelingzivpnBot\n◇━━━━━━━━━━━━━━━━━◇ \n🚀 Terima kasih telah bertransaksi di ✨WINTUNELING VPN`;
                } 
                // FORMAT 2 (UDP / KUOTA DENGAN EMOJI)
                else {
                    finalCaption = `✨PEMBELIAN BERHASIL✨  \n◇━━━━━━━━━━━━━━━━━◇ \n📦 Produk : ${data[0]}\n💰 Harga : Rp ${data[1]}\n⏳ Masa Aktif : ${data[2]}\n\n◇━━━━━━━━━━━━━━━━━◇ \n✅ TRANSAKSI SUKSES (${currentCount}) \n📂 Grup Sharing Config  \nhttps://chat.whatsapp.com/IRaOCbFdgaO6Rmx0tsgyyb?mode=ems_copy_t \n📞 Kontak Admin \n👉 wa.me/6285921645742\n\n*BOT VPN ➙* t.me/wintunelingvpnbot\n*BOT ZIVPN ➙* t.me/wintunelingzivpnBot\n*BOT KUOTA ➙* t.me/wintunelingkoutabot\n◇━━━━━━━━━━━━━━━━━◇ \n🚀 Terima kasih telah bertransaksi di ✨WINTUNELING VPN✨`;
                }

                // Kirim Gambar / Teks ke Saluran
                if (sesi.imageMessage) {
                    const msgToDownload = { message: { imageMessage: sesi.imageMessage } };
                    const pathImg = await downloadAndSaveMedia(sock, msgToDownload, "testi_temp.jpg");
                    const buffer = fs.readFileSync(pathImg);
                    
                    await sock.sendMessage(ID_SALURAN_TESTI, { image: buffer, caption: finalCaption });
                    fs.unlinkSync(pathImg); 
                } else if (sesi.textContent) {
                    await sock.sendMessage(ID_SALURAN_TESTI, { text: `💬 *PESAN PEMBELI:*\n_"${sesi.textContent}"_\n\n${finalCaption}` });
                }

                // Naikkan angka testi dan hapus sesi
                saveTestiCount(currentCount + 1);
                delete sessions[sender];

                return sock.sendMessage(chatId, { text: `✅ Sukses memposting Testimoni ke-${currentCount} ke saluran!` }, { quoted: msg });

            } catch (err) {
                delete sessions[sender]; // Hapus memori sesi jika error
                console.log(err);
                return sock.sendMessage(chatId, { text: `❌ Gagal memposting testimoni: ${err.message}` }, { quoted: msg });
            }
        }
    }

    // --- 3. MULAI SESI TANYA JAWAB BARU ---
    if (cmd === ".testi" || cmd === ".testi2") {
        const quotedMsg = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
        if (!quotedMsg) return sock.sendMessage(chatId, { text: "⚠️ Reply/balas gambar struk transfer dengan perintah *.testi* atau *.testi2*" }, { quoted: msg });

        let imgMsg = quotedMsg.imageMessage ? quotedMsg.imageMessage : null;
        let txtContent = (!imgMsg && (quotedMsg.conversation || quotedMsg.extendedTextMessage?.text)) ? (quotedMsg.conversation || quotedMsg.extendedTextMessage?.text) : null;

        if (!imgMsg && !txtContent) return sock.sendMessage(chatId, { text: "⚠️ Mohon reply/balas pesan berupa Gambar atau Teks Chat." }, { quoted: msg });

        // Mulai simpan ke memori sesi
        sessions[sender] = {
            tipe: cmd,
            step: 0,
            jawaban: [],
            imageMessage: imgMsg,
            textContent: txtContent
        };

        const daftarPertanyaan = cmd === ".testi" ? pertanyaanTesti1 : pertanyaanTesti2;
        
        return sock.sendMessage(chatId, { 
            text: `📝 *SISTEM AUTO TESTIMONI AKTIF*\nMari kita isi datanya. Silakan balas pesan ini dengan *${daftarPertanyaan[0]}*:\n\n_(Ketik *batal* kapan saja untuk berhenti)_` 
        }, { quoted: msg });
    }
}
