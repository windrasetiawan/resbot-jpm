async function listgc(sock, chatId, text, key, msg) {
    const cmd = text.split(" ")[0].toLowerCase();
    if (cmd !== ".listgc" && cmd !== ".gclist") return;

    try {
        // Ambil data grup
        const groups = await sock.groupFetchAllParticipating();
        const groupsList = Object.values(groups);
        
        if (groupsList.length === 0) return sock.sendMessage(chatId, { text: "❌ Tidak ada grup." });

        // Ambil nama saja (subject)
        const listText = groupsList.map((g, i) => `${i + 1}. ${g.subject}`).join('\n');
        
        await sock.sendMessage(chatId, { 
            text: `📋 *LIST GRUP (${groupsList.length})*\n\n${listText}` 
        }, { quoted: msg });
        
    } catch (e) {
        console.error(e);
        await sock.sendMessage(chatId, { text: '❌ Gagal mengambil data grup.' });
    }
}
export default listgc;
