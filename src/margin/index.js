/* eslint-disable space-in-parens */
const { signedRequest } = require('../common');

module.exports = function (common) {
  // margin api (withdraw api)

  /**
   * Create a signed http request
   * @param {string} side - BUY or SELL
   * @param {string} symbol - The symbol to buy or sell
   * @param {string} quantity - The quantity to buy or sell
   * @param {string} price - The price per unit to transact each unit at
   * @param {object} flags - additional order settings
   * @param {object} tempKeys - temporary keys
   * @return {?promise} returs promise if callback is not defined
   */
  const marginOrder = (
    side,
    symbol,
    quantity,
    price,
    flags = {},
    callback = false,
    tempKeys
  ) => {
    let endpoint = 'v1/margin/order';
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
      common.sapi + endpoint,
      opt,
      function (error, response) {
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
   * Creates an order
   * @param {string} side - BUY or SELL
   * @param {string} symbol - the symbol to buy
   * @param {numeric} quantity - the quantity required
   * @param {numeric} price - the price to pay for each unit
   * @param {object} flags - additional buy order flags
   * @param {function} callback - the callback function
   * @return {undefined}
   */
  this.order = function (
    side,
    symbol,
    quantity,
    price,
    flags = {},
    callback = false
  ) {
    marginOrder(side, symbol, quantity, price, flags, callback);
  };

  /**
   * Creates a buy order
   * @param {string} symbol - the symbol to buy
   * @param {numeric} quantity - the quantity required
   * @param {numeric} price - the price to pay for each unit
   * @param {object} flags - additional buy order flags
   * @param {function} callback - the callback function
   * @return {undefined}
   */
  this.buy = function (symbol, quantity, price, flags = {}, callback = false) {
    marginOrder('BUY', symbol, quantity, price, flags, callback);
  };

  /**
   * Creates a sell order
   * @param {string} symbol - the symbol to sell
   * @param {numeric} quantity - the quantity required
   * @param {numeric} price - the price to sell each unit for
   * @param {object} flags - additional order flags
   * @param {function} callback - the callback function
   * @return {undefined}
   */
  this.sell = function (symbol, quantity, price, flags = {}, callback = false) {
    marginOrder('SELL', symbol, quantity, price, flags, callback);
  };

  /**
   * Creates a market buy order
   * @param {string} symbol - the symbol to buy
   * @param {numeric} quantity - the quantity required
   * @param {object} flags - additional buy order flags
   * @param {function} callback - the callback function
   * @return {undefined}
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
    marginOrder('BUY', symbol, quantity, 0, flags, callback);
  };

  /**
   * Creates a market sell order
   * @param {string} symbol - the symbol to sell
   * @param {numeric} quantity - the quantity required
   * @param {object} flags - additional sell order flags
   * @param {function} callback - the callback function
   * @return {undefined}
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
    marginOrder('SELL', symbol, quantity, 0, flags, callback);
  };

  /**
   * Cancels an order
   * @param {string} symbol - the symbol to cancel
   * @param {string} orderid - the orderid to cancel
   * @param {function} callback - the callback function
   * @param {object} tempKeys - temporary keys
   * @return {?promise} returs promise if callback is not defined
   */
  this.cancel = function (symbol, orderid, callback = false, tempKeys) {
    return signedRequest(
      common,
      common.sapi + 'v1/margin/order',
      { symbol: symbol, orderId: orderid },
      callback,
      tempKeys,
      false,
      'DELETE'
    );
  };

  /**
   * Gets all order of a given symbol
   * @param {string} symbol - the symbol
   * @param {function} callback - the callback function
   * @param {object} options - additional options
   * @return {promise or undefined} - omitting the callback returns a promise
   */
  this.allOrders = function (symbol, callback, options = {}, tempKeys) {
    let parameters = Object.assign({ symbol: symbol }, options);

    return signedRequest(
      common,
      common.sapi + 'v1/margin/allOrders',
      parameters,
      callback,
      tempKeys,
      false,
      false,
      false,
      5
    );
  };

  /**
   * Gets the status of an order
   * @param {string} symbol - the symbol to check
   * @param {string} orderid - the orderid to check
   * @param {function} callback - the callback function
   * @param {object} flags - any additional flags
   * @param {object} tempKeys - temporary keys
   * @return {?promise} returs promise if callback is not defined
   */
  this.orderStatus = function (
    symbol,
    orderid,
    callback,
    flags = {},
    tempKeys
  ) {
    let parameters = Object.assign({ symbol: symbol, orderId: orderid }, flags);
    return signedRequest(
      common,
      common.sapi + 'v1/margin/order',
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
      common.sapi + 'v1/margin/openOrders',
      parameters,
      callback,
      tempKeys,
      false,
      false,
      false,
      symbol ? 1 : 40
    );
  };

  /**
   * Cancels all order of a given symbol
   * @param {string} symbol - the symbol to cancel all orders for
   * @param {function} callback - the callback function
   * @param {object} tempKeys - temporary keys
   * @return {?promise} returs promise if callback is not defined
   */
  this.cancelOrders = function (symbol, callback = false, tempKeys) {
    return signedRequest(
      common,
      common.sapi + 'v1/margin/openOrders',
      { symbol },
      function (error, json) {
        if (json.length === 0) {
          if (callback)
            return callback.call(
              this,
              'No orders present for this symbol',
              {},
              symbol
            );
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
            common.sapi + 'v1/margin/order',
            { symbol: symbol, orderId: obj.orderId },
            function (error, data) {
              if (callback) return callback.call(this, error, data, symbol);
            },
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
  };

  /**
   * Transfer from main account to margin account
   * @param {string} asset - the asset
   * @param {number} amount - the asset
   * @param {function} callback - the callback function
   * @param {object} options - additional options
   * @param {object} tempKeys - temporary keys
   * @return {?promise} returs promise if callback is not defined
   */
  this.transferMainToMargin = function (asset, amount, callback, tempKeys) {
    let parameters = Object.assign({ asset: asset, amount: amount, type: 1 });
    return signedRequest(
      common,
      common.sapi + 'v1/margin/transfer',
      parameters,
      callback,
      tempKeys,
      false,
      'POST',
      false,
      5
    );
  };

  /**
   * Transfer from margin account to main account
   * @param {string} asset - the asset
   * @param {number} amount - the asset
   * @param {function} callback - the callback function
   * @param {object} tempKeys - temporary keys
   * @return {?promise} returs promise if callback is not defined
   */
  this.transferMarginToMain = function (asset, amount, callback, tempKeys) {
    let parameters = Object.assign({ asset: asset, amount: amount, type: 2 });
    return signedRequest(
      common,
      common.sapi + 'v1/margin/transfer',
      parameters,
      callback,
      tempKeys,
      false,
      'POST',
      false,
      5
    );
  };

  /**
   * Get maximum transfer-out amount of an asset
   * @param {string} asset - the asset
   * @param {function} callback - the callback function
   * @param {object} tempKeys - temporary keys
   * @return {?promise} returs promise if callback is not defined
   */
  this.maxTransferable = function (asset, callback, tempKeys) {
    return signedRequest(
      common,
      common.sapi + 'v1/margin/maxTransferable',
      { asset: asset },
      callback,
      tempKeys
    );
  };

  /**
   * Margin account borrow/loan
   * @param {string} asset - the asset
   * @param {number} amount - the asset
   * @param {function} callback - the callback function
   * @param {object} tempKeys - temporary keys
   * @return {?promise} returs promise if callback is not defined
   */
  this.borrow = function (asset, amount, callback, tempKeys) {
    let parameters = Object.assign({ asset: asset, amount: amount });
    return signedRequest(
      common,
      common.sapi + 'v1/margin/loan',
      parameters,
      callback,
      tempKeys,
      false,
      'POST'
    );
  };

  /**
   * Margin account repay
   * @param {string} asset - the asset
   * @param {number} amount - the asset
   * @param {function} callback - the callback function
   * @param {object} tempKeys - temporary keys
   * @return {?promise} returs promise if callback is not defined
   */
  this.repay = function (asset, amount, callback, tempKeys) {
    let parameters = Object.assign({ asset: asset, amount: amount });
    return signedRequest(
      common,
      common.sapi + 'v1/margin/repay',
      parameters,
      callback,
      tempKeys,
      false,
      'POST'
    );
  };
  /**
   * Margin account details
   * @param {function} callback - the callback function
   * @param {object} tempKeys - temporary keys
   * @return {?promise} returs promise if callback is not defined
   */
  this.account = function (callback, tempKeys) {
    return signedRequest(
      common,
      common.sapi + 'v1/margin/account',
      {},
      callback,
      tempKeys,
      false,
      false,
      false,
      5
    );
  };
  /**
   * Get maximum borrow amount of an asset
   * @param {string} asset - the asset
   * @param {function} callback - the callback function
   * @param {object} tempKeys - temporary keys
   * @return {?promise} returs promise if callback is not defined
   */
  this.maxBorrowable = function (asset, callback, tempKeys) {
    return signedRequest(
      common,
      common.sapi + 'v1/margin/maxBorrowable',
      { asset: asset },
      callback,
      tempKeys
    );
  };
};
