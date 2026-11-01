/* ============================================================
   OMNI-KEY / KINETIX — ЕДИНСТВЕННЫЙ файл, который ты правишь после деплоя.
   Вставь 2 адреса из Remix — и сайт перейдёт из DEMO в LIVE.
   ============================================================ */
window.OMNI = {
  // --- Сеть: BNB Smart Chain ---
  CHAIN_ID: 56,
  CHAIN_HEX: "0x38",
  CHAIN_NAME: "BNB Smart Chain",
  RPC: "https://bsc-dataseed.binance.org",
  EXPLORER: "https://bscscan.com",

  // --- ВСТАВЬ ПОСЛЕ ДЕПЛОЯ ---
  KIIX_TOKEN: "0xaF82A50c0aC9CfF8c7F39da9Ff998921DB68bC94",   // новый KIIX (задеплоен)
  STAKING:    "0x49c6a95A95453143b0161437aAbc43db2383771C",   // стейкинг v2 (задеплоен)

  // --- Адрес сайта (для иконки токена в MetaMask), например https://username.github.io/omni-key/ ---
  SITE_URL: "https://omni-key-kinetix.github.io/OMNI-KEY/",

  // --- Торговля (после создания пулов вставь прямые ссылки) ---
  PANCAKE_URL: "",   // пусто = сайт сам соберёт ссылку на swap из адреса токена
  DODO_URL: "",      // пусто = https://app.dodoex.io/

  // --- Физика OMNI-KEY ---
  ENERGY_PER_KIIX_J: 8e6,           // 1 KIIX в Ядре = 8 МДж
  KIIX_SUPPLY: 1e9,
  SECTORS: [                         // пороги энергии (Дж)
    { id: "alpha", name: "АЛЬФА", need: 1e9,  hint: "125 KIIX" },
    { id: "beta",  name: "БЕТА",  need: 1e11, hint: "12 500 KIIX" },
    { id: "gamma", name: "ГАММА", need: 1e13, hint: "1 250 000 KIIX" },
    { id: "omega", name: "ОМЕГА", need: 1e15, hint: "125 000 000 KIIX" },
  ],

  // --- Реестр частиц (добавляй новые токены сюда) ---
  PARTICLES: [
    { no: 1, sym: "KIIX", name: "KINETIX", role: "Кинетическая энергия Ядра", status: "active", supply: "1 000 000 000" },
    { no: 2, sym: "????", name: "Запечатано", role: "Атом-NFT слой", status: "sealed", supply: "≤ 1 000 000 000" },
    { no: 3, sym: "????", name: "Запечатано", role: "Смарт-схема Ядра", status: "sealed", supply: "≤ 1 000 000 000" },
    { no: 4, sym: "????", name: "Запечатано", role: "Web4 агенты", status: "sealed", supply: "≤ 1 000 000 000" },
  ],
};
