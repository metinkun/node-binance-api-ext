/* eslint-disable space-in-parens */
const { promiseRequest, depthWeight, priceParser } = require('../common');

module.exports = function (common) {
  // Futures

  /**
   * Used by balance to get the balance data
   * @param {array} data - account info object
   * @return {object} - balances hel with available, onorder amounts
   */
  const balanceParser = (data) => {
    let balances = {};
    if (typeof data === 'undefined') return {};
    for (let obj of data) {
      obj.withdrawAvailable = Number(obj.withdrawAvailable);
      const total = Number(obj.balance);
      if (total > 0)
        balances[obj.asset] = { available: obj.withdrawAvailable, total };
    }
    return balances;
  };

  const futuresOrder = async (
    side,
    symbol,
    quantity,
    price = false,
    params = {},
    callback
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
      params.timeInForce = 'GTC'; // Post only by default. Use GTC for limit orders.
    }
    return promiseRequest(
      common,
      'v1/order',
      params,
      {
        base: common.fapi,
        type: 'TRADE',
        method: 'POST',
      },
      callback
    );
  };
  /**
   * pings server
   * @param {function} callback - the callback function
   * @return {promise or undefined} - omitting the callback returns a promise
   */
  this.ping = async (callback) => {
    return promiseRequest(
      common,
      'v1/ping',
      {},
      { base: common.fapi },
      callback
    );
  };
  /**
   * Gets servertime
   * @param {function} callback - the callback function
   * @return {promise or undefined} - omitting the callback returns a promise
   */
  this.time = async (callback) => {
    return promiseRequest(
      common,
      'v1/time',
      {},
      { base: common.fapi },
      callback
    );
  };

  /**
   * Gets exchange info
   * @param {function} callback - the callback function
   * @return {promise or undefined} - omitting the callback returns a promise
   */
  this.exchangeInfo = async (callback) => {
    return promiseRequest(
      common,
      'v1/exchangeInfo',
      {},
      { base: common.fapi },
      callback
    );
  };

  /**
   * Latest price for a symbol or symbols
   * @param {string} symbol - symbol
   * @param {function} callback - the callback function
   * @return {promise or undefined} - omitting the callback returns a promise
   */
  this.prices = async (symbol, callback) => {
    return await promiseRequest(
      common,
      'v1/ticker/price',
      symbol ? { symbol } : {},
      { base: common.fapi },
      callback,
      priceParser,
      symbol ? 1 : 2
    );
  };

  /**
   * 24 hour price change statistics
   * @param {string} symbol - symbol
   * @param {function} callback - the callback function
   * @return {promise or undefined} - omitting the callback returns a promise
   */
  this.daily = async (symbol, callback) => {
    const parser = (data) =>
      symbol ? data : data.reduce((out, i) => ((out[i.symbol] = i), out), {});

    return await promiseRequest(
      common,
      'v1/ticker/24hr',
      symbol ? { symbol } : {},
      { base: common.fapi },
      callback,
      parser,
      symbol ? 1 : 40
    );
  };

  /**
   * Get present open interest of specific coin
   * @param {string} symbol - symbol
   * @param {function} callback - the callback function
   * @return {?promise} returs promise if callback is not defined
   */
  this.openInterest = async (symbol, callback) => {
    return promiseRequest(
      common,
      'v1/openInterest',
      { symbol },
      { base: common.fapi },
      callback
    );
  };

  /**
   * limit buy
   * @param {string} symbol - symbol
   * @param {number} quantity - The quantity to buy or sell
   * @param {string} price - The price per unit to transact each unit at
   * @param {object} params -parameters
   * @param {string} params.APIKEY -apikey
   * @param {string} params.APISECRET -secretkey
   * @param {string} params.newClientOrderId -newClientOrderId
   * @param {"LONG" | "SHORT" | "BOTH"} params.positionSide -Default BOTH for One-way Mode ; LONG or SHORT for Hedge Mode. It must be sent with Hedge Mode.
   * @param {function} callback - the callback function
   * @return {?promise} returs promise if callback is not defined
   */
  this.buy = async (symbol, quantity, price, params = {}, callback) => {
    return futuresOrder('BUY', symbol, quantity, price, params, callback);
  };
  /**
   * limit sell
   * @param {string} symbol - symbol
   * @param {string} quantity - The quantity to buy or sell
   * @param {string} price - The price per unit to transact each unit at
   * @param {object} params -parameters
   * @param {string} params.APIKEY -apikey
   * @param {string} params.APISECRET -secretkey
   * @param {string} params.newClientOrderId -newClientOrderId
   * @param {"LONG" | "SHORT" | "BOTH"} params.positionSide -Default BOTH for One-way Mode ; LONG or SHORT for Hedge Mode. It must be sent with Hedge Mode.
   * @param {function} callback - the callback function
   * @return {?promise} returs promise if callback is not defined
   */
  this.sell = async (symbol, quantity, price, params = {}, callback) => {
    return futuresOrder('SELL', symbol, quantity, price, params, callback);
  };

  /**
   * market buy
   * @param {string} symbol - symbol
   * @param {string} quantity - The quantity to buy or sell
   * @param {object} params -parameters
   * @param {string} params.APIKEY -apikey
   * @param {string} params.APISECRET -secretkey
   * @param {string} params.newClientOrderId -newClientOrderId
   * @param {"LONG" | "SHORT" | "BOTH"} params.positionSide -Default BOTH for One-way Mode ; LONG or SHORT for Hedge Mode. It must be sent with Hedge Mode.
   * @param {"true" |"false"} params.reduceOnly -"true" or "false". Defalt "false".
   * @param {function} callback - the callback function
   * @return {?promise} returs promise if callback is not defined
   */
  this.marketBuy = async (symbol, quantity, params = {}, callback) => {
    return futuresOrder('BUY', symbol, quantity, false, params, callback);
  };

  /**
   * market sell
   * @param {string} symbol - symbol
   * @param {string} quantity - The quantity to buy or sell
   * @param {object} params -parameters
   * @param {string} params.APIKEY -apikey
   * @param {string} params.APISECRET -secretkey
   * @param {string} params.newClientOrderId -newClientOrderId
   * @param {"LONG" | "SHORT" | "BOTH"} params.positionSide -Default BOTH for One-way Mode ; LONG or SHORT for Hedge Mode. It must be sent with Hedge Mode.
   * @param {"true" |"false"} params.reduceOnly -"true" or "false". Defalt "false".
   * @param {function} callback - the callback function
   * @return {?promise} returs promise if callback is not defined
   */
  this.marketSell = async (symbol, quantity, params = {}, callback) => {
    return futuresOrder('SELL', symbol, quantity, false, params, callback);
  };

  /**
   * stop limit buy
   * @param {string} symbol - symbol
   * @param {string} quantity - The quantity to buy or sell
   * @param {string} price - The price per unit to transact each unit at
   * @param {string} stopPrice - stop price
   * @param {object} params -parameters
   * @param {string} params.APIKEY -apikey
   * @param {string} params.APISECRET -secretkey
   * @param {string} params.newClientOrderId -newClientOrderId
   * @param {"LONG" | "SHORT" | "BOTH"} params.positionSide -Default BOTH for One-way Mode ; LONG or SHORT for Hedge Mode. It must be sent with Hedge Mode.
   * @param {function} callback - the callback function
   * @return {?promise} returs promise if callback is not defined
   */
  this.stopLimitBuy = async (
    symbol,
    quantity,
    price,
    stopPrice,
    params = {},
    callback
  ) => {
    params.stopPrice = stopPrice;
    params.type = 'STOP';
    return futuresOrder('BUY', symbol, quantity, price, params, callback);
  };

  /**
   * stop market buy
   * @param {string} symbol - symbol
   * @param {string} quantity - The quantity to buy or sell
   * @param {string} stopPrice - price for stop order
   * @param {object} params -parameters
   * @param {string} params.APIKEY -apikey
   * @param {string} params.APISECRET -secretkey
   * @param {string} params.newClientOrderId -newClientOrderId
   * @param {"LONG" | "SHORT" | "BOTH"} params.positionSide -Default BOTH for One-way Mode ; LONG or SHORT for Hedge Mode. It must be sent with Hedge Mode.
   * @param {function} callback - the callback function
   * @return {?promise} returs promise if callback is not defined
   */
  this.stopMarketBuy = async (
    symbol,
    quantity,
    stopPrice,
    params = {},
    callback
  ) => {
    params.stopPrice = stopPrice;
    params.type = 'STOP_MARKET';
    return futuresOrder('BUY', symbol, quantity, false, params, callback);
  };

  /**
   * stop limit sell
   * @param {string} symbol - symbol
   * @param {string} quantity - The quantity to buy or sell
   * @param {string} price - The price per unit to transact each unit at
   * @param {string} stopPrice - stopPrice
   * @param {object} params -parameters
   * @param {string} params.APIKEY -apikey
   * @param {string} params.APISECRET -secretkey
   * @param {string} params.newClientOrderId -newClientOrderId
   * @param {"LONG" | "SHORT" | "BOTH"} params.positionSide -Default BOTH for One-way Mode ; LONG or SHORT for Hedge Mode. It must be sent with Hedge Mode.
   * @param {function} callback - the callback function
   * @return {?promise} returs promise if callback is not defined
   */
  this.stopLimitSell = async (
    symbol,
    quantity,
    price,
    stopPrice,
    params = {},
    callback
  ) => {
    params.stopPrice = stopPrice;
    params.type = 'STOP';
    return futuresOrder('SELL', symbol, quantity, price, params, callback);
  };

  /**
   * stop market sell
   * @param {string} symbol - symbol
   * @param {string} quantity - The quantity to buy or sell
   * @param {string} stopPrice - stopPrice
   * @param {object} params -parameters
   * @param {string} params.APIKEY -apikey
   * @param {string} params.APISECRET -secretkey
   * @param {string} params.newClientOrderId -newClientOrderId
   * @param {"LONG" | "SHORT" | "BOTH"} params.positionSide -Default BOTH for One-way Mode ; LONG or SHORT for Hedge Mode. It must be sent with Hedge Mode.
   * @param {function} callback - the callback function
   * @return {?promise} returs promise if callback is not defined
   */
  this.stopMarketSell = async (
    symbol,
    quantity,
    stopPrice,
    params = {},
    callback
  ) => {
    params.stopPrice = stopPrice;
    params.type = 'STOP_MARKET';
    return futuresOrder('SELL', symbol, quantity, false, params, callback);
  };

  /**
   * Creates an order
   * @param {string} side - BUY or SELL
   * @param {string} symbol - the symbol to buy
   * @param {numeric} quantity - the quantity required
   * @param {numeric} price - the price to pay for each unit
   * @param {{APIKEY: string, APISECRET: string }} params - additional parameters
   * @param {string} params.newClientOrderId -newClientOrderId
   * @param {"LONG" | "SHORT" | "BOTH"} params.positionSide -Default BOTH for One-way Mode ; LONG or SHORT for Hedge Mode. It must be sent with Hedge Mode.
   * @param {"true" |"false"} params.reduceOnly -"true" or "false". Defalt "false".
   * @param {function} callback - the callback function
   * @return {promise or undefined} - omitting the callback returns a promise
   */
  this.order = futuresOrder;

  /**
   * set position margin
   * @param {string} symbol - symbol
   * @param {number} amount - amount
   * @param {1|2} type - 1: Add position margin，2: Reduce position margin
   * @param {object} params -parameters
   * @param {string} params.APIKEY -apikey
   * @param {string} params.APISECRET -secretkey
   * @param {"LONG" | "SHORT" | "BOTH"} params.positionSide -Default BOTH for One-way Mode ; LONG or SHORT for Hedge Mode. It must be sent with Hedge Mode.
   * @param {function} callback - the callback function
   * @return {?promise} returs promise if callback is not defined
   */
  this.positionMargin = async (
    symbol,
    amount,
    type = 1,
    params = {},
    callback
  ) => {
    params.symbol = symbol;
    params.amount = amount;
    params.type = type;
    return promiseRequest(
      common,
      'v1/positionMargin',
      params,
      { base: common.fapi, method: 'POST', type: 'SIGNED' },
      callback
    );
  };

  /**
   * get position margin history
   * @param {string} symbol - symbol
   * @param {object} params -parameters
   * @param {string} params.APIKEY -apikey
   * @param {string} params.APISECRET -secretkey
   * @param {1|2}    params.type - 1: Add position margin，2: Reduce position margin
   * @param {number} params.startTime
   * @param {number} params.endTime
   * @param {number} params.limit
   * @param {function} callback - the callback function
   * @return {?promise} returs promise if callback is not defined
   */
  this.positionMarginHistory = async (symbol, params = {}, callback) => {
    params.symbol = symbol;
    return promiseRequest(
      common,
      'v1/positionMargin/history',
      params,
      { base: common.fapi, type: 'SIGNED' },
      callback
    );
  };

  /**
   * get position mode
   * @param {object} params -parameters
   * @param {string} params.APIKEY -apikey
   * @param {string} params.APISECRET -secretkey
   * @param {function} callback - the callback function
   * @return {?promise} returs promise if callback is not defined
   */
  this.positionMode = async (params = {}, callback) => {
    return promiseRequest(
      common,
      'v1/positionSide/dual',
      params,
      {
        base: common.fapi,
        type: 'SIGNED',
      },
      callback,
      false,
      30
    );
  };
  /**
   * change position mode
   * @param {"true" | "false"} dualSidePosition - "true": Hedge Mode mode; "false": One-way Mode
   * @param {object} params -parameters
   * @param {string} params.APIKEY -apikey
   * @param {string} params.APISECRET -secretkey
   * @param {function} callback - the callback function
   * @return {?promise} returs promise if callback is not defined
   */
  this.changePositionMode = async (dualSidePosition, params = {}, callback) => {
    params.dualSidePosition = dualSidePosition;
    return promiseRequest(
      common,
      'v1/positionSide/dual',
      params,
      { base: common.fapi, type: 'SIGNED', method: 'POST' },
      callback,
      false,
      30
    );
  };

  /**
   * get income history
   * @param {object} params -parameters
   * @param {string} params.symbol -symbol
   * @param {string} params.APIKEY -apikey
   * @param {string} params.APISECRET -secretkey
   * @param {"TRANSFER" | "WELCOME_BONUS" | "REALIZED_PNL" | "FUNDING_FEE" |"COMMISSION" | "INSURANCE_CLEAR"}    params.incomeType - 1: Add position margin，2: Reduce position margin
   * @param {number} params.startTime
   * @param {number} params.endTime
   * @param {number} params.limit
   * @param {function} callback - the callback function
   * @return {?promise} returs promise if callback is not defined
   */
  this.income = async (params = {}, callback) => {
    return promiseRequest(
      common,
      'v1/income',
      params,
      {
        base: common.fapi,
        type: 'SIGNED',
      },
      callback
    );
  };

  /**
   * get balance
   * @param {object} params -parameters
   * @param {string} params.APIKEY -apikey
   * @param {string} params.APISECRET -secretkey
   * @param {function} callback - the callback function
   * @return {?promise} returs promise if callback is not defined
   */
  this.balance = async (params = {}, callback) => {
    return promiseRequest(
      common,
      'v1/balance',
      params,
      {
        base: common.fapi,
        type: 'SIGNED',
      },
      callback,
      balanceParser
    );
  };

  /**
   * gets account
   * @param {object} params -parameters
   * @param {string} params.APIKEY -apikey
   * @param {string} params.APISECRET -secretkey
   * @param {function} callback - the callback function
   * @return {?promise} returs promise if callback is not defined
   */
  this.account = async (params = {}, callback) => {
    return promiseRequest(
      common,
      'v1/account',
      params,
      {
        base: common.fapi,
        type: 'SIGNED',
      },
      callback,
      false,
      5
    );
  };

  /**
   * gets order book
   * @param {string} symbol -symbol
   * @param {object} params -parameters
   * @param {number} params.limit
   * @param {function} callback - the callback function
   * @return {?promise} returs promise if callback is not defined
   */
  this.depth = async (symbol, params = {}, callback) => {
    params.symbol = symbol;

    return promiseRequest(
      common,
      'v1/depth',
      params,
      { base: common.fapi },
      callback,
      false,
      depthWeight(params.limit)
    );
  };

  /**
   * gets symbol order book ticker
   * @param {string} symbol -symbol NOT MANDATORY
   * @param {function} callback - the callback function
   * @return {?promise} returs promise if callback is not defined
   */
  this.quote = async (symbol, callback) => {
    const parser = (data) =>
      symbol ? data : data.reduce((out, i) => ((out[i.symbol] = i), out), {});
    return await promiseRequest(
      common,
      'v1/ticker/bookTicker',
      symbol ? { symbol } : {},
      {
        base: common.fapi,
      },
      callback,
      parser,
      symbol ? 1 : 2
    );
  };

  /**
   * Gets order status
   * @param {string} symbol - symbol MANDATORY
   * @param {{orderId: string, origClientOrderId: string,
   *  APIKEY: string, APISECRET: string }} params - origClientOrderId or orderId is MANDATORY
   * @param {function} callback - the callback function
   * @return {?promise} returs promise if callback is not defined
   */
  this.orderStatus = async (symbol, params = {}, callback) => {
    params.symbol = symbol;
    return promiseRequest(
      common,
      'v1/order',
      params,
      {
        base: common.fapi,
        type: 'SIGNED',
      },
      callback
    );
  };

  /**
   * cancels an order
   * @param {string} symbol - symbol MANDATORY
   * @param {{orderId: string, origClientOrderId: string,
   *  APIKEY: string, APISECRET: string }} params - origClientOrderId or orderId is MANDATORY
   * @param {function} callback - the callback function
   * @return {?promise} returs promise if callback is not defined
   */
  this.cancel = async (symbol, params = {}, callback) => {
    params.symbol = symbol;
    return promiseRequest(
      common,
      'v1/order',
      params,
      {
        base: common.fapi,
        type: 'SIGNED',
        method: 'DELETE',
      },
      callback
    );
  };

  /**
   * Cancels all orders of a given symbol
   * @param {string} symbol - symbol MANDATORY
   * @param {{orderId: string, origClientOrderId: string,
   *  APIKEY: string, APISECRET: string }} params - origClientOrderId or orderId is MANDATORY
   * @param {function} callback - the callback function
   * @return {?promise} returs promise if callback is not defined
   */
  this.cancelAll = async (symbol, params = {}, callback) => {
    params.symbol = symbol;
    return promiseRequest(
      common,
      'v1/allOpenOrders',
      params,
      {
        base: common.fapi,
        type: 'SIGNED',
        method: 'DELETE',
      },
      callback
    );
  };

  /**
   * Gets all open orders of a given symbol
   * @param {string} symbol - symbol NOT MANDATORY
   * @param {{orderId: string, origClientOrderId: string,
   *  APIKEY: string, APISECRET: string }} params - origClientOrderId or orderId is MANDATORY
   * @param {function} callback - the callback function
   * @return {?promise} returs promise if callback is not defined
   */
  this.openOrders = async (symbol, params = {}, callback) => {
    if (symbol) params.symbol = symbol;
    return promiseRequest(
      common,
      'v1/openOrders',
      params,
      {
        base: common.fapi,
        type: 'SIGNED',
      },
      callback,
      false,
      symbol ? 1 : 40
    );
  };

  /**
   * get all orders of given symbol
   * @param {string} symbol -symbol MANDATORY
   * @param {object} params -parameters
   * @param {string} params.APIKEY -apikey
   * @param {string} params.APISECRET -secretkey
   * @param {number} params.startTime
   * @param {number} params.endTime
   * @param {number} params.limit
   * @param {function} callback - the callback function
   * @return {?promise} returs promise if callback is not defined
   */
  this.allOrders = async (symbol, params = {}, callback) => {
    params.symbol = symbol;
    return promiseRequest(
      common,
      'v1/allOrders',
      params,
      {
        base: common.fapi,
        type: 'SIGNED',
      },
      callback,
      false,
      5
    );
  };

  /**
   * get klines of given symbol
   * @param {string} symbol -symbol MANDATORY
   * @param {"1m"|"3m"|"5m"|"15m"|"30m"|"1h"|"2h"|"4h"|"6h"|"8h"|"12h"|"1d"|"3d"|"1w"|"1M"} interval - the callback function
   * @param {object} params -parameters
   * @param {string} params.APIKEY -apikey
   * @param {string} params.APISECRET -secretkey
   * @param {number} params.startTime
   * @param {number} params.endTime
   * @param {number} params.limit
   * @param {function} callback - the callback function
   * @return {?promise} returs promise if callback is not defined
   */
  this.candlesticks = async (
    symbol,
    interval = '30m',
    params = {},
    callback
  ) => {
    params.symbol = symbol;
    params.interval = interval;
    return promiseRequest(
      common,
      'v1/klines',
      params,
      { base: common.fapi },
      callback
    );
  };

  /**
   * gets mark price and funding rate
   * @param {string} symbol -symbol NOT MANDATORY
   * @param {function} callback - the callback function
   * @return {?promise} returs promise if callback is not defined
   */
  this.markPrice = async (symbol, callback) => {
    return promiseRequest(
      common,
      'v1/premiumIndex',
      symbol ? { symbol } : {},
      {
        base: common.fapi,
      },
      callback
    );
  };

  /**
   * get recent trades(up to 24 hours)
   * @param {string} symbol -symbol MANDATORY
   * @param {object} params -parameters
   * @param {number} params.limit
   * @param {function} callback - the callback function
   * @return {?promise} returs promise if callback is not defined
   */
  this.trades = async (symbol, params = {}, callback) => {
    params.symbol = symbol;
    return promiseRequest(
      common,
      'v1/trades',
      params,
      { base: common.fapi },
      callback
    );
  };

  /**
   * get older market historical trades
   * @param {string} symbol -symbol MANDATORY
   * @param {string} interval -interval MANDATORY
   * @param {object} params -parameters
   * @param {number} params.fromId
   * @param {number} params.limit
   * @param {function} callback - the callback function
   * @return {?promise} returs promise if callback is not defined
   */
  this.historicalTrades = async (symbol, params = {}, callback) => {
    params.symbol = symbol;
    return promiseRequest(
      common,
      'v1/historicalTrades',
      params,
      {
        base: common.fapi,
        type: 'MARKET_DATA',
      },
      callback,
      false,
      5
    );
  };

  /**
   * get compressed aggregate trades
   * @param {string} symbol -symbol MANDATORY
   * @param {object} params -parameters
   * @param {number} params.startTime
   * @param {number} params.endTime
   * @param {number} params.limit
   * @param {number} params.fromId
   * @param {function} callback - the callback function
   * @return {?promise} returs promise if callback is not defined
   */
  this.aggTrades = async (symbol, params = {}, callback) => {
    params.symbol = symbol;
    return promiseRequest(
      common,
      'v1/aggTrades',
      params,
      {
        base: common.fapi,
      },
      callback
    );
  };

  /**
   * gets trade of account and specific symbol
   * @param {string} symbol -symbol MANDATORY
   * @param {object} params -parameters
   * @param {string} params.APIKEY -apikey
   * @param {string} params.APISECRET -secretkey
   * @param {number} params.startTime
   * @param {number} params.endTime
   * @param {number} params.limit
   * @param {number} params.fromId
   * @param {function} callback - the callback function
   * @return {?promise} returs promise if callback is not defined
   */
  this.userTrades = async (symbol, params = {}, callback) => {
    params.symbol = symbol;
    return promiseRequest(
      common,
      'v1/userTrades',
      params,
      {
        base: common.fapi,
        type: 'SIGNED',
      },
      callback,
      false
    );
  };

  /**
   * starts new user data stream for 60 minutes
   * @param {object} params -parameters
   * @param {string} params.APIKEY -apikey
   * @param {string} params.APISECRET -secretkey
   * @param {function} callback - the callback function
   * @return {?promise} returs promise if callback is not defined
   */
  this.getDataStream = async (params = {}, callback) => {
    //A User Data Stream listenKey is valid for 60 minutes after creation. setInterval
    return promiseRequest(
      common,
      'v1/listenKey',
      params,
      {
        base: common.fapi,
        type: 'SIGNED',
        method: 'POST',
      },
      callback
    );
  };

  /**
   * keeps alive user data stream for 60 minutes
   * @param {object} params -parameters
   * @param {string} params.APIKEY -apikey
   * @param {string} params.APISECRET -secretkey
   * @param {function} callback - the callback function
   * @return {?promise} returs promise if callback is not defined
   */
  this.keepDataStream = async (params = {}, callback) => {
    return promiseRequest(
      common,
      'v1/listenKey',
      params,
      {
        base: common.fapi,
        type: 'SIGNED',
        method: 'PUT',
      },
      callback
    );
  };

  /**
   * closes user data stream
   * @param {object} params -parameters
   * @param {string} params.APIKEY -apikey
   * @param {string} params.APISECRET -secretkey
   * @param {function} callback - the callback function
   * @return {?promise} returs promise if callback is not defined
   */
  this.closeDataStream = async (params = {}, callback) => {
    return promiseRequest(
      common,
      'v1/listenKey',
      params,
      {
        base: common.fapi,
        type: 'SIGNED',
        method: 'DELETE',
      },
      callback
    );
  };

  /**
   * get all liqudation orders
   * @param {string} symbol -symbol NOT MANDATORY
   * @param {object} params -parameters
   * @param {number} params.startTime
   * @param {number} params.endTime
   * @param {number} params.limit
   * @param {function} callback - the callback function
   * @return {?promise} returs promise if callback is not defined
   */
  this.liquidationOrders = async (symbol = false, params = {}, callback) => {
    if (symbol) params.symbol = symbol;
    return promiseRequest(
      common,
      'v1/allForceOrders',
      params,
      {
        base: common.fapi,
      },
      callback,
      false,
      5
    );
  };

  /**
   * gets position information
   * @param {object} params -parameters
   * @param {string} params.APIKEY -apikey
   * @param {string} params.APISECRET -secretkey
   * @param {function} callback - the callback function
   * @return {?promise} returs promise if callback is not defined
   */
  this.positionRisk = async (params = {}, callback) => {
    return promiseRequest(
      common,
      'v1/positionRisk',
      params,
      {
        base: common.fapi,
        type: 'SIGNED',
      },
      callback,
      false,
      5
    );
  };

  /**
   * get funding rate history
   * @param {string} symbol -symbol MANDATORY
   * @param {object} params -parameters
   * @param {number} params.startTime
   * @param {number} params.endTime
   * @param {number} params.limit
   * @param {function} callback - the callback function
   * @return {?promise} returs promise if callback is not defined
   */
  this.fundingRate = async (symbol, params = {}, callback) => {
    params.symbol = symbol;
    return promiseRequest(
      common,
      'v1/fundingRate',
      params,
      {
        base: common.fapi,
      },
      callback
    );
  };

  /**
   * gets notional and leverage brackets
   * @param {string} symbol -symbol NOT MANDATORY
   * @param {object} params -parameters
   * @param {string} params.APIKEY -apikey
   * @param {string} params.APISECRET -secretkey
   * @param {function} callback - the callback function
   * @return {?promise} returs promise if callback is not defined
   */
  this.leverageBracket = async (symbol, params = {}, callback) => {
    if (symbol) params.symbol = symbol;
    return promiseRequest(
      common,
      'v1/leverageBracket',
      params,
      {
        base: common.fapi,
        type: 'USER_DATA',
      },
      callback
    );
  };

  /**
   * change initial leverage
   * @param {string} symbol -symbol MANDATORY
   * @param {number} leverage -leverage MANDATORY
   * @param {object} params -parameters
   * @param {string} params.APIKEY -apikey
   * @param {string} params.APISECRET -secretkey
   * @param {function} callback - the callback function
   * @return {?promise} returs promise if callback is not defined
   */
  this.leverage = async (symbol, leverage, params = {}, callback) => {
    params.symbol = symbol;
    params.leverage = leverage;
    return promiseRequest(
      common,
      'v1/leverage',
      params,
      {
        base: common.fapi,
        method: 'POST',
        type: 'SIGNED',
      },
      callback
    );
  };

  /**
   * change margin type
   * @param {string} symbol -symbol MANDATORY
   * @param {"ISOLATED" | "CROSSED"} marginType -marginType MANDATORY
   * @param {object} params -parameters
   * @param {string} params.APIKEY -apikey
   * @param {string} params.APISECRET -secretkey
   * @param {function} callback - the callback function
   * @return {?promise} returs promise if callback is not defined
   */
  this.marginType = async (symbol, marginType, params = {}, callback) => {
    params.symbol = symbol;
    params.marginType = marginType;
    return promiseRequest(
      common,
      'v1/marginType',
      params,
      {
        base: common.fapi,
        method: 'POST',
        type: 'SIGNED',
      },
      callback
    );
  };

  this.chartData = common.futuresTicks;
};
