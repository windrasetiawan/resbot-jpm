import axios from 'axios';

async function cekkuota(sock, chatId, text, key, msg) {
    const cmd = text.split(" ")[0].toLowerCase();
    
    // Filter Command
    if (cmd !== ".cekxl" && cmd !== ".cekkuota") return;

    // Ambil Nomor dari argumen
    const args = text.split(" ");
    let num = args[1];

    if (!num) {
        return sock.sendMessage(chatId, { 
            text: "⚠️ Masukkan nomor HP!\nContoh: *.cekxl 087812345678*" 
        }, { quoted: msg });
    }

    // Normalisasi Nomor (08 -> 628) agar API menerima
    let msisdn = num.replace(/\D/g, '');
    if (msisdn.startsWith('08')) msisdn = '62' + msisdn.slice(1);
    if (msisdn.startsWith('8')) msisdn = '62' + msisdn;

    // Kirim pesan loading
    await sock.sendMessage(chatId, { text: "⏳ *Sedang mengecek kouta...*" }, { quoted: msg });

    // --- KONFIGURASI SESUAI KODE YANG WORK ---
    const config = {
        method: 'get',
        url: `https://apigw.kmsp-store.com/sidompul/v4/cek_kuota`,
        params: { msisdn: msisdn, isJSON: 'true' },
        headers: { 
            'Authorization': 'Basic c2lkb21wdWxhcGk6YXBpZ3drbXNw', 
            'X-API-Key': '60ef29aa-a648-4668-90ae-20951ef90c55', 
            'X-App-Version': '4.0.0', // <--- PENTING! Ini yang bikin work
            'Content-Type': 'application/x-www-form-urlencoded',
            'User-Agent': 'okhttp/4.9.0' // Tambahan agar lebih trusted
        }
    };

    try {
        const response = await axios(config);
        const res = response.data;

        // Logika sesuai kode Telegram (if res.status === true)
        if (res.status === true) {
            // Bersihkan HTML tags karena WA pakai Markdown (*bold*, _italic_)
            let rawHasil = res.data?.hasil || "Tidak ada info.";
            
            let cleanHasil = rawHasil
                .replace(/<br\s*\/?>/gi, '\n') // Ganti <br> jadi enter
                .replace(/<b>/gi, '*')         // Ganti <b> jadi * (Bold WA)
                .replace(/<\/b>/gi, '*')       // Ganti </b> jadi *
                .replace(/<[^>]*>?/gm, '');    // Hapus sisa tag HTML lain

            const replyText = `✅ *DETAIL KUOTA XL/AXIS*\n📱 Nomor: ${msisdn}\n\n${cleanHasil}`;
            
            await sock.sendMessage(chatId, { text: replyText }, { quoted: msg });
        } else {
            // Tangkap Error Message dari API
            const errMsg = res.data?.keteranganError || res.message || "Gagal mengambil data.";
            await sock.sendMessage(chatId, { text: `❌ *GAGAL:*\n${errMsg}` }, { quoted: msg });
        }
    } catch (error) {
        console.error(error);
        await sock.sendMessage(chatId, { 
            text: "❌ *Terjadi Kesalahan!*\nNomor salah, hangus, atau server sedang gangguan." 
        }, { quoted: msg });
    }
}

export default cekkuota;
