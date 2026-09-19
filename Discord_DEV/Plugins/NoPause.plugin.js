/**
 * @name NoPause for Quests
 * @description Prevents Discord from pausing Quest videos when you alt-tab or lose focus, and lets you watch mobile-only Quest videos in the desktop client
 * @version 2.3.1
 * @author ThomasT
 * @authorId 706932839907852389
 * @source https://github.com/thomasthanos/1st-theme/blob/main/Discord_DEV/Plugins/NoPause.plugin.js
 * @updateUrl https://raw.githubusercontent.com/thomasthanos/1st-theme/main/Discord_DEV/Plugins/NoPause.plugin.js
 * @website https://github.com/thomasthanos
 */

const PLUGIN_NAME = "NoPause for Quests";
const PLUGIN_VERSION = "2.3.0";
const LOG_PREFIX = "[NoPause for Quests]";
const MQ_PREFIX = "[NoPause for Quests][MobileQuest]";
const REWARD_PREFIX = "[NoPause for Quests][Reward]";

// Global symbols (Symbol.for): ένα νέο instance (reload/update του plugin) βρίσκει ό,τι άφησε
// ένα παλιό instance και το καθαρίζει -> όχι διπλά patches / listeners.
const RUNTIME_KEY = Symbol.for("NoPauseForQuests.runtime");
const VIDEO_STATE = Symbol.for("NoPauseForQuests.videoState");
const MODAL_WRAPPER = Symbol.for("NoPauseForQuests.videoQuestModalWrapper");

// ---------------------------------------------------------------------------------------------
// NoPause
// ---------------------------------------------------------------------------------------------
const USER_ACTION_WINDOW_MS = 400;
// Όσο υπάρχει Quest video ελέγχουμε κάθε 200ms, αλλιώς μόνο κάθε 1s (ελάχιστο κόστος).
const SCAN_ACTIVE_MS = 200;
const SCAN_IDLE_MS = 1000;
const NEGATIVE_DETECTION_TTL_MS = 2000;
const BLOCKED_PAUSE_LOG_INTERVAL_MS = 30000;
// Αν το Discord ξανακάνει pause συνεχώς, σταματάμε προσωρινά το auto-resume (όχι "πάλη" με τον player).
const RESUME_LIMIT = 5;
const RESUME_WINDOW_MS = 10000;
const FIBER_SEARCH_DEPTH = 150;
// Πλήκτρα με τα οποία ο χρήστης σταματά/κλείνει το video. Modifiers (Alt/Ctrl/Meta) αγνοούνται,
// ώστε το Alt+Tab να μη μετράει ποτέ ως "manual pause".
const USER_PAUSE_KEYS = new Set([" ", "Spacebar", "k", "K", "Enter", "Escape", "MediaPlayPause", "MediaPause", "MediaStop"]);
const QUEST_CDN_PATH = /\/quests\//i;

// ---------------------------------------------------------------------------------------------
// Mobile Quest desktop playback
// ---------------------------------------------------------------------------------------------
// Ονόματα tasks όπως τα στέλνει το Discord API (taskConfigV2.tasks).
const TASK_DESKTOP_VIDEO = "WATCH_VIDEO";
const TASK_MOBILE_VIDEO = "WATCH_VIDEO_ON_MOBILE";
// Stable anchors στον κώδικα του Discord (strings που δεν είναι minified).
const ANCHOR_QUEST_UTILS = ["_getTaskDetailsForType"];
const ANCHOR_ASSET_RESOLVER = ["video_player_video_low_res"];
const ANCHOR_QUEST_ACTIONS = ["QUEST_VIDEO_ENROLLMENT_RETRY_ATTEMPTED", "openModalLazy"];
const ANCHOR_PLAYER_FOCUS_HOOK = ["focusedChanged", "isFocused()"];
const questVideoModalKey = questId => `VIDEO-QUEST-${questId}`;
const SESSION_LOG_INTERVAL_MS = 15000;
const NO_SERVER_PROGRESS_WARN_MS = 45000;
const MODULE_WAIT_WARN_MS = 20000;

// Σχήματα πηγαίου κώδικα για τον εντοπισμό των minified exports.
const PREDICATE_SHAPE = /^(?:function\s*[\w$]*\s*\(\s*[\w$]+\s*\)\s*\{\s*return\b[^;]*\}|\(?\s*[\w$]+\s*\)?\s*=>\s*(?!\{)[^;]*)$/;
const COMBINATOR_SHAPE = /(?:return|=>)\s*!?\s*[\w$.]+\(\s*[\w$]+\s*\)\s*&&\s*!\s*[\w$.]+\(\s*[\w$]+\s*\)\s*\}?$/;
const ASSIGNMENT = /[^=!<>]=(?!=)/;
const QR_OPENER_SHAPE = /\{\s*\.\.\.[\w$]+\s*,\s*questId\s*:\s*[\w$]+\.id\s*\}/;
const LAZY_LOADER_SHAPE = /^(?:function\s*[\w$]*\s*\(\s*\)\s*\{\s*return\s+|\(\s*\)\s*=>\s*)(?:Promise\.all\(\[[^\]]*\]\)|[\w$]+\.e\([^)]*\))\.then\(\s*[\w$]+\.bind\(\s*[\w$]+\s*,\s*\d+\s*\)\s*\)\s*;?\s*\}?$/;

function safeGet(object, key) {
    try { return object[key]; } catch (err) { return undefined; }
}

function functionSource(fn) {
    try { return Function.prototype.toString.call(fn); } catch (err) { return ""; }
}

// Αν κάποιο άλλο plugin έχει κάνει patch ένα export με BdApi.Patcher, κοιτάμε την αρχική συνάρτηση.
function unwrapPatched(fn) {
    return typeof fn?.__originalFunction === "function" ? fn.__originalFunction : fn;
}

function safeJson(value, max = 500) {
    try {
        const text = JSON.stringify(value);
        if (typeof text !== "string") return String(value);
        return text.length > max ? `${text.slice(0, max)}...` : text;
    } catch (err) {
        return String(value);
    }
}

function describeApiError(error) {
    if (error == null) return "no error details";
    if (Array.isArray(error)) return error.length ? `errors=${safeJson(error)}` : "empty error list";
    if (typeof error !== "object") return String(error);
    const parts = [];
    if (error.status != null) parts.push(`status=${error.status}`);
    if (error.code != null && error.code !== -1) parts.push(`code=${error.code}`);
    if (error.message) parts.push(`message="${error.message}"`);
    if (error.fields && typeof error.fields === "object" && Object.keys(error.fields).length) parts.push(`fields=${safeJson(error.fields)}`);
    if (error.body != null) parts.push(`body=${safeJson(error.body)}`);
    return parts.length ? parts.join(", ") : safeJson(error);
}

function getQuestTasks(quest) {
    const tasks = quest?.config?.taskConfigV2?.tasks;
    return tasks && typeof tasks === "object" ? tasks : null;
}

function describeVideoAssets(task) {
    const assets = task?.assets;
    if (!assets) return "none";
    const kinds = [];
    if (typeof assets.videoHls?.url === "string" && assets.videoHls.url) kinds.push("hls");
    if (typeof assets.video?.url === "string" && assets.video.url) kinds.push("mp4");
    if (typeof assets.videoLowRes?.url === "string" && assets.videoLowRes.url) kinds.push("mp4-low");
    return kinds.length ? kinds.join("+") : "none";
}

function describeRewards(quest) {
    const rewards = quest?.config?.rewardsConfig?.rewards;
    if (!Array.isArray(rewards) || !rewards.length) return "unknown reward";
    return rewards.map(reward => reward?.messages?.name ?? `reward type ${reward?.type}`).join(", ");
}

// Ίδιος ορισμός με το Discord: υπάρχει WATCH_VIDEO_ON_MOBILE task και ΔΕΝ υπάρχει WATCH_VIDEO task.
function isMobileOnlyVideoQuest(quest) {
    const tasks = getQuestTasks(quest);
    return !!tasks && tasks[TASK_MOBILE_VIDEO] != null && tasks[TASK_DESKTOP_VIDEO] == null;
}

function isDesktopPlayableMobileQuest(quest) {
    if (!quest || typeof quest !== "object" || quest.preview === true) return false;
    if (!isMobileOnlyVideoQuest(quest)) return false;
    return describeVideoAssets(getQuestTasks(quest)[TASK_MOBILE_VIDEO]) !== "none";
}

// Το config object ενός quest μένει ίδιο όταν αλλάζει μόνο το userStatus -> cache ανά config.
const expiryCache = new WeakMap();
function isQuestExpired(quest, now = Date.now()) {
    const config = quest?.config;
    if (!config || typeof config !== "object") return false;
    let expiresAt = expiryCache.get(config);
    if (expiresAt === undefined) {
        expiresAt = config.expiresAt ? new Date(config.expiresAt).valueOf() : NaN;
        expiryCache.set(config, expiresAt);
    }
    return isFinite(expiresAt) && expiresAt <= now;
}

function questLabel(quest, questId) {
    const name = quest?.config?.messages?.questName;
    return name ? `"${String(name).trim()}" (${questId ?? quest?.id})` : `${questId ?? quest?.id}`;
}

function serverProgressSeconds(quest) {
    const value = quest?.userStatus?.progress?.[TASK_MOBILE_VIDEO]?.value;
    return typeof value === "number" ? value : 0;
}

function formatSeconds(value) {
    return typeof value === "number" && isFinite(value) ? `${Math.round(value * 10) / 10}s` : "n/a";
}

