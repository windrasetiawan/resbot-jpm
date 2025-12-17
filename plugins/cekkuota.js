import axios from 'axios';

async function cekkuota(sock, chatId, message, key, msg) {
    const parts = message.trim().split(" ");
    const command = parts[0].toLowerCase();
    const args = parts.slice(1);

    // Filter Command
    if (command === ".cekkuota" || command === ".cekxl") {
        
        // 1. Cek Input Nomor
        if (!args[0]) {
            return sock.sendMessage(chatId, { text: "⚠️ Masukkan nomor XL/Axis!\nContoh: *.cekkuota 62878xxxx*" }, { quoted: msg });
        }

        // 2. Bersihkan Format Nomor (Hanya Angka)
        const msisdn = args[0].replace(/[^0-9]/g, '');

        // 3. Kirim Pesan Loading
        await sock.sendMessage(chatId, { text: "⏳ Sedang mengambil data..." }, { quoted: msg });

        // 4. Config API
        const config = {
            method: 'get',
            url: `https://apigw.kmsp-store.com/sidompul/v4/cek_kuota`,
            params: { msisdn: msisdn, isJSON: 'true' },
            headers: { 
                'Authorization': 'Basic c2lkb21wdWxhcGk6YXBpZ3drbXNw', 
                'X-API-Key': '60ef29aa-a648-4668-90ae-20951ef90c55', 
                'X-App-Version': '4.0.0', 
                'Content-Type': 'application/x-www-form-urlencoded'
            }
        };

        try {
            // 5. Request Data
            const response = await axios(config);
            const res = response.data;

            if (res.status === true) {
                // 6. Rapikan Hasil (HTML -> Text WA)
                let hasil = res.data.hasil || "Tidak ada info paket.";
                hasil = hasil
                    .replace(/<br\s*\/?>/gi, '\n') // Enter
                    .replace(/<b>/gi, '*')         // Bold
                    .replace(/<\/b>/gi, '*')       // Bold End
                    .replace(/<[^>]*>?/gm, '');    // Hapus sisa tag HTML

                await sock.sendMessage(chatId, { 
                    text: `✅ *DETAIL KUOTA XL/AXIS*\n*Nomor:* ${msisdn}\n\n${hasil}` 
                }, { quoted: msg });

            } else {
                // Error dari API (misal nomor salah)
                const errorMsg = res.data?.keteranganError || res.message || "Gagal mengambil data.";
                await sock.sendMessage(chatId, { text: `❌ *GAGAL:*\n${errorMsg}` }, { quoted: msg });
            }

        } catch (e) {
            console.error("Error Cek Kuota:", e);
            await sock.sendMessage(chatId, { text: "❌ *ERROR SERVER*\nGagal menghubungi server Sidompul." }, { quoted: msg });
        }
    }
}

export default cekkuota;
