/**
 * @name BetterAccountButtons
 * @author ChatGPT
 * @version 1.1.0
 * @description Custom Material dark UI styling for Disable/Delete account buttons, centered layout.
 */

module.exports = class {
  start() {
    this.injectCSS();
    this.observeButtons();
  }

  stop() {
    BdApi.clearCSS("BetterAccountButtons");
    if (this.observer) this.observer.disconnect();
  }

  injectCSS() {
    const css = `
      .better-account-btn {
        background-color: #1a1a1e !important;
        color: #fff !important;
        font-weight: 500;
        font-size: 13px;
        border-radius: 8px !important;
        padding: 6px 16px !important;
        width: fit-content !important;
        box-shadow: 0 4px 10px rgba(0, 0, 0, 0.3);
        transition: all 0.2s ease;
        margin: 8px auto !important;
        display: block !important;
      }

      .better-account-btn:hover {
        background-color: #2a2a2f !important;
        transform: translateY(-1px);
        box-shadow: 0 6px 14px rgba(0, 0, 0, 0.4);
      }

      .better-account-btn.delete {
        color: #ff5a5a !important;
        border: 1px solid #ff5a5a !important;
      }

      .better-account-btn.delete:hover {
        background-color: #2a1a1a !important;
        color: #ff4444 !important;
        border-color: #ff4444 !important;
      }
    `;
    BdApi.injectCSS("BetterAccountButtons", css);
  }

  observeButtons() {
    const observer = new MutationObserver(() => {
      const buttons = document.querySelectorAll('button');

      buttons.forEach((btn) => {
        const text = btn.textContent?.trim();

        if (text === "Disable Account" && !btn.classList.contains("better-account-btn")) {
          btn.classList.add("better-account-btn");
        }

        if (text === "Delete Account" && !btn.classList.contains("better-account-btn")) {
          btn.classList.add("better-account-btn", "delete");
        }
      });
    });

    observer.observe(document.body, { childList: true, subtree: true });
    this.observer = observer;
  }
};