// Το desktop VideoQuestModal του Discord διαβάζει ΜΟΝΟ το tasks.WATCH_VIDEO
// ("VideoQuestModal: videoTask must not be null"). Για mobile-only quests δίνουμε στο modal μια
// "όψη" του ΠΡΑΓΜΑΤΙΚΟΥ quest όπου το WATCH_VIDEO δείχνει στο ίδιο ακριβώς WATCH_VIDEO_ON_MOBILE
// task object (ίδιο id, userStatus, video assets, target και task type). Δεν δημιουργείται νέο quest
// και δεν αλλάζει τίποτα στο QuestStore. Το claim του reward διαβάζει πάντα το quest από το QuestStore.
const desktopViewCache = new WeakMap();
function buildDesktopQuestView(quest) {
    if (!isDesktopPlayableMobileQuest(quest)) return null;
    let view = desktopViewCache.get(quest);
    if (view) return view;
    const taskConfig = quest.config.taskConfigV2;
    const mobileTask = taskConfig.tasks[TASK_MOBILE_VIDEO];
    view = {
        ...quest,
        config: {
            ...quest.config,
            taskConfigV2: {
                ...taskConfig,
                tasks: { ...taskConfig.tasks, [TASK_DESKTOP_VIDEO]: mobileTask }
            }
        }
    };
    desktopViewCache.set(quest, view);
    return view;
}

function isVideoQuestModalExports(exportsObject) {
    return !!exportsObject && typeof exportsObject === "object"
        && Object.prototype.hasOwnProperty.call(exportsObject, "VideoQuestModalContext")
        && Object.prototype.hasOwnProperty.call(exportsObject, "VideoQuestConfigContext");
}

// Βρίσκει μέσα στο quest utils module του Discord τα δύο predicates που αποφασίζουν το mobile-only
// routing, με βάση τη ΣΥΜΠΕΡΙΦΟΡΑ τους και όχι τα minified ονόματα. Καλούνται μόνο μικρές pure
// συναρτήσεις ενός expression, με συνθετικά αντικείμενα που έχουν μόνο taskConfigV2.tasks.
function probeQuestPredicates(exportsObject) {
    const sample = tasks => ({ id: "0", preview: false, userStatus: null, config: { taskConfigV2: { tasks } } });
    const samples = {
        mobile: sample({ [TASK_MOBILE_VIDEO]: {} }),
        desktop: sample({ [TASK_DESKTOP_VIDEO]: {} }),
        both: sample({ [TASK_DESKTOP_VIDEO]: {}, [TASK_MOBILE_VIDEO]: {} }),
        none: sample({ PLAY_ON_DESKTOP: {} })
    };
    const found = { mobileOnly: [], desktopVideo: [] };
    for (const key of Object.keys(exportsObject)) {
        const fn = unwrapPatched(safeGet(exportsObject, key));
        if (typeof fn !== "function" || fn.length !== 1) continue;
        const source = functionSource(fn);
        if (!source || source.length > 400 || !PREDICATE_SHAPE.test(source)) continue;
        if (ASSIGNMENT.test(source.replace(/=>/g, " "))) continue;
        if (!source.includes("taskConfigV2") && !COMBINATOR_SHAPE.test(source)) continue;
        const result = {};
        for (const [name, quest] of Object.entries(samples)) {
            try { result[name] = fn(quest); } catch (err) { result[name] = undefined; }
        }
        if (result.mobile === true && result.desktop === false && result.both === false && result.none === false) {
            found.mobileOnly.push(key);
        } else if (result.desktop === true && result.both === true && result.mobile === false && result.none === false) {
            found.desktopVideo.push(key);
        }
    }
    return found;
}

// Wrapper για το default export του VideoQuestModal. Είναι αυτόνομο (δεν εξαρτάται από το αν το
// plugin τρέχει), ώστε ένα ήδη ανοιχτό modal να μη σπάσει ποτέ στη μέση. Ειδοποιεί επίσης το
// NoPause όταν ανοίγει/κλείνει οποιοδήποτε Quest video modal (desktop ή mobile quest).
function createVideoQuestModalWrapper(Original, bridge, QuestStore) {
    const React = BdApi.React;
    const useStateFromStores = typeof BdApi.Hooks?.useStateFromStores === "function" ? BdApi.Hooks.useStateFromStores : null;

    const useQuestFromStore = useStateFromStores
        ? questId => useStateFromStores([QuestStore], () => (questId != null ? QuestStore.getQuest(questId) ?? null : null), [questId])
        : questId => {
            const [, forceUpdate] = React.useReducer(value => value + 1, 0);
            React.useEffect(() => {
                const listener = () => forceUpdate();
                QuestStore.addChangeListener(listener);
                return () => QuestStore.removeChangeListener(listener);
            }, []);
            return questId != null ? QuestStore.getQuest(questId) ?? null : null;
        };

    function NoPauseQuestVideoModal(props) {
        const questId = props?.questId;
        const hasOverride = props?.overrideQuest != null;
        // Live από το QuestStore: progress/completion του πραγματικού quest ενημερώνονται κανονικά.
        const storeQuest = useQuestFromStore(questId);
        const view = React.useMemo(
            () => (hasOverride || storeQuest == null ? null : buildDesktopQuestView(storeQuest)),
            [hasOverride, storeQuest]
        );
        const usesDesktopView = view != null;
        React.useEffect(() => {
            const token = {};
            bridge.target?.onVideoModalMounted(token, questId);
            return () => bridge.target?.onVideoModalUnmounted(token);
        }, [questId]);
        React.useEffect(() => {
            if (!usesDesktopView) return undefined;
            bridge.target?.onDesktopSessionOpened(questId);
            return () => bridge.target?.onDesktopSessionClosed(questId);
        }, [usesDesktopView, questId]);
        // overrideQuest είναι υπάρχον prop του VideoQuestModal του Discord.
        return React.createElement(Original, usesDesktopView ? { ...props, overrideQuest: view } : props);
    }

    NoPauseQuestVideoModal.displayName = "NoPauseQuestVideoModal";
    NoPauseQuestVideoModal[MODAL_WRAPPER] = { original: Original };
    return NoPauseQuestVideoModal;
}

class MobileQuestDesktopPlayback {
    constructor() {
        this.bridge = { target: null };
        // Callbacks προς το NoPause (Quest video modal άνοιξε/έκλεισε).
        this.onVideoModalMount = null;
        this.onVideoModalUnmount = null;
        // Quests που ολοκληρώθηκαν με τον desktop player σε αυτή τη συνεδρία (για τα reward logs).
        this.completedViaDesktop = new Set();
        this.resetState();
    }

    resetState() {
        this.active = false;
        this.disabledReason = null;
        this.QuestStore = null;
        this.ModalActions = null;
        this.questUtils = null;
        this.mobileOnlyKey = null;
        this.desktopVideoKey = null;
        this.assetModule = null;
        this.assetResolverKey = null;
        this.questActions = null;
        this.openVideoKey = null;
        this.openQrKey = null;
        this.loaderKey = null;
        this.modalExports = null;
        this.modalOriginal = null;
        this.modalWrapper = null;
        this.modalReady = false;
        this.readinessLogged = false;
        this.preloadState = "idle";
        this.abortController = null;
        this.timers = new Set();
        this.unpatches = [];
        this.storeListener = null;
        this.lastQuestsRef = null;
        this.lastScanSummary = null;
        this.mobileQuestCount = 0;
        this.hasUnlockableQuests = false;
        this.announcedQuests = new Set();
        this.sessions = new Map();
        this.lastErrorLogAt = 0;
    }

    log(...args) { console.log(MQ_PREFIX, ...args); }
    warn(...args) { console.warn(MQ_PREFIX, ...args); }
    error(...args) { console.error(MQ_PREFIX, ...args); }

    errorThrottled(message, err) {
        const now = Date.now();
        if (now - this.lastErrorLogAt < 10000) return;
        this.lastErrorLogAt = now;
        this.error(message, err);
    }

    start() {
        this.stop(true);
        this.resetState();

        const api = globalThis.BdApi;
        if (!api?.Webpack || !api?.Patcher || !api?.React) {
            this.disable("BdApi.Webpack / Patcher / React δεν είναι διαθέσιμα σε αυτή την έκδοση του BetterDiscord");
            return;
        }

        this.QuestStore = this.tryFind(() => api.Webpack.getStore("QuestStore"));
        if (!this.QuestStore?.getQuest || !this.QuestStore?.addChangeListener) {
            this.disable("Δεν βρέθηκε το QuestStore του Discord");
            return;
        }

        this.active = true;
        this.bridge.target = this;
        this.abortController = new AbortController();
        this.ModalActions = this.tryFind(() => api.Webpack.getByKeys("openModalLazy", "closeModal", "hasModalOpen"));

        this.storeListener = () => this.onQuestStoreChange();
        this.QuestStore.addChangeListener(this.storeListener);
        this.onQuestStoreChange();

        this.setupVideoQuestModal();
        this.whenModule("quest utils", api.Webpack.Filters.bySource(...ANCHOR_QUEST_UTILS), exportsObject => this.attachQuestUtils(exportsObject));
        this.whenModule("quest asset resolver", api.Webpack.Filters.bySource(...ANCHOR_ASSET_RESOLVER), exportsObject => this.attachAssetResolver(exportsObject));
        this.whenModule("quest actions", api.Webpack.Filters.bySource(...ANCHOR_QUEST_ACTIONS), exportsObject => this.attachQuestActions(exportsObject));
    }

