async function menu(sock, sender, message) {
    const text = `
╔═════════════════════╗
║    🤖 *MENU BOT* ║
╠═════════════════════╣
║                     ║
║ ➤ .autojpm          ║
║ ➤ .ping             ║
║ ➤ .listgc           ║
║ ➤ .addhc / .delhc   ║
║ ➤ .setopen / .close ║
║                     ║
╚═════════════════════╝
`;
    // Mengirim pesan balasan
    await sock.sendMessage(sender, { text: text });
}
export default menu;
