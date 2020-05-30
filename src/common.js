/* eslint-disable space-in-parens */
const file = require('fs');
const qs = require('qs');
const crypto = require('crypto');
const axios = require('axios').default;
const { RateLimitWeight } = require('rate-limit-ext');
const limiter = new RateLimitWeight(axios, { weightLimit: 100, period: 5000 });

const default_options = {
  recvWindow: 5000,
  useServerTime: false,
  reconnect: true,
  forcedReconnect : false, // keep trying reconnect whatever happens
  verbose: false,
  test: false,
  arrayBased:false,
  log: function (...args) {
    console.log(Array.prototype.slice.call(args));
  },
};

function createCommon() {
  return {
    subscriptions: {},
    futuresSubscriptions: {},
    futuresInfo: {},
    futuresMeta: {},
    futuresTicks: {},
    futuresRealtime: {},
    futuresKlineQueue: {},
    depthCache: {},
    depthCacheContext: {},
    ohlcLatest: {},
    klineQueue: {},
    ohlc: {},
    options: { ...default_options },
    info: { timeOffset: 0 },
    socketHeartbeatInterval: null,


    base: 'https://api.binance.com/api/',
    wapi: 'https://api.binance.com/wapi/',
    sapi: 'https://api.binance.com/sapi/',
    fapi: 'https://fapi.binance.com/fapi/',
    fapiTest: 'https://testnet.binancefuture.com/fapi/',
    fstream: 'wss://fstream.binance.com/stream?streams=',
    fstreamSingle: 'wss://fstream.binance.com/ws/',
    stream: 'wss://stream.binance.com:9443/ws/',
    combineStream: 'wss://stream.binance.com:9443/stream?streams=',
    userAgent: 'Mozilla/4.0 (compatible; Node Binance API)',
    contentType: 'application/x-www-form-urlencoded',
  };
}

function setOptions(opt = {}, common, callback = false) {
  if (typeof opt === 'string') {
    // Pass json config filename
    common.options = JSON.parse(file.readFileSync(opt));
  } else common.options = opt;
  if (typeof common.options.recvWindow === 'undefined')
    common.options.recvWindow = default_options.recvWindow;
  if (typeof common.options.useServerTime === 'undefined')
    common.options.useServerTime = default_options.useServerTime;
  if (typeof common.options.reconnect === 'undefined')
    common.options.reconnect = default_options.reconnect;
  if (typeof common.options.test === 'undefined')
    common.options.test = default_options.test;
  if (typeof common.options.log === 'undefined')
    common.options.log = default_options.log;
  if (typeof common.options.verbose === 'undefined')
    common.options.verbose = default_options.verbose;
  if (typeof common.options.urls !== 'undefined') {
    const { urls } = common.options;
    if (typeof urls.base === 'string') common.base = urls.base;
    if (typeof urls.wapi === 'string') common.wapi = urls.wapi;
    if (typeof urls.sapi === 'string') common.sapi = urls.sapi;
    if (typeof urls.fapi === 'string') common.fapi = urls.fapi;
    if (typeof urls.fapiTest === 'string') common.fapiTest = urls.fapiTest;
    if (typeof urls.stream === 'string') common.stream = urls.stream;
    if (typeof urls.combineStream === 'string')
      common.combineStream = urls.combineStream;
    if (typeof urls.fstream === 'string') common.fstream = urls.fstream;
    if (typeof urls.fstreamSingle === 'string')
      common.fstreamSingle = urls.fstreamSingle;
  }
  if (common.options.useServerTime) {
    apiRequest(common, common.base + 'v3/time', {}, function (error, response) {
      common.info.timeOffset = response.serverTime - new Date().getTime();
      //common.options.log("server time set: ", response.serverTime, common.info.timeOffset);
      if (callback) callback();
    });
  } else if (callback) callback();
  return this;
}

const addProxy = (common, opt) => {
  if (common.options.proxy) {
    const proxyauth = common.options.proxy.auth
      ? `${common.options.proxy.auth.username}:${common.options.proxy.auth.password}@`
      : '';
    opt.proxy = `http://${proxyauth}${common.options.proxy.host}:${common.options.proxy.port}`;
  }
  return opt;
};

// const reqHandler = (cb) => (error, response, body) => {
//   if (!cb) return;
//   if (error) return cb(error, {});
//   if (response && response.statusCode !== 200) return cb(response, {});
//   return cb(null, JSON.parse(body));
// };

const pullKeys = (params) => {
  const keys = { APIKEY: params.APIKEY, APISECRET: params.APISECRET };
  delete params.APIKEY;
  delete params.APISECRET;
  return keys;
};