    stop(quiet = false) {
        const wasActive = this.active;
        this.active = false;
        if (this.bridge.target === this) this.bridge.target = null;

        try { this.abortController?.abort(); } catch (err) { /* noop */ }
        this.abortController = null;
        for (const timer of this.timers) clearTimeout(timer);
        this.timers.clear();

        if (this.storeListener && this.QuestStore?.removeChangeListener) {
            try { this.QuestStore.removeChangeListener(this.storeListener); } catch (err) { this.error("removeChangeListener failed", err); }
        }
        this.storeListener = null;

        // Κλείνει ανοιχτό desktop player mobile quest (όσο το modal μας είναι ακόμα σε ισχύ).
        this.closeDesktopSessions(quiet);

        for (const unpatch of this.unpatches.splice(0)) {
            try { unpatch(); } catch (err) { this.error("unpatch failed", err); }
        }

        this.restoreVideoQuestModal();
        this.modalReady = false;
        this.sessions.clear();
        if (wasActive && !quiet) this.log("Stopped - all Mobile Quest patches removed");
    }

    disable(reason) {
        this.disabledReason = reason;
        this.active = false;
        this.warn(`Disabled: ${reason}. Το NoPause για Quest videos συνεχίζει κανονικά.`);
    }

    tryFind(fn) {
        try { return fn() ?? null; } catch (err) { return null; }
    }

    addTimer(fn, delay) {
        const timer = setTimeout(() => { this.timers.delete(timer); fn(); }, delay);
        this.timers.add(timer);
        return timer;
    }

    whenModule(label, filter, onFound) {
        if (!this.active || !this.abortController) return;
        const found = this.tryFind(() => BdApi.Webpack.getModule(filter));
        if (found) {
            this.runAttach(label, onFound, found);
            return;
        }
        this.log(`Waiting for Discord's ${label} module...`);
        const warnTimer = this.addTimer(() => {
            if (this.active) this.warn(`Discord's ${label} module has not appeared after ${MODULE_WAIT_WARN_MS / 1000}s (anchor: ${safeJson(filter.searches ?? "?")}). Πιθανή αλλαγή από Discord update.`);
        }, MODULE_WAIT_WARN_MS);
        BdApi.Webpack.waitForModule(filter, { signal: this.abortController.signal })
            .then(exportsObject => {
                clearTimeout(warnTimer);
                this.timers.delete(warnTimer);
                if (exportsObject && this.active) this.runAttach(label, onFound, exportsObject);
            })
            .catch(err => { if (this.active) this.error(`waitForModule(${label}) failed`, err); });
    }

    runAttach(label, onFound, exportsObject) {
        if (!this.active) return;
        try { onFound(exportsObject); } catch (err) { this.error(`Could not attach to ${label}`, err); }
    }

    // --- Discord internals -----------------------------------------------------------------

    attachQuestUtils(exportsObject) {
        const probe = probeQuestPredicates(exportsObject);
        if (probe.mobileOnly.length !== 1 || probe.desktopVideo.length !== 1) {
            this.disable(`Τα quest predicates δεν αναγνωρίστηκαν με βεβαιότητα (mobileOnly=[${probe.mobileOnly}], hasDesktopVideo=[${probe.desktopVideo}])`);
            this.stop(true);
            return;
        }
        const [mobileOnlyKey] = probe.mobileOnly;
        const [desktopVideoKey] = probe.desktopVideo;

        // isMobileOnlyVideoQuest(quest): true -> "Watch on mobile" + QR modal.
        // Για quests που μπορούν να παιχτούν εδώ επιστρέφει false, οπότε το Discord ακολουθεί το
        // κανονικό desktop video flow (κείμενα, icon, άνοιγμα VideoQuestModal).
        this.unpatches.push(BdApi.Patcher.after(PLUGIN_NAME, exportsObject, mobileOnlyKey, (_, args, result) =>
            (result === true && this.canPlayOnDesktop(args[0]) ? false : result)));
        // hasWatchVideoTask(quest): το Quest Home tile/header ανοίγει το video μόνο αν υπάρχει WATCH_VIDEO.
        this.unpatches.push(BdApi.Patcher.after(PLUGIN_NAME, exportsObject, desktopVideoKey, (_, args, result) =>
            (result !== true && this.canPlayOnDesktop(args[0]) ? true : result)));

        if (typeof exportsObject[mobileOnlyKey]?.__originalFunction !== "function" || typeof exportsObject[desktopVideoKey]?.__originalFunction !== "function") {
            this.disable("Τα webpack exports του Discord δεν είναι patchable σε αυτή την έκδοση του BetterDiscord");
            this.stop(true);
            return;
        }

        this.questUtils = exportsObject;
        this.mobileOnlyKey = mobileOnlyKey;
        this.desktopVideoKey = desktopVideoKey;
        this.log(`Quest utils ready: isMobileOnlyVideoQuest="${mobileOnlyKey}", hasWatchVideoTask="${desktopVideoKey}"`);
        this.reportReadiness();
    }

    attachAssetResolver(exportsObject) {
        const key = Object.keys(exportsObject).find(candidate => {
            const fn = unwrapPatched(safeGet(exportsObject, candidate));
            if (typeof fn !== "function" || fn.length < 4) return false;
            const source = functionSource(fn);
            return source.includes(TASK_MOBILE_VIDEO) && source.includes("video_player");
        });
        if (!key) {
            this.warn("Quest asset resolver not found - thumbnails εκτός του player μπορεί να λείπουν (η αναπαραγωγή δεν επηρεάζεται)");
            return;
        }
        // resolveQuestAsset(quest, assetKey, theme, useMobileVideoTask, ...): στο desktop ζητείται
        // πάντα useMobileVideoTask=false -> null για mobile-only quests. Μόνο τότε ξαναρωτάμε για
        // τα assets του πραγματικού WATCH_VIDEO_ON_MOBILE task.
        this.unpatches.push(BdApi.Patcher.instead(PLUGIN_NAME, exportsObject, key, (that, args, original) => {
            const result = original.apply(that, args);
            if (result != null) return result;
            const assetKey = args[1];
            if (args[3] || typeof assetKey !== "string" || !assetKey.startsWith("video_player_") || !this.canPlayOnDesktop(args[0])) return result;
            const mobileArgs = Array.from(args);
            mobileArgs[3] = true;
            return original.apply(that, mobileArgs);
        }));
        this.assetModule = exportsObject;
        this.assetResolverKey = key;
        this.log(`Quest asset resolver ready: "${key}"`);
    }

