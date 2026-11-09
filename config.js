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

  // --- Gate Pass (ВСТАВЬ после деплоя) ---
  GATEPASS: "0x289E3BD13a0d5919eAb7D063930027287937B7aD",
  PAY_TOKENS: {
    USDT: "0x55d398326f99059fF775485246999027B3197955",
    USDC: "0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d",
    ETH:  "0x2170Ed0880ac9A755fd29B2688956BD959F933F8",   // Ethereum (BEP-20)
  },

  // --- Программа вознаграждений (адрес OmniRewards; пусто = раздел показывает "первый период не опубликован") ---
  REWARDS: "0x5F171D767b5D14957b31189990064a86e419Ba40",

  // --- Адрес сайта (для иконки токена в MetaMask), например https://username.github.io/omni-key/ ---
  SITE_URL: "https://omni-key-kinetix.github.io/OMNI-KEY/",

  // --- Пул Pancake V2 и замок LP (PinkLock) ---
  PAIR: "0x313E697825fFB6145e8a2733Cf7c53c2C7CD0837",
  LP_LOCK_URL: "https://www.pinksale.finance/pinklock/bsc/record/2096113",
  LP_LOCK_UNTIL: "2027-10-01",

  // --- Торговля (после создания пулов вставь прямые ссылки) ---
  PANCAKE_URL: "",   // пусто = сайт сам соберёт ссылку на swap из адреса токена
  DODO_URL: "",      // пусто = https://app.dodoex.io/

  // --- Прозрачность / NANOBOTIKA (только чтение) ---
  VESTING: "0xF68216333a63d34f7323FECeb0A376C1fA1E2d34",      // KiixVesting: 200 000 000 KIIX команды
  TEAM_WALLET: "0x7438Cd5d156613a9e4F586494893D667C688B01e",   // кошелёк команды (публичный)
  PINKLOCK: "0x407993575c91ce7643a4d4cCACc9A98c36eE1BBE",      // PinkLock V2 (держит LP)
  CHAINLINK_BNB: "0x0567F2323251f0Aab15c8dFb1967E4e8A7D42aeE", // Chainlink BNB/USD

  // --- Физика OMNI-KEY ---
  ENERGY_PER_KIIX_J: 8e6,           // 1 KIIX в Ядре = 8 МДж
  KIIX_SUPPLY: 1e9,
  SECTORS: [                         // пороги энергии (Дж) = KIIX в стейке x 8e6. Цена пула старта ~$0.000001
    { id: "alpha", name: "АЛЬФА", need: 1.6e14, hint: "20 000 000 KIIX" },
    { id: "beta",  name: "БЕТА",  need: 8e14,   hint: "100 000 000 KIIX" },
    { id: "gamma", name: "ГАММА", need: 3.2e15, hint: "400 000 000 KIIX" },
    { id: "omega", name: "ОМЕГА", need: 7.2e15, hint: "900 000 000 KIIX" },
  ],

  // --- Реестр частиц (добавляй новые токены сюда) ---
  PARTICLES: [
    { no: 1, sym: "KIIX", name: "KINETIX", role: "Кинетическая энергия Ядра", status: "active", supply: "1 000 000 000" },
    { no: 2, sym: "????", name: "Запечатано", role: "Атом-NFT слой", status: "sealed", supply: "≤ 1 000 000 000" },
    { no: 3, sym: "????", name: "Запечатано", role: "Смарт-схема Ядра", status: "sealed", supply: "≤ 1 000 000 000" },
    { no: 4, sym: "????", name: "Запечатано", role: "Web4 агенты", status: "sealed", supply: "≤ 1 000 000 000" },
  ],
};