const filterParams = (params) => {
  for (let key in params) if (!params[key]) delete params[key];
};

const makeQueryString = (q) =>
  Object.keys(q)
    .reduce((a, k) => {
      if (q[k] !== undefined) {
        a.push(k + '=' + encodeURIComponent(q[k]));
      }
      return a;
    }, [])
    .join('&');

const proxyRequest = (common, opt, cb, parser, weight = 1) =>
  request(addProxy(common, opt), cb, parser, weight);

const reqObjPOST = (common, url, data = {}, key) => ({
  url: url,
  data: qs.stringify(data),
  method: 'POST',
  timeout: common.options.recvWindow,
  headers: {
    'User-Agent': common.userAgent,
    'Content-type': common.contentType,
    'X-MBX-APIKEY': key || '',
  },
});

const reqObj = (
  common,
  url,
  data = {},
  method = 'GET',
  key,
  fillParams = false
) => {
  const returnThis = {
    url: url,
    method: method,
    timeout: common.options.recvWindow,
    headers: {
      'User-Agent': common.userAgent,
      'Content-type': common.contentType,
      'X-MBX-APIKEY': key || '',
    },
  };
  if (fillParams) returnThis.params = data;
  return returnThis;
};

/**
 * Create a http request to the public API
 * @param {object} common - common private object
 * @param {string} url - The http endpoint
 * @param {object} data - The data to send
 * @param {function} callback - The callback method to call
 * @param {string} method - the http method
 * @param {function} parser - The callback method to call
 * @return {?promise}
 */
const apiRequest = (
  common,
  url,
  data = {},
  callback,
  method,
  parser,
  weight = 1
) => {
  if (!method) method = 'GET';
  if (!common.options.APIKEY) throw Error('apiRequest: Invalid API Key');
  let opt = reqObj(common, url, data, method, common.options.APIKEY, true);
  return proxyRequest(common, opt, callback, parser, weight);
};

/**
 * Create a signed http request
 * @param {object} common - common private object
 * @param {string} url - The http endpoint
 * @param {object} data - The data to send
 * @param {function} callback - The callback method to call
 * @param {object} tempKeys - temporary keys
 * @param {function} parser - response data parser
 * @param {string} method - the http method
 * @param {boolean} noDataInSignature - Prevents data from being added to signature
 * @return {?promise} returns promise if callback is not defined
 */
const signedRequest = (
  common,
  url,
  data = {},
  callback,
  tempKeys,
  parser,
  method,
  noDataInSignature = false,
  weight = 1
) => {
  if (!method) method = 'GET';
  let apiKey, secretKey;
  if (tempKeys && tempKeys.APIKEY) apiKey = tempKeys.APIKEY;
  else if (common.options.APIKEY) apiKey = common.options.APIKEY;
  else throw Error('apiRequest: Invalid API Key');

  if (tempKeys && tempKeys.APISECRET) secretKey = tempKeys.APISECRET;
  else if (common.options.APISECRET) secretKey = common.options.APISECRET;
  else throw Error('apiRequest: Invalid API Secret');

  data.timestamp = new Date().getTime() + common.info.timeOffset;
  if (typeof data.recvWindow === 'undefined')
    data.recvWindow = common.options.recvWindow;
  let query =
    method === 'POST' && noDataInSignature ? '' : makeQueryString(data);
  let signature = crypto
    .createHmac('sha256', secretKey)
    .update(query)
    .digest('hex'); // set the HMAC hash header
  let opt;
  if (method === 'POST') {
    opt = reqObjPOST(common, url + '?signature=' + signature, data, apiKey);
  } else {
    opt = reqObj(
      common,
      url + '?' + query + '&signature=' + signature,
      data,
      method,
      apiKey,
      !query
    );
  }
  return proxyRequest(common, opt, callback, parser, weight);
};

const request = (reqObj, callBack, parser, weight = 1) => {
  let res, rej, promise;
  if (!callBack) {
    promise = new Promise((resolve, reject) => {
      res = resolve;
      rej = reject;
    });
  } else {
    rej = (err) => callBack(err);
    res = (response) => callBack(null, response);
  }
  limiter
    .request(weight, reqObj)
    .then((response) => {
      if (response.status !== 200) {
        let err = response.data;
        if (typeof err === 'string') {
          try {
            err = JSON.parse(err);
          } catch (error) {}
        }
        rej(err);
      } else {
        if (parser) res(parser(response.data));
        else res(response.data);
      }
    })
    .catch(function (error) {
      if (error.response) {
        let err = error.response.data;
        if (typeof err === 'string') {
          try {
            err = JSON.parse(err);
          } catch (error) {}
        }
        rej(err);
      } else if (error.request) rej(error.request);
      else rej(error.message);
    });
  if (promise) return promise;
};

