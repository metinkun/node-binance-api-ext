/* eslint-disable space-in-parens */
const {
  request,
  addProxy,
  signedRequest,
  publicRequest,
  marketRequest,
  depthData,
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
   * @param {object} flags - additional order settings
   * @param {function} callback - the callback function
   * @param {object} tempKeys - temporary keys
   * @return {?promise} returs promise if callback is not defined
   */
  const order = (
    side,
    symbol,
    quantity,
    price,
    flags = {},
    callback = false,
    tempKeys
  ) => {
    let endpoint = flags.type === 'OCO' ? 'v3/order/oco' : 'v3/order';
    if (common.options.test) endpoint += '/test';
    let opt = {
      symbol: symbol,
      side: side,
      type: 'LIMIT',
      quantity: quantity,
    };
    if (typeof flags.type !== 'undefined') opt.type = flags.type;
    if (opt.type.includes('LIMIT')) {
      opt.price = price;
      if (opt.type !== 'LIMIT_MAKER') {
        opt.timeInForce = 'GTC';
      }
    }
    if (opt.type === 'OCO') {
      opt.price = price;
      opt.stopLimitPrice = flags.stopLimitPrice;
      opt.stopLimitTimeInForce = 'GTC';
      delete opt.type;
    }
    if (typeof flags.timeInForce !== 'undefined')
      opt.timeInForce = flags.timeInForce;
    if (typeof flags.newOrderRespType !== 'undefined')
      opt.newOrderRespType = flags.newOrderRespType;
    if (typeof flags.newClientOrderId !== 'undefined')
      opt.newClientOrderId = flags.newClientOrderId;

    /*
     * STOP_LOSS
     * STOP_LOSS_LIMIT
     * TAKE_PROFIT
     * TAKE_PROFIT_LIMIT
     * LIMIT_MAKER
     */
    if (typeof flags.icebergQty !== 'undefined')
      opt.icebergQty = flags.icebergQty;
    if (typeof flags.stopPrice !== 'undefined') {
      opt.stopPrice = flags.stopPrice;
      if (opt.type === 'LIMIT')
        throw Error(
          'stopPrice: Must set "type" to one of the following: STOP_LOSS, STOP_LOSS_LIMIT, TAKE_PROFIT, TAKE_PROFIT_LIMIT'
        );
    }
    signedRequest(
      common,
      common.base + endpoint,
      opt,
      (error, response) => {
        if (!response) {
          if (callback) callback(error, response);
          else common.options.log('Order() error:', error);
          return;
        }
        if (
          typeof response.msg !== 'undefined' &&
          response.msg === 'Filter failure: MIN_NOTIONAL'
        ) {
          common.options.log(
            'Order quantity too small. See exchangeInfo() for minimum amounts'
          );
        }
        if (callback) callback(error, response);
        else
          common.options.log(
            side + '(' + symbol + ',' + quantity + ',' + price + ') ',
            response
          );
      },
      tempKeys,
      false,
      'POST'
    );
  };

  /**
   * Gets the price of a given symbol or symbols
   * @param {array} data - array of symbols
   * @return {array} - symbols with their current prices
   */
  const priceData = (data) => {
    const prices = {};
    if (Array.isArray(data)) {
      for (let obj of data) {
        prices[obj.symbol] = obj.price;
      }
    } else {
      // Single price returned
      prices[data.symbol] = data.price;
    }
    return prices;
  };

  /**
   * Used by balance to get the balance data
   * @param {array} data - account info object
   * @return {object} - balances hel with available, onorder amounts
   */
  const balanceData = (data) => {
    let balances = {};
    if (typeof data === 'undefined') return {};
    if (typeof data.balances === 'undefined') {
      common.options.log('balanceData error', data);
      return {};
    }
    for (let obj of data.balances) {
      balances[obj.asset] = { available: obj.free, onOrder: obj.locked };
    }
    return balances;
  };

  /**
   * Gets the prices of a given symbol(s)
   * @param {string} symbol - the symbol
   * @param {function} callback - the callback function
   * @return {promise or undefined} - omitting the callback returns a promise
   */
  this.prices = function (symbol, callback = false) {
    const params = typeof symbol === 'string' ? '?symbol=' + symbol : '';
    if (typeof symbol === 'function') callback = symbol; // backwards compatibility

    let opt = {
      url: common.base + 'v3/ticker/price' + params,
      timeout: common.options.recvWindow,
    };

    return request(addProxy(common, opt), callback, priceData);
  };

  /**
   * Get the balance data
   * @param {function} callback - the callback function
   * @param {object} tempKeys - temporary keys
   * @return {?promise} returs promise if callback is not defined
   */
  this.balance = function (callback, tempKeys) {
    return signedRequest(
      common,
      common.base + 'v3/account',
      {},
      callback,
      tempKeys,
      balanceData
    );
  };

  /**
   * Cancels an order
   * @param {string} symbol - the symbol to cancel
   * @param {string} orderid - the orderid to cancel
   * @param {function} callback - the callback function
   * @param {object} tempKeys - temporary keys
   * @return {?promise} returs promise if callback is not defined
   */
  this.cancel = function (symbol, orderId, callback = false, tempKeys) {
    return signedRequest(
      common,
      common.base + 'v3/order',
      { symbol, orderId },
      callback,
      tempKeys,
      false,
      'DELETE'
    );
  };

  /**
   * Gets the status of an order
   * @param {string} symbol - the symbol to check
   * @param {string} orderId - the orderid to check
   * @param {function} callback - the callback function
   * @param {object} flags - any additional flags
   * @param {object} tempKeys - temporary keys
   * @return {?promise} returs promise if callback is not defined
   */
  this.orderStatus = function (
    symbol,
    orderId,
    callback,
    flags = {},
    tempKeys
  ) {
    let parameters = Object.assign({ symbol, orderId }, flags);
    return signedRequest(
      common,
      common.base + 'v3/order',
      parameters,
      callback,
      tempKeys
    );
  };

  /**
   * Gets open orders
   * @param {string} symbol - the symbol to get
   * @param {function} callback - the callback function
   * @param {object} tempKeys - temporary keys
   * @return {?promise} returs promise if callback is not defined
   */
  this.openOrders = function (symbol, callback, tempKeys) {
    let parameters = symbol ? { symbol: symbol } : {};
    return signedRequest(
      common,
      common.base + 'v3/openOrders',
      parameters,
      callback,
      tempKeys
    );
  };

  /**
   * Cancels all orders of a given symbol
   * @param {string} symbol - the symbol to cancel all orders for
   * @param {function} callback - the callback function
   * @param {object} tempKeys - temporary keys
   * @return {?promise} returs promise if callback is not defined
   */
  this.cancelAll = function (symbol, callback = false, tempKeys) {
    return signedRequest(
      common,
      common.base + 'v3/openOrders',
      { symbol },
      callback,
      tempKeys,
      false,
      'DELETE'
    );
  };

  /**
   * Cancels all orders of a given symbol
   * @param {string} symbol - the symbol to cancel all orders for
   * @param {function} callback - the callback function
   * @param {object} tempKeys - temporary keys
   * @return {?promise} returs promise if callback is not defined
   */
  this.cancelOrders = function (symbol, callback = false, tempKeys) {
    let promise;
    if (!callback) {
      promise = new Promise((resolve, reject) => {
        callback = (error, response) => {
          if (error) {
            reject(error);
          } else {
            resolve(response);
          }
        };
      });
    }

    const req = signedRequest(
      common,
      common.base + 'v3/openOrders',
      { symbol: symbol },
      function (error, json) {
        if (json.length === 0) {
          return callback('No orders present for this symbol', {});
        }
        for (let obj of json) {
          let quantity = obj.origQty - obj.executedQty;
          common.options.log(
            'cancel order: ' +
              obj.side +
              ' ' +
              symbol +
              ' ' +
              quantity +
              ' @ ' +
              obj.price +
              ' #' +
              obj.orderId
          );
          signedRequest(
            common,
            common.base + 'v3/order',
            { symbol: symbol, orderId: obj.orderId },
            callback,
            tempKeys,
            false,
            'DELETE'
          );
        }
      },
      tempKeys
    );

    if (!promise) promise = req;
    return promise;
  };

  /**
   * Gets all order of a given symbol
   * @param {string} symbol - the symbol
   * @param {function} callback - the callback function
   * @param {object} options - additional options
   * @param {object} tempKeys - temporary keys
   * @return {?promise} returs promise if callback is not defined
   */
  this.allOrders = function (symbol, callback, options = {}, tempKeys) {
    let parameters = Object.assign({ symbol: symbol }, options);
    return signedRequest(
      common,
      common.base + 'v3/allOrders',
      parameters,
      callback,
      tempKeys
    );
  };

  /**
   * Gets the depth information for a given symbol
   * @param {string} symbol - the symbol
   * @param {function} callback - the callback function
   * @param {int} limit - limit the number of returned orders
   * @return {promise or undefined} - omitting the callback returns a promise
   */
  this.depth = function (symbol, callback, limit = 100) {
    if (!callback) {
      return new Promise((resolve, reject) => {
        callback = (error, response) => {
          if (error) {
            reject(error);
          } else {
            resolve(response);
          }
        };
        publicRequest(
          common,
          common.base + 'v3/depth',
          { symbol, limit },
          function (error, data) {
            return callback.call(this, error, depthData(data), symbol);
          }
        );
      });
    } else {
      publicRequest(
        common,
        common.base + 'v3/depth',
        { symbol: symbol, limit: limit },
        function (error, data) {
          return callback.call(this, error, depthData(data), symbol);
        }
      );
    }
  };

  /**
   * Creates an order
   * @param {string} side - BUY or SELL
   * @param {string} symbol - the symbol to buy
   * @param {numeric} quantity - the quantity required
   * @param {numeric} price - the price to pay for each unit
   * @param {object} flags - aadditionalbuy order flags
   * @param {function} callback - the callback function
   * @return {promise or undefined} - omitting the callback returns a promise
   */
  this.order = function (
    side,
    symbol,
    quantity,
    price,
    flags = {},
    callback = false
  ) {
    if (!callback) {
      return new Promise((resolve, reject) => {
        callback = (error, response) => {
          if (error) {
            reject(error);
          } else {
            resolve(response);
          }
        };
        order(side, symbol, quantity, price, flags, callback);
      });
    } else {
      order(side, symbol, quantity, price, flags, callback);
    }
  };

  /**
   * Creates a buy order
   * @param {string} symbol - the symbol to buy
   * @param {numeric} quantity - the quantity required
   * @param {numeric} price - the price to pay for each unit
   * @param {object} flags - additional buy order flags
   * @param {function} callback - the callback function
   * @return {promise or undefined} - omitting the callback returns a promise
   */
  this.buy = function (symbol, quantity, price, flags = {}, callback = false) {
    if (!callback) {
      return new Promise((resolve, reject) => {
        callback = (error, response) => {
          if (error) {
            reject(error);
          } else {
            resolve(response);
          }
        };
        order('BUY', symbol, quantity, price, flags, callback);
      });
    } else {
      order('BUY', symbol, quantity, price, flags, callback);
    }
  };

  /**
   * Creates a sell order
   * @param {string} symbol - the symbol to sell
   * @param {numeric} quantity - the quantity required
   * @param {numeric} price - the price to sell each unit for
   * @param {object} flags - additional order flags
   * @param {function} callback - the callback function
   * @return {promise or undefined} - omitting the callback returns a promise
   */
  this.sell = function (symbol, quantity, price, flags = {}, callback = false) {
    if (!callback) {
      return new Promise((resolve, reject) => {
        callback = (error, response) => {
          if (error) {
            reject(error);
          } else {
            resolve(response);
          }
        };
        order('SELL', symbol, quantity, price, flags, callback);
      });
    } else {
      order('SELL', symbol, quantity, price, flags, callback);
    }
  };

  /**
   * Creates a market buy order
   * @param {string} symbol - the symbol to buy
   * @param {numeric} quantity - the quantity required
   * @param {object} flags - additional buy order flags
   * @param {function} callback - the callback function
   * @return {promise or undefined} - omitting the callback returns a promise
   */
  this.marketBuy = function (
    symbol,
    quantity,
    flags = { type: 'MARKET' },
    callback = false
  ) {
    if (typeof flags === 'function') {
      // Accept callback as third parameter
      callback = flags;
      flags = { type: 'MARKET' };
    }
    if (typeof flags.type === 'undefined') flags.type = 'MARKET';
    if (!callback) {
      return new Promise((resolve, reject) => {
        callback = (error, response) => {
          if (error) {
            reject(error);
          } else {
            resolve(response);
          }
        };
        order('BUY', symbol, quantity, 0, flags, callback);
      });
    } else {
      order('BUY', symbol, quantity, 0, flags, callback);
    }
  };

  /**
   * Creates a market sell order
   * @param {string} symbol - the symbol to sell
   * @param {numeric} quantity - the quantity required
   * @param {object} flags - additional sell order flags
   * @param {function} callback - the callback function
   * @return {promise or undefined} - omitting the callback returns a promise
   */
  this.marketSell = function (
    symbol,
    quantity,
    flags = { type: 'MARKET' },
    callback = false
  ) {
    if (typeof flags === 'function') {
      // Accept callback as third parameter
      callback = flags;
      flags = { type: 'MARKET' };
    }
    if (typeof flags.type === 'undefined') flags.type = 'MARKET';
    if (!callback) {
      return new Promise((resolve, reject) => {
        callback = (error, response) => {
          if (error) {
            reject(error);
          } else {
            resolve(response);
          }
        };
        order('SELL', symbol, quantity, 0, flags, callback);
      });
    } else {
      order('SELL', symbol, quantity, 0, flags, callback);
    }
  };

  /**
   * Gets the average prices of a given symbol
   * @param {string} symbol - the symbol
   * @param {function} callback - the callback function
   * @return {promise or undefined} - omitting the callback returns a promise
   */
  this.avgPrice = function (symbol, callback = false) {
    let opt = {
      url: common.base + 'v3/avgPrice?symbol=' + symbol,
      timeout: common.options.recvWindow,
    };
    const parser = (data) => ({ [symbol]: data.price });
    return request(addProxy(common, opt), callback, parser);
  };

  /**
   * Gets the book tickers of given symbol(s)
   * @param {string} symbol - the symbol
   * @param {function} callback - the callback function
   * @return {promise or undefined} - omitting the callback returns a promise
   */
  this.bookTickers = function (symbol, callback) {
    const params = typeof symbol === 'string' ? '?symbol=' + symbol : '';
    if (typeof symbol === 'function') callback = symbol; // backwards compatibility
    let opt = {
      url: common.base + 'v3/ticker/bookTicker' + params,
      timeout: common.options.recvWindow,
    };
    const parser = symbol ? null : bookPriceData;
    return request(addProxy(common, opt), callback, parser);
  };

  /**
   * Gets the prevday percentage change
   * @param {string} symbol - the symbol or symbols
   * @param {function} callback - the callback function
   * @return {promise or undefined} - omitting the callback returns a promise
   */
  this.prevDay = function (symbol, callback) {
    let input = symbol ? { symbol: symbol } : {};
    if (!callback) {
      return new Promise((resolve, reject) => {
        callback = (error, response) => {
          if (error) {
            reject(error);
          } else {
            resolve(response);
          }
        };
        publicRequest(
          common,
          common.base + 'v3/ticker/24hr',
          input,
          (error, data) => {
            return callback.call(this, error, data, symbol);
          }
        );
      });
    } else {
      publicRequest(
        common,
        common.base + 'v3/ticker/24hr',
        input,
        (error, data) => {
          return callback.call(this, error, data, symbol);
        }
      );
    }
  };

  /**
   * Gets the the exchange info
   * @param {function} callback - the callback function
   * @return {promise or undefined} - omitting the callback returns a promise
   */
  this.exchangeInfo = function (callback) {
    if (!callback) {
      return new Promise((resolve, reject) => {
        callback = (error, response) => {
          if (error) {
            reject(error);
          } else {
            resolve(response);
          }
        };
        publicRequest(common, common.base + 'v3/exchangeInfo', {}, callback);
      });
    } else {
      publicRequest(common, common.base + 'v3/exchangeInfo', {}, callback);
    }
  };

  /**
   * Get the account
   * @param {function} callback - the callback function
   * @param {object} tempKeys - temporary keys
   * @return {?promise} returs promise if callback is not defined
   */
  this.account = function (callback, tempKeys) {
    return signedRequest(
      common,
      common.base + 'v3/account',
      {},
      callback,
      tempKeys
    );
  };

  /**
   * Get trades for a given symbol
   * @param {string} symbol - the symbol
   * @param {function} callback - the callback function
   * @param {object} options - additional options
   * @param {object} tempKeys - temporary keys
   * @return {?promise} returs promise if callback is not defined
   */
  this.trades = (symbol, callback, options = {}, tempKeys) => {
    let parameters = Object.assign({ symbol: symbol }, options);
    return signedRequest(
      common,
      common.base + 'v3/myTrades',
      parameters,
      callback,
      tempKeys
    );
  };

  /**
   * Get the historical trade info
   * @param {string} symbol - the symbol
   * @param {function} callback - the callback function
   * @param {int} limit - limit the number of items returned
   * @param {int} fromId - from this id
   * @return {promise or undefined} - omitting the callback returns a promise
   */
  this.historicalTrades = function (
    symbol,
    callback,
    limit = 500,
    fromId = false
  ) {
    let parameters = { symbol: symbol, limit: limit };
    if (fromId) parameters.fromId = fromId;
    if (!callback) {
      return new Promise((resolve, reject) => {
        callback = (error, response) => {
          if (error) {
            reject(error);
          } else {
            resolve(response);
          }
        };
        marketRequest(
          common,
          common.base + 'v3/historicalTrades',
          parameters,
          callback
        );
      });
    } else {
      marketRequest(
        common,
        common.base + 'v3/historicalTrades',
        parameters,
        callback
      );
    }
  };

  /**
   * Get the recent trades
   * @param {string} symbol - the symbol
   * @param {function} callback - the callback function
   * @param {int} limit - limit the number of items returned
   * @return {promise or undefined} - omitting the callback returns a promise
   */
  this.recentTrades = function (symbol, callback, limit = 500) {
    if (!callback) {
      return new Promise((resolve, reject) => {
        callback = (error, response) => {
          if (error) {
            reject(error);
          } else {
            resolve(response);
          }
        };
        marketRequest(
          common,
          common.base + 'v1/trades',
          { symbol: symbol, limit: limit },
          callback
        );
      });
    } else {
      marketRequest(
        common,
        common.base + 'v1/trades',
        { symbol: symbol, limit: limit },
        callback
      );
    }
  };

  /**
   * Gets the candles information for a given symbol
   * intervals: 1m,3m,5m,15m,30m,1h,2h,4h,6h,8h,12h,1d,3d,1w,1M
   * @param {string} symbol - the symbol
   * @param {function} interval - the callback function
   * @param {function} callback - the callback function
   * @param {object} options - additional options
   * @return {promise or undefined} - omitting the callback returns a promise
   */
  this.candlesticks = function (
    symbol,
    interval = '5m',
    callback = false,
    options = { limit: 500 }
  ) {
    let params = Object.assign({ symbol: symbol, interval: interval }, options);
    if (!callback) {
      return new Promise((resolve, reject) => {
        callback = (error, response) => {
          if (error) {
            reject(error);
          } else {
            resolve(response);
          }
        };
        publicRequest(common, common.base + 'v3/klines', params, function (
          error,
          data
        ) {
          return callback.call(this, error, data, symbol);
        });
      });
    } else {
      publicRequest(common, common.base + 'v3/klines', params, function (
        error,
        data
      ) {
        return callback.call(this, error, data, symbol);
      });
    }
  };
  /**
   * Get agg trades for given symbol
   * @param {string} symbol - the symbol
   * @param {object} options - addtional optoins
   * @param {function} callback - the callback function
   * @return {promise or undefined} - omitting the callback returns a promise
   */
  this.aggTrades = function (symbol, options = {}, callback = false) {
    //fromId startTime endTime limit
    let parameters = Object.assign({ symbol }, options);
    if (!callback) {
      return new Promise((resolve, reject) => {
        callback = (error, response) => {
          if (error) {
            reject(error);
          } else {
            resolve(response);
          }
        };
        marketRequest(
          common,
          common.base + 'v3/aggTrades',
          parameters,
          callback
        );
      });
    } else {
      marketRequest(common, common.base + 'v3/aggTrades', parameters, callback);
    }
  };
};
