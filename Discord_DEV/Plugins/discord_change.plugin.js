/**
 * @name 1discord_change
 * @version 1.7.2
 * @description Μαρκάρει φακέλους ως αναγνωσμένους με βάση τα ID τους, με το παλιό δεξί κλικ + click, responsive UI, Material-style settings και έλεγχο τιμών.
 * @author ThomasT
 * @authorId 706932839907852389
 * @source https://github.com/thomasthanos/1st-theme/blob/main/Discord_DEV/Plugins/discord_change.plugin.js
 * @updateUrl https://raw.githubusercontent.com/thomasthanos/1st-theme/main/Discord_DEV/Plugins/discord_change.plugin.js
 * @downloadUrl https://raw.githubusercontent.com/thomasthanos/1st-theme/main/Discord_DEV/Plugins/discord_change.plugin.js
 * @website https://github.com/thomasthanos
 */

module.exports = class DiscordLinkSafe {
    start() {
        this._observer = new MutationObserver(() => this.replaceLinks());
        this._observer.observe(document.body, { childList: true, subtree: true });
        this.replaceLinks();
    }

    stop() {
        if (this._observer) this._observer.disconnect();
    }

    replaceLinks() {
        const links = document.querySelectorAll('a[href*="discord.gg/"], a[href*="discord.com/invite/"]');

        links.forEach(link => {
            if (link.dataset._discordSafeModified) return;

            const wrapper = link.closest('[id^="message-accessories"]');
            const isExpired = wrapper?.querySelector('h3.inviteDestinationExpired_d5f3cd');

            link.innerHTML = 'Discord link';
            link.style.fontWeight = 'bold';
            link.style.textDecoration = 'none';
            link.style.color = isExpired ? '#8B0000' : '#00b0f4';

            link.dataset._discordSafeModified = "true";
        });
    }
};
