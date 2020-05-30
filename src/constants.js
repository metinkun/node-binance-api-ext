const times = {
  '1m': { query: '1m', ms: 60000 * 1 },
  '3m': { query: '3m', ms: 60000 * 3 },
  '5m': { query: '5m', ms: 60000 * 5 },
  '15m': { query: '15m', ms: 60000 * 15 },
  '30m': { query: '30m', ms: 60000 * 30 },
  '1h': { query: '1h', ms: 60000 * 60 },
  '2h': { query: '2h', ms: 60000 * 120 },
  '4h': { query: '4h', ms: 60000 * 240 },
  '8h': { query: '8h', ms: 60000 * 480 },
  '12h': { query: '12h', ms: 60000 * 720 },
  '1d': { query: '1d', ms: 60000 * 60 * 24 },
  '3d': { query: '3d', ms: 60000 * 60 * 72 },
  '1w': { query: '1w', ms: 60000 * 60 * 24 * 7 },
  '1M': { query: '1M', ms: 60000 * 60 * 24 * 30 },
};

module.exports = {
  times,
};
