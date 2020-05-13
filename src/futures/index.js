/* eslint-disable space-in-parens */
const { promiseRequest } = require('../common');

module.exports = function (common) {
  // Futures
  const futuresOrder = async (
    side,
    symbol,
    quantity,
    price = false,
    params = {}
  ) => {
    params.symbol = symbol;
    params.side = side;
    params.quantity = quantity;
    // LIMIT STOP MARKET STOP_MARKET TAKE_PROFIT TAKE_PROFIT_MARKET
    // reduceOnly stopPrice
    if (price) {
      params.price = price;
      if (typeof params.type === 'undefined') params.type = 'LIMIT';
    } else {
      if (typeof params.type === 'undefined') params.type = 'MARKET';
    }
    if (
      !params.timeInForce &&
      (params.type.includes('LIMIT') ||
        params.type === 'STOP' ||
        params.type === 'TAKE_PROFIT')
    ) {
      params.timeInForce = 'GTX'; // Post only by default. Use GTC for limit orders.
    }
    return promiseRequest(common, 'v1/order', params, {
      base: common.fapi,
      type: 'TRADE',
      method: 'POST',
    });
  };

  this.ping = async (params = {}) => {
    return promiseRequest(common, 'v1/ping', params, { base: common.fapi });
  };
  this.time = async (params = {}) => {
    return promiseRequest(common, 'v1/time', params, {
      base: common.fapi,
    }).then((r) => r.serverTime);
  };

  this.exchangeInfo = async () => {
    return promiseRequest(common, 'v1/exchangeInfo', {}, { base: common.fapi });
  };

  this.prices = async (params = {}) => {
    let data = await promiseRequest(common, 'v1/ticker/price', params, {
      base: common.fapi,
    });
    return data.reduce((out, i) => ((out[i.symbol] = i.price), out), {});
  };

  this.daily = async (symbol = false, params = {}) => {
    if (symbol) params.symbol = symbol;
    let data = await promiseRequest(common, 'v1/ticker/24hr', params, {
      base: common.fapi,
    });
    return symbol
      ? data
      : data.reduce((out, i) => ((out[i.symbol] = i), out), {});
  };

  this.openInterest = async (symbol) => {
    return promiseRequest(
      common,
      'v1/openInterest',
      { symbol },
      { base: common.fapi }
    ).then((r) => r.openInterest);
  };

  this.buy = async (symbol, quantity, price, params = {}) => {
    return futuresOrder('BUY', symbol, quantity, price, params);
  };

  this.sell = async (symbol, quantity, price, params = {}) => {
    return futuresOrder('SELL', symbol, quantity, price, params);
  };

  this.marketBuy = async (symbol, quantity, params = {}) => {
    return futuresOrder('BUY', symbol, quantity, false, params);
  };

  this.marketSell = async (symbol, quantity, params = {}) => {
    return futuresOrder('SELL', symbol, quantity, false, params);
  };

  this.stopLimitBuy = async (
    symbol,
    quantity,
    price,
    stopPrice,
    params = {}
  ) => {
    params.stopPrice = stopPrice;
    params.type = 'STOP';
    return futuresOrder('BUY', symbol, quantity, price, params);
  };

  this.stopMarketBuy = async (
    symbol,
    quantity,
    stopPrice,
    params = {}
  ) => {
    params.stopPrice = stopPrice;
    params.type = 'STOP_MARKET';
    return futuresOrder('BUY', symbol, quantity, false, params);
  };

  this.stopLimitSell = async (
    symbol,
    quantity,
    price,
    stopPrice,
    params = {}
  ) => {
    params.stopPrice = stopPrice;
    params.type = 'STOP';
    return futuresOrder('SELL', symbol, quantity, price, params);
  };

  this.stopMarketSell = async (
    symbol,
    quantity,
    stopPrice,
    params = {}
  ) => {
    params.stopPrice = stopPrice;
    params.type = 'STOP_MARKET';
    return futuresOrder('SELL', symbol, quantity, false, params);
  };

  this.order = futuresOrder; // side symbol quantity [price] [params]

  // type: 1: Add postion margin，2: Reduce postion margin
  this.positionMargin = async (
    symbol,
    amount,
    type = 1,
    params = {}
  ) => {
    params.symbol = symbol;
    params.amount = amount;
    params.type = type;
    return promiseRequest(common, 'v1/positionMargin', params, {
      base: common.fapi,
      method: 'POST',
      type: 'SIGNED',
    });
  };

  this.positionMarginHistory = async (symbol, params = {}) => {
    params.symbol = symbol;
    return promiseRequest(common, 'v1/positionMargin/history', params, {
      base: common.fapi,
      type: 'SIGNED',
    });
  };

  this.income = async (params = {}) => {
    return promiseRequest(common, 'v1/income', params, {
      base: common.fapi,
      type: 'SIGNED',
    });
  };

  this.balance = async (params = {}) => {
    return promiseRequest(common, 'v1/balance', params, {
      base: common.fapi,
      type: 'SIGNED',
    });
  };

  this.account = async (params = {}) => {
    return promiseRequest(common, 'v1/account', params, {
      base: common.fapi,
      type: 'SIGNED',
    });
  };

  this.depth = async (symbol, params = {}) => {
    params.symbol = symbol;
    return promiseRequest(common, 'v1/depth', params, { base: common.fapi });
  };

  this.quote = async (symbol = false, params = {}) => {
    if (symbol) params.symbol = symbol;
    //let data = await promiseRequest(common, 'v3/ticker/bookTicker', params, {base:common.fapi} );
    //return data.reduce((out, i) => ((out[i.symbol] = i), out), {}),
    let data = await promiseRequest(common, 'v1/ticker/bookTicker', params, {
      base: common.fapi,
    });
    return symbol
      ? data
      : data.reduce((out, i) => ((out[i.symbol] = i), out), {});
  };

  this.orderStatus = async (symbol, params = {}) => {
    // Either orderId or origClientOrderId must be sent
    params.symbol = symbol;
    return promiseRequest(common, 'v1/order', params, {
      base: common.fapi,
      type: 'SIGNED',
    });
  };

  this.cancel = async (symbol, params = {}) => {
    // Either orderId or origClientOrderId must be sent
    params.symbol = symbol;
    return promiseRequest(common, 'v1/order', params, {
      base: common.fapi,
      type: 'SIGNED',
      method: 'DELETE',
    });
  };

  this.cancelAll = async (symbol, params = {}) => {
    params.symbol = symbol;
    return promiseRequest(common, 'v1/allOpenOrders', params, {
      base: common.fapi,
      type: 'SIGNED',
      method: 'DELETE',
    });
  };

  this.openOrders = async (symbol = false, params = {}) => {
    if (symbol) params.symbol = symbol;
    return promiseRequest(common, 'v1/openOrders', params, {
      base: common.fapi,
      type: 'SIGNED',
    });
  };

  this.allOrders = async (symbol = false, params = {}) => {
    // Get all account orders; active, canceled, or filled.
    if (symbol) params.symbol = symbol;
    return promiseRequest(common, 'v1/allOrders', params, {
      base: common.fapi,
      type: 'SIGNED',
    });
  };

  this.candles = async (symbol, interval = '30m', params = {}) => {
    params.symbol = symbol;
    params.interval = interval;
    return promiseRequest(common, 'v1/klines', params, { base: common.fapi });
  };

  this.markPrice = async (symbol = false) => {
    return promiseRequest(common, 'v1/premiumIndex', symbol ? { symbol } : {}, {
      base: common.fapi,
    });
  };

  this.trades = async (symbol, params = {}) => {
    params.symbol = symbol;
    return promiseRequest(common, 'v1/trades', params, { base: common.fapi });
  };

  this.historicalTrades = async (symbol, params = {}) => {
    params.symbol = symbol;
    return promiseRequest(common, 'v1/historicalTrades', params, {
      base: common.fapi,
      type: 'MARKET_DATA',
    });
  };

  this.aggTrades = async (symbol, params = {}) => {
    params.symbol = symbol;
    return promiseRequest(common, 'v1/aggTrades', params, {
      base: common.fapi,
    });
  };

  this.userTrades = async (symbol, params = {}) => {
    params.symbol = symbol;
    return promiseRequest(common, 'v1/userTrades', params, {
      base: common.fapi,
      type: 'SIGNED',
    });
  };

  this.getDataStream = async (params = {}) => {
    //A User Data Stream listenKey is valid for 60 minutes after creation. setInterval
    return promiseRequest(common, 'v1/listenKey', params, {
      base: common.fapi,
      type: 'SIGNED',
      method: 'POST',
    });
  };

  this.keepDataStream = async (params = {}) => {
    return promiseRequest(common, 'v1/listenKey', params, {
      base: common.fapi,
      type: 'SIGNED',
      method: 'PUT',
    });
  };

  this.closeDataStream = async (params = {}) => {
    return promiseRequest(common, 'v1/listenKey', params, {
      base: common.fapi,
      type: 'SIGNED',
      method: 'DELETE',
    });
  };

  this.liquidationOrders = async (symbol = false, params = {}) => {
    if (symbol) params.symbol = symbol;
    return promiseRequest(common, 'v1/allForceOrders', params, {
      base: common.fapi,
    });
  };

  this.positionRisk = async (params = {}) => {
    return promiseRequest(common, 'v1/positionRisk', params, {
      base: common.fapi,
      type: 'SIGNED',
    });
  };

  this.fundingRate = async (symbol, params = {}) => {
    params.symbol = symbol;
    return promiseRequest(common, 'v1/fundingRate', params, {
      base: common.fapi,
    });
  };

  this.leverageBracket = async (symbol = false, params = {}) => {
    if (symbol) params.symbol = symbol;
    return promiseRequest(common, 'v1/leverageBracket', params, {
      base: common.fapi,
      type: 'USER_DATA',
    });
  };

  // leverage 1 to 125
  this.leverage = async (symbol, leverage, params = {}) => {
    params.symbol = symbol;
    params.leverage = leverage;
    return promiseRequest(common, 'v1/leverage', params, {
      base: common.fapi,
      method: 'POST',
      type: 'SIGNED',
    });
  };

  // ISOLATED, CROSSED
  this.marginType = async (symbol, marginType, params = {}) => {
    params.symbol = symbol;
    params.marginType = marginType;
    return promiseRequest(common, 'v1/marginType', params, {
      base: common.fapi,
      method: 'POST',
      type: 'SIGNED',
    });
  };
};