    attachQuestActions(exportsObject) {
        const functions = Object.keys(exportsObject)
            .map(key => [key, unwrapPatched(safeGet(exportsObject, key))])
            .filter(([, fn]) => typeof fn === "function");

        const videoOpeners = functions.filter(([, fn]) => {
            const source = functionSource(fn);
            return source.includes("videoSessionId") && source.includes("openModalLazy");
        });
        const openVideo = videoOpeners.length === 1 ? videoOpeners[0] : null;
        const openVideoSource = openVideo ? functionSource(openVideo[1]) : "";

        // Το openVideoQuestModal του Discord κάνει: if (isMobileOnly(quest)) return void openQrModal(quest)
        const bounceName = /return\s+void\s+([\w$]+)\(\s*[\w$]+\s*\)/.exec(openVideoSource)?.[1] ?? null;
        let qrOpeners = functions.filter(([, fn]) => fn.length === 1 && QR_OPENER_SHAPE.test(functionSource(fn)) && functionSource(fn).includes("openModalLazy"));
        if (qrOpeners.length > 1 && bounceName) qrOpeners = qrOpeners.filter(([, fn]) => fn.name === bounceName);
        const openQr = qrOpeners.length === 1 && (!bounceName || qrOpeners[0][1].name === bounceName) ? qrOpeners[0] : null;

        let loaders = functions.filter(([, fn]) => fn.length === 0 && LAZY_LOADER_SHAPE.test(functionSource(fn)));
        if (loaders.length > 1) {
            const awaited = /await\s*\(?\s*([\w$]+)\(\s*\)/.exec(openVideoSource)?.[1];
            loaders = loaders.filter(([, fn]) => fn.name === awaited);
        }
        const loader = loaders.length === 1 ? loaders[0] : null;

        this.questActions = exportsObject;
        this.openVideoKey = openVideo?.[0] ?? null;
        this.openQrKey = openQr?.[0] ?? null;
        this.loaderKey = loader?.[0] ?? null;
        this.log(`Quest actions: openVideoQuestModal=${this.openVideoKey ? `"${this.openVideoKey}"` : "NOT FOUND"}, openMobileHandoffModal=${this.openQrKey ? `"${this.openQrKey}"` : "NOT FOUND"}, videoModalLoader=${this.loaderKey ? `"${this.loaderKey}"` : "NOT FOUND"}`);

        // Δίχτυ ασφαλείας: handlers που δημιουργήθηκαν πριν ενεργοποιηθεί το plugin και καλούν
        // κατευθείαν το "Continue on your phone" (QR) modal ανοίγουν τον desktop player.
        if (this.openQrKey && this.openVideoKey) {
            const openVideoKey = this.openVideoKey;
            this.unpatches.push(BdApi.Patcher.instead(PLUGIN_NAME, exportsObject, this.openQrKey, (that, args, original) => {
                const quest = args[0];
                if (this.canPlayOnDesktop(quest)) {
                    const openVideoQuestModal = exportsObject[openVideoKey];
                    if (typeof openVideoQuestModal === "function") {
                        try {
                            this.log(`Mobile handoff (QR) requested for quest ${questLabel(quest)} -> opening Discord's desktop video player instead`);
                            openVideoQuestModal({ quest });
                            return undefined;
                        } catch (err) {
                            this.error("Could not open the desktop video player, falling back to Discord's QR modal", err);
                        }
                    }
                }
                return original.apply(that, args);
            }));
        } else {
            this.warn("QR handoff redirect not installed (δεν επηρεάζει τα κουμπιά που ξανασχεδιάζονται μετά την ενεργοποίηση)");
        }

        if (!this.loaderKey && !this.modalReady) {
            this.warn("Video quest player loader not found: ο desktop player θα ενεργοποιηθεί μόλις το Discord φορτώσει μόνο του το VideoQuestModal (π.χ. άνοιγμα οποιουδήποτε Quest video)");
        }
        if (this.hasUnlockableQuests) this.preloadVideoQuestModal("mobile-only quest already in QuestStore");
    }

    setupVideoQuestModal() {
        if (!this.active || !this.abortController) return;
        const existing = this.tryFind(() => BdApi.Webpack.getModule(isVideoQuestModalExports, { searchDefault: false }));
        if (existing) {
            this.installModalWrapper(existing, "already loaded");
            return;
        }
        // Το filter τρέχει συγχρονισμένα αμέσως μόλις το Discord εκτελέσει το module, πριν το
        // openVideoQuestModal διαβάσει το default export -> δεν υπάρχει race στο πρώτο άνοιγμα.
        BdApi.Webpack.waitForModule(exportsObject => {
            if (!isVideoQuestModalExports(exportsObject)) return false;
            if (this.active) this.installModalWrapper(exportsObject, "lazy-loaded by Discord");
            return true;
        }, { signal: this.abortController.signal, searchDefault: false })
            .then(exportsObject => { if (exportsObject && this.active) this.installModalWrapper(exportsObject, "lazy-loaded by Discord"); })
            .catch(err => { if (this.active) this.error("waitForModule(VideoQuestModal) failed", err); });
    }

    installModalWrapper(exportsObject, source) {
        if (!this.active) return false;
        if (this.modalReady && this.modalExports === exportsObject) return true;
        const current = safeGet(exportsObject, "default");
        if (typeof current !== "function") {
            this.error(`VideoQuestModal default export is not a component (${typeof current}) - desktop playback stays off`);
            return false;
        }
        const original = current[MODAL_WRAPPER]?.original ?? current;
        // Όλη η λύση στηρίζεται στο υπάρχον prop overrideQuest του VideoQuestModal. Αν ένα Discord
        // update το αφαιρέσει, δεν ενεργοποιούμε τίποτα (αλλιώς το modal θα έσπαγε στο invariant).
        if (!functionSource(unwrapPatched(original)).includes("overrideQuest")) {
            this.error("VideoQuestModal no longer supports the overrideQuest prop (Discord update?) - desktop playback stays off, το Discord θα δείχνει QR όπως πριν");
            return false;
        }
        const wrapper = createVideoQuestModalWrapper(original, this.bridge, this.QuestStore);
        try { exportsObject.default = wrapper; } catch (err) { /* checked below */ }
        if (safeGet(exportsObject, "default") !== wrapper) {
            this.error("VideoQuestModal export is not writable - desktop playback stays off (το Discord θα συνεχίσει να δείχνει QR)");
            return false;
        }
        this.modalExports = exportsObject;
        this.modalOriginal = original;
        this.modalWrapper = wrapper;
        this.modalReady = true;
        this.log(`VideoQuestModal wrapper installed (${source})`);
        this.reportReadiness();
        return true;
    }

    restoreVideoQuestModal() {
        const { modalExports, modalWrapper, modalOriginal } = this;
        this.modalExports = null;
        this.modalWrapper = null;
        this.modalOriginal = null;
        if (!modalExports || !modalWrapper) return;
        try {
            if (safeGet(modalExports, "default") === modalWrapper) {
                modalExports.default = modalOriginal;
            } else {
                this.warn("VideoQuestModal export was wrapped again by someone else; leaving it (our layer is passive for normal quests)");
            }
        } catch (err) {
            this.error("Could not restore VideoQuestModal export", err);
        }
    }

    preloadVideoQuestModal(reason) {
        if (!this.active || this.modalReady || this.preloadState !== "idle") return;
        if (!this.questActions || !this.loaderKey) return;
        this.preloadState = "loading";
        this.log(`Loading Discord's video quest player module (${reason})`);
        let promise;
        try { promise = Promise.resolve(this.questActions[this.loaderKey]()); } catch (err) { promise = Promise.reject(err); }
        promise.then(exportsObject => {
            if (!this.active) return;
            this.preloadState = "done";
            if (this.modalReady) return;
            if (isVideoQuestModalExports(exportsObject)) this.installModalWrapper(exportsObject, "preloaded");
            else this.warn("Loaded module is not the VideoQuestModal", exportsObject && typeof exportsObject === "object" ? Object.keys(exportsObject) : exportsObject);
        }, err => {
            if (!this.active) return;
            this.preloadState = "failed";
            this.error("Could not load Discord's video quest player module", err);
        });
    }

    reportReadiness() {
        if (!this.active || !this.modalReady || !this.mobileOnlyKey) return;
        if (this.readinessLogged) return;
        this.readinessLogged = true;
        this.log(`Desktop playback for mobile-only Quest videos is ACTIVE (${this.mobileQuestCount} active mobile-only video quest(s) in QuestStore)`);
    }

    // Ξεκλειδώνουμε ΜΟΝΟ πραγματικά quests του λογαριασμού (QuestStore), όχι previews ή ληγμένα,
    // και μόνο όταν ο desktop player μπορεί πράγματι να τα παίξει.
    canPlayOnDesktop(quest) {
        if (!this.active || !this.modalReady || !this.mobileOnlyKey) return false;
        if (!isDesktopPlayableMobileQuest(quest) || isQuestExpired(quest)) return false;
        try { return this.QuestStore.getQuest(quest.id) != null; } catch (err) { return false; }
    }

    // --- Signals from the VideoQuestModal wrapper ---------------------------------------------

    onVideoModalMounted(token, questId) {
        try { this.onVideoModalMount?.(token, questId); } catch (err) { this.errorThrottled("onVideoModalMount failed", err); }
    }

    onVideoModalUnmounted(token) {
        try { this.onVideoModalUnmount?.(token); } catch (err) { this.errorThrottled("onVideoModalUnmount failed", err); }
    }

    // --- Diagnostics -------------------------------------------------------------------------

    onQuestStoreChange() {
        if (!this.active) return;
        try {
            // Πρώτα το progress της ανοιχτής session (σημειώνει completion από τον desktop player), μετά το scan.
            if (this.sessions.size) this.reportSessionProgress();
            const quests = this.QuestStore.quests;
            if (quests && quests !== this.lastQuestsRef) {
                this.lastQuestsRef = quests;
                this.scanQuests(quests);
            }
        } catch (err) {
            this.errorThrottled("QuestStore listener failed", err);
        }
    }

    scanQuests(quests) {
        const now = Date.now();
        const counts = { total: 0, active: 0, completed: 0, unclaimed: 0, expired: 0, unlockable: 0 };
        for (const quest of quests.values()) {
            if (!isMobileOnlyVideoQuest(quest)) continue;
            counts.total++;
            const completed = quest.userStatus?.completedAt != null;
            const claimed = quest.userStatus?.claimedAt != null;
            const expired = isQuestExpired(quest, now);
            const playable = isDesktopPlayableMobileQuest(quest);
            if (completed) counts.completed++;
            else if (expired) counts.expired++;
            else counts.active++;
            if (playable && !expired) counts.unlockable++;

            // Ολοκληρωμένο αλλά χωρίς claim: μία γραμμή ανά quest (βοηθά με το "Reward Error").
            if (completed && !claimed) {
                counts.unclaimed++;
                const key = `unclaimed:${quest.id}`;
                if (!this.announcedQuests.has(key)) {
                    this.announcedQuests.add(key);
                    const rewardsExpireAt = quest.config?.rewardsConfig?.rewardsExpireAt;
                    this.log(`Completed but NOT claimed: ${questLabel(quest)} reward=${describeRewards(quest)}, completedAt=${quest.userStatus.completedAt}, rewardsExpireAt=${rewardsExpireAt ?? "n/a"}${this.completedViaDesktop.has(quest.id) ? " (completed with the desktop player)" : ""}`);
                }
            }

            // Λεπτομέρειες μία φορά ανά quest, μόνο για όσα μπορούν ακόμα να γίνουν (όχι completed/expired).
            if (completed || expired || this.announcedQuests.has(quest.id)) continue;
            this.announcedQuests.add(quest.id);
            const task = getQuestTasks(quest)[TASK_MOBILE_VIDEO];
            const reason = quest.preview === true ? "preview quest" : "no playable video asset";
            this.log(`Mobile-only video quest ${questLabel(quest)}: target=${formatSeconds(task?.target)}, progress=${formatSeconds(serverProgressSeconds(quest))}, enrolled=${quest.userStatus?.enrolledAt != null}, reward=${describeRewards(quest)}, assets=${describeVideoAssets(task)} -> desktop playback ${playable ? "available" : `NOT possible (${reason})`}`);
        }

        const summary = `${counts.total}/${counts.active}/${counts.completed}/${counts.unclaimed}/${counts.expired}`;
        if (summary !== this.lastScanSummary) {
            this.lastScanSummary = summary;
            this.log(`QuestStore: ${counts.total} mobile-only video quest(s) - ${counts.active} active, ${counts.completed} completed (${counts.unclaimed} not claimed), ${counts.expired} expired`);
        }
        this.mobileQuestCount = counts.active;
        this.hasUnlockableQuests = counts.unlockable > 0;
        if (this.hasUnlockableQuests) this.preloadVideoQuestModal("mobile-only quest found in QuestStore");
    }

    onDesktopSessionOpened(questId) {
        if (!this.active) return;
        const quest = this.QuestStore?.getQuest(questId);
        const task = getQuestTasks(quest)?.[TASK_MOBILE_VIDEO];
        const now = Date.now();
        const session = {
            openedAt: now,
            target: task?.target ?? null,
            server: serverProgressSeconds(quest),
            serverChangedAt: now,
            client: null,
            lastLogAt: now,
            loggedClient: null,
            loggedServer: null,
            warnedNoServerProgress: false,
            completed: quest?.userStatus?.completedAt != null
        };
        this.sessions.set(questId, session);
        this.log(`Desktop player opened for mobile-only quest ${questLabel(quest, questId)} - real ${TASK_MOBILE_VIDEO} task, target=${formatSeconds(session.target)}, server progress=${formatSeconds(session.server)}, assets=${describeVideoAssets(task)}`);
    }

    onDesktopSessionClosed(questId) {
        const session = this.sessions.get(questId);
        this.sessions.delete(questId);
        if (!session) return;
        const quest = this.QuestStore?.getQuest(questId);
        const client = this.QuestStore?.getOptimisticProgress?.(questId, TASK_MOBILE_VIDEO);
        const completed = quest?.userStatus?.completedAt != null;
        if (completed && !session.completed) this.completedViaDesktop.add(questId);
        this.log(`Desktop player closed for quest ${questLabel(quest, questId)}: playback progress=${formatSeconds(client)}, server progress=${formatSeconds(serverProgressSeconds(quest))} / ${formatSeconds(session.target)}, completed=${completed}`);
    }

    reportSessionProgress() {
        const now = Date.now();
        for (const [questId, session] of this.sessions) {
            const quest = this.QuestStore.getQuest(questId);
            if (!quest) continue;
            const server = serverProgressSeconds(quest);
            const client = this.QuestStore.getOptimisticProgress?.(questId, TASK_MOBILE_VIDEO);
            if (server !== session.server) {
                session.server = server;
                session.serverChangedAt = now;
            }
            if (typeof client === "number") session.client = client;

            if (!session.completed && quest.userStatus?.completedAt != null) {
                session.completed = true;
                this.completedViaDesktop.add(questId);
                this.log(`Quest ${questLabel(quest)} marked COMPLETED by Discord (server progress=${formatSeconds(server)} / ${formatSeconds(session.target)}, reward=${describeRewards(quest)})`);
            }
            if (now - session.lastLogAt >= SESSION_LOG_INTERVAL_MS && (session.client !== session.loggedClient || session.server !== session.loggedServer)) {
                session.lastLogAt = now;
                session.loggedClient = session.client;
                session.loggedServer = session.server;
                this.log(`Progress ${questLabel(quest)}: playback=${formatSeconds(session.client)}, server=${formatSeconds(session.server)} / target=${formatSeconds(session.target)}`);
            }
            if (!session.warnedNoServerProgress && !session.completed && typeof session.client === "number"
                && session.client - session.server >= 20 && now - session.serverChangedAt >= NO_SERVER_PROGRESS_WARN_MS) {
                session.warnedNoServerProgress = true;
                this.warn(`Playback advanced to ${formatSeconds(session.client)} but Discord reports no new server progress for ${Math.round((now - session.serverChangedAt) / 1000)}s (server=${formatSeconds(session.server)}). Αν το progress δεν ανεβαίνει, ο server πιθανότατα δεν δέχεται desktop progress για αυτό το mobile task - στείλε αυτό το log.`);
            }
        }
    }

    closeDesktopSessions(quiet) {
        if (!this.sessions.size || typeof this.ModalActions?.closeModal !== "function") return;
        for (const questId of Array.from(this.sessions.keys())) {
            const key = questVideoModalKey(questId);
            try {
                if (this.ModalActions.hasModalOpen?.(key) === false) continue;
                this.ModalActions.closeModal(key);
                if (!quiet) this.log(`Closed the desktop player of quest ${questId} (plugin stopped)`);
            } catch (err) {
                this.error(`Could not close video modal ${key}`, err);
            }
        }
    }

    getStatusText() {
        if (this.disabledReason) return `Ανενεργό - ${this.disabledReason}`;
        if (!this.active) return "Ανενεργό";
        if (!this.mobileOnlyKey) return "Αναμονή για τα Quest internals του Discord...";
        if (!this.modalReady) {
            if (this.preloadState === "loading") return "Φόρτωση του Quest video player του Discord...";
            if (this.preloadState === "failed") return "Αποτυχία φόρτωσης του Quest video player (δες console)";
            return this.hasUnlockableQuests
                ? "Αναμονή για τον Quest video player του Discord..."
                : "Έτοιμο - θα ενεργοποιηθεί μόλις υπάρξει mobile-only video Quest στον λογαριασμό";
        }
        return `Ενεργό - ${this.mobileQuestCount} ενεργό(ά) mobile-only video Quest(s) στον λογαριασμό`;
    }
}

// Ο Quest video player του Discord (και ο παλιός και ο νέος) κάνει pause στο alt-tab μέσω ενός
// focus hook ({ focused, focusedChanged } από το WindowStore, που ενημερώνεται από native IPC και
// όχι μόνο από DOM events). Όσο παίζει Quest video, το hook επιστρέφει "focused", οπότε ο player
// δεν μπαίνει καν σε paused state (ούτε εμφανίζεται το "We paused the video while you are away").
// Εκτός Quest video επιστρέφει πάντα την πραγματική τιμή.
class PlayerFocusGuard {
    constructor(isSessionActive) {
        this.isSessionActive = isSessionActive;
        this.unpatch = null;
        this.abortController = null;
        this.status = "Ανενεργό";
    }

