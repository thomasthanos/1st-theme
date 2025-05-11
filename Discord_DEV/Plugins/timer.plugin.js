/**
 * @name Timer
 * @version 1.6.5
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
        setTimeout(() => {
            if (this.settings.enabled) this.insertClockInTitle();
            this.retryInjectSettingsIcon();
        }, 10000);
    }

    stop() {
        const clock = document.getElementById("realtime-clock");
        if (clock) clock.remove();
        const icon = document.getElementById("timer-settings-icon");
        if (icon) icon.remove();
        const modal = document.getElementById("timer-settings-modal");
        if (modal) modal.remove();
        clearInterval(this.interval);
    }

    insertClockInTitle() {
        const waitForTitleBar = setInterval(() => {
            const titleContainer = document.querySelector('[class^="title_"]');
            if (!titleContainer) return;

            if (!document.getElementById("realtime-clock")) {
                const clock = document.createElement("span");
                clock.id = "realtime-clock";
                Object.assign(clock.style, {
                    marginLeft: "10px",
                    padding: "6px 14px",
                    borderRadius: "10px",
                    background: "rgba(40, 40, 45, 0.75)",
                    backdropFilter: "blur(4px)",
                    border: "1px solid rgba(255, 255, 255, 0.05)",
                    color: "#e0e0e0",
                    fontSize: "13px",
                    fontWeight: "600",
                    fontFamily: "Consolas, monospace",
                    boxShadow: "0 2px 6px rgba(0, 0, 0, 0.4)",
                    userSelect: "none",
                    transition: "all 0.3s ease"
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

        clock.textContent = time;
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
                        marginLeft: "0px"
                    });
                    btn.onclick = () => this.openSettingsModal();
                    const controls = card.querySelector('[class*="bd-controls"]');
                    if (controls) controls.appendChild(btn);
                }
            });
        };

        inject();
        this.observerInterval = setInterval(() => {
            if (!document.querySelector("#timer-settings-icon")) inject();
        }, 2000);
    }

    openSettingsModal() {
        const modal = document.createElement("div");
        modal.id = "timer-settings-modal";
        Object.assign(modal.style, {
            position: "fixed",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            zIndex: "10000",
            background: "#1e1f22",
            color: "#fff",
            padding: "26px",
            borderRadius: "14px",
            width: "380px",
            boxShadow: "0 0 25px rgba(0, 0, 0, 0.7)",
            fontFamily: "Segoe UI, sans-serif",
            display: "flex",
            flexDirection: "column",
            gap: "18px",
            border: "1px solid rgba(255, 255, 255, 0.05)"
        });

        const title = document.createElement("div");
        title.innerHTML = "🕒 <strong style='font-size: 18px;'>Timer Settings</strong>";
        title.style.textAlign = "center";

        const checkbox = (id, label, checked) => {
            const wrapper = document.createElement("label");
            wrapper.style.display = "flex";
            wrapper.style.alignItems = "center";
            wrapper.style.gap = "12px";
            wrapper.style.fontSize = "15px";
            wrapper.style.cursor = "pointer";

            const box = document.createElement("div");
            box.id = id;
            box.className = "custom-checkbox";
            Object.assign(box.style, {
                width: "24px",
                height: "24px",
                borderRadius: "6px",
                border: "2px solid #5865F2",
                background: checked ? "#5865F2" : "transparent",
                color: "#fff",
                fontWeight: "bold",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "14px",
                transition: "all 0.2s ease",
                boxShadow: "inset 0 0 4px rgba(0,0,0,0.4)"
            });

            box.innerText = checked ? "✓" : "✕";

            box.onmouseenter = () => box.style.boxShadow = "0 0 6px #5865F2";
            box.onmouseleave = () => box.style.boxShadow = "inset 0 0 4px rgba(0,0,0,0.4)";

            box.onclick = () => {
                const isChecked = box.innerText === "✓";
                box.innerText = isChecked ? "✕" : "✓";
                box.style.background = isChecked ? "transparent" : "#5865F2";
                this.settings[id.replace("timer-", "")] = !isChecked;
            };

            const span = document.createElement("span");
            span.textContent = label;

            wrapper.appendChild(box);
            wrapper.appendChild(span);
            return wrapper;
        };

        const btnRow = document.createElement("div");
        btnRow.style.display = "flex";
        btnRow.style.justifyContent = "space-between";

        const saveBtn = document.createElement("button");
        saveBtn.textContent = "💾 Save";
        Object.assign(saveBtn.style, {
            background: "linear-gradient(to right, #4e5dff, #7289da)",
            border: "none",
            color: "#fff",
            padding: "10px 22px",
            borderRadius: "8px",
            fontWeight: "700",
            fontSize: "14px",
            cursor: "pointer",
            boxShadow: "0 2px 10px rgba(114,137,218,0.4)",
            transition: "all 0.2s ease"
        });

        const cancelBtn = document.createElement("button");
        cancelBtn.textContent = "Cancel";
        Object.assign(cancelBtn.style, {
            background: "transparent",
            border: "1px solid #72767d",
            color: "#b9bbbe",
            fontWeight: "500",
            fontSize: "14px",
            borderRadius: "8px",
            padding: "10px 22px",
            cursor: "pointer",
            transition: "all 0.2s ease"
        });

        modal.appendChild(title);
        modal.appendChild(checkbox("timer-enabled", "Enable Clock", this.settings.enabled));
        modal.appendChild(checkbox("timer-24h", "Use 24-Hour Format", this.settings.use24h));
        modal.appendChild(checkbox("timer-seconds", "Show Seconds", this.settings.showSeconds));
        btnRow.appendChild(saveBtn);
        btnRow.appendChild(cancelBtn);
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
