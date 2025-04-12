/**
 * @name DiscordLinkSafe
 * @description Replaces Discord invite links with a safe label and highlights expired invites.
 * @version 1.4.0
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