    start() {
        this.stop();
        const api = globalThis.BdApi;
        if (!api?.Webpack?.Filters?.bySource || !api?.Patcher) {
            this.status = "Μη διαθέσιμο (BdApi)";
            return;
        }
        this.abortController = new AbortController();
        const filter = api.Webpack.Filters.bySource(...ANCHOR_PLAYER_FOCUS_HOOK);
        let modules = [];
        try { modules = api.Webpack.getModules(filter, { raw: true }) ?? []; } catch (err) { modules = []; }
        for (const module of modules) {
            if (this.tryAttach(module)) return;
        }
        this.status = "Αναμονή για τον Quest video player...";
        const candidates = [...new Set(modules.map(module => module?.id))];
        console.log(`${LOG_PREFIX} Quest player focus hook not loaded yet${candidates.length ? ` (checked modules: ${candidates.join(", ")})` : ""} - waiting; μέχρι τότε προστατεύει το pause() guard`);
        api.Webpack.waitForModule((exportsObject, module) => {
            try { return filter(exportsObject, module) && PlayerFocusGuard.findHookKey(module) != null; } catch (err) { return false; }
        }, { signal: this.abortController.signal, raw: true })
            .then(module => { if (module && this.abortController) this.tryAttach(module); })
            .catch(() => { /* aborted */ });
    }

    stop() {
        try { this.abortController?.abort(); } catch (err) { /* noop */ }
        this.abortController = null;
        if (this.unpatch) {
            try { this.unpatch(); } catch (err) { console.error(LOG_PREFIX, "Could not remove the player focus patch", err); }
            this.unpatch = null;
        }
        this.status = "Ανενεργό";
    }

    // Επιστρέφει το export key του focus hook. Το filter (bySource) κρατάει μόνο modules που ΟΡΙΖΟΥΝ
    // το hook (το factory τους καλεί isFocused()), όχι απλά re-exports. Δεν συγκρίνουμε όλο το source
    // με το factory: το ίδιο module υπάρχει σε πολλά chunks με διαφορετικά minified ονόματα.
    static findHookKey(module) {
        const exportsObject = module?.exports;
        if (!exportsObject || typeof exportsObject !== "object" || module.id == null) return null;
        for (const key of Object.keys(exportsObject)) {
            const fn = unwrapPatched(safeGet(exportsObject, key));
            if (typeof fn !== "function" || fn.length !== 0) continue;
            const source = functionSource(fn);
            if (source.length > 400 || !source.includes("isFocused()")) continue;
            if (!/\bfocused\s*:/.test(source) || !/\bfocusedChanged\s*:/.test(source)) continue;
            return key;
        }
        return null;
    }

    tryAttach(module) {
        if (this.unpatch) return true;
        const key = PlayerFocusGuard.findHookKey(module);
        if (!key) return false;
        try {
            this.unpatch = BdApi.Patcher.after(PLUGIN_NAME, module.exports, key, (_, __, result) => {
                if (!result || typeof result !== "object" || !("focused" in result) || !this.isSessionActive()) return result;
                if (result.focused === true && result.focusedChanged !== true) return result;
                return { ...result, focused: true, focusedChanged: false };
            });
        } catch (err) {
            console.error(LOG_PREFIX, "Could not patch the Quest player focus hook (NoPause keeps using the pause() guard)", err);
            this.status = "Αποτυχία patch (χρησιμοποιείται μόνο το pause() guard)";
            return false;
        }
        this.status = "Ενεργό";
        console.log(`${LOG_PREFIX} Quest player focus hook patched ("${key}", module ${module.id}) - ο player δεν κάνει pause στο alt-tab όσο παίζει Quest video`);
        return true;
    }
}

// Καταγράφει τι απαντά ο server όταν γίνεται claim reward, ώστε το "Reward Error" του Discord να
// έχει συγκεκριμένη αιτία στο console. Δεν αλλάζει κανένα request.
class QuestRewardDiagnostics {
    constructor(mobileQuests) {
        this.mobileQuests = mobileQuests;
        this.dispatcher = null;
        this.subscriptions = [];
    }

