import axios from 'axios';

async function cekkuota(sock, chatId, message, key, msg) {
    const parts = message.trim().split(" ");
    
    let command = parts[0]?.toLowerCase();
    if (command.startsWith(".") || command.startsWith("#")) {
        command = command.substring(1);
    }
    const args = parts.slice(1);

    if (command === "cekkuota" || command === "cekxl") {
        if (!args[0]) return sock.sendMessage(chatId, { text: "⚠️ Masukkan nomor! Contoh: .cekxl 0878xxxx" }, { quoted: msg });

        let msisdn = args[0].replace(/[^0-9]/g, ''); 
        if (msisdn.startsWith('08')) msisdn = '62' + msisdn.substring(1);

        await sock.sendMessage(chatId, { text: "⏳ Sedang menghubungi server..." }, { quoted: msg });

        const config = {
            method: 'get',
            url: `https://apigw.kmsp-store.com/sidompul/v4/cek_kuota`,
            params: { msisdn: msisdn, isJSON: 'true' },
            headers: { 
                'Authorization': 'Basic c2lkb21wdWxhcGk6YXBpZ3drbXNw', 
                'X-API-Key': '60ef29aa-a648-4668-90ae-20951ef90c55', 
                'X-App-Version': '4.0.0', 
                'Content-Type': 'application/x-www-form-urlencoded',
                'User-Agent': 'okhttp/4.9.0'
            },
            timeout: 15000 
        };

        try {
            const response = await axios(config);
            const res = response.data;

            if (res.status === true || res.success === true) {
                let cleanHasil = (res.data?.hasil || res.hasil || "Info paket tidak tersedia.")
                    .replace(/<br\s*\/?>/gi, '\n')
                    .replace(/<b>/gi, '*')
                    .replace(/<\/b>/gi, '*')
                    .replace(/<[^>]*>?/gm, '');

                await sock.sendMessage(chatId, { text: `✅ *DETAIL KUOTA*\n${msisdn}\n\n${cleanHasil}` }, { quoted: msg });
            } else {
                await sock.sendMessage(chatId, { text: `❌ Gagal: ${res.message || "Error tidak diketahui"}` }, { quoted: msg });
            }
        } catch (error) {
            await sock.sendMessage(chatId, { text: "❌ Server Sidompul Down/Error." }, { quoted: msg });
        }
    }
}
export default cekkuota;
