/* OMNI-KEY × KINETIX — frontend. Читает/пишет только публичные методы контрактов. Приватных ключей тут нет и быть не может. */
(function () {
  "use strict";
  const C = window.OMNI;
  const { ethers } = window;
  const $ = (id) => document.getElementById(id);

  const isAddr = (a) => { try { return ethers.isAddress(a) && a !== ethers.ZeroAddress; } catch { return false; } };
  const LIVE = isAddr(C.KIIX_TOKEN) && isAddr(C.STAKING);

  const TOKEN_ABI = [
    "function balanceOf(address) view returns (uint256)",
    "function allowance(address,address) view returns (uint256)",
    "function approve(address,uint256) returns (bool)",
  ];
  const STAKING_ABI = [
    "function totalStaked() view returns (uint256)",
    "function totalWeight() view returns (uint256)",
    "function rewardsPerYear() view returns (uint256)",
    "function aprBps(uint8) view returns (uint256)",
    "function totalRewardsFunded() view returns (uint256)",
    "function totalRewardsPaid() view returns (uint256)",
    "function positionsOf(address) view returns (tuple(uint128 amount,uint128 weight,uint64 unlockTime,uint8 tier,bool open,uint256 rewardDebt,uint256 pending)[])",
    "function pendingReward(address,uint256) view returns (uint256)",
    "function stake(uint256,uint8)",
    "function claim(uint256)",
    "function withdraw(uint256)",
  ];

  const GP_LIVE = isAddr(C.GATEPASS);
  const GP_ABI = [
    "function priceUsd(uint256) view returns (uint256)",
    "function minted(uint256) view returns (uint256)",
    "function maxSupply(uint256) view returns (uint256)",
    "function quote(uint8,address) view returns (uint256)",
    "function accessLevel(address) view returns (uint8)",
    "function saleOpen() view returns (bool)",
    "function buy(uint8,address,address) payable returns (uint256)",
  ];

  const TIERS = [
    { get name() { return T("tier_0"); }, days: 0,   mult: 1.0 },
    { get name() { return T("tier_1"); }, days: 30,  mult: 1.5 },
    { get name() { return T("tier_2"); }, days: 90,  mult: 2.5 },
    { get name() { return T("tier_3"); }, days: 180, mult: 4.0 },
  ];

  const ALLOC_PCT = [15, 20, 25, 10, 10, 10, 10];
  const allocList = () => ALLOC_PCT.map((p, i) => [T("alloc_" + i), p]);

  // ---------- state ----------
  const S = {
    tier: 1, account: null, signer: null,
    bal: 0n, allowance: 0n, positions: [], pend: [],
    g: { staked: 0n, weight: 0n, perYear: 0n, funded: 0n, paid: 0n, apr: [0n, 0n, 0n, 0n] },
  };
  const DEMO_G = {
    staked: ethers.parseUnits("12450000", 18), weight: ethers.parseUnits("24900000", 18),
    perYear: ethers.parseUnits("150000000", 18), funded: ethers.parseUnits("300000000", 18),
    paid: ethers.parseUnits("1250000", 18), apr: [60240n, 90360n, 150600n, 240960n],
  };

  const RW_LIVE = isAddr(C.REWARDS);
  const RW_ABI = [
    "function isClaimed(uint256,address) view returns (bool)",
    "function claim(uint256 id, uint256 amount, bytes32[] proof)",
    "function claimMany(uint256[] ids, uint256[] amounts, bytes32[][] proofs)",
    "function epochCount() view returns (uint256)",
  ];
  const BOOST = [1.0, 1.1, 1.25, 1.5, 2.0]; // = scripts/lib/epoch.js BOOST_BPS (none, Alpha, Beta, Gamma, Omega)
  let rRewards, wRewards;

  let readProvider, rToken, rStaking, wToken, wStaking, rGP, wGP;
  if (LIVE) {
    readProvider = new ethers.JsonRpcProvider(C.RPC, C.CHAIN_ID, { staticNetwork: true, cacheTimeout: -1 });
    rToken = new ethers.Contract(C.KIIX_TOKEN, TOKEN_ABI, readProvider);
    rStaking = new ethers.Contract(C.STAKING, STAKING_ABI, readProvider);
    if (GP_LIVE) rGP = new ethers.Contract(C.GATEPASS, GP_ABI, readProvider);
    if (RW_LIVE) rRewards = new ethers.Contract(C.REWARDS, RW_ABI, readProvider);
  }

  // state of Gate Pass
  S.gp = { price: [0n, 0n, 0n, 0n], minted: [0n, 0n, 0n, 0n], cap: [0n, 0n, 0n, 0n], quote: [null, null, null, null], open: true, level: 0 };
  S.cur = "BNB";
  const payAddr = () => (S.cur === "BNB" ? ethers.ZeroAddress : C.PAY_TOKENS[S.cur]);
  const refAddr = () => {
    try {
      const q = new URLSearchParams(location.search).get("ref");
      if (q && isAddr(q)) localStorage.setItem("okref", q);
      const r = localStorage.getItem("okref");
      return r && isAddr(r) && r.toLowerCase() !== (S.account || "").toLowerCase() ? r : ethers.ZeroAddress;
    } catch { return ethers.ZeroAddress; }
  };
  const fmtUsd = (w) => "$" + Number(ethers.formatUnits(w, 18)).toLocaleString(window.LOCALE, { maximumFractionDigits: 0 });

  // ---------- helpers ----------
  const fmtTok = (v, d = 2) => {
    const n = Number(ethers.formatUnits(v, 18));
    return n.toLocaleString(window.LOCALE, { maximumFractionDigits: d });
  };
  const SI = T("si");
  const fmtEnergy = (j) => {
    if (!isFinite(j) || j <= 0) return "0 " + SI[0];
    let i = 0; while (j >= 1000 && i < SI.length - 1) { j /= 1000; i++; }
    return j.toLocaleString(window.LOCALE, { maximumFractionDigits: 2 }) + " " + SI[i];
  };
  const energyOf = (wei) => Number(ethers.formatUnits(wei, 18)) * C.ENERGY_PER_KIIX_J;
  const short = (a) => a.slice(0, 6) + "…" + a.slice(-4);
  const fmtApr = (bps, hasStake) => {
    if (!hasStake) return T("apr_first");
    const p = Number(bps) / 100;
    if (p > 1e6) return T("over_1m");
    return p.toLocaleString(window.LOCALE, { maximumFractionDigits: 0 }) + "%";
  };
  let toastT;
  function toast(msg, err) {
    const t = $("toast"); t.textContent = msg; t.className = "show" + (err ? " err" : "");
    clearTimeout(toastT); toastT = setTimeout(() => (t.className = ""), err ? 7000 : 4500);
  }
  const errMsg = (e) => (e && (e.shortMessage || e.reason || e.message) || T("err")).toString().slice(0, 180);

  // ---------- static render ----------
  function renderStatic() {
    const banner = $("modeBanner");
    banner.textContent = LIVE ? T("banner_live") : T("banner_demo");
    if (LIVE) banner.className = "live";

    // particles
    $("particleGrid").innerHTML = C.PARTICLES.map((p) => `
      <div class="card particle ${p.status}">
        <div class="no">#${p.no}</div>
        ${p.status === "active" ? '<img class="pic" src="kiix.svg" alt="KIIX">' : '<div class="sealedIcon">🔒</div>'}
        <h3>${p.sym}</h3>
        <p><b>${p.status === "active" ? p.name : T("p_sealedname")}</b></p>
        <p>${T("p_role" + p.no)}</p>
        <p class="mono">${T("p_emission")}${p.supply}</p>
        <span class="pill ${p.status === "active" ? "on" : ""}">${p.status === "active" ? T("p_active") : T("p_sealed")}</span>
      </div>`).join("");

    // tiers
    $("tiers").innerHTML = TIERS.map((t, i) => `
      <button class="tier" data-t="${i}" type="button">
        <b>${t.name}</b><div class="m">×${t.mult.toFixed(1)}</div>
        <small>${t.days === 0 ? T("tier_nolock") : T("tier_lock", { d: t.days })}</small>
        <div class="apr" id="apr${i}">APR —</div>
      </button>`).join("");
    document.querySelectorAll(".tier").forEach((b) => b.addEventListener("click", () => { S.tier = +b.dataset.t; markTier(); recalcButtons(); }));
    markTier();

    // alloc
    $("alloc").innerHTML = allocList().map(([n, p]) => `<div class="a"><span>${n}</span><div class="t"><i style="width:${p * 3.5}%"></i></div><em>${p}%</em></div>`).join("") +
      `<p class="note">${allocList().map(([n, p]) => n + " " + T("mln", { n: p * 10 })).join(" · ")}</p>`;

    // links
    const tok = LIVE ? C.KIIX_TOKEN : null;
    $("tokAddr").textContent = tok ? short(tok) : T("after_deploy");
    const pc = C.PANCAKE_URL || (tok ? `https://pancakeswap.finance/swap?outputCurrency=${tok}&chain=bsc` : "#");
    const dd = C.DODO_URL || "https://app.dodoex.io/";
    $("buyPancake").href = pc; $("buyDodo").href = dd;
    $("buyHero").addEventListener("click", () => { });
    if (!tok) {
      $("buyPancake").addEventListener("click", (e) => { e.preventDefault(); toast(T("trade_soon")); });
    }
    if (C.LP_LOCK_URL && $("lpLockLi")) {
      const d = new Date(C.LP_LOCK_UNTIL + "T00:00:00Z").toLocaleDateString(window.LOCALE, { timeZone: "UTC", year: "numeric", month: "long", day: "numeric" });
      $("lpLockLi").innerHTML = T("tr_lp", { u: C.LP_LOCK_URL, d });
      $("lpLockLi").hidden = false;
    }
    $("footLinks").innerHTML = tok
      ? `<a target="_blank" rel="noopener" href="${C.EXPLORER}/token/${C.KIIX_TOKEN}">${T("foot_token")}</a> · <a target="_blank" rel="noopener" href="${C.EXPLORER}/address/${C.STAKING}">${T("foot_staking")}</a>${GP_LIVE ? ` · <a target="_blank" rel="noopener" href="${C.EXPLORER}/address/${C.GATEPASS}">${T("foot_pass")}</a>` : ""}${C.PAIR ? ` · <a target="_blank" rel="noopener" href="https://dexscreener.com/bsc/${C.PAIR}">${T("foot_chart")}</a>` : ""}${C.LP_LOCK_URL ? ` · <a target="_blank" rel="noopener" href="${C.LP_LOCK_URL}">${T("foot_lock")}</a>` : ""}${RW_LIVE ? ` · <a target="_blank" rel="noopener" href="${C.EXPLORER}/address/${C.REWARDS}">${T("foot_rewards")}</a>` : ""}`
      : T("foot_none");
  }

  function markTier() {
    document.querySelectorAll(".tier").forEach((b) => b.classList.toggle("sel", +b.dataset.t === S.tier));
    const t = TIERS[S.tier];
    $("selTier").textContent = `${t.name} ×${t.mult.toFixed(1)} · ${t.days ? T("d_short", { d: t.days }) : T("tier_nolock_short")}`;
  }

  function renderSectors(userWei) {
    S.lastUserWei = userWei || 0n;
    const e = energyOf(S.lastUserWei);
    const g = S.gp;
    $("sectorGrid").innerHTML = C.SECTORS.map((s, i) => {
      const byEnergy = e >= s.need;
      const byPass = g.level >= i + 1;
      const open = byEnergy || byPass;
      const pct = Math.min(100, (e / s.need) * 100);
      let shop = `<p class="note">${T("pass_soon")}</p>`;
      if (GP_LIVE) {
        const left = g.cap[i] > 0n ? (g.cap[i] - g.minted[i]).toString() + " / " + g.cap[i].toString() : "…";
        const q = g.quote[i] != null ? "≈ " + Number(ethers.formatUnits(g.quote[i], 18)).toLocaleString(window.LOCALE, { maximumFractionDigits: 6 }) + " " + S.cur : "";
        const sold = g.cap[i] > 0n && g.minted[i] >= g.cap[i];
        shop = `<div class="shop"><div class="price">${fmtUsd(g.price[i])}</div><p class="note">${q}</p><p class="note">${T("pass_left", { n: left })}</p>
          <button class="btn sm gold full" data-pass="${i}" ${!g.open || sold ? "disabled" : ""}>${sold ? T("pass_sold") : g.open ? T("pass_buy") : T("pass_closed")}</button></div>`;
      }
      return `<div class="card sector ${open ? "open" : ""}">
        <div class="ring">${open ? "🔓" : "🔒"}</div>
        <h3>${T("s_word")} ${T("sec_" + s.id)}</h3>
        <p class="mono">${fmtEnergy(s.need)}</p><p>${Math.round(s.need / C.ENERGY_PER_KIIX_J).toLocaleString(window.LOCALE)} KIIX</p>
        <div class="bar"><i style="width:${pct.toFixed(1)}%"></i></div>
        <p class="note">${open ? (byPass && !byEnergy ? T("sec_open_pass") : T("sec_open")) : T("sec_pct", { p: pct.toFixed(1) })}</p>
        ${shop}</div>`;
    }).join("");
    document.querySelectorAll("[data-pass]").forEach((b) => b.addEventListener("click", () => buyPass(+b.dataset.pass, b)));
    const rb = $("refBox");
    if (rb) {
      const show = GP_LIVE && S.account && g.level > 0;
      rb.hidden = !show;
      if (show) $("refLink").value = C.SITE_URL.replace(/\/?$/, "/") + "?ref=" + S.account;
    }
  }

  // ---------- gate pass ----------
  async function refreshPass() {
    if (!GP_LIVE) return;
    try {
      const idx = [0, 1, 2, 3];
      const [price, minted, cap, open] = await Promise.all([
        Promise.all(idx.map((i) => rGP.priceUsd(i))), Promise.all(idx.map((i) => rGP.minted(i))),
        Promise.all(idx.map((i) => rGP.maxSupply(i))), rGP.saleOpen(),
      ]);
      const quote = await Promise.all(idx.map((i) => rGP.quote(i, payAddr()).catch(() => null)));
      const level = S.account ? Number(await rGP.accessLevel(S.account)) : 0;
      S.gp = { price, minted, cap, quote, open, level };
    } catch (e) { console.warn("pass read failed", e); }
    renderSectors(S.lastUserWei || 0n);
  }

  async function buyPass(tier, btn) {
    if (!S.account) { await connect(); if (!S.account) return; }
    if (!GP_LIVE) return toast(T("pass_soon_t"));
    try {
      const cur = payAddr();
      const q = await rGP.quote(tier, cur);
      const ref = refAddr();
      if (S.cur === "BNB") {
        const bal = await readProvider.getBalance(S.account);
        const value = (q * 101n) / 100n; // +1% на движение курса, излишек вернётся
        if (bal < value) return toast(T("no_bnb", { n: ethers.formatEther(value) }), true);
        await act(btn, () => wGP.buy(tier, cur, ref, { value }), T("ok_bought"), () => { if (!reduce) burst(120); });
      } else {
        const tk = new ethers.Contract(cur, TOKEN_ABI, S.signer);
        const need = S.cur === "ETH" ? (q * 101n) / 100n : q;
        const bal = await tk.balanceOf(S.account);
        if (bal < need) return toast(T("no_cur", { c: S.cur }), true);
        const alw = await tk.allowance(S.account, C.GATEPASS);
        if (alw < need) {
          const ok = await act(btn, () => tk.approve(C.GATEPASS, need), T("ok_approve_pass"));
          return ok;
        }
        await act(btn, () => wGP.buy(tier, cur, ref), T("ok_bought"), () => { if (!reduce) burst(120); });
      }
    } catch (e) { toast(errMsg(e), true); }
  }

  // ---------- global data ----------
  async function refreshGlobal() {
    try {
      if (LIVE) {
        const [staked, weight, perYear, funded, paid, a0, a1, a2, a3] = await Promise.all([
          rStaking.totalStaked(), rStaking.totalWeight(), rStaking.rewardsPerYear(),
          rStaking.totalRewardsFunded(), rStaking.totalRewardsPaid(),
          rStaking.aprBps(0), rStaking.aprBps(1), rStaking.aprBps(2), rStaking.aprBps(3),
        ]);
        S.g = { staked, weight, perYear, funded, paid, apr: [a0, a1, a2, a3] };
      } else S.g = DEMO_G;
    } catch (e) { console.warn("global read failed", e); }
    const g = S.g;
    $("sEnergy").textContent = fmtEnergy(energyOf(g.staked));
    $("sBound").textContent = fmtTok(g.staked, 0);
    $("sFill").textContent = ((Number(ethers.formatUnits(g.staked, 18)) / C.KIIX_SUPPLY) * 100).toFixed(6) + "%";
    $("sPool").textContent = fmtTok(g.funded - g.paid, 0);
    $("gStaked").textContent = fmtTok(g.staked, 0) + " KIIX";
    $("gPerYear").textContent = fmtTok(g.perYear, 0) + " KIIX";
    for (let i = 0; i < 4; i++) $("apr" + i).textContent = "APR " + fmtApr(g.apr[i], g.weight > 0n);
  }

  // ---------- user data ----------
  async function refreshUser() {
    if (!S.account) return;
    if (!LIVE) { $("uBal").textContent = T("demo"); renderSectors(0n); return; }
    try {
      const [bal, alw, pos] = await Promise.all([
        rToken.balanceOf(S.account), rToken.allowance(S.account, C.STAKING), rStaking.positionsOf(S.account),
      ]);
      S.bal = bal; S.allowance = alw;
      S.positions = pos.map((p, i) => ({ id: i, amount: p.amount, unlock: Number(p.unlockTime), tier: Number(p.tier), open: p.open }));
      const open = S.positions.filter((p) => p.open);
      S.pend = await Promise.all(open.map((p) => rStaking.pendingReward(S.account, p.id)));
      const staked = open.reduce((a, p) => a + p.amount, 0n);
      const pending = S.pend.reduce((a, v) => a + v, 0n);
      $("uBal").textContent = fmtTok(bal) + " KIIX";
      $("uStaked").textContent = fmtTok(staked) + " KIIX";
      $("uPending").textContent = fmtTok(pending, 4) + " KIIX";
      $("uEnergy").textContent = fmtEnergy(energyOf(staked));
      renderSectors(staked);
      renderPositions(open);
      recalcButtons();
    } catch (e) { console.warn(e); toast(T("read_fail") + errMsg(e), true); }
  }

  function renderPositions(open) {
    const body = $("posBody");
    if (!open.length) { body.innerHTML = `<tr><td colspan="6" class="empty">${T("pos_empty")}</td></tr>`; return; }
    const now = Math.floor(Date.now() / 1000);
    body.innerHTML = open.map((p, k) => {
      const left = p.unlock - now;
      const unlocked = left <= 0;
      const when = unlocked ? T("unlocked") : left > 86400 ? T("d_short", { d: Math.ceil(left / 86400) }) : T("h_short", { h: Math.ceil(left / 3600) });
      return `<tr><td>${p.id}</td><td>${TIERS[p.tier].name} ×${TIERS[p.tier].mult.toFixed(1)}</td><td>${fmtTok(p.amount)}</td><td>${when}</td><td>${fmtTok(S.pend[k], 4)}</td>
        <td><button class="btn sm" data-claim="${p.id}">${T("claim")}</button><button class="btn sm gold" data-wd="${p.id}" ${unlocked ? "" : "disabled"}>${T("withdraw")}</button></td></tr>`;
    }).join("");
    body.querySelectorAll("[data-claim]").forEach((b) => b.addEventListener("click", () => act(b, () => wStaking.claim(+b.dataset.claim), T("ok_claim"))));
    body.querySelectorAll("[data-wd]").forEach((b) => b.addEventListener("click", () => act(b, () => wStaking.withdraw(+b.dataset.wd), T("ok_withdraw"))));
  }

  // ---------- wallet ----------
  async function ensureChain() {
    try { await window.ethereum.request({ method: "wallet_switchEthereumChain", params: [{ chainId: C.CHAIN_HEX }] }); }
    catch (e) {
      if (e && e.code === 4902) {
        await window.ethereum.request({ method: "wallet_addEthereumChain", params: [{
          chainId: C.CHAIN_HEX, chainName: C.CHAIN_NAME, nativeCurrency: { name: "BNB", symbol: "BNB", decimals: 18 },
          rpcUrls: [C.RPC], blockExplorerUrls: [C.EXPLORER] }] });
      } else throw e;
    }
  }

  async function connect() {
    if (!window.ethereum) return toast(T("no_mm"), true);
    try {
      await window.ethereum.request({ method: "eth_requestAccounts" });
      if (LIVE) await ensureChain();
      const bp = new ethers.BrowserProvider(window.ethereum); bp.pollingInterval = 1500;
      S.signer = await bp.getSigner();
      S.account = await S.signer.getAddress();
      if (LIVE) {
        wToken = new ethers.Contract(C.KIIX_TOKEN, TOKEN_ABI, S.signer);
        wStaking = new ethers.Contract(C.STAKING, STAKING_ABI, S.signer);
        if (GP_LIVE) wGP = new ethers.Contract(C.GATEPASS, GP_ABI, S.signer);
        if (RW_LIVE) wRewards = new ethers.Contract(C.REWARDS, RW_ABI, S.signer);
      }
      $("connectBtn").textContent = short(S.account);
      $("connectBtn").classList.add("on");
      $("connectBtn").title = T("connected_title") + S.account;
      $("stakeNote").textContent = LIVE ? T("stake_note") : T("stake_demo");
      await refreshUser();
      await refreshPass();
      refreshRewards();
    } catch (e) { toast(errMsg(e), true); }
  }

  async function autoConnect() {
    if (!window.ethereum) return;
    try {
      const acc = await window.ethereum.request({ method: "eth_accounts" });
      if (!acc || !acc.length) return;
      if (LIVE) {
        const cid = await window.ethereum.request({ method: "eth_chainId" });
        if (String(cid).toLowerCase() !== String(C.CHAIN_HEX).toLowerCase()) return;
      }
      await connect();
    } catch (e) {}
  }

  // ---------- actions ----------
  function parseAmt() {
    const v = $("amount").value.trim();
    if (!v) return 0n;
    try { return ethers.parseUnits(v, 18); } catch { return 0n; }
  }
  function recalcButtons() {
    const a = parseAmt();
    const ok = LIVE && S.account && a > 0n && a <= S.bal;
    const need = a > S.allowance;
    $("approveBtn").disabled = !(ok && need);
    $("stakeBtn").disabled = !(ok && !need);
  }
  async function act(btn, fn, okMsg, after) {
    const old = btn.textContent; btn.disabled = true; btn.textContent = T("sign");
    let ok = false;
    try {
      const tx = await fn();
      btn.textContent = T("wait");
      await tx.wait();
      await new Promise((r) => setTimeout(r, 1800)); // даём публичному RPC догнать блок
      toast("✅ " + okMsg);
      if (after) after();
      ok = true;
    } catch (e) { toast(errMsg(e), true); }
    btn.textContent = old;
    await Promise.all([refreshUser(), refreshGlobal(), refreshPass(), refreshRewards()]);
    recalcButtons();
    return ok;
  }


  // ---------- rewards program ----------
  function renderBoost() {
    const names = [T("rw_boost_none"), T("sec_alpha"), T("sec_beta"), T("sec_gamma"), T("sec_omega")];
    $("rwBoost").innerHTML = names.map((n, i) => `<div class="row"><span>${n}</span><b>×${BOOST[i].toFixed(2)}</b></div>`).join("");
  }
  async function refreshRewards() {
    const box = $("rwYours");
    if (!box) return;
    if (!S.account) { box.innerHTML = `<p class="note">${T("rw_connect")}</p>`; return; }
    if (!RW_LIVE) { box.innerHTML = `<p class="note">${T("rw_soon")}</p>`; return; }
    try {
      const r = await fetch("rewards/index.json?t=" + Date.now(), { cache: "no-store" });
      if (!r.ok) throw new Error("no index");
      const idx = await r.json();
      if (!idx.epochs || !idx.epochs.length) { box.innerHTML = `<p class="note">${T("rw_soon")}</p>`; return; }
      const me = S.account.toLowerCase();
      const items = [];
      for (const e of idx.epochs) {
        const f = await (await fetch(e.file + "?t=" + Date.now(), { cache: "no-store" })).json();
        const c = f.claims && f.claims[me];
        if (!c) continue;
        const done = await rRewards.isClaimed(e.id, S.account);
        items.push({ id: e.id, sym: e.symbol, dec: e.decimals, amount: c.amount, proof: c.proof, done });
      }
      if (!items.length) { box.innerHTML = `<p class="note">${T("rw_none")}</p>`; return; }
      const esc = (v) => String(v).replace(/[^A-Za-z0-9._-]/g, "").slice(0, 12);   // защита от HTML в данных эпох
      items.forEach((it) => { it.sym = esc(it.sym); it.id = Number(it.id); });
      const fmt = (it) => Number(ethers.formatUnits(it.amount, it.dec)).toLocaleString(window.LOCALE, { maximumFractionDigits: 6 });
      const open = items.filter((i) => !i.done);
      box.innerHTML = items.map((it) => `<div class="rwEp"><div><span>${T("rw_epoch", { n: it.id + 1 })}</span> <b>${fmt(it)} ${it.sym}</b></div>
        ${it.done ? `<span class="pill on">${T("rw_got")}</span>` : `<button class="btn sm gold" data-rw="${it.id}">${T("rw_claim", { a: fmt(it), s: it.sym })}</button>`}</div>`).join("")
        + (open.length > 1 ? `<div style="margin-top:10px"><button class="btn sm full" id="rwAll">${T("rw_claim_all")}</button></div>` : "");
      box.querySelectorAll("[data-rw]").forEach((b) => b.addEventListener("click", () => {
        const it = items.find((x) => x.id === +b.dataset.rw);
        act(b, () => wRewards.claim(it.id, it.amount, it.proof), T("rw_ok"), () => { if (!reduce) burst(60); });
      }));
      const all = $("rwAll");
      if (all) all.addEventListener("click", () => act(all, () => wRewards.claimMany(open.map((x) => x.id), open.map((x) => x.amount), open.map((x) => x.proof)), T("rw_ok")));
    } catch (e) { console.warn("rewards", e); box.innerHTML = `<p class="note">${T("rw_soon")}</p>`; }
  }

  // ---------- starfield + quanta ----------
  const cv = $("stars"), ctx = cv.getContext("2d");
  let W, H, stars = [], quanta = [], mx = 0.5, my = 0.5;
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  function resize() {
    W = cv.width = innerWidth; H = cv.height = innerHeight;
    stars = Array.from({ length: Math.min(160, Math.floor(W * H / 9000)) }, () => ({
      x: Math.random() * W, y: Math.random() * H, z: Math.random() * 0.9 + 0.1,
      c: ["#f6e2a0", "#7fa0ff", "#bfeaff", "#00ffcc"][Math.floor(Math.random() * 4)] }));
  }
  function burst(n) {
    for (let i = 0; i < n; i++) quanta.push({
      x: Math.random() * W, y: H + 10, vx: (Math.random() - 0.5) * 3, vy: -2 - Math.random() * 4, life: 1,
      c: Math.random() < 0.5 ? "#f6e2a0" : "#00ffcc" });
  }
  function frame() {
    ctx.clearRect(0, 0, W, H);
    for (const s of stars) {
      s.y += s.z * 0.15; if (s.y > H) { s.y = 0; s.x = Math.random() * W; }
      const px = s.x + (mx - 0.5) * 30 * s.z, py = s.y + (my - 0.5) * 30 * s.z;
      ctx.globalAlpha = 0.25 + s.z * 0.6; ctx.fillStyle = s.c;
      ctx.beginPath(); ctx.arc(px, py, s.z * 1.5, 0, 6.283); ctx.fill();
    }
    const tx = W / 2, ty = H * 0.28;
    for (const q of quanta) {
      q.vx += (tx - q.x) * 0.0009; q.vy += (ty - q.y) * 0.0009;
      q.x += q.vx; q.y += q.vy; q.life -= 0.006;
      ctx.globalAlpha = Math.max(0, q.life); ctx.fillStyle = q.c; ctx.shadowColor = q.c; ctx.shadowBlur = 8;
      ctx.beginPath(); ctx.arc(q.x, q.y, 2.2, 0, 6.283); ctx.fill(); ctx.shadowBlur = 0;
    }
    quanta = quanta.filter((q) => q.life > 0);
    ctx.globalAlpha = 1;
    requestAnimationFrame(frame);
  }
  if (!reduce) {
    addEventListener("resize", resize); addEventListener("mousemove", (e) => { mx = e.clientX / W; my = e.clientY / H; });
    resize(); frame();
  }

  // ---------- wire up ----------
  function init() {
    renderStatic();
    renderBoost();
    renderSectors(0n);
    $("connectBtn").addEventListener("click", connect);
    if ($("payCur")) $("payCur").addEventListener("change", (e) => { S.cur = e.target.value; refreshPass(); });
    if ($("copyRef")) $("copyRef").addEventListener("click", () => { $("refLink").select(); try { navigator.clipboard.writeText($("refLink").value); } catch {} toast(T("copied")); });
    refAddr();
    $("amount").addEventListener("input", recalcButtons);
    $("maxBtn").addEventListener("click", () => { $("amount").value = ethers.formatUnits(S.bal, 18); recalcButtons(); });
    $("approveBtn").addEventListener("click", () => act($("approveBtn"), () => wToken.approve(C.STAKING, parseAmt()), T("ok_approve_stake")));
    $("stakeBtn").addEventListener("click", () => act($("stakeBtn"), () => wStaking.stake(parseAmt(), S.tier), T("ok_staked"), () => { $("amount").value = ""; if (!reduce) burst(90); }));
    $("addTokenBtn").addEventListener("click", async () => {
      if (!LIVE) return toast(T("tok_nd"));
      if (!window.ethereum) return toast(T("no_mm2"), true);
      try {
        await ensureChain();
        const options = { address: C.KIIX_TOKEN, symbol: "KIIX", decimals: 18 };
        if (C.SITE_URL) options.image = C.SITE_URL.replace(/\/?$/, "/") + "kiix.svg";
        await window.ethereum.request({ method: "wallet_watchAsset", params: { type: "ERC20", options } });
      } catch (e) { toast(errMsg(e), true); }
    });
    if (window.ethereum) {
      window.ethereum.on && window.ethereum.on("accountsChanged", () => location.reload());
      window.ethereum.on && window.ethereum.on("chainChanged", () => location.reload());
    }
    autoConnect();
    refreshGlobal();
    refreshPass();
    setInterval(refreshGlobal, 20000);
    setInterval(refreshPass, 30000);
    setInterval(refreshUser, 12000);
  }
  init();
})();

/* ---- artifact orb animation ---- */
(function(){
  var orb=document.getElementById('orb'),tilt=document.getElementById('orbTilt'),cv=document.getElementById('orbSpark');
  if(!orb||!tilt||!cv)return;
  var reduce=window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var ctx=cv.getContext('2d'),dpr=Math.min(window.devicePixelRatio||1,2),W=0;
  function size(){W=orb.clientWidth;cv.width=cv.height=Math.round(W*dpr);}
  size();window.addEventListener('resize',size);
  var stars=[],i;
  for(i=0;i<16;i++){var a=Math.random()*6.283,r=Math.sqrt(Math.random())*0.44;
    stars.push({x:.5+Math.cos(a)*r,y:.5+Math.sin(a)*r,s:.012+Math.random()*.02,p:Math.random()*6.283,v:.6+Math.random()*1.2,g:Math.random()<.35});}
  var running=true,mx=0,my=0,tx=0,ty=0,cx=0,cy=0,moved=false,visible=true,t0=performance.now();
  window.addEventListener('mousemove',function(e){var b=orb.getBoundingClientRect();
    var dx=(e.clientX-(b.left+b.width/2))/(window.innerWidth/2),dy=(e.clientY-(b.top+b.height/2))/(window.innerHeight/2);
    mx=Math.max(-1,Math.min(1,dx));my=Math.max(-1,Math.min(1,dy));moved=true;},{passive:true});
  if('IntersectionObserver' in window){new IntersectionObserver(function(en){visible=en[0].isIntersecting;if(visible&&!running){running=true;requestAnimationFrame(frame);}}).observe(orb);}
  function star(x,y,s,a,gold){
    ctx.save();ctx.translate(x,y);ctx.globalAlpha=a;
    var g=ctx.createRadialGradient(0,0,0,0,0,s*1.6);
    g.addColorStop(0,gold?'rgba(255,225,150,.95)':'rgba(255,255,255,.95)');g.addColorStop(1,'rgba(255,255,255,0)');
    ctx.fillStyle=g;ctx.beginPath();ctx.arc(0,0,s*1.6,0,6.283);ctx.fill();
    ctx.strokeStyle=gold?'rgba(255,235,180,.95)':'rgba(255,255,255,.95)';ctx.lineWidth=Math.max(1,s*.12);
    ctx.beginPath();ctx.moveTo(-s*2.4,0);ctx.lineTo(s*2.4,0);ctx.moveTo(0,-s*2.4);ctx.lineTo(0,s*2.4);ctx.stroke();ctx.restore();
  }
  function frame(now){
    if(!visible){running=false;return;}
    var t=(now-t0)/1000;
    if(!moved){tx=Math.sin(t*.45)*.55;ty=Math.cos(t*.37)*.35;}else{tx=mx;ty=my;}
    cx+=(tx-cx)*.06;cy+=(ty-cy)*.06;
    var fl=reduce?0:Math.sin(t*.9)*7;
    tilt.style.transform='translateY('+fl.toFixed(2)+'px) rotateY('+(cx*9).toFixed(2)+'deg) rotateX('+(-cy*7).toFixed(2)+'deg)';
    ctx.clearRect(0,0,cv.width,cv.height);
    if(!reduce){for(var k=0;k<stars.length;k++){var s=stars[k],ph=Math.sin(t*s.v+s.p),al=Math.max(0,ph);al=al*al*al;
      if(al>.02)star((s.x+cx*.012)*cv.width,(s.y+cy*.012)*cv.height,s.s*cv.width*(.6+al*.6),al,s.g);}}
    if(!reduce)requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
})();