    start() {
        this.stop();
        let dispatcher = null;
        try {
            // Ίδιο κριτήριο με αυτό που χρησιμοποιεί το BetterDiscord για τον Flux dispatcher.
            dispatcher = BdApi.Webpack.getModule(m => m != null && typeof m === "object"
                && typeof m.dispatch === "function" && typeof m.subscribe === "function"
                && typeof m.unsubscribe === "function" && typeof m.register === "function", { searchExports: true });
        } catch (err) { dispatcher = null; }
        if (!dispatcher) {
            console.warn(REWARD_PREFIX, "Flux dispatcher not found - reward diagnostics off");
            return;
        }
        this.dispatcher = dispatcher;
        const on = (type, handler) => {
            const wrapped = action => {
                try { handler(action ?? {}); } catch (err) { console.error(REWARD_PREFIX, `${type} diagnostics failed`, err); }
            };
            dispatcher.subscribe(type, wrapped);
            this.subscriptions.push([type, wrapped]);
        };
        on("QUESTS_CLAIM_REWARD_BEGIN", action => console.log(REWARD_PREFIX, `Claiming reward for ${this.describeQuest(action.questId)}`));
        on("QUESTS_CLAIM_REWARD_SUCCESS", action => {
            const items = action.entitlements?.items;
            const errors = action.entitlements?.errors;
            console.log(REWARD_PREFIX, `Reward claimed for ${this.describeQuest(action.questId)} (${Array.isArray(items) ? items.length : "?"} item(s))${Array.isArray(errors) && errors.length ? `, errors=${safeJson(errors)}` : ""}`);
        });
        on("QUESTS_CLAIM_REWARD_FAILURE", action => this.logFailure("Claim FAILED", action));
        on("QUESTS_FETCH_REWARD_CODE_FAILURE", action => this.logFailure("Reward code fetch FAILED", action));
        on("VIRTUAL_CURRENCY_BALANCE_FETCH_FAIL", action => {
            console.warn(REWARD_PREFIX, `Orbs balance fetch FAILED (${describeApiError(action.error ?? action.err ?? null)}). Το Orbs reward modal δείχνει τότε "Reward Error" ακόμα κι αν το claim πέτυχε - έλεγξε αν το quest εμφανίζεται ως Claimed.`);
        });
        console.log(REWARD_PREFIX, "Reward diagnostics active - claim / reward code / Orbs balance errors will be logged here");
    }

    stop() {
        for (const [type, handler] of this.subscriptions) {
            try { this.dispatcher?.unsubscribe(type, handler); } catch (err) { /* noop */ }
        }
        this.subscriptions = [];
        this.dispatcher = null;
    }

    describeQuest(questId) {
        let quest = null;
        try { quest = this.mobileQuests.QuestStore?.getQuest(questId) ?? null; } catch (err) { quest = null; }
        const tags = [];
        if (isMobileOnlyVideoQuest(quest)) tags.push("mobile-only video quest");
        if (this.mobileQuests.completedViaDesktop.has(questId)) tags.push("completed with the desktop player");
        const status = quest?.userStatus;
        if (status) tags.push(`completed=${status.completedAt != null}, claimed=${status.claimedAt != null}`);
        return `${questLabel(quest, questId)} [reward=${describeRewards(quest)}${tags.length ? `; ${tags.join("; ")}` : ""}]`;
    }

