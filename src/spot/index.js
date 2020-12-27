/* eslint-disable space-in-parens */
const {
  signedRequest,
  publicRequest,
  depthData,
  pullKeys,
  apiRequest,
  depthWeight,
  priceParser,
} = require('../common');

module.exports = function (common) {
  /**
   * Used by bookTickers to format the bids and asks given given symbols
   * @param {array} data - array of symbols
   * @return {object} - symbols with their bids and asks data
   */
  const bookPriceData = (data) => {
    let prices = {};
    for (let obj of data) {
      prices[obj.symbol] = {
        bid: obj.bidPrice,
        bids: obj.bidQty,
        ask: obj.askPrice,
        asks: obj.askQty,
      };
    }
    return prices;
  };
  /**
   * Create a signed http request
   * @param {string} side - BUY or SELL
   * @param {string} symbol - The symbol to buy or sell
   * @param {string} quantity - The quantity to buy or sell
   * @param {string} price - The price per unit to transact each unit at
   * @param {object} params - additional order settings
   * @param {function} callback - the callback function
   * @param {object} tempKeys - temporary keys
   * @return {?promise} returs promise if callback is not defined
   */
  const order = (
    side,
    symbol,
    quantity,
    price,
    params = {},
    callback = false
  ) => {
    const tempKeys = pullKeys(params);
    let endpoint = params.type === 'OCO' ? 'v3/order/oco' : 'v3/order';
    if (common.options.test) endpoint += '/test';
    let opt = {
      symbol: symbol,
      side: side,
      type: 'LIMIT',
      quantity: quantity,
    };
    if (typeof params.type !== 'undefined') opt.type = params.type;
    if (opt.type.includes('LIMIT')) {
      opt.price = price;
      if (opt.type !== 'LIMIT_MAKER') {
        opt.timeInForce = 'GTC';
      }
    }
    if (opt.type === 'OCO') {
      opt.price = price;
      opt.stopLimitPrice = params.stopLimitPrice;
      opt.stopLimitTimeInForce = 'GTC';
      delete opt.type;
    }
    if (typeof params.timeInForce !== 'undefined')
      opt.timeInForce = params.timeInForce;
    if (typeof params.newOrderRespType !== 'undefined')
      opt.newOrderRespType = params.newOrderRespType;
    if (typeof params.newClientOrderId !== 'undefined')
      opt.newClientOrderId = params.newClientOrderId;

    /*
     * STOP_LOSS
     * STOP_LOSS_LIMIT
     * TAKE_PROFIT
     * TAKE_PROFIT_LIMIT
     * LIMIT_MAKER
     */
    if (typeof params.icebergQty !== 'undefined')
      opt.icebergQty = params.icebergQty;
    if (typeof params.stopPrice !== 'undefined') {
      opt.stopPrice = params.stopPrice;
      if (opt.type === 'LIMIT')
        throw Error(
          'stopPrice: Must set "type" to one of the following: STOP_LOSS, STOP_LOSS_LIMIT, TAKE_PROFIT, TAKE_PROFIT_LIMIT'
        );
    }
    return signedRequest(
      common,
      common.base + endpoint,
      opt,
      callback,
      tempKeys,
      false,
      'POST'
    );
  };

  /**
   * Used by balance to get the balance data
   * @param {array} data - account info object
   * @return {object} - balances hel with available, onorder amounts
   */
  const balanceParser = (data) => {
    let balances = {};
    if (typeof data === 'undefined') return {};
    if (typeof data.balances === 'undefined') {
      common.options.log('balanceData error', data);
      return {};
    }
    for (let obj of data.balances) {
      obj.free = Number(obj.free);
      obj.locked = Number(obj.locked);
      const total = obj.free + obj.locked;
      if (total > 0) balances[obj.asset] = { available: obj.free, total };
    }
    return balances;
  };

  /**
   * Gets the prices of a given symbol(s)
   * @param {string} symbol - symbol NOT MANDATORY
   * @param {function} callback - the callback function
   * @return {promise or undefined} - omitting the callback returns a promise
   */
  this.prices = function (symbol, callback = false) {
    let params = symbol ? { symbol: symbol } : {};
    return publicRequest(
      common,
      common.base + 'v3/ticker/price',
      params,
      callback,
      false,
      priceParser,
      symbol ? 1 : 2
    );
  };

  /**
   * Get the balance data
   * @param {{ APIKEY: string, APISECRET: string }} params - additional parameters
   * @param {function} callback - the callback function
   * @return {?promise} returs promise if callback is not defined
   */
  this.balance = function (params = {}, callback) {
    return signedRequest(
      common,
      common.base + 'v3/account',
      params,
      callback,
      pullKeys(params),
      balanceParser,
      false,
      false,
      5
    );
  };

  /**
   * Cancels an order
   * @param {string} symbol - the symbol to cancel
   * @param {{orderId: string, origClientOrderId: string, APIKEY: string, APISECRET: string }} params - additional parameters
   * @param {object} params - the orderid or clientOrderID  is mandatory
   * @param {function} callback - the callback function
   * @return {?promise} returs promise if callback is not defined
   */
  this.cancel = function (symbol, params = {}, callback = false) {
    params.symbol = symbol;
    return signedRequest(
      common,
      common.base + 'v3/order',
      params,
      callback,
      pullKeys(params),
      false,
      'DELETE'
    );
  };

  /**
   * Gets the status of an order
   * @param {string} symbol - the symbol to check
   * @param {{orderId: string, origClientOrderId: string,
   *  APIKEY: string, APISECRET: string }} params - additional parameters
   * @param {function} callback - the callback function
   * @return {?promise} returs promise if callback is not defined
   */
  this.orderStatus = function (symbol, params = {}, callback) {
    params.symbol = symbol;
    return signedRequest(
      common,
      common.base + 'v3/order',
      params,
      callback,
      pullKeys(params)
    );
  };

  /**
   * Gets open orders
   * @param {string} symbol - the symbol to get
   * @param {{APIKEY: string, APISECRET: string }} params - additional parameters
   * @param {function} callback - the callback function
   * @return {?promise} returs promise if callback is not defined
   */
  this.openOrders = function (symbol, params = {}, callback) {
    const tempKeys = pullKeys(params);
    params = symbol ? { symbol, ...params } : {};
    return signedRequest(
      common,
      common.base + 'v3/openOrders',
      params,
      callback,
      tempKeys,
      false,
      false,
      false,
      symbol ? 1 : 40
    );
  };

  /**
   * Cancels all orders of a given symbol
   * @param {string} symbol - the symbol to cancel all orders for
   * @param {{APIKEY: string, APISECRET: string }} params - additional parameters
   * @param {function} callback - the callback function
   * @return {?promise} returs promise if callback is not defined
   */
  this.cancelAll = function (symbol, params = {}, callback) {
    params.symbol = symbol;
    return signedRequest(
      common,
      common.base + 'v3/openOrders',
      params,
      callback,
      pullKeys(params),
      false,
      'DELETE',
      false,
      symbol ? 1 : 40
    );
  };

  /**
   * Cancels all orders of a given symbol
   * @param {string} symbol - the symbol to cancel all orders for
   * @param {{APIKEY: string, APISECRET: string }} params - additional parameters
   * @param {function} callback - the callback function
   * @return {?promise} returs promise if callback is not defined
   */
  this.cancelOrders = function (symbol, params = {}, callback) {
    params.symbol = symbol;
    const tempKeys = pullKeys(params);
    let promise;
    if (!callback) {
      promise = new Promise((resolve, reject) => {
        callback = (error, response) => {
          if (error) reject(error);
          else resolve(response);
        };
      });
    }

    const req = signedRequest(
      common,
      common.base + 'v3/openOrders',
      params,
      function (error, json) {
        if (error) return callback(error, json);
        if (json.length === 0) return callback(false, {}); // no open orders
        for (let obj of json) {
          signedRequest(
            common,
            common.base + 'v3/order',
            { ...params, orderId: obj.orderId },
            callback,
            tempKeys,
            false,
            'DELETE'
          );
        }
      },
      tempKeys,
      false,
      false,
      false,
      symbol ? 1 : 40
    );

    if (!promise) promise = req;
    return promise;
  };

  /**
   * Gets all order of a given symbol
   * @param {string} symbol - the symbol
   * @param {{orderId: string, startTime: number, endTime: number,
   * limit: number,APIKEY: string, APISECRET: string }} params - additional parameters
   * @param {function} callback - the callback function
   * @return {?promise} returs promise if callback is not defined
   */
  this.allOrders = function (symbol, params = {}, callback) {
    params.symbol = symbol;
    return signedRequest(
      common,
      common.base + 'v3/allOrders',
      params,
      callback,
      pullKeys(params),
      false,
      false,
      false,
      5
    );
  };
  /**
   * Gets the depth information for a given symbol
   * @param {string} symbol - the symbol
   * @param {{limit: number,APIKEY: string, APISECRET: string }} params - additional parameters
   * @param {function} callback - the callback function
   * @return {promise or undefined} - omitting the callback returns a promise
   */
  this.depth = function (symbol, params = {}, callback) {
    params.symbol = symbol;
    return publicRequest(
      common,
      common.base + 'v3/depth',
      params,
      callback,
      pullKeys(params),
      depthData,
      depthWeight(params.limit)
    );
  };

  /**
   * Creates an order
   * @param {string} side - BUY or SELL
   * @param {string} symbol - the symbol to buy
   * @param {numeric} quantity - the quantity required
   * @param {numeric} price - the price to pay for each unit
   * @param {{APIKEY: string, APISECRET: string }} params - additional parameters
   * @param {function} callback - the callback function
   * @return {promise or undefined} - omitting the callback returns a promise
   */
  this.order = function (
    side,
    symbol,
    quantity,
    price,
    params = {},
    callback = false
  ) {
    return order(side, symbol, quantity, price, params, callback);
  };

  /**
   * Creates a buy order
   * @param {string} symbol - the symbol to buy
   * @param {numeric} quantity - the quantity required
   * @param {numeric} price - the price to pay for each unit
   * @param {{APIKEY: string, APISECRET: string }} params - additional parameters
   * @param {function} callback - the callback function
   * @return {promise or undefined} - omitting the callback returns a promise
   */
  this.buy = function (symbol, quantity, price, params = {}, callback) {
    return order('BUY', symbol, quantity, price, params, callback);
  };

  /**
   * Creates a sell order
   * @param {string} symbol - the symbol to sell
   * @param {numeric} quantity - the quantity required
   * @param {numeric} price - the price to sell each unit for
   * @param {{APIKEY: string, APISECRET: string }} params - additional parameters
   * @param {function} callback - the callback function
   * @return {promise or undefined} - omitting the callback returns a promise
   */
  this.sell = function (symbol, quantity, price, params = {}, callback) {
    return order('SELL', symbol, quantity, price, params, callback);
  };

  /**
   * Creates a market buy order
   * @param {string} symbol - the symbol to buy
   * @param {numeric} quantity - the quantity required
   * @param {{APIKEY: string, APISECRET: string }} params - additional parameters
   * @param {function} callback - the callback function
   * @return {promise or undefined} - omitting the callback returns a promise
   */
  this.marketBuy = function (symbol, quantity, params = {}, callback) {
    if (typeof params === 'function') {
      // Accept callback as third parameter
      callback = params;
      params = { type: 'MARKET' };
    }
    if (typeof params.type === 'undefined') params.type = 'MARKET';
    return order('BUY', symbol, quantity, 0, params, callback);
  };

  /**
   * Creates a market sell order
   * @param {string} symbol - the symbol to sell
   * @param {numeric} quantity - the quantity required
   * @param {{APIKEY: string, APISECRET: string }} params - additional parameters
   * @param {function} callback - the callback function
   * @return {promise or undefined} - omitting the callback returns a promise
   */
  this.marketSell = function (symbol, quantity, params = {}, callback) {
    if (typeof params === 'function') {
      // Accept callback as third parameter
      callback = params;
      params = { type: 'MARKET' };
    }
    if (typeof params.type === 'undefined') params.type = 'MARKET';
    return order('SELL', symbol, quantity, 0, params, callback);
  };

  /**
   * Gets the average prices of a given symbol
   * @param {string} symbol - symbol MANDATORY
   * @param {function} callback - the callback function
   * @return {promise or undefined} - omitting the callback returns a promise
   */
  this.avgPrice = function (symbol, callback = false) {
    const parser = (data) => ({ [symbol]: data.price });
    return publicRequest(
      common,
      common.base + 'v3/avgPrice',
      { symbol },
      callback,
      false,
      parser
    );
  };

  /**
   * Gets the book tickers of given symbol(s)
   * @param {string} symbol - the symbol
   * @param {function} callback - the callback function
   * @return {promise or undefined} - omitting the callback returns a promise
   */
  this.bookTickers = function (symbol, callback) {
    let input = symbol ? { symbol: symbol } : {};
    const parser = symbol ? null : bookPriceData;
    return publicRequest(
      common,
      common.base + 'v3/ticker/bookTicker',
      input,
      callback,
      false,
      parser,
      symbol ? 1 : 2
    );
  };

  /**
   * Gets the prevday percentage change
   * @param {string} symbol - the symbol or symbols
   * @param {function} callback - the callback function
   * @return {promise or undefined} - omitting the callback returns a promise
   */
  this.daily = function (symbol, callback) {
    const parser = (data) =>
      symbol ? data : data.reduce((out, i) => ((out[i.symbol] = i), out), {});

    let input = symbol ? { symbol: symbol } : {};
    return publicRequest(
      common,
      common.base + 'v3/ticker/24hr',
      input,
      callback,
      false,
      parser,
      symbol ? 1 : 40
    );
  };

  /**
   * Gets the time
   * @param {function} callback - the callback function
   * @return {promise or undefined} - omitting the callback returns a promise
   */
  this.time = function (callback) {
    return publicRequest(common, common.base + 'v3/time', {}, callback);
  };

  /**
   * Gets the the exchange info
   * @param {function} callback - the callback function
   * @return {promise or undefined} - omitting the callback returns a promise
   */
  this.exchangeInfo = function (callback) {
    return publicRequest(common, common.base + 'v3/exchangeInfo', {}, callback);
  };

  /**
   * Get the account
   * @param {{APIKEY: string, APISECRET: string }} params - additional parameters
   * @param {function} callback - the callback function
   * @return {?promise} returs promise if callback is not defined
   */
  this.account = function (params = {}, callback) {
    return signedRequest(
      common,
      common.base + 'v3/account',
      params,
      callback,
      pullKeys(params),
      false,
      false,
      false,
      5
    );
  };

  /**
   * Get trades for a given symbol
   * @param {string} symbol - the symbol
   * @param {{startTime: number, endTime: number, fromId:number, limit: number,
   * APIKEY: string, APISECRET: string }} params  - additional params
   * @param {function} callback - the callback function
   * @return {?promise} returs promise if callback is not defined
   */
  this.trades = (symbol, params = {}, callback) => {
    params.symbol = symbol;
    return signedRequest(
      common,
      common.base + 'v3/myTrades',
      params,
      callback,
      pullKeys(params),
      false,
      false,
      false,
      5
    );
  };

  /**
   * Get the historical trade info
   * @param {string} symbol - the symbol
   * @param {{fromId:number, limit: number }} params  - additional params
   * @param {function} callback - the callback function
   * @return {promise or undefined} - omitting the callback returns a promise
   */
  this.historicalTrades = function (symbol, params = {}, callback) {
    params.symbol = symbol;

    return apiRequest(
      common,
      common.base + 'v3/historicalTrades',
      params,
      callback,
      false,
      false,
      5
    );
  };

  /**
   * Get the recent trades
   * @param {string} symbol - the symbol
   * @param {{startTime: number, endTime: number, fromId:number, limit: number}} params  - additional params
   * @param {function} callback - the callback function
   * @return {promise or undefined} - omitting the callback returns a promise
   */
  this.recentTrades = function (symbol, params = {}, callback) {
    params.symbol = symbol;
    return publicRequest(common, common.base + 'v1/trades', params, callback);
  };

  /**
   * Gets the candles information for a given symbol
   * intervals: 1m,3m,5m,15m,30m,1h,2h,4h,6h,8h,12h,1d,3d,1w,1M
   * @param {string} symbol -symbol MANDATORY
   * @param {"1m"|"3m"|"5m"|"15m"|"30m"|"1h"|"2h"|"4h"|"6h"|"8h"|"12h"|"1d"|"3d"|"1w"|"1M"} interval - the callback function
   * @param {{startTime: number, endTime: number, limit: number}} params  - additional params
   * @param {function} callback - the callback function
   * @return {promise or undefined} - omitting the callback returns a promise
   */
  this.candlesticks = function (
    symbol,
    interval = '5m',
    params = {},
    callback = false
  ) {
    params = Object.assign({ symbol: symbol, interval: interval }, params);
    return publicRequest(common, common.base + 'v3/klines', params, callback);
  };
  /**
   * Get agg trades for given symbol
   * @param {string} symbol - the symbol
   * @param {{startTime: number, endTime: number, fromId:number, limit: number}} params  - additional params
   * @param {function} callback - the callback function
   * @return {promise or undefined} - omitting the callback returns a promise
   */
  this.aggTrades = function (symbol, params = {}, callback = false) {
    params.symbol = symbol;
    return apiRequest(common, common.base + 'v3/aggTrades', params, callback);
  };

  this.chartData = common.ohlc;
};
