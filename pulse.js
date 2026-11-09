/* OMNI-KEY · «Прозрачность» + NANOBOTIKA v1 (пульс экосистемы)
   Только чтение блокчейна. Ключи, подписи и кошелёк не используются. */
(function () {
  "use strict";
  var C = window.OMNI, T = window.T, E = window.ethers;
  if (!C || !E || !T || !document.getElementById("pulse")) return;

  var RPCS = [C.RPC, "https://bsc-dataseed1.binance.org", "https://bsc-dataseed1.defibit.io", "https://bsc-rpc.publicnode.com"];
  var LOGS_RPCS = ["https://bsc-rpc.publicnode.com", C.RPC];
  var LOG_SPAN = 45000;               // < 50 000 блоков (лимит публичного узла) ~ 5.6 часа
  var BLOCK_SEC = 0.45;
  var LOC = window.LOCALE || "en-US";
  var $ = function (id) { return document.getElementById(id); };
  var nf = function (n, d) { return new Intl.NumberFormat(LOC, { maximumFractionDigits: d == null ? 0 : d }).format(n); };
  var cf = function (n) { return new Intl.NumberFormat(LOC, { notation: "compact", maximumFractionDigits: 2 }).format(n); };
  var dtf = function (ts) { return new Intl.DateTimeFormat(LOC, { year: "numeric", month: "short", day: "numeric", timeZone: "UTC" }).format(new Date(ts * 1000)); };
  var fmtUsd = function (n) { return n < 0.01 ? "$" + n.toPrecision(2) : "$" + nf(n, n < 100 ? 2 : 0); };
  var fmtPrice = function (n) { return "$" + n.toExponential(2).replace("e-", "e−"); };
  var fe = function (x) { return Number(E.formatUnits(x, 18)); };
  var short = function (a) { return a.slice(0, 6) + "…" + a.slice(-4); };
  var link = function (path, label) { return '<a target="_blank" rel="noopener" href="' + C.EXPLORER + path + '">' + label + "</a>"; };

  var ERC20 = ["function balanceOf(address) view returns (uint256)", "function totalSupply() view returns (uint256)"];
  var PAIR = ["function getReserves() view returns (uint112,uint112,uint32)", "function token0() view returns (address)", "function totalSupply() view returns (uint256)", "function balanceOf(address) view returns (uint256)"];
  var CL = ["function latestRoundData() view returns (uint80,int256,uint256,uint256,uint80)"];
  var VEST = ["function start() view returns (uint64)", "function cliff() view returns (uint64)", "function linearDuration() view returns (uint64)", "function released() view returns (uint256)", "function releasable() view returns (uint256)", "function totalAllocation() view returns (uint256)"];
  var STK = ["function totalStaked() view returns (uint256)", "function totalRewardsFunded() view returns (uint256)", "function totalRewardsPaid() view returns (uint256)", "function periodFinish() view returns (uint256)", "function rewardRate() view returns (uint256)"];
  var GP = ["function minted(uint256) view returns (uint256)", "function maxSupply(uint256) view returns (uint256)"];

  var provider = null, pIdx = 0;
  function mkProvider(i) { return new E.JsonRpcProvider(RPCS[i], undefined, { staticNetwork: E.Network.from(56), batchMaxCount: 1 }); }
  function withRpc(fn) {                      // пробуем узлы по очереди
    var tries = 0;
    function go() {
      provider = provider || mkProvider(pIdx);
      return fn(provider).catch(function (e) {
        if (++tries >= RPCS.length) throw e;
        pIdx = (pIdx + 1) % RPCS.length; provider = mkProvider(pIdx); return go();
      });
    }
    return go();
  }


  function renderLinks() {
    var L = [["KIIX Token", "/token/" + C.KIIX_TOKEN + "#code"], ["Staking", "/address/" + C.STAKING + "#code"], ["GatePass", "/address/" + C.GATEPASS + "#code"],
      ["Rewards", "/address/" + C.REWARDS + "#code"], ["Vesting", "/address/" + C.VESTING + "#code"], ["Pancake V2 pair", "/address/" + C.PAIR]];
    var h = L.filter(function (x) { return x[1].indexOf("undefined") === -1; }).map(function (x) { return link(x[1], x[0]); });
    if (C.LP_LOCK_URL) h.push('<a target="_blank" rel="noopener" href="' + C.LP_LOCK_URL + '">PinkLock</a>');
    $("tpLinks").innerHTML = h.join(" ");
  }
  renderLinks();

  var D = {};                                  // последние данные

  async function readState(p) {
    var token = new E.Contract(C.KIIX_TOKEN, ERC20, p);
    var pair = new E.Contract(C.PAIR, PAIR, p);
    var out = {};
    var blk = await p.getBlock("latest");
    out.block = blk.number; out.blockTs = blk.timestamp;
    var res = await pair.getReserves();
    var t0 = (await pair.token0()).toLowerCase();
    var kiixIs0 = t0 === C.KIIX_TOKEN.toLowerCase();
    out.rK = fe(kiixIs0 ? res[0] : res[1]); out.rB = fe(kiixIs0 ? res[1] : res[0]); out.kiixIs0 = kiixIs0;
    var cl = new E.Contract(C.CHAINLINK_BNB, CL, p); var r = await cl.latestRoundData();
    out.bnbUsd = Number(r[1]) / 1e8;
    out.price = out.rB * out.bnbUsd / out.rK; out.tvl = 2 * out.rB * out.bnbUsd;
    var lpTotal = await pair.totalSupply(); var lpLocked = await pair.balanceOf(C.PINKLOCK);
    out.lpPct = Number(lpLocked * 10000n / lpTotal) / 100;
    out.supply = fe(await token.totalSupply());
    var stk = new E.Contract(C.STAKING, STK, p);
    out.staked = fe(await stk.totalStaked()); out.funded = fe(await stk.totalRewardsFunded()); out.paid = fe(await stk.totalRewardsPaid());
    out.rewEnd = Number(await stk.periodFinish()); out.rate = fe(await stk.rewardRate());
    out.balStk = fe(await token.balanceOf(C.STAKING)); out.balPair = fe(await token.balanceOf(C.PAIR));
    out.balTeam = fe(await token.balanceOf(C.TEAM_WALLET));
    out.rewLeft = Math.max(0, out.funded - out.paid);
    if (C.VESTING) {
      var v = new E.Contract(C.VESTING, VEST, p);
      var vs = await Promise.all([v.start(), v.cliff(), v.linearDuration(), v.released(), v.releasable(), token.balanceOf(C.VESTING)]);
      out.vStart = Number(vs[0]); out.vCliff = Number(vs[1]); out.vDur = Number(vs[2]);
      out.vReleased = fe(vs[3]); out.vAvail = fe(vs[4]); out.balVest = fe(vs[5]);
      out.vTotal = out.balVest + out.vReleased;
    } else { out.balVest = 0; out.vTotal = 0; out.vReleased = 0; out.vAvail = 0; }
    if (C.GATEPASS) {
      var g = new E.Contract(C.GATEPASS, GP, p); out.passes = [];
      for (var i = 0; i < 4; i++) { var m = await g.minted(i), mx = await g.maxSupply(i); out.passes.push([Number(m), Number(mx)]); }
    }
    // проверки кода токена: нет owner(), нет mint(address,uint256)
    var code = (await p.getCode(C.KIIX_TOKEN)).toLowerCase();
    out.noMint = code.indexOf("40c10f19") === -1;
    out.noOwner = code.indexOf("8da5cb5b") === -1;
    return out;
  }

  /* ---------- проверки ---------- */
  function checks(d) {
    var now = Math.floor(Date.now() / 1000), days = (new Date(C.LP_LOCK_UNTIL + "T00:00:00Z").getTime() / 1000 - now) / 86400;
    var list = [];
    list.push([T("tp_c_lock"), d.lpPct >= 95 && days > 180 ? "ok" : d.lpPct >= 50 ? "warn" : "bad", T("tp_c_lock_v", { p: nf(d.lpPct, 2), d: dtf(new Date(C.LP_LOCK_UNTIL + "T00:00:00Z").getTime() / 1000) })]);
    if (C.VESTING) list.push([T("tp_c_vest"), d.vTotal >= 199999999 ? "ok" : d.vTotal > 0 ? "warn" : "bad", T("tp_c_vest_v", { a: nf(d.vTotal) })]);
    list.push([T("tp_c_rew"), d.rewLeft > 1e6 ? "ok" : d.rewLeft > 0 ? "warn" : "bad", T("tp_c_rew_v", { a: cf(d.rewLeft), d: dtf(d.rewEnd) })]);
    list.push([T("tp_c_owner"), d.noOwner ? "ok" : "bad", d.noOwner ? T("tp_c_owner_ok") : T("tp_c_owner_bad")]);
    list.push([T("tp_c_mint"), d.noMint && d.supply <= 1e9 ? "ok" : "bad", T("tp_c_mint_v", { a: nf(d.supply) })]);
    return list;
  }
  var ICON = { ok: "✔", warn: "!", bad: "✖", idle: "•" };

  /* ---------- Прозрачность ---------- */
  function renderTransparency(d) {
    var ch = checks(d); D.checks = ch;
    $("tpChecks").innerHTML = ch.map(function (c) { return '<li class="chk ' + c[1] + '"><i>' + ICON[c[1]] + "</i><span>" + c[0] + "</span><em>" + c[2] + "</em></li>"; }).join("");
    var row = function (k, v) { return '<div class="row"><span>' + k + "</span><b>" + v + "</b></div>"; };
    $("tpPool").innerHTML = row(T("tp_price"), fmtPrice(d.price)) + row(T("tp_tvl"), fmtUsd(d.tvl)) +
      row(T("tp_res"), cf(d.rK) + " KIIX + " + nf(d.rB, 4) + " BNB") + row(T("tp_locked"), nf(d.lpPct, 2) + "%") +
      row(T("tp_unlock"), dtf(new Date(C.LP_LOCK_UNTIL + "T00:00:00Z").getTime() / 1000)) +
      row("BNB / USD", "$" + nf(d.bnbUsd, 2)) +
      '<p class="note">' + link("/address/" + C.PAIR, "Pancake V2 pair") + " · " + (C.LP_LOCK_URL ? '<a target="_blank" rel="noopener" href="' + C.LP_LOCK_URL + '">PinkLock</a>' : "") + "</p>";
    if (C.VESTING) {
      var pct = d.vTotal ? (Math.min(d.vReleased + d.vAvail, d.vTotal) / d.vTotal * 100) : 0;
      $("tpVest").innerHTML = row(T("tp_v_locked"), nf(d.balVest) + " KIIX") + row(T("tp_v_cliff"), dtf(d.vStart + d.vCliff)) +
        row(T("tp_v_end"), dtf(d.vStart + d.vCliff + d.vDur)) + row(T("tp_v_rel"), nf(d.vReleased) + " KIIX") +
        row(T("tp_v_avail"), nf(d.vAvail) + " KIIX") + row(T("tp_v_pct"), nf(pct, 2) + "%") +
        '<p class="note">' + T("tp_v_note") + " " + link("/address/" + C.VESTING + "#code", "BscScan") + "</p>";
    }
    var other = Math.max(0, d.supply - d.balVest - d.balStk - d.balPair - d.balTeam);
    var parts = [
      ["tp_d_vest", d.balVest, "#ffd24a"], ["tp_d_stk", d.balStk, "#00ffcc"], ["tp_d_pool", d.balPair, "#4a73ff"],
      ["tp_d_team", d.balTeam, "#ff7a9c"], ["tp_d_other", other, "#8a96aa"]];
    $("tpDist").innerHTML = '<div class="bar">' + parts.map(function (p) { return '<i style="width:' + Math.max(0.4, p[1] / d.supply * 100) + "%;background:" + p[2] + '" title="' + T(p[0]) + '"></i>'; }).join("") + "</div>" +
      parts.map(function (p) { return '<div class="row"><span><u style="background:' + p[2] + '"></u>' + T(p[0]) + "</span><b>" + nf(p[1]) + " · " + nf(p[1] / d.supply * 100, 2) + "%</b></div>"; }).join("") +
      '<p class="note">' + T("tp_team_link") + " " + link("/address/" + C.TEAM_WALLET, short(C.TEAM_WALLET)) + "</p>";
    $("tpUpd").textContent = T("tp_updated", { t: new Date().toLocaleTimeString(LOC) });
  }

  /* ---------- NANOBOTIKA: светофор, метрики, тикер ---------- */
  function renderPulse(d) {
    var age = Math.max(0, Math.floor(Date.now() / 1000) - d.blockTs);
    var chain = age < 60 ? "ok" : age < 600 ? "warn" : "bad";
    var liq = d.tvl >= 1000 ? "ok" : d.tvl >= 20 ? "warn" : "bad";
    var chs = D.checks || checks(d), sec = chs.some(function (c) { return c[1] === "bad"; }) ? "bad" : chs.some(function (c) { return c[1] === "warn"; }) ? "warn" : "ok";
    var n = D.events ? D.events.length : null, hrs = nf(LOG_SPAN * BLOCK_SEC / 3600, 1);
    var act = n === null ? "idle" : n > 0 ? "ok" : "idle";
    var tl = [
      ["nb_tl_chain", chain, T(chain === "bad" ? "nb_chain_bad" : "nb_chain_ok", { b: nf(d.block), s: age })],
      ["nb_tl_liq", liq, T(liq === "ok" ? "nb_liq_ok" : liq === "warn" ? "nb_liq_low" : "nb_liq_bad", { v: fmtUsd(d.tvl) })],
      ["nb_tl_sec", sec, T(sec === "ok" ? "nb_sec_ok" : "nb_sec_bad")],
      ["nb_tl_act", act, n === null ? "…" : T(n > 0 ? "nb_act_some" : "nb_act_none", { n: n, h: hrs })]];
    $("nbTl").innerHTML = tl.map(function (x) { return '<div class="tl ' + x[1] + '"><i></i><div><b>' + T(x[0]) + "</b><span>" + x[2] + "</span></div></div>"; }).join("");
    var mk = [];
    mk.push(["nb_m_price", fmtPrice(d.price)]); mk.push(["nb_m_tvl", fmtUsd(d.tvl)]);
    mk.push(["nb_m_staked", cf(d.staked) + " KIIX"]); mk.push(["nb_m_emis", cf(d.rate * 86400) + " KIIX"]);
    mk.push(["nb_m_energy", (d.staked * C.ENERGY_PER_KIIX_J).toExponential(2).replace("e+", "e") + " J"]);
    if (d.passes) { var s = d.passes.reduce(function (a, p) { return a + p[0]; }, 0), m = d.passes.reduce(function (a, p) { return a + p[1]; }, 0); mk.push(["nb_m_passes", nf(s) + " / " + nf(m)]); }
    var days = Math.max(0, Math.round((new Date(C.LP_LOCK_UNTIL + "T00:00:00Z").getTime() / 1000 - Date.now() / 1000) / 86400));
    mk.push(["nb_m_lock", nf(days)]); mk.push(["nb_m_vest", cf(d.balVest) + " KIIX"]);
    $("nbMet").innerHTML = mk.map(function (m) { return "<div><b>" + m[1] + "</b><span>" + T(m[0]) + "</span></div>"; }).join("");
    // бегущая строка
    var items = mk.map(function (m) { return "<span><em>" + T(m[0]) + "</em> " + m[1] + "</span>"; }).join("");
    var tk = $("nbTicker"); if (tk) { tk.innerHTML = '<div class="tkIn">' + items + items + "</div>"; tk.hidden = false; }
    $("nbUpd").textContent = T("tp_updated", { t: new Date().toLocaleTimeString(LOC) });
  }

  /* ---------- лента событий ---------- */
  var IF_PAIR = new E.Interface(["event Swap(address indexed sender,uint256 amount0In,uint256 amount1In,uint256 amount0Out,uint256 amount1Out,address indexed to)"]);
  var IF_STK = new E.Interface(["event Staked(address indexed user,uint256 indexed id,uint256 amount,uint8 tier,uint64 unlockTime)", "event Claimed(address indexed user,uint256 indexed id,uint256 reward,uint256 fee)", "event Withdrawn(address indexed user,uint256 indexed id,uint256 amount)"]);
  var IF_GP = new E.Interface(["event Purchased(address indexed buyer,uint256 indexed tokenId,uint8 tier,address payToken,uint256 paid,uint256 usdPrice,address referrer,uint256 referralPaid)"]);
  var IF_RW = new E.Interface(["event EpochPublished(uint256 indexed id,address indexed token,bytes32 root,uint256 total,uint64 deadline)", "event Claimed(uint256 indexed id,address indexed user,uint256 amount)"]);
  var IF_V = new E.Interface(["event Released(address indexed to,uint256 amount)"]);

  async function logs(addr, from, to) {
    var last;
    for (var i = 0; i < LOGS_RPCS.length; i++) {
      try {
        var p = new E.JsonRpcProvider(LOGS_RPCS[i], undefined, { staticNetwork: E.Network.from(56), batchMaxCount: 1 });
        return await p.getLogs({ address: addr, fromBlock: from, toBlock: to });
      } catch (e) { last = e; }
    }
    throw last;
  }
  function parse(iface, lg) { try { return iface.parseLog(lg); } catch (e) { return null; } }

  async function loadEvents(d) {
    var to = d.block, from = Math.max(0, to - LOG_SPAN);
    try { var fb = await withRpc(function (p) { return p.getBlock(from); }); if (fb && d.blockTs > fb.timestamp) BLOCK_SEC = (d.blockTs - fb.timestamp) / (to - from); } catch (e) {}
    var srcs = [[C.PAIR, IF_PAIR, "pair"], [C.STAKING, IF_STK, "stk"]];
    if (C.GATEPASS) srcs.push([C.GATEPASS, IF_GP, "gp"]);
    if (C.REWARDS) srcs.push([C.REWARDS, IF_RW, "rw"]);
    if (C.VESTING) srcs.push([C.VESTING, IF_V, "v"]);
    var res = await Promise.allSettled(srcs.map(function (s) { return logs(s[0], from, to); }));
    var ev = [], okAny = false;
    res.forEach(function (r, i) {
      if (r.status !== "fulfilled") return; okAny = true;
      r.value.forEach(function (lg) {
        var pl = parse(srcs[i][1], lg); if (!pl) return;
        var a = pl.args, txt = null, kind = srcs[i][2];
        if (kind === "pair") {
          var k0 = d.kiixIs0;
          var kIn = fe(k0 ? a[1] : a[2]), bIn = fe(k0 ? a[2] : a[1]), kOut = fe(k0 ? a[3] : a[4]), bOut = fe(k0 ? a[4] : a[3]);
          if (kOut > 0 && bIn > 0) txt = ["buy", T("nb_e_buy", { k: cf(kOut), b: nf(bIn, 4), u: fmtUsd(bIn * d.bnbUsd) })];
          else if (kIn > 0 && bOut > 0) txt = ["sell", T("nb_e_sell", { k: cf(kIn), b: nf(bOut, 4), u: fmtUsd(bOut * d.bnbUsd) })];
        } else if (kind === "stk") {
          if (pl.name === "Staked") txt = ["stake", T("nb_e_stake", { a: cf(fe(a[2])), t: T("tier_" + Number(a[3])) })];
          else if (pl.name === "Claimed") txt = ["claim", T("nb_e_claim", { a: cf(fe(a[2])) })];
          else if (pl.name === "Withdrawn") txt = ["wd", T("nb_e_wd", { a: cf(fe(a[2])) })];
        } else if (kind === "gp") txt = ["pass", T("nb_e_pass", { t: T(["sec_alpha", "sec_beta", "sec_gamma", "sec_omega"][Number(a[2])] || "sec_alpha") })];
        else if (kind === "rw") txt = pl.name === "EpochPublished" ? ["rw", T("nb_e_rw", { n: Number(a[0]) })] : ["rwc", T("nb_e_rwc", { n: Number(a[0]) })];
        else if (kind === "v") txt = ["vest", T("nb_e_rel", { a: cf(fe(a[1])) })];
        if (txt) ev.push({ b: lg.blockNumber, i: lg.index, tx: lg.transactionHash, k: txt[0], t: txt[1] });
      });
    });
    ev.sort(function (x, y) { return y.b - x.b || y.i - x.i; });
    ev = ev.slice(0, 25);
    return okAny ? ev : null;
  }
  var ICO = { buy: "▲", sell: "▼", stake: "◉", claim: "✦", wd: "◌", pass: "◆", rw: "★", rwc: "★", vest: "⏳" };
  var rtf = null; try { rtf = new Intl.RelativeTimeFormat(LOC, { numeric: "auto" }); } catch (e) {}
  function ago(sec) { sec = Math.max(0, Math.round(sec)); if (!rtf) return sec + "s"; if (sec < 90) return rtf.format(-sec, "second"); if (sec < 5400) return rtf.format(-Math.round(sec / 60), "minute"); return rtf.format(-Math.round(sec / 3600), "hour"); }

  function renderFeed(d) {
    var hrs = nf(LOG_SPAN * BLOCK_SEC / 3600, 1);
    $("nbFeedH").textContent = T("nb_feed_h", { h: hrs });
    if (D.events === undefined) { $("nbFeed").innerHTML = '<li class="none">…</li>'; return; }
    if (D.events === null) { $("nbFeed").innerHTML = '<li class="none">' + T("nb_feed_err") + "</li>"; return; }
    if (!D.events.length) { $("nbFeed").innerHTML = '<li class="none">' + T("nb_feed_none", { h: hrs }) + "</li>"; return; }
    var nowTs = Math.floor(Date.now() / 1000);
    $("nbFeed").innerHTML = D.events.map(function (e) {
      var ts = d.blockTs - (d.block - e.b) * BLOCK_SEC;
      return '<li class="ev ' + e.k + '"><i>' + (ICO[e.k] || "•") + "</i><span>" + e.t + "</span><em>" + ago(nowTs - ts) + ' · <a target="_blank" rel="noopener" href="' + C.EXPLORER + "/tx/" + e.tx + '">tx</a></em></li>';
    }).join("");
  }

  /* ---------- цикл ---------- */
  var busy = false;
  async function tick(withEvents) {
    if (busy) return; busy = true;
    try {
      var d = await withRpc(readState); D.state = d;
      renderTransparency(d); renderPulse(d); renderFeed(d);
      if (withEvents) { try { D.events = await loadEvents(d); } catch (e) { D.events = null; } renderPulse(d); renderFeed(d); }
    } catch (e) {
      try { console.warn("pulse:", e && e.message); } catch (x) {}
      var m = '<p class="note">' + T("tp_err") + "</p>";
      if (!D.state) { $("tpChecks").innerHTML = m; $("nbTl").innerHTML = '<div class="tl bad"><i></i><div><b>' + T("nb_tl_chain") + "</b><span>" + T("nb_chain_bad") + "</span></div></div>"; }
    }
    busy = false;
  }
  var evT = 0;
  function loop() {
    if (document.hidden) return;
    var ev = Date.now() - evT > 90000; if (ev) evT = Date.now();
    tick(ev);
  }
  tick(true); evT = Date.now();
  setInterval(loop, 30000);
  document.addEventListener("visibilitychange", function () { if (!document.hidden) loop(); });
})();