    logFailure(label, action) {
        const questId = action.questId;
        console.warn(REWARD_PREFIX, `${label} for ${this.describeQuest(questId)}: ${describeApiError(action.error)}`);
        if (label !== "Claim FAILED") return;

        let quest = null;
        try { quest = this.mobileQuests.QuestStore?.getQuest(questId) ?? null; } catch (err) { quest = null; }
        if (!isMobileOnlyVideoQuest(quest)) return;

        // The claim request is Discord's own; a 403 here is the server refusing the claim for a
        // mobile-only quest, which the phone app can still do.
        const status = Number(action.error?.status);
        const message = status === 403 || status === 400
            ? "Το Discord δεν δέχεται το claim αυτού του mobile quest από το desktop. Κάνε το claim από την εφαρμογή του κινητού — το quest μετράει ως ολοκληρωμένο."
            : "Το claim του mobile quest απέτυχε. Κάνε Ctrl+R και ξαναδοκίμασε· αν ξαναποτύχει, κάνε το claim από την εφαρμογή του κινητού.";
        console.warn(REWARD_PREFIX, message);
        try { BdApi.UI.showToast(message, { type: "error", timeout: 10000 }); } catch (err) { /* noop */ }
    }
}

module.exports = class NoPause {
    constructor(meta) {
        this.meta = meta;
        this.name = PLUGIN_NAME;
        this.started = false;
        this.scanTimer = null;
        this.patchedVideos = new Set();
        this.detectionCache = new WeakMap();
        this.openQuestModals = new Set();
        this.sessionActive = false;
        this.shield = null;
        this.lastScanErrorAt = 0;
        this.mobileQuests = new MobileQuestDesktopPlayback();
        this.playerFocus = new PlayerFocusGuard(() => this.sessionActive);
        this.rewardDiagnostics = new QuestRewardDiagnostics(this.mobileQuests);
    }

    start() {
        this.cleanupStaleRuntime();
        window[RUNTIME_KEY] = { owner: this, version: PLUGIN_VERSION, stop: () => this.stop() };
        this.started = true;

        this.removeLegacyPatches();
        // Patches που τυχόν έμειναν από προηγούμενο instance με το ίδιο caller.
        try { BdApi?.Patcher?.unpatchAll(PLUGIN_NAME); } catch (err) { /* noop */ }

        // Τα υπόλοιπα κομμάτια είναι απομονωμένα: αν κάτι λείπει από το Discord, το NoPause συνεχίζει.
        this.mobileQuests.onVideoModalMount = (token) => this.onQuestVideoModalMount(token);
        this.mobileQuests.onVideoModalUnmount = (token) => this.onQuestVideoModalUnmount(token);
        this.safely("start mobile quest", () => this.mobileQuests.start(), () => this.mobileQuests.stop(true));
        this.safely("start player focus guard", () => this.playerFocus.start(), () => this.playerFocus.stop());
        this.safely("start reward diagnostics", () => this.rewardDiagnostics.start(), () => this.rewardDiagnostics.stop());

        this.scanQuestVideos();
        console.log(`${LOG_PREFIX} Plugin started v${PLUGIN_VERSION} - NoPause for Quest videos + desktop playback for mobile-only Quest videos`);
    }

    stop() {
        this.started = false;
        if (this.scanTimer != null) clearTimeout(this.scanTimer);
        this.scanTimer = null;

        this.safely("reward diagnostics", () => this.rewardDiagnostics.stop());
        this.safely("player focus guard", () => this.playerFocus.stop());
        this.safely("mobile quest", () => this.mobileQuests.stop());
        try { BdApi?.Patcher?.unpatchAll(PLUGIN_NAME); } catch (err) { /* noop */ }
        this.mobileQuests.onVideoModalMount = null;
        this.mobileQuests.onVideoModalUnmount = null;
        this.openQuestModals.clear();
        this.safely("focus/visibility shield", () => this.setSessionActive(false));
        this.safely("video patches", () => this.unpatchAllVideos());
        if (window[RUNTIME_KEY]?.owner === this) delete window[RUNTIME_KEY];

        console.log(`${LOG_PREFIX} Plugin stopped`);
    }

    safely(label, fn, onError) {
        try {
            fn();
        } catch (err) {
            console.error(LOG_PREFIX, `${label} failed`, err);
            if (onError) { try { onError(); } catch (cleanupErr) { /* noop */ } }
        }
    }

    // Αν ένα προηγούμενο instance δεν σταμάτησε (π.χ. σφάλμα στο reload), καθαρίζεται πρώτα.
    cleanupStaleRuntime() {
        const stale = window[RUNTIME_KEY];
        if (!stale || stale.owner === this) return;
        console.warn(LOG_PREFIX, `Cleaning up a previous instance (v${stale.version ?? "?"}) that was not stopped`);
        try { stale.stop(); } catch (err) { console.error(LOG_PREFIX, "Previous instance cleanup failed", err); }
        if (window[RUNTIME_KEY] === stale) delete window[RUNTIME_KEY];
    }

    // Η v2.1.0 δεν επανέφερε τα video.pause overrides και τα document overrides στο stop().
    removeLegacyPatches() {
        let cleaned = 0;
        const videos = document.getElementsByTagName("video");
        for (let i = 0; i < videos.length; i++) {
            if (this.removeLegacyVideoPatch(videos[i])) cleaned++;
        }
        for (const [property, legacyValue] of [["hidden", false], ["visibilityState", "visible"], ["hasFocus", true]]) {
            if (Object.getOwnPropertyDescriptor(document, property) && NoPause.ownDescriptorBackup(document, property, legacyValue) === undefined) {
                try { delete document[property]; cleaned++; } catch (err) { /* noop */ }
            }
        }
        if (cleaned) console.log(`${LOG_PREFIX} Removed ${cleaned} leftover patch(es) from an older version`);
    }

    removeLegacyVideoPatch(video) {
        if (!video || !video._noPauseState) return false;
        try { if (Object.prototype.hasOwnProperty.call(video, "pause")) delete video.pause; } catch (err) { /* noop */ }
        try { delete video._noPauseState; } catch (err) { /* noop */ }
        try { delete video.dataset.wasPlaying; } catch (err) { /* noop */ }
        return true;
    }

    // --- Quest video session -------------------------------------------------------------------

    onQuestVideoModalMount(token) {
        if (!this.started) return;
        this.openQuestModals.add(token);
        this.setSessionActive(true);
        this.scheduleScan(0);
    }

    onQuestVideoModalUnmount(token) {
        this.openQuestModals.delete(token);
        if (this.started) this.scheduleScan(0);
    }

    scheduleScan(delay) {
        if (!this.started) return;
        if (this.scanTimer != null) clearTimeout(this.scanTimer);
        this.scanTimer = setTimeout(() => this.scanQuestVideos(), delay);
    }

    scanQuestVideos() {
        this.scanTimer = null;
        if (!this.started) return;
        let questVideos = 0;
        try {
            const videos = document.getElementsByTagName("video");
            for (let i = 0; i < videos.length; i++) {
                const video = videos[i];
                if (!this.isQuestVideo(video)) continue;
                questVideos++;
                this.patchVideo(video);
                this.keepPlaying(video);
            }
            // Videos που αφαιρέθηκαν από το DOM: καθάρισμα listeners/override
            for (const video of this.patchedVideos) {
                if (!video.isConnected) this.unpatchVideo(video);
            }
        } catch (err) {
            const now = Date.now();
            if (now - this.lastScanErrorAt > 10000) {
                this.lastScanErrorAt = now;
                console.error(LOG_PREFIX, "Quest video scan error", err);
            }
        }
        this.setSessionActive(questVideos > 0 || this.openQuestModals.size > 0);
        this.scheduleScan(this.sessionActive ? SCAN_ACTIVE_MS : SCAN_IDLE_MS);
    }

    // Η προστασία focus/visibility ενεργοποιείται ΜΟΝΟ όσο υπάρχει Quest video. Εκτός Quest video
    // το Discord λειτουργεί εντελώς κανονικά (notifications, read state, idle, overlay, κ.λπ.).
    setSessionActive(active) {
        if (active === this.sessionActive) return;
        this.sessionActive = active;
        if (active) {
            this.activateShield();
            console.log(`${LOG_PREFIX} Quest video session started - alt-tab protection ON`);
        } else {
            this.deactivateShield();
            console.log(`${LOG_PREFIX} Quest video session ended - Discord focus/visibility back to normal`);
        }
    }

    // --- Visibility / focus shield ------------------------------------------------------------

    // Own properties πάνω στο document δεν υπάρχουν σε vanilla Discord. Αν βρεθεί ένα που μοιάζει με
    // override παλιότερης έκδοσης (που δεν αφαιρούνταν στο stop), το θεωρούμε υπόλειμμα και όχι "original".
    static ownDescriptorBackup(object, property, legacyValue) {
        const descriptor = Object.getOwnPropertyDescriptor(object, property);
        if (!descriptor) return undefined;
        try {
            const getter = descriptor.get ?? (typeof descriptor.value === "function" ? descriptor.value : null);
            const source = getter ? functionSource(getter).replace(/\s+/g, "") : "";
            if (/^\(\)=>(false|true|"visible"|'visible')$/.test(source) && getter.call(object) === legacyValue) return undefined;
        } catch (err) { /* keep descriptor */ }
        return descriptor;
    }

    static restoreOwnProperty(object, property, descriptor) {
        if (descriptor) Object.defineProperty(object, property, descriptor);
        else delete object[property];
    }

    activateShield() {
        if (this.shield) return;
        const shield = {
            backup: {
                protoHidden: Object.getOwnPropertyDescriptor(Document.prototype, "hidden"),
                protoVisibilityState: Object.getOwnPropertyDescriptor(Document.prototype, "visibilityState"),
                ownHidden: NoPause.ownDescriptorBackup(document, "hidden", false),
                ownVisibilityState: NoPause.ownDescriptorBackup(document, "visibilityState", "visible"),
                ownHasFocus: NoPause.ownDescriptorBackup(document, "hasFocus", true)
            },
            blockedBlur: false,
            blockedVisibility: false,
            visibilityHandler: null,
            blurHandler: null
        };
        this.shield = shield;

        // Visibility API: το Quest video δεν "βλέπει" ποτέ hidden (π.χ. minimize).
        Object.defineProperty(Document.prototype, "hidden", { get: () => false, configurable: true });
        Object.defineProperty(Document.prototype, "visibilityState", { get: () => "visible", configurable: true });
        Object.defineProperty(document, "hidden", { get: () => false, configurable: true });
        Object.defineProperty(document, "visibilityState", { get: () => "visible", configurable: true });
        Object.defineProperty(document, "hasFocus", { value: () => true, configurable: true, writable: true });

        // Capture phase - block πριν τα δει το Discord. Μόνο το blur του ίδιου του παραθύρου και το
        // visibilitychange: τα focus/blur των inputs και των υπόλοιπων στοιχείων περνούν κανονικά.
        shield.visibilityHandler = (e) => {
            shield.blockedVisibility = true;
            e.stopImmediatePropagation();
        };
        shield.blurHandler = (e) => {
            if (e.target !== window) return;
            shield.blockedBlur = true;
            e.stopImmediatePropagation();
        };
        document.addEventListener("visibilitychange", shield.visibilityHandler, true);
        window.addEventListener("blur", shield.blurHandler, true);
    }

    deactivateShield() {
        const shield = this.shield;
        if (!shield) return;
        this.shield = null;
        document.removeEventListener("visibilitychange", shield.visibilityHandler, true);
        window.removeEventListener("blur", shield.blurHandler, true);

        const backup = shield.backup;
        if (backup.protoHidden) Object.defineProperty(Document.prototype, "hidden", backup.protoHidden);
        if (backup.protoVisibilityState) Object.defineProperty(Document.prototype, "visibilityState", backup.protoVisibilityState);
        NoPause.restoreOwnProperty(document, "hidden", backup.ownHidden);
        NoPause.restoreOwnProperty(document, "visibilityState", backup.ownVisibilityState);
        NoPause.restoreOwnProperty(document, "hasFocus", backup.ownHasFocus);

        // Ό,τι μπλοκαρίστηκε όσο έπαιζε το video ξαναστέλνεται με την πραγματική κατάσταση,
        // ώστε το Discord να μη μείνει με λάθος focus/visibility.
        try {
            if (shield.blockedVisibility) document.dispatchEvent(new Event("visibilitychange"));
            if (shield.blockedBlur && !document.hasFocus()) window.dispatchEvent(new FocusEvent("blur"));
        } catch (err) {
            console.error(LOG_PREFIX, "Could not re-sync focus/visibility state", err);
        }
    }

    // --- Quest video detection ----------------------------------------------------------------

    isQuestVideo(video) {
        if (!(video instanceof HTMLVideoElement)) return false;
        const cached = this.detectionCache.get(video);
        const now = Date.now();
        if (cached && (cached.reason || now - cached.checkedAt < NEGATIVE_DETECTION_TTL_MS)) return !!cached.reason;
        let reason = null;
        try { reason = this.detectQuestVideo(video); } catch (err) { /* closest μπορεί να πετάξει αν ο κόμβος αποσπαστεί */ }
        this.detectionCache.set(video, { reason, checkedAt: now });
        return !!reason;
    }

    detectQuestVideo(video) {
        // 1) Οποιοδήποτε parent με data-quest-id
        if (video.closest("[data-quest-id]")) return "data-quest-id";

        // 2) Το Quest video modal του Discord: σταθερά data-testid (video-quest-close-btn,
        //    video-quest-share-btn, video-quest-reward-indicator) - όχι hashed classes.
        const modal = video.closest('[role="dialog"], [data-mana-component="modal"], [aria-modal="true"]');
        if (modal && modal.querySelector('[data-testid^="video-quest-"], [data-quest-id]')) return "quest video modal";

        const isWebPlayer = video.getAttribute("data-testid") === "discord-web-video-player-video"
            || !!video.closest('[data-testid="discord-web-video-player-container"]');
        if (!modal && !isWebPlayer) return null;

        // 3) React props του Quest video modal (questId + videoSessionId)
        if (this.hasQuestVideoModalFiber(video)) return "quest video modal props";

        // 4) discord-web-video-player που παίζει asset από το Quest CDN (/quests/)
        if (isWebPlayer && QUEST_CDN_PATH.test(`${video.currentSrc || ""} ${video.src || ""} ${video.poster || ""}`)) return "quest CDN source";

        return null;
    }

    hasQuestVideoModalFiber(element) {
        const fiberKey = Object.keys(element).find(key => key.startsWith("__reactFiber$"));
        let fiber = fiberKey ? element[fiberKey] : null;
        for (let depth = 0; fiber && depth < FIBER_SEARCH_DEPTH; depth++, fiber = fiber.return) {
            const props = fiber.memoizedProps;
            if (props && typeof props === "object" && typeof props.videoSessionId === "string"
                && (props.questId != null || props.quest?.id != null)) return true;
        }
        return false;
    }

    // --- Video patching -------------------------------------------------------------------------

    patchVideo(video) {
        // Αν ΔΕΝ είναι quest video, μην το επεξεργαστείς
        if (!this.isQuestVideo(video)) return;

        const existing = video[VIDEO_STATE];
        if (existing?.owner === this) return;
        if (existing) this.unpatchVideo(video, existing);
        this.removeLegacyVideoPatch(video);

        const ownPauseDescriptor = Object.getOwnPropertyDescriptor(video, "pause");
        const originalPause = video.pause;
        const state = {
            owner: this,
            userPaused: false,
            videoEnded: false,
            wasPlaying: !video.paused,
            lastUserAction: 0,
            blockedSinceLog: 0,
            lastBlockedLogAt: 0,
            resumeTimes: [],
            resumeSuspendedUntil: 0,
            listeners: [],
            ownPauseDescriptor,
            pauseOverride: null
        };
        const listen = (target, type, handler, capture = false) => {
            target.addEventListener(type, handler, capture);
            state.listeners.push([target, type, handler, capture]);
        };

        // Detect if video ended naturally
        listen(video, "ended", () => { state.videoEnded = true; });
        listen(video, "playing", () => {
            state.videoEnded = false;
            state.userPaused = false;
            state.wasPlaying = true;
        });
        listen(video, "play", () => { state.userPaused = false; });

        // Detect user-initiated pause μέσω πραγματικού click/keydown πάνω στα controls.
        // Σημειώνουμε χρόνο· ένα pause() εντός ~400ms από user action θεωρείται ηθελημένο.
        const markUserAction = () => { state.lastUserAction = Date.now(); };
        const markUserKey = (e) => {
            if (e.ctrlKey || e.altKey || e.metaKey) return;
            if (USER_PAUSE_KEYS.has(e.key)) markUserAction();
        };
        listen(video, "click", markUserAction, true);
        const container = video.closest('[data-testid="discord-web-video-player-container"]') || video.parentElement;
        if (container) {
            listen(container, "pointerdown", markUserAction, true);
            listen(container, "click", markUserAction, true);
            listen(container, "keydown", markUserKey, true);
        }

        // Override pause method (μόνο σε αυτό το video element)
        const plugin = this;
        state.pauseOverride = function pause() {
            if (state.videoEnded || video.ended) {
                return originalPause.apply(video, arguments);
            }
            // Αν το pause προήλθε από πρόσφατη ενέργεια χρήστη -> επίτρεψέ το και μην κάνεις auto-resume
            if (Date.now() - state.lastUserAction < USER_ACTION_WINDOW_MS) {
                state.userPaused = true;
                return originalPause.apply(video, arguments);
            }
            // Block automatic pause (alt-tab / lost focus) για quest videos
            plugin.logBlockedPause(state);
            return undefined;
        };
        Object.defineProperty(video, "pause", { value: state.pauseOverride, configurable: true, writable: true });

        video[VIDEO_STATE] = state;
        this.patchedVideos.add(video);
        console.log(`${LOG_PREFIX} Patched quest video element (${this.detectionCache.get(video)?.reason ?? "quest video"})`);
    }

    // Resume μόνο αν ΔΕΝ το σταμάτησε ο χρήστης, δεν τελείωσε, έπαιζε πριν και δεν "παλεύουμε" με τον player.
    keepPlaying(video) {
        const state = video[VIDEO_STATE];
        if (!state || state.owner !== this) return;
        if (!video.paused) {
            state.wasPlaying = true;
            return;
        }
        if (video.ended || state.videoEnded || state.userPaused || !state.wasPlaying) return;
        if (!(video.currentTime > 0 && video.currentTime < video.duration - 0.5)) return;
        const now = Date.now();
        if (now - state.lastUserAction < USER_ACTION_WINDOW_MS || now < state.resumeSuspendedUntil) return;
        state.resumeTimes = state.resumeTimes.filter(time => now - time < RESUME_WINDOW_MS);
        if (state.resumeTimes.length >= RESUME_LIMIT) {
            state.resumeSuspendedUntil = now + RESUME_WINDOW_MS;
            state.resumeTimes = [];
            console.warn(`${LOG_PREFIX} Discord keeps pausing this quest video (${RESUME_LIMIT} auto-resumes in ${RESUME_WINDOW_MS / 1000}s) - auto-resume paused for ${RESUME_WINDOW_MS / 1000}s`);
            return;
        }
        state.resumeTimes.push(now);
        const playPromise = video.play();
        if (playPromise && typeof playPromise.catch === "function") playPromise.catch(() => {});
    }

    unpatchVideo(video, state = video?.[VIDEO_STATE]) {
        if (!video || !state) return;
        for (const [target, type, handler, capture] of state.listeners) {
            try { target.removeEventListener(type, handler, capture); } catch (err) { /* noop */ }
        }
        state.listeners.length = 0;
        try {
            if (Object.prototype.hasOwnProperty.call(video, "pause") && video.pause === state.pauseOverride) {
                NoPause.restoreOwnProperty(video, "pause", state.ownPauseDescriptor);
            }
        } catch (err) { /* noop */ }
        if (video[VIDEO_STATE] === state) delete video[VIDEO_STATE];
        state.owner?.patchedVideos?.delete(video);
    }

    unpatchAllVideos() {
        for (const video of Array.from(this.patchedVideos)) this.unpatchVideo(video);
        const videos = document.getElementsByTagName("video");
        for (let i = 0; i < videos.length; i++) {
            if (videos[i][VIDEO_STATE]?.owner === this) this.unpatchVideo(videos[i]);
        }
        this.patchedVideos.clear();
    }

    logBlockedPause(state) {
        state.blockedSinceLog++;
        const now = Date.now();
        if (now - state.lastBlockedLogAt < BLOCKED_PAUSE_LOG_INTERVAL_MS) return;
        console.log(`${LOG_PREFIX} Blocked auto-pause on quest video${state.blockedSinceLog > 1 ? ` (x${state.blockedSinceLog})` : ""}`);
        state.lastBlockedLogAt = now;
        state.blockedSinceLog = 0;
    }

    getSettingsPanel() {
        const panel = document.createElement("div");
        panel.style.padding = "10px";
        panel.innerHTML = `
            <div style="color: var(--text-strong, var(--text-default, var(--text-normal))); font-size: 16px; margin-bottom: 10px;">
                <strong>NoPause for Quests v${PLUGIN_VERSION}</strong>
            </div>
            <div style="color: var(--text-muted); font-size: 14px; line-height: 1.45;">
                Το plugin υποστηρίζει:
                <ol style="margin: 8px 0 12px 20px; padding: 0; list-style: decimal;">
                    <li><strong>NoPause για Quest videos</strong> - το Discord δεν κάνει pause το Quest video όταν κάνεις alt-tab ή χάνει focus.</li>
                    <li><strong>Desktop playback για mobile Quest videos</strong> - όταν ένα Quest ζητά να δεις το video από κινητό («Watch on mobile» / QR «Continue on your phone»), ανοίγει ο κανονικός Quest video player του Discord στο PC με το πραγματικό video του Quest.</li>
                </ol>
                <strong>1. NoPause - πως λειτουργεί:</strong>
                <ul style="margin: 6px 0 12px 20px; padding: 0; list-style: disc;">
                    <li>Ενεργοποιείται ΜΟΝΟ όσο υπάρχει ανοιχτό Quest video - αλλιώς το Discord λειτουργεί εντελώς κανονικά</li>
                    <li>Ο Quest player δεν κάνει pause στο alt-tab (χωρίς το «We paused the video while you are away»)</li>
                    <li>Override visibility API και block του window blur μόνο κατά τη διάρκεια του Quest video</li>
                    <li>Intercept video.pause() μόνο στο Quest video + auto-resume με όριο (δεν «παλεύει» με τον player)</li>
                    <li>Το manual pause (click, Space/K, Esc) λειτουργεί κανονικά</li>
                </ul>
                <strong>Αναγνωρίζει quest videos από:</strong>
                <ul style="margin: 6px 0 12px 20px; padding: 0; list-style: disc;">
                    <li>Quest video modal (data-testid="video-quest-close-btn" / "video-quest-share-btn")</li>
                    <li>React props του Quest video modal (questId + videoSessionId)</li>
                    <li>Parent με data-quest-id</li>
                    <li>discord-web-video-player με video από το Quest CDN (/quests/)</li>
                </ul>
                <strong>2. Mobile Quest videos στο desktop:</strong>
                <ul style="margin: 6px 0 12px 20px; padding: 0; list-style: disc;">
                    <li>Μόνο για Quests που έχουν ήδη δοθεί στον λογαριασμό σου (QuestStore του Discord) και δεν έχουν λήξει</li>
                    <li>Χρησιμοποιεί το πραγματικό Quest task/video (WATCH_VIDEO_ON_MOBILE) και τον player του Discord</li>
                    <li>Όνομα, reward, progress και διάρκεια έρχονται από το Discord</li>
                    <li>Δεν δημιουργεί Quests, δεν αλλάζει progress, δεν κάνει completion - το progress το στέλνει ο player του Discord όσο βλέπεις</li>
                </ul>
                <strong>3. Reward diagnostics:</strong>
                <ul style="margin: 6px 0 12px 20px; padding: 0; list-style: disc;">
                    <li>Αν το claim βγάλει «Reward Error», το console γράφει την ακριβή απάντηση του server (prefix ${REWARD_PREFIX})</li>
                </ul>
                <div>NoPause: <span data-nopause-session style="color: var(--text-default, var(--text-normal));"></span></div>
                <div>Quest player focus: <span data-nopause-focus style="color: var(--text-default, var(--text-normal));"></span></div>
                <div>Mobile Quests: <span data-nopause-mobile-status style="color: var(--text-default, var(--text-normal));"></span></div>
                <br>
                <em>Κανονικά videos δεν επηρεάζονται. Debug logs στο console με prefix ${LOG_PREFIX}.</em>
            </div>
        `;
        const setText = (selector, text) => {
            const element = panel.querySelector(selector);
            if (element) element.textContent = text;
        };
        setText("[data-nopause-session]", this.sessionActive ? "Ενεργό (παίζει Quest video)" : "Σε αναμονή (δεν υπάρχει Quest video - το Discord λειτουργεί κανονικά)");
        setText("[data-nopause-focus]", this.playerFocus.status);
        setText("[data-nopause-mobile-status]", this.mobileQuests.getStatusText());
        return panel;
    }
};
