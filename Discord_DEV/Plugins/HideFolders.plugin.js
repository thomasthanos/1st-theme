/**
 * @name HideFolders
 * @author ThomasT
 * @version 1.4.0
 * @description Κρύβει τον wrapper με πολλαπλά folder IDs μέσω BetterDiscord Settings, με πιο compact Material‑style UI.
 * @source https://github.com/thomasthanos/1st-theme/blob/main/Discord_DEV/Plugins/autoreadtrash.plugin.js
 * @updateUrl https://thomasthanos.github.io/1st-theme/Discord_DEV/Plugins/autoreadtrash.plugin.js
 */

const config = {
    info: {
        name: "HideFolders",
        authors: [{ name: "YourName" }],
        version: "1.4.0",
        description: "Κρύβει τον wrapper με class wrapper_cc5dd2 που περιέχει folder IDs (χωρισμένα με κόμμα).",
        source: "https://github.com/thomasthanos/1st-theme/blob/main/Discord_DEV/Plugins/autoreadtrash.plugin.js",
        updateUrl: "https://thomasthanos.github.io/1st-theme/Discord_DEV/Plugins/autoreadtrash.plugin.js",
    },
    defaultConfig: []
};

module.exports = class HideFolders {
    constructor() {
        this._config = config;
    }

    getSettingsPanel() {
        return this.generateSettingsPanel();
    }

    start() {
        this.hideWrappers();
    }

    stop() {
        this.showWrappers();
    }

    getConfigIds() {
        const raw = BdApi.getData("HideFolders", "folderIds") || "";
        return raw.split(",").map(id => id.trim()).filter(Boolean);
    }

    hideWrappers() {
        this.getConfigIds().forEach(id => {
            const elm = document.querySelector(`[data-list-item-id="${id}"]`);
            const wrapper = elm?.closest(".wrapper_cc5dd2");
            if (wrapper) wrapper.style.display = "none";
        });
    }

    showWrappers() {
        this.getConfigIds().forEach(id => {
            const elm = document.querySelector(`[data-list-item-id="${id}"]`);
            const wrapper = elm?.closest(".wrapper_cc5dd2");
            if (wrapper) wrapper.style.display = "";
        });
    }

    generateSettingsPanel() {
        const container = document.createElement("div");
        Object.assign(container.style, {
            display: "flex",
            flexDirection: "column",
            padding: "16px",
            margin: "12px auto",
            backgroundColor: "var(--background-secondary)",
            borderRadius: "6px",
            boxShadow: "0 1px 4px rgba(0,0,0,0.2)",
            fontFamily: "var(--font-primary)",
            color: "var(--text-normal)",
            width: "100%",
            maxWidth: "520px",
            boxSizing: "border-box"
        });

        // Modern, centered label
        const label = document.createElement("label");
        label.textContent = "Folder IDs (διαχωρισμένα με κόμμα)";
        Object.assign(label.style, {
            fontSize: "0.875rem",
            textTransform: "uppercase",
            letterSpacing: "1px",
            color: "var(--interactive-accent)",
            margin: "0 auto 8px",
            textAlign: "center",
            width: "100%"
        });

        // Textarea
        const textarea = document.createElement("textarea");
        textarea.value = BdApi.getData("HideFolders", "folderIds") || "";
        textarea.placeholder = "π.χ. guildsnav___123, guildsnav___456";
        Object.assign(textarea.style, {
            width: "100%",
            boxSizing: "border-box",
            minHeight: "120px",
            padding: "12px",
            border: "1px solid var(--background-modifier-accent)",
            borderRadius: "4px",
            backgroundColor: "var(--background-tertiary)",
            color: "var(--text-normal)",
            fontSize: "0.9375rem",
            resize: "vertical",
            outline: "none",
            transition: "border-color .2s ease, box-shadow .2s ease"
        });
        textarea.onfocus = () => {
            textarea.style.borderColor = "var(--interactive-accent)";
            textarea.style.boxShadow = "0 0 0 1.5px rgba(64,32,224,0.2)";
        };
        textarea.onblur = () => {
            textarea.style.borderColor = "var(--background-modifier-accent)";
            textarea.style.boxShadow = "none";
        };
        textarea.oninput = () => {
            BdApi.setData("HideFolders", "folderIds", textarea.value);
            this.showWrappers();
            setTimeout(() => this.hideWrappers(), 100);
        };

        container.appendChild(label);
        container.appendChild(textarea);

        // Button row
        const btnRow = document.createElement("div");
        Object.assign(btnRow.style, {
            display: "flex",
            justifyContent: "flex-end",
            marginTop: "16px"
        });

        // Enhanced Clear button
        const clearBtn = document.createElement("button");
        clearBtn.innerText = "Clear IDs";
        Object.assign(clearBtn.style, {
            padding: "8px 16px",
            fontSize: "0.75rem",
            fontWeight: "500",
            textTransform: "uppercase",
            letterSpacing: "1px",
            border: "none",
            borderRadius: "4px",
            backgroundColor: "var(--background-modifier-accent)",
            color: "var(--text-normal)",
            boxShadow: "0 2px 4px rgba(0,0,0,0.3)",
            cursor: "pointer",
            transition: "background-color 0.2s ease, box-shadow 0.2s ease"
        });
        clearBtn.onmouseover = () => {
            clearBtn.style.backgroundColor = "var(--background-modifier-hover)";
            clearBtn.style.boxShadow = "0 4px 8px rgba(0,0,0,0.4)";
        };
        clearBtn.onmouseout = () => {
            clearBtn.style.backgroundColor = "var(--background-modifier-accent)";
            clearBtn.style.boxShadow = "0 2px 4px rgba(0,0,0,0.3)";
        };
        clearBtn.onclick = () => {
            // Καθαρισμός IDs και επανεκκίνηση plugin για reset των hidden wrappers
            textarea.value = "";
            BdApi.setData("HideFolders", "folderIds", "");
            // Reload plugin to reset display states
            BdApi.Plugins.reload(config.info.name);
        };

        btnRow.appendChild(clearBtn);
        container.appendChild(btnRow);

        return container;
    }
};