const promiseRequest = async (
  common,
  url,
  data = {},
  flags = {},
  callback,
  parser,
  weight = 1
) => {
  let query = '',
    headers = {
      'User-Agent': common.userAgent,
      'Content-type': 'application/x-www-form-urlencoded',
    };
  const tempKeys = pullKeys(data);
  let apiKey, secretKey;
  if (tempKeys && tempKeys.APIKEY) apiKey = tempKeys.APIKEY;
  else if (common.options.APIKEY) apiKey = common.options.APIKEY;

  if (tempKeys && tempKeys.APISECRET) secretKey = tempKeys.APISECRET;
  else if (common.options.APISECRET) secretKey = common.options.APISECRET;
  if (typeof flags.method === 'undefined') flags.method = 'GET'; // GET POST PUT DELETE
  if (typeof flags.type === 'undefined') flags.type = false;
  // TRADE, SIGNED, MARKET_DATA, USER_DATA, USER_STREAM
  else {
    if (typeof data.recvWindow === 'undefined')
      data.recvWindow = common.options.recvWindow;
    headers['X-MBX-APIKEY'] = apiKey;
    if (!apiKey) return new Promise((res, rej) => rej('Invalid API KEY'));
  }
  let baseURL = typeof flags.base === 'undefined' ? common.base : flags.base;
  if (common.options.test && baseURL === common.fapi) baseURL = common.fapiTest;
  let opt = {
    headers,
    url: baseURL + url,
    method: flags.method,
    timeout: common.options.recvWindow,
    followAllRedirects: true,
  };
  if (
    flags.type === 'SIGNED' ||
    flags.type === 'TRADE' ||
    flags.type === 'USER_DATA'
  ) {
    if (!secretKey) return new Promise((res, rej) => rej('Invalid API Secret'));
    data.timestamp = new Date().getTime() + common.info.timeOffset;
    query = makeQueryString(data);
    data.signature = crypto
      .createHmac('sha256', secretKey)
      .update(query)
      .digest('hex'); // HMAC hash header
    opt.url = `${baseURL}${url}?${query}&signature=${data.signature}`;
  } else opt.params = data;
  return proxyRequest(common, opt, callback, parser, weight);
};

const depthWeight = (limit) => {
  if (limit < 50) return 2;
  else if (limit < 100) return 5;
  else if (limit < 500) return 10;
  else return 20;
};

/**
 * Create a http request to the public API
 * @param {string} url - The http endpoint
 * @param {object} data - The data to send
 * @param {function} callback - The callback method to call
 * @param {string} method - the http method
 * @return {undefined}
 */
const publicRequest = (
  common,
  url,
  data = {},
  callback,
  method,
  parser,
  weight = 1
) => {
  if (!method) method = 'GET';
  let opt = reqObj(common, url, data, method, false, true);
  return proxyRequest(common, opt, callback, parser, weight);
};

/**
 * Used for /depth endpoint
 * @param {object} data - containing the bids and asks
 * @return {undefined}
 */
const depthData = (data) => {
  if (!data) return { bids: [], asks: [] };
  let bids = {},
    asks = {},
    obj;
  if (typeof data.bids !== 'undefined') {
    for (obj of data.bids) {
      bids[obj[0]] = parseFloat(obj[1]);
    }
  }
  if (typeof data.asks !== 'undefined') {
    for (obj of data.asks) {
      asks[obj[0]] = parseFloat(obj[1]);
    }
  }
  return { lastUpdateId: data.lastUpdateId, bids: bids, asks: asks };
};

/**
 * Gets the price of a given symbol or symbols
 * @param {array} data - array of symbols
 * @return {array} - symbols with their current prices
 */
const priceParser = (data) => {
  const prices = {};
  if (Array.isArray(data)) {
    for (let obj of data) {
      prices[obj.symbol] = obj.price;
    }
  } else if (data.symbol) prices[data.symbol] = data.price;
  else return data;

  return prices;
};

module.exports = {
  createCommon,
  setOptions,
  pullKeys,
  filterParams,
  request,
  proxyRequest,
  apiRequest,
  signedRequest,
  promiseRequest,
  addProxy,
  reqObj,
  reqObjPOST,
  publicRequest,
  depthData,
  depthWeight,
  priceParser,
};
