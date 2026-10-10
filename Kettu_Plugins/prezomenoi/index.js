(()=>{
const { findByStoreName, findByProps } = vendetta.metro;
const { after } = vendetta.patcher;
const GUILD_ID = "1216757265391161537";
const SERVER_TEXT = "Ghost Server";
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
const patches = [];
const clone = (o, ch) => { const c = Object.create(Object.getPrototypeOf(o)); Object.assign(c, o, ch); return c; };
function chName(c) {
  if (!c || c.guild_id !== GUILD_ID) return c;
  const n = CHANNELS[c.id] ?? CATEGORIES[c.id];
  return n && c.name !== n ? clone(c, { name: n }) : c;
}
function rerender() { try { for (const s of ["GuildStore","ChannelStore","GuildMemberStore","UserStore"]) findByStoreName(s)?.emitChange?.(); } catch {} }
return {
  onLoad() {
    try {
      const GS = findByStoreName("GuildStore");
      patches.push(after("getGuild", GS, ([id], g) => g && id === GUILD_ID && g.name !== SERVER_TEXT ? clone(g, { name: SERVER_TEXT }) : g));
    } catch (e) { console.log("[prezomenoi] guild", e); }
    try {
      const CS = findByStoreName("ChannelStore");
      patches.push(after("getChannel", CS, (_, c) => chName(c)));
      if (CS.getMutableGuildChannelsForGuild) patches.push(after("getMutableGuildChannelsForGuild", CS, ([gid], r) => {
        if (gid !== GUILD_ID || !r) return r; const o = {}; for (const k in r) o[k] = chName(r[k]); return o; }));
    } catch (e) { console.log("[prezomenoi] channel", e); }
    try {
      const MS = findByStoreName("GuildMemberStore");
      patches.push(after("getMember", MS, ([gid, uid], m) => {
        const u = byId[uid]; if (gid !== GUILD_ID || !u || !m) return m;
        return { ...m, nick: u.target, colorString: u.color, colorStrings: m.colorStrings ? { ...m.colorStrings, primaryColor: u.color } : m.colorStrings };
      }));
      const UN = findByProps("getName", "getNickname");
      if (UN?.getName) patches.push(after("getName", UN, ([gid, , user], r) => gid === GUILD_ID && user && byId[user.id] ? byId[user.id].target : r));
      if (UN?.getNickname) patches.push(after("getNickname", UN, ([gid, , user], r) => gid === GUILD_ID && user && byId[user.id] ? byId[user.id].target : r));
    } catch (e) { console.log("[prezomenoi] member", e); }
    rerender();
  },
  onUnload() { for (const p of patches.splice(0)) try { p(); } catch {} rerender(); }
};
})()