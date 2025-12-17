import axios from 'axios';

async function cekkuota(sock, chatId, message, key, msg) {
    // Parsing Command
    const parts = message.trim().split(" ");
    const command = parts[0].toLowerCase();
    const args = parts.slice(1);

    // --- COMMAND: .cekkuota atau .cekxl ---
    if (command === ".cekkuota" || command === ".cekxl") {
        
        // 1. Validasi Input Nomor
        if (!args[0]) {
            return sock.sendMessage(chatId, { 
                text: "⚠️ Masukkan nomor XL/Axis!\nContoh: *.cekkuota 62878xxxx*" 
            }, { quoted: msg });
        }

        // Bersihkan nomor (hanya ambil angka)
        const msisdn = args[0].replace(/[^0-9]/g, ''); 

        // 2. Kirim Pesan Loading
        await sock.sendMessage(chatId, { text: "⏳ Sedang mengecek kouta..." }, { quoted: msg });

        // 3. Konfigurasi API Sidompul
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
            // 4. Request ke API
            const response = await axios(config);
            const res = response.data;

            if (res.status === true) {
                // 5. Rapikan Hasil (Convert HTML ke Format WA)
                let rawHasil = res.data.hasil || "Tidak ada info.";
                
                let cleanHasil = rawHasil
                    .replace(/<br\s*\/?>/gi, '\n') // Ganti baris baru HTML jadi Enter
                    .replace(/<b>/gi, '*')         // Ganti Bold HTML jadi Bintang WA
                    .replace(/<\/b>/gi, '*')       // Tutup Bold
                    .replace(/<[^>]*>?/gm, '');    // Hapus sisa tag HTML

                const replyText = `✅ *DETAIL KUOTA XL/AXIS*\n*Nomor:* ${msisdn}\n\n${cleanHasil}`;
                
                return sock.sendMessage(chatId, { text: replyText }, { quoted: msg });

            } else {
                // Jika API merespon tapi gagal (misal nomor salah)
                const errMsg = res.data?.keteranganError || res.message || "Gagal mengambil data.";
                return sock.sendMessage(chatId, { text: `❌ *GAGAL:*\n${errMsg}` }, { quoted: msg });
            }

        } catch (error) {
            console.error("Error Cek Kuota:", error);
            return sock.sendMessage(chatId, { text: "❌ *ERROR SERVER*\nTerjadi kesalahan koneksi atau server gangguan." }, { quoted: msg });
        }
    }
}

export default cekkuota;
