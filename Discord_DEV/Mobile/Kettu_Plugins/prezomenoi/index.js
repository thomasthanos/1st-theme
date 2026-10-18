(()=>{
const { findByStoreName, findByProps } = vendetta.metro;
const M = vendetta.metro;
const { after } = vendetta.patcher;
const GUILD_ID = "1216757265391161537";
const SERVER_TEXT = "Ghost Server";
const ICON_URL = "https://i.postimg.cc/vmvDRcRr/Chat-GPT-Image-14-2025-07-08-17.png";
const isG = a => a && (a === GUILD_ID || a.id === GUILD_ID || a.guildId === GUILD_ID || a.guild?.id === GUILD_ID);
const USERS = [
    { id: "411178013103751190", original: ["AnimalRapist"], target: "Akrivos", color: "#1F8249" },
    { id: "681933873877352472", original: ["Karaflopekatsos", "Tony Redgrave"], target: "Mpillias", color: "#734986" },
    { id: "1076347460500324363", original: ["Skiguros"], target: "Giannhs", color: "#1F8249" },
    { id: "633412575601623049", original: ["Pipirokauletas", "アスタ"], target: "Petros", color: "#206694" },
    { id: "804860278788456469", original: ["nyxterida", "ANNOUSKA"], target: "Eirini", color: "#FF69B4" },
    { id: "684773505157431347", original: ["FlaviBot"], target: "FlaviBot", color: "#FFD700" },
    { id: "324631108731928587", original: ["Simple Poll"], target: "Simple Poll", color: "#FFD700" },
    { id: "778355613373693953", original: ["Kontosouvli lover", "@Kontosouvli lover"], target: "Andreas", color: "#8B0000" },
    { id: null, original: ["Seniora Chara"], target: "Chara", color: "#9b59b6" }
];
const CHANNELS = {
    "1216778033550196856": "📜〢Rules",
    "1217201547054944377": "🎵〢Music",
    "1216757354574385203": "💬〢Chat",
    "1333458086094045385": "📽️〢Clips",
    "1344770404023144550": "📰〢Epikairotita",
    "1357173641745404006": "☘️〢Drugs",
    "1355323003084341359": "🌐〢Nord VPN",
    "1216757265936154689": "📞〢Larose",
    "1250083136818122813": "☣️〢Karkinos",
    "1216761517194739936": "⚖️〢Dikastirio",
    "1216818976898941068": "🎬〢Movies",
    "1345100969393917953": "🔏〢Secret",
    "1490509630776934500": "🤫〢Mpillias",
    "1517315171104849990": "🧪〢Exomologisi",
    "1459305637841473711": "🇩🇪〢secret channel",
    "1459297181721952307": "🇩🇪〢secret call"
};
const CATEGORIES = {
    "1216757265936154686": "💬",
    "1216757265936154687": "📱",
    "1459305587413094420": "🇩🇪"
};
const byId = {}; for (const u of USERS) if (u.id) byId[u.id] = u;
// Proxy view over the original record: keeps prototype/methods, overrides only given keys.
const cache = new WeakMap();
const view = (o, over) => {
  let per = cache.get(o); const key = JSON.stringify(over);
  if (per && per.k === key) return per.v;
  const v = new Proxy(o, { get: (t, p) => (p in over ? over[p] : Reflect.get(t, p, t)) });
  cache.set(o, { k: key, v }); return v;
};
const chOver = c => { if (!c || c.guild_id !== GUILD_ID) return null; const n = CHANNELS[c.id] ?? CATEGORIES[c.id]; return n ? { name: n } : null; };
const chName = c => { const o = chOver(c); return o ? view(c, o) : c; };
const ICON_HASH = "prezomenoi_icon";
const ICON_RE = new RegExp("/(icons|banners|splashes)/" + GUILD_ID + "/");
const swap = r => {
  if (typeof r === "string") return ICON_RE.test(r) || r === ICON_HASH ? ICON_URL : r;
  if (Array.isArray(r)) return r.map(swap);
  if (r && typeof r === "object" && typeof r.uri === "string" && ICON_RE.test(r.uri)) return { ...r, uri: ICON_URL };
  return r;
};
const gView = g => g && g.id === GUILD_ID ? view(g, {
  name: SERVER_TEXT, icon: ICON_HASH,
  getIconURL: () => ICON_URL, getIconSource: () => ({ uri: ICON_URL }),
}) : g;
// walk a rendered RN tree and replace image sources pointing at this guild's icon
const fixTree = (n, d = 0) => {
  if (!n || typeof n !== "object" || d > 40) return;
  if (Array.isArray(n)) { for (const c of n) fixTree(c, d + 1); return; }
  const p = n.props; if (!p) return;
  for (const k of ["source", "src", "uri", "url", "icon", "iconSource"]) if (p[k] != null) { const s = swap(p[k]); if (s !== p[k]) try { p[k] = s; } catch {} }
  if (p.guild?.id === GUILD_ID && p.guild.icon !== ICON_HASH) try { p.guild = gView(p.guild); } catch {}
  fixTree(p.children, d + 1);
};
const mapObj = (r, f) => { if (!r || typeof r !== "object") return r; if (Array.isArray(r)) return r.map(f); const o = {}; for (const k in r) o[k] = f(r[k]); return o; };
const uidOf = a => typeof a === "string" ? a : a?.id ?? a?.userId;
const patches = [];
const P = (obj, fn, cb) => { try { if (obj && typeof obj[fn] === "function") patches.push(after(fn, obj, cb)); } catch (e) { console.log("[prezomenoi]", fn, e); } };
function rerender() { try { for (const s of ["GuildStore","ChannelStore","GuildChannelStore","GuildMemberStore","UserStore","SelectedChannelStore"]) findByStoreName(s)?.emitChange?.(); } catch {} }
return {
  onLoad() {
    const GS = findByStoreName("GuildStore");
    P(GS, "getGuild", (_, g) => gView(g));
    P(GS, "getGuilds", (_, r) => mapObj(r, gView));
    const CS = findByStoreName("ChannelStore");
    for (const fn of ["getChannel", "getBasicChannel"]) P(CS, fn, (_, c) => chName(c));
    for (const fn of ["getMutableGuildChannelsForGuild", "getMutableBasicGuildChannelsForGuild", "loadAllGuildAndPrivateChannelsFromDisk"]) P(CS, fn, (_, r) => mapObj(r, chName));
    const GCS = findByStoreName("GuildChannelStore");
    P(GCS, "getChannels", ([gid], r) => {
      if (gid !== GUILD_ID || !r) return r; const o = { ...r };
      for (const k in o) if (Array.isArray(o[k])) o[k] = o[k].map(e => e?.channel ? { ...e, channel: chName(e.channel) } : e);
      return o;
    });
    const CN = findByProps("computeChannelName");
    P(CN, "computeChannelName", ([c], r) => chOver(c)?.name ?? r);
    const MS = findByStoreName("GuildMemberStore");
    P(MS, "getMember", ([gid, uid], m) => { const u = byId[uid]; return gid === GUILD_ID && u && m ? { ...m, nick: u.target, colorString: u.color } : m; });
    P(MS, "getNick", ([gid, uid], r) => gid === GUILD_ID && byId[uid] ? byId[uid].target : r);
    const nameCb = ([gid, , user], r) => gid === GUILD_ID && byId[uidOf(user)] ? byId[uidOf(user)].target : r;
    for (const mod of [findByProps("getName", "getNickname"), findByProps("getName", "useName")]) for (const fn of ["getName", "getNickname"]) P(mod, fn, nameCb);
    // (2)+(3) every icon/asset URL helper module: force by guild arg, and swap any built cdn icons/<gid>/ URL
    const all = p => { try { return M.findByPropsAll ? M.findByPropsAll(p) : [findByProps(p)]; } catch { return []; } };
    const mods = new Set();
    for (const p of ["getGuildIconURL", "getGuildIconSource", "getAnimatedGuildIconURL", "getGuildBannerURL", "getAvatarURL", "makeSource"]) for (const m of all(p)) if (m) mods.add(m);
    for (const m of mods) for (const fn of Object.keys(m)) {
      if (typeof m[fn] !== "function" || /^[A-Z]/.test(fn) || fn.startsWith("use")) continue;
      const forced = /guild.*icon/i.test(fn);
      P(m, fn, (a, r) => {
        if (forced && isG(a[0])) return typeof r === "string" || r == null ? (/Source/.test(fn) ? { uri: ICON_URL } : ICON_URL) : (typeof r === "object" ? { ...r, uri: ICON_URL } : r);
        return swap(r);
      });
    }
    // (4) GuildIcon-like React components: inject source into render output
    for (const nm of ["GuildIcon", "GuildIconImage", "GuildIconWithBadge", "GuildsBarItem", "GuildIconV2"]) {
      for (const how of ["findByName", "findByDisplayName"]) {
        try {
          const comp = M[how]?.(nm, false);
          if (comp && typeof comp.default === "function") { P(comp, "default", (_, r) => { fixTree(r); return r; }); break; }
          if (comp && typeof comp.type?.render === "function") { P(comp.type, "render", (_, r) => { fixTree(r); return r; }); break; }
        } catch {}
      }
    }
    rerender();
  },
  onUnload() { for (const p of patches.splice(0)) try { p(); } catch {} rerender(); }
};
})()