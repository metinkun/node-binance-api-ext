const {
  createCommon,
  setOptions,
  publicRequest,
  apiRequest,
  signedRequest,
  promiseRequest,
  pullKeys,
} = require('./common');

const main = function Main(common) {
  //'use strict'; // eslint-disable-line no-unused-expressions
  // let Binance = this; // eslint-disable-line consistent-this

  /**
   * Gets depth cache for given symbol
   * @param {string} symbol - the symbol to fetch
   * @return {object} - the depth cache object
   */
  const getDepthCache = (symbol) => {
    if (typeof common.depthCache[symbol] === 'undefined')
      return { bids: {}, asks: {} };
    return common.depthCache[symbol];
  };

  /**
   * Calculate Buy/Sell volume from DepthCache
   * @param {string} symbol - the symbol to fetch
   * @return {object} - the depth volume cache object
   */
  const depthVolume = (symbol) => {
    let cache = getDepthCache(symbol),
      quantity,
      price;
    let bidbase = 0,
      askbase = 0,
      bidqty = 0,
      askqty = 0;
    for (price in cache.bids) {
      quantity = cache.bids[price];
      bidbase += parseFloat((quantity * parseFloat(price)).toFixed(8));
      bidqty += quantity;
    }
    for (price in cache.asks) {
      quantity = cache.asks[price];
      askbase += parseFloat((quantity * parseFloat(price)).toFixed(8));
      askqty += quantity;
    }
    return { bids: bidbase, asks: askbase, bidQty: bidqty, askQty: askqty };
  };

  /**
   * Gets depth cache for given symbol
   * @param {symbol} symbol - get depch cache for this symbol
   * @return {object} - object
   */
  this.depthCache = (symbol) => {
    return getDepthCache(symbol);
  };

  /**
   * Gets depth volume for given symbol
   * @param {symbol} symbol - get depch volume for this symbol
   * @return {object} - object
   */
  this.depthVolume = (symbol) => {
    return depthVolume(symbol);
  };

  /**
   * Count decimal places
   * @param {float} float - get the price precision point
   * @return {int} - number of place
   */
  this.getPrecision = function (float) {
    if (!float || Number.isInteger(float)) return 0;
    return float.toString().split('.')[1].length || 0;
  };

  /**
   * rounds number with given step
   * @param {float} qty - quantity to round
   * @param {float} stepSize - stepSize as specified by exchangeInfo
   * @return {float} - number
   */
  this.roundStep = function (qty, stepSize) {
    // Integers do not require rounding
    if (Number.isInteger(qty)) return qty;
    const qtyString = qty.toFixed(16);
    const desiredDecimals = Math.max(stepSize.indexOf('1') - 1, 0);
    const decimalIndex = qtyString.indexOf('.');
    return parseFloat(qtyString.slice(0, decimalIndex + desiredDecimals + 1));
  };

  /**
   * rounds price to required precision
   * @param {float} price - price to round
   * @param {float} tickSize - tickSize as specified by exchangeInfo
   * @return {float} - number
   */
  this.roundTicks = function (price, tickSize) {
    const formatter = new Intl.NumberFormat('en-US', {
      style: 'decimal',
      minimumFractionDigits: 0,
      maximumFractionDigits: 8,
    });
    const precision = formatter.format(tickSize).split('.')[1].length || 0;
    if (typeof price === 'string') price = parseFloat(price);
    return price.toFixed(precision);
  };

  /**
   * Reverses the keys of an object
   * @param {object} object - the object
   * @return {object} - the object
   */
  this.reverse = function (object) {
    let range = Object.keys(object).reverse(),
      output = {};
    for (let price of range) {
      output[price] = object[price];
    }
    return output;
  };

  /**
   * Converts an object to an array
   * @param {object} obj - the object
   * @return {array} - the array
   */
  this.array = function (obj) {
    return Object.keys(obj).map(function (key) {
      return [Number(key), obj[key]];
    });
  };

  /**
   * Sorts bids
   * @param {string} symbol - the object
   * @param {int} max - the max number of bids
   * @param {string} baseValue - the object
   * @return {object} - the object
   */
  this.sortBids = function (symbol, max = Infinity, baseValue = false) {
    let object = {},
      count = 0,
      cache;
    if (typeof symbol === 'object') cache = symbol;
    else cache = getDepthCache(symbol).bids;
    let sorted = Object.keys(cache).sort(function (a, b) {
      return parseFloat(b) - parseFloat(a);
    });
    let cumulative = 0;
    for (let price of sorted) {
      if (baseValue === 'cumulative') {
        cumulative += parseFloat(cache[price]);
        object[price] = cumulative;
      } else if (!baseValue) object[price] = parseFloat(cache[price]);
      else
        object[price] = parseFloat(
          (cache[price] * parseFloat(price)).toFixed(8)
        );
      if (++count >= max) break;
    }
    return object;
  };

  /**
   * Sorts asks
   * @param {string} symbol - the object
   * @param {int} max - the max number of bids
   * @param {string} baseValue - the object
   * @return {object} - the object
   */
  this.sortAsks = function (symbol, max = Infinity, baseValue = false) {
    let object = {},
      count = 0,
      cache;
    if (typeof symbol === 'object') cache = symbol;
    else cache = getDepthCache(symbol).asks;
    let sorted = Object.keys(cache).sort(function (a, b) {
      return parseFloat(a) - parseFloat(b);
    });
    let cumulative = 0;
    for (let price of sorted) {
      if (baseValue === 'cumulative') {
        cumulative += parseFloat(cache[price]);
        object[price] = cumulative;
      } else if (!baseValue) object[price] = parseFloat(cache[price]);
      else
        object[price] = parseFloat(
          (cache[price] * parseFloat(price)).toFixed(8)
        );
      if (++count >= max) break;
    }
    return object;
  };

  /**
   * Returns the first property of an object
   * @param {object} object - the object to get the first member
   * @return {string} - the object key
   */
  this.first = function (object) {
    return Object.keys(object).shift();
  };

  /**
   * Returns the last property of an object
   * @param {object} object - the object to get the first member
   * @return {string} - the object key
   */
  this.last = function (object) {
    return Object.keys(object).pop();
  };

  /**
   * Returns an array of properties starting at start
   * @param {object} object - the object to get the properties form
   * @param {int} start - the starting index
   * @return {array} - the array of entires
   */
  this.slice = function (object, start = 0) {
    return Object.entries(object)
      .slice(start)
      .map((entry) => entry[0]);
  };

  /**
   * Gets the minimum key form object
   * @param {object} object - the object to get the properties form
   * @return {string} - the minimum key
   */
  this.min = function (object) {
    return Math.min.apply(Math, Object.keys(object));
  };

  /**
   * Gets the maximum key form object
   * @param {object} object - the object to get the properties form
   * @return {string} - the minimum key
   */
  this.max = function (object) {
    return Math.max.apply(Math, Object.keys(object));
  };

  /**
   * Sets an option given a key and value
   * @param {string} key - the key to set
   * @param {object} value - the value of the key
   * @return {undefined}
   */
  this.setOption = function (key, value) {
    common.options[key] = value;
  };

  /**
   * Gets an option given a key
   * @param {string} key - the key to set
   * @return {undefined}
   */
  this.getOption = function (key) {
    return common.options[key];
  };

  /**
   * Returns the entire info object
   * @return {object} - the info object
   */
  this.getInfo = function () {
    return common.info;
  };

  /**
   * Returns the entire options object
   * @return {object} - the options object
   */
  this.getOptions = function () {
    return common.options;
  };

  /**
   * Tell api to use the server time to offset time indexes
   * @param {function} callback - the callback function
   * @return {promise or undefined} - omitting the callback returns a promise
   */
  this.useServerTime = (callback = false) => {
    const parser = (data) => {
      common.info.timeOffset = data.serverTime - Date.now();
      return data;
    };
    return publicRequest(
      common,
      common.base + 'v3/time',
      {},
      callback,
      false,
      parser
    );
  };

  /**
   * Convert chart data to highstock array [timestamp,open,high,low,close]
   * @param {object} chart - the chart
   * @param {boolean} include_volume - to include the volume or not
   * @return {array} - an array
   */
  this.highstock = function (chart, include_volume = false) {
    let array = [];
    for (let timestamp in chart) {
      let obj = chart[timestamp];
      let line = [
        Number(timestamp),
        parseFloat(obj.open),
        parseFloat(obj.high),
        parseFloat(obj.low),
        parseFloat(obj.close),
      ];
      if (include_volume) line.push(parseFloat(obj.volume));
      array.push(line);
    }
    return array;
  };

  /**
   * Populates OHLC information
   * @param {object} chart - the chart
   * @return {object} - object with candle information
   */
  this.ohlc = function (chart) {
    let open = [],
      high = [],
      low = [],
      close = [],
      volume = [];
    for (let timestamp in chart) {
      //common.ohlc[symbol][interval]
      let obj = chart[timestamp];
      open.push(parseFloat(obj.open));
      high.push(parseFloat(obj.high));
      low.push(parseFloat(obj.low));
      close.push(parseFloat(obj.close));
      volume.push(parseFloat(obj.volume));
    }
    return { open: open, high: high, low: low, close: close, volume: volume };
  };

  /**
   * Queries the public api
   * @param {string} url - the public api endpoint
   * @param {object} data - the data to send
   * @param {function} callback - the callback function
   * @param {string} method - the http method
   * @return {promise or undefined} - omitting the callback returns a promise
   */
  this.publicRequest = function (url, data, callback, method = 'GET') {
    if (!callback) {
      return new Promise((resolve, reject) => {
        callback = (error, response) => {
          if (error) {
            reject(error);
          } else {
            resolve(response);
          }
        };
        publicRequest(common, url, data, callback, method);
      });
    } else {
      publicRequest(common, url, data, callback, method);
    }
  };

  /**
   * Queries the futures API by default
   * @param {string} url - the signed api endpoint
   * @param {{APIKEY: string, APISECRET: string }} params - additional parameters
   * @param {object} flags - type of request, authentication method and endpoint url
   * @param {function} callback - the callback function
   * @return {?promise} returs promise if callback is not defined
   */
  this.promiseRequest = function (url, params = {}, flags = {}, callback) {
    return promiseRequest(common, url, params, flags, callback);
  };

  /**
   * Queries the signed api
   * @param {string} url - the signed api endpoint
   * @param {object} data - the data to send
   * @param {function} callback - the callback function
   * @param {string} method - the http method
   * @param {boolean} noDataInSignature - Prevents data from being added to signature
   * @return {?promise} returs promise if callback is not defined
   */
  this.signedRequest = function (
    url,
    data,
    callback,
    method = 'GET',
    noDataInSignature = false
  ) {
    return signedRequest(
      common,
      url,
      data,
      callback,
      pullKeys(data),
      false,
      method,
      noDataInSignature
    );
  };

  /**
   * Gets the market asset of given symbol
   * @param {string} symbol - the public api endpoint
   * @return {undefined}
   */
  this.getMarket = function (symbol) {
    if (symbol.endsWith('BTC')) return 'BTC';
    else if (symbol.endsWith('ETH')) return 'ETH';
    else if (symbol.endsWith('BNB')) return 'BNB';
    else if (symbol.endsWith('XRP')) return 'XRP';
    else if (symbol.endsWith('PAX')) return 'PAX';
    else if (symbol.endsWith('USDT')) return 'USDT';
    else if (symbol.endsWith('USDC')) return 'USDC';
    else if (symbol.endsWith('USDS')) return 'USDS';
    else if (symbol.endsWith('TUSD')) return 'TUSD';
  };

  /**
   * Get the account binance lending information
   * @param {object} params - additional params
   * @param {function} callback - the callback function
   * @return {promise or undefined} - omitting the callback returns a promise
   */
  this.lending = async (params = {}, callback) => {
    return promiseRequest(
      common,
      'v1/lending/union/account',
      params,
      { base: common.sapi, type: 'SIGNED' },
      callback
    );
  };

  // futures websockets support: ticker bookTicker miniTicker aggTrade markPrice
  /* TODO: https://binance-docs.github.io/apidocs/futures/en/#change-log
        Cancel multiple orders DELETE /common.fapi/v1/batchOrders
        New Future Account Transfer POST https://api.binance.com/sapi/v1/futures/transfer
        Get Postion Margin Change History (TRADE)
        
        wss://fstream.binance.com/ws/<listenKey>
        Diff. Book Depth Streams (250ms, 100ms, or realtime): <symbol>@depth OR <symbol>@depth@100ms OR <symbol>@depth@0ms
        Partial Book Depth Streams (5, 10, 20): <symbol>@depth<levels> OR <symbol>@depth<levels>@100ms
        All Market Liquidation Order Streams: !forceOrder@arr
        Liquidation Order Streams for specific symbol: <symbol>@forceOrder
        Chart data (250ms): <symbol>@kline_<interval>
        SUBSCRIBE, UNSUBSCRIBE, LIST_SUBSCRIPTIONS, SET_PROPERTY, GET_PROPERTY
        Live Subscribing/Unsubscribing to streams: requires sending futures subscription id when connecting
        futuresSubscriptions { "method": "LIST_SUBSCRIPTIONS", "id": 1 }
        futuresUnsubscribe { "method": "UNSUBSCRIBE", "params": [ "btcusdt@depth" ], "id": 1 }
        futures depthCache & complete realtime chart updates
        */
};

const spot = require('./spot');
const futures = require('./futures');
const wapi = require('./wapi');
const margin = require('./margin');
const webSocket = require('./webSocket');

function Binance(options = {}) {
  // if (!new.target) {
  //   // Legacy support for calling the constructor without 'new'
  //   return new Binance(common);
  // }
  const common = createCommon();

  if (options) setOptions(options, common);

  const returnThis = {
    //   /**
    //    * Gets an option given a key
    //    * @param {object} opt - the object with the class configuration
    //    * @param {function} callback - the callback function
    //    * @return {undefined}
    //    */
    options: (opt, callback) =>
      setOptions.bind(returnThis)(opt, common, callback),
    ...new main(common),
    spot: new spot(common),
    futures: new futures(common),
    wapi: new wapi(common),
    margin: new margin(common),
    webSocket: new webSocket(common),
    common,
  };

  return returnThis;
}
module.exports = Binance;
//https://github.com/binance-exchange/binance-official-api-docs

//error codes : https://github.com/binance-exchange/binance-official-api-docs/blob/master/errors.md
