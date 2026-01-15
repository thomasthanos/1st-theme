/**
 * @name Timer
 * @version 2.0,0
 * @description Εμφανίζει την ώρα με dark εμφάνιση και προσφέρει custom ρυθμίσεις μέσω εικονιδίου ⚙️ με ✓ ✕ κουμπιά.
 * @author ThomasT
 * @authorId 706932839907852389
 * @source https://github.com/thomasthanos/1st-theme
 * @updateUrl https://raw.githubusercontent.com/thomasthanos/1st-theme/main/Discord_DEV/Plugins/Timer.plugin.js
 */

module.exports = class Timer {
    constructor() {
        this.settings = BdApi.Data.load("Timer", "settings") || {
            enabled: true,
            use24h: true,
            showSeconds: true
        };
    }

    start() {
        // Μειώθηκε ο χρόνος αναμονής στα 3 δευτερόλεπτα για πιο γρήγορη εμφάνιση
        setTimeout(() => {
            if (this.settings.enabled) this.insertClockInTitle();
            this.retryInjectSettingsIcon();
        }, 3000);
    }

    stop() {
        const clock = document.getElementById("realtime-clock");
        if (clock) clock.remove();
        const icon = document.getElementById("timer-settings-icon");
        if (icon) icon.remove();
        const modal = document.getElementById("timer-settings-modal");
        if (modal) modal.remove();
        clearInterval(this.interval);
        if (this.observerInterval) clearInterval(this.observerInterval);
    }

    insertClockInTitle() {
        const waitForTitleBar = setInterval(() => {
            // Διορθωμένος selector για να βρίσκει το νέο title bar (βάσει του screenshot)
            const titleContainer = document.querySelector('[class*="c38106"][class*="-title"]') ||
                document.querySelector('[class*="title_"]') ||
                document.querySelector('[class*="-title"]');

            if (!titleContainer) return;

            if (!document.getElementById("realtime-clock")) {
                const clock = document.createElement("span");
                clock.id = "realtime-clock";
                Object.assign(clock.style, {
                    marginLeft: "10px",
                    padding: "4px 12px",
                    borderRadius: "8px",
                    background: "rgba(30, 31, 34, 0.8)",
                    backdropFilter: "blur(4px)",
                    border: "1px solid rgba(255, 255, 255, 0.1)",
                    color: "#dbdee1",
                    fontSize: "12px",
                    fontWeight: "600",
                    fontFamily: "Consolas, monospace",
                    boxShadow: "0 2px 4px rgba(0, 0, 0, 0.2)",
                    userSelect: "none",
                    whiteSpace: "nowrap",
                    display: "inline-flex",
                    alignItems: "center"
                });

                titleContainer.appendChild(clock);
                this.interval = setInterval(() => this.updateClock(clock), 1000);
                clearInterval(waitForTitleBar);
            }
        }, 1000);
    }

    updateClock(clock) {
        const now = new Date();
        let h = now.getHours();
        const m = now.getMinutes().toString().padStart(2, "0");
        const s = now.getSeconds().toString().padStart(2, "0");

        if (!this.settings.use24h) h = h % 12 || 12;
        h = h.toString().padStart(2, "0");

        let time = `${h}:${m}`;
        if (this.settings.showSeconds) time += `:${s}`;
        if (!this.settings.use24h) time += now.getHours() >= 12 ? " PM" : " AM";

        if (clock.textContent !== time) clock.textContent = time;
    }

    retryInjectSettingsIcon() {
        const inject = () => {
            const pluginCards = document.querySelectorAll('[class*="bd-addon-card"]');
            pluginCards.forEach(card => {
                const header = card.querySelector('[class*="bd-addon-header"]');
                if (header?.textContent.includes("Timer") && !card.querySelector("#timer-settings-icon")) {
                    const btn = document.createElement("button");
                    btn.id = "timer-settings-icon";
                    btn.innerHTML = "⚙️";
                    btn.title = "Timer Settings";
                    Object.assign(btn.style, {
                        background: "transparent",
                        border: "none",
                        cursor: "pointer",
                        fontSize: "16px",
                        marginLeft: "8px"
                    });
                    btn.onclick = () => this.openSettingsModal();
                    const controls = card.querySelector('[class*="bd-controls"]');
                    if (controls) controls.appendChild(btn);
                }
            });
        };

        inject();
        this.observerInterval = setInterval(inject, 2000);
    }

    openSettingsModal() {
        // (Το υπόλοιπο modal παραμένει το ίδιο όπως το είχες, είναι σωστό λειτουργικά)
        const modal = document.createElement("div");
        modal.id = "timer-settings-modal";
        Object.assign(modal.style, {
            position: "fixed", top: "50%", left: "50%", transform: "translate(-50%, -50%)",
            zIndex: "10000", background: "#1e1f22", color: "#fff", padding: "26px",
            borderRadius: "14px", width: "380px", boxShadow: "0 0 25px rgba(0, 0, 0, 0.7)",
            fontFamily: "Segoe UI, sans-serif", display: "flex", flexDirection: "column", gap: "18px",
            border: "1px solid rgba(255, 255, 255, 0.05)"
        });

        const title = document.createElement("div");
        title.innerHTML = "🕒 <strong style='font-size: 18px;'>Timer Settings</strong>";
        title.style.textAlign = "center";

        const checkbox = (id, label, checked) => {
            const wrapper = document.createElement("label");
            wrapper.style.display = "flex"; wrapper.style.alignItems = "center";
            wrapper.style.gap = "12px"; wrapper.style.fontSize = "15px"; wrapper.style.cursor = "pointer";
            const box = document.createElement("div");
            box.id = id;
            Object.assign(box.style, {
                width: "24px", height: "24px", borderRadius: "6px", border: "2px solid #5865F2",
                background: checked ? "#5865F2" : "transparent", color: "#fff", fontWeight: "bold",
                display: "flex", alignItems: "center", justifyContent: "center", fontSize: "14px"
            });
            box.innerText = checked ? "✓" : "✕";
            box.onclick = () => {
                const isChecked = box.innerText === "✓";
                box.innerText = isChecked ? "✕" : "✓";
                box.style.background = isChecked ? "transparent" : "#5865F2";
            };
            const span = document.createElement("span");
            span.textContent = label;
            wrapper.appendChild(box); wrapper.appendChild(span);
            return wrapper;
        };

        const btnRow = document.createElement("div");
        btnRow.style.display = "flex"; btnRow.style.justifyContent = "space-between";
        const saveBtn = document.createElement("button");
        saveBtn.textContent = "💾 Save";
        Object.assign(saveBtn.style, { background: "#5865F2", border: "none", color: "#fff", padding: "10px 22px", borderRadius: "8px", cursor: "pointer" });

        const cancelBtn = document.createElement("button");
        cancelBtn.textContent = "Cancel";
        Object.assign(cancelBtn.style, { background: "transparent", border: "1px solid #72767d", color: "#b9bbbe", borderRadius: "8px", padding: "10px 22px", cursor: "pointer" });

        modal.appendChild(title);
        modal.appendChild(checkbox("timer-enabled", "Enable Clock", this.settings.enabled));
        modal.appendChild(checkbox("timer-24h", "Use 24-Hour Format", this.settings.use24h));
        modal.appendChild(checkbox("timer-seconds", "Show Seconds", this.settings.showSeconds));
        btnRow.appendChild(saveBtn); btnRow.appendChild(cancelBtn);
        modal.appendChild(btnRow);
        document.body.appendChild(modal);

        saveBtn.onclick = () => {
            this.settings.enabled = document.getElementById("timer-enabled")?.innerText === "✓";
            this.settings.use24h = document.getElementById("timer-24h")?.innerText === "✓";
            this.settings.showSeconds = document.getElementById("timer-seconds")?.innerText === "✓";
            BdApi.Data.save("Timer", "settings", this.settings);
            modal.remove();
            this.stop();
            if (this.settings.enabled) this.start();
        };
        cancelBtn.onclick = () => modal.remove();
    }
};