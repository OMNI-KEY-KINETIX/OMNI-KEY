/* OMNI-KEY v20 extras: event calendar (countdowns) + "share on X" for the referral link.
   Read-only, no wallet, no external requests. Dates come from config.js (copies of contract parameters). */
(function () {
  "use strict";
  var C = window.OMNI || {};
  var DAY = 86400;
  function $(id) { return document.getElementById(id); }
  function fmtDate(ts) {
    try { return new Date(ts * 1000).toLocaleDateString(window.LOCALE || undefined, { timeZone: "UTC", year: "numeric", month: "long", day: "numeric" }); }
    catch (e) { return new Date(ts * 1000).toISOString().slice(0, 10); }
  }
  function iso(d) { var t = Date.parse(d + "T00:00:00Z"); return isNaN(t) ? 0 : Math.floor(t / 1000); }
  function events() {
    var cliffEnd = (C.VESTING_START || 0) + (C.VESTING_CLIFF_S || 0);
    var vestEnd = cliffEnd + (C.VESTING_LINEAR_S || 0);
    var list = [
      { k: "tl_cliff", ts: cliffEnd, ic: "🔓" },
      { k: "tl_lp", ts: iso(C.LP_LOCK_UNTIL || ""), ic: "🔒" },
      { k: "tl_vest_end", ts: vestEnd, ic: "📜" },
      { k: "tl_stake_end", ts: iso(C.STAKING_REWARDS_END || ""), ic: "⚡" }
    ].filter(function (e) { return e.ts > 0; });
    list.sort(function (a, b) { return a.ts - b.ts; });
    return list;
  }
  function render() {
    var g = $("tlGrid"); if (!g || typeof window.T !== "function") return;
    var now = Math.floor(Date.now() / 1000), html = "";
    events().forEach(function (e) {
      var left = e.ts - now, status;
      if (left <= 0) status = '<b class="tlDone">' + window.T("tl_done") + "</b>";
      else status = '<b class="tlLeft">' + window.T("tl_in", { d: Math.ceil(left / DAY).toLocaleString(window.LOCALE || undefined) }) + "</b>";
      html += '<div class="card tlCard"><div class="tlIc">' + e.ic + "</div><div><h3>" + window.T(e.k) + '</h3><p class="mono">' + fmtDate(e.ts) + "</p><p>" + status + "</p><p class=\"note\">" + window.T(e.k + "_n") + "</p></div></div>";
    });
    g.innerHTML = html;
  }
  function wireShare() {
    var b = $("shareX"); if (!b) return;
    b.addEventListener("click", function (ev) {
      ev.preventDefault();
      var l = $("refLink"), url = (l && l.value) || C.SITE_URL || "";
      if (!/^https:\/\/[A-Za-z0-9.\/_?=&%#:-]+$/.test(url)) return;
      var text = window.T("share_text");
      window.open("https://x.com/intent/post?text=" + encodeURIComponent(text) + "&url=" + encodeURIComponent(url), "_blank", "noopener");
    });
  }
  function init() { render(); wireShare(); setInterval(render, 60 * 60 * 1000); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
})();
