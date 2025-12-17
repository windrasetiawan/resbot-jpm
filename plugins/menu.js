async function menu(sock, sender, message) {
    const text = `
╭❰ *MENU BOT* ❱
│
│ ➤ .autojpm
│ ➤ .ping
│ ➤ .addhc / .delhc
│ ➤ .setopen / .setclose
╰────────────`;
    await sock.sendMessage(sender, { text: text });
}
export default menu;
