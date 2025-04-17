/**
 * @name HideFolderById
 * @author ThomasT
 * @version 1.3.0
 * @description Κρύβει το wrapper που περιέχει πολλαπλά folder IDs μέσω BetterDiscord Settings, με βελτιωμένο UI.
 */

const config = {
    info: {
        name: "HideFolderById",
        authors: [{ name: "YourName" }],
        version: "1.3.0",
        description: "Κρύβει το wrapper με class wrapper_cc5dd2 που περιέχει folder IDs (χωρισμένα με κόμμα)."
    },
    defaultConfig: []
};

module.exports = class HideFolderById {
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
        const raw = BdApi.getData("HideFolderById", "folderIds") || "";
        return raw
            .split(",")
            .map(id => id.trim())
            .filter(id => id.length > 0);
    }

    hideWrappers() {
        const ids = this.getConfigIds();
        ids.forEach(folderId => {
            const target = document.querySelector(`[data-list-item-id="${folderId}"]`);
            if (target) {
                const wrapper = target.closest(".wrapper_cc5dd2");
                if (wrapper) {
                    wrapper.style.display = "none";
                }
            }
        });
    }

    showWrappers() {
        const ids = this.getConfigIds();
        ids.forEach(folderId => {
            const target = document.querySelector(`[data-list-item-id="${folderId}"]`);
            if (target) {
                const wrapper = target.closest(".wrapper_cc5dd2");
                if (wrapper) {
                    wrapper.style.display = "";
                }
            }
        });
    }

    generateSettingsPanel() {
        const container = document.createElement("div");
        container.style.padding = "10px";
        container.style.fontFamily = "var(--font-primary)";
        container.style.color = "var(--header-primary)";

        const title = document.createElement("h2");
        title.textContent = "Hide Folder by ID";
        title.style.marginBottom = "10px";

        const subtitle = document.createElement("p");
        subtitle.textContent = "Βάλε τα folder IDs (π.χ. guildsnav___...) χωρισμένα με κόμμα:";
        subtitle.style.fontSize = "14px";
        subtitle.style.marginBottom = "10px";

        const textarea = document.createElement("textarea");
        textarea.value = BdApi.getData("HideFolderById", "folderIds") || "";
        textarea.style.width = "100%";
        textarea.style.height = "80px";
        textarea.style.resize = "vertical";
        textarea.style.padding = "8px";
        textarea.style.borderRadius = "6px";
        textarea.style.border = "1px solid var(--background-modifier-accent)";
        textarea.style.backgroundColor = "var(--background-secondary)";
        textarea.style.color = "var(--text-normal)";
        textarea.oninput = () => {
            BdApi.setData("HideFolderById", "folderIds", textarea.value);
            this.showWrappers();
            setTimeout(() => this.hideWrappers(), 100);
        };

        const clearButton = document.createElement("button");
        clearButton.textContent = "Clear IDs";
        clearButton.style.marginTop = "10px";
        clearButton.style.padding = "5px 10px";
        clearButton.style.backgroundColor = "var(--button-secondary-background)";
        clearButton.style.color = "var(--button-secondary-text)";
        clearButton.style.border = "none";
        clearButton.style.borderRadius = "4px";
        clearButton.style.cursor = "pointer";
        clearButton.onclick = () => {
            textarea.value = "";
            BdApi.setData("HideFolderById", "folderIds", "");
            this.showWrappers();
        };

        container.appendChild(title);
        container.appendChild(subtitle);
        container.appendChild(textarea);
        container.appendChild(clearButton);

        return container;
    }
};
