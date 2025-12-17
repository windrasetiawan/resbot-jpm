async function listgc(sock, sender, message) {
    try {
        const groups = await sock.groupFetchAllParticipating();
        const list = Object.values(groups).map((g, i) => `${i + 1}. ${g.subject}`).join('\n');
        await sock.sendMessage(sender, { text: `📋 *LIST GRUP:*\n\n${list || 'Tidak ada grup.'}` });
    } catch (e) {
        await sock.sendMessage(sender, { text: '❌ Gagal mengambil list grup.' });
    }
}
export default listgc;
