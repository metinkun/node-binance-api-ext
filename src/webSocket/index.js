/* eslint-disable no-unused-vars */
/* eslint-disable space-in-parens */

const url = require('url');
const HttpsProxyAgent = require('https-proxy-agent');
const SocksProxyAgent = require('socks-proxy-agent');
const WebSocket = require('ws');
const stringHash = require('string-hash');
const async = require('async');

const {
  signedRequest,
  publicRequest,
  apiRequest,
  promiseRequest,
  depthData,
} = require('../common');

const { times } = require('../constants');

module.exports = function (common) {
  // websocket

  /**
   * No-operation function
   * @return {undefined}
   */
  const noop = () => {
    // Do nothing
  };

  /**
   * Called on each socket heartbeat
   * @return {undefined}
   */
  const handleSocketHeartbeat = function () {
    this.isAlive = true;
  };

  /**
   * Replaces socks connection uri hostname with IP address
   * @param {string} connString - socks connection string
   * @return {string} modified string with ip address
   */
  const proxyReplacewithIp = (connString) => {
    return connString;
  };

  /**
   * Returns an array in the form of [host, port]
   * @param {string} connString - connection string
   * @return {array} array of host and port
   */
  const parseProxy = (connString) => {
    let arr = connString.split('/');
    let host = arr[2].split(':')[0];
    let port = arr[2].split(':')[1];
    return [arr[0], host, port];
  };

  /**
   * Checks whether or not an array contains any duplicate elements
   * @param {array} array - the array to check
   * @return {boolean} - true or false
   */
  const isArrayUnique = (array) => {
    let s = new Set(array);
    return s.size === array.length;
  };

  /**
   * Converts the futures liquidation stream data into a friendly object
   * @param {object} data - liquidation data callback data type
   * @return {object} - user friendly data type
   */
  const fLiquidationConvertData = (data) => {
    let eventType = data.e,
      eventTime = data.E;
    let {
      s: symbol,
      S: side,
      o: orderType,
      f: timeInForce,
      q: origAmount,
      p: price,
      ap: avgPrice,
      X: orderStatus,
      l: lastFilledQty,
      z: totalFilledQty,
      T: tradeTime,
    } = data.o;
    return {
      symbol,
      side,
      orderType,
      timeInForce,
      origAmount,
      price,
      avgPrice,
      orderStatus,
      lastFilledQty,
      totalFilledQty,
      eventType,
      tradeTime,
      eventTime,
    };
  };

  /**
   * Checks to see of the object is iterable
   * @param {object} obj - The object check
   * @return {boolean} true or false is iterable
   */
  const isIterable = (obj) => {
    if (obj === null) return false;
    return typeof obj[Symbol.iterator] === 'function';
  };

  /**
   * Used to subscribe to a combined websocket endpoint
   * @param {string} streams - streams to connect to
   * @param {function} callback - the function to call when information is received
   * @param {boolean} reconnect - whether to reconnect on disconnect
   * @param {object} opened_callback - the function to call when opened
   * @return {WebSocket} - websocket reference
   */
  const subscribeCombined = function (
    streams,
    callback,
    reconnect = false,
    opened_callback = false
  ) {
    let httpsproxy = process.env.https_proxy || false;
    let socksproxy = process.env.socks_proxy || false;
    const queryParams = streams.join('/');
    let ws = false;
    if (socksproxy !== false) {
      socksproxy = proxyReplacewithIp(socksproxy);
      if (common.options.verbose)
        common.options.log('using socks proxy server ' + socksproxy);
      let agent = new SocksProxyAgent({
        protocol: parseProxy(socksproxy)[0],
        host: parseProxy(socksproxy)[1],
        port: parseProxy(socksproxy)[2],
      });
      ws = new WebSocket(common.combineStream + queryParams, { agent: agent });
    } else if (httpsproxy !== false) {
      if (common.options.verbose)
        common.options.log('using proxy server ' + httpsproxy);
      let config = url.parse(httpsproxy);
      let agent = new HttpsProxyAgent(config);
      ws = new WebSocket(common.combineStream + queryParams, { agent: agent });
    } else {
      ws = new WebSocket(common.combineStream + queryParams);
    }

    ws.reconnect = common.options.reconnect;
    ws.endpoint = stringHash(queryParams);
    ws.isAlive = false;
    if (common.options.verbose) {
      common.options.log(
        'CombinedStream: Subscribed to [' + ws.endpoint + '] ' + queryParams
      );
    }
    ws.on('open', handleSocketOpen.bind(ws, opened_callback));
    ws.on('pong', handleSocketHeartbeat);
    ws.on('error', handleSocketError);
    ws.on('close', handleSocketClose.bind(ws, reconnect));
    ws.on('message', (data) => {
      try {
        callback(JSON.parse(data).data);
      } catch (error) {
        common.options.log('CombinedStream: Parse error: ' + error.message);
      }
    });
    return ws;
  };

  /**
   * Reworked Tuitio's heartbeat code into a shared single interval tick
   * @return {undefined}
   */
  const socketHeartbeat = () => {
    /* Sockets removed from `subscriptions` during a manual terminate()
         will no longer be at risk of having functions called on them */
    for (let endpointId in common.subscriptions) {
      const ws = common.subscriptions[endpointId];
      if (ws.isAlive) {
        ws.isAlive = false;
        if (ws.readyState === WebSocket.OPEN) ws.ping(noop);
      } else {
        if (common.options.verbose)
          common.options.log(
            'Terminating inactive/broken WebSocket: ' + ws.endpoint
          );
        if (ws.readyState === WebSocket.OPEN) ws.terminate();
      }
    }
  };

  /**
   * Called when socket is opened, subscriptions are registered for later reference
   * @param {function} opened_callback - a callback function
   * @return {undefined}
   */
  const handleSocketOpen = function (opened_callback) {
    this.isAlive = true;
    if (Object.keys(common.subscriptions).length === 0) {
      common.socketHeartbeatInterval = setInterval(socketHeartbeat, 30000);
    }
    common.subscriptions[this.endpoint] = this;
    if (typeof opened_callback === 'function') opened_callback(this.endpoint);
  };

  /**
   * Called when socket is closed, subscriptions are de-registered for later reference
   * @param {boolean} reconnect - true or false to reconnect the socket
   * @param {string} code - code associated with the socket
   * @param {string} reason - string with the response
   * @return {undefined}
   */
  const handleSocketClose = function (reconnect, code, reason) {
    delete common.subscriptions[this.endpoint];
    if (
      common.subscriptions &&
      Object.keys(common.subscriptions).length === 0
    ) {
      clearInterval(common.socketHeartbeatInterval);
    }
    common.options.log(
      'WebSocket closed: ' +
        this.endpoint +
        (code ? ' (' + code + ')' : '') +
        (reason ? ' ' + reason : '')
    );
    if (common.options.reconnect && this.reconnect && reconnect) {
      if (this.endpoint && parseInt(this.endpoint.length, 10) === 60)
        common.options.log('Account data WebSocket reconnecting...');
      else
        common.options.log('WebSocket reconnecting: ' + this.endpoint + '...');
      setTimeout(() => {
        try {
          reconnect();
        } catch (error) {
          common.options.log('WebSocket reconnect error: ' + error.message);
        }
      }, 10000);
    }
  };

  /**
   * Used to terminate a web socket
   * @param {string} endpoint - endpoint identifier associated with the web socket
   * @param {boolean} reconnect - auto reconnect after termination
   * @return {undefined}
   */
  const terminate = function (endpoint, reconnect = false) {
    let ws = common.subscriptions[endpoint];
    if (!ws) return;
    ws.removeAllListeners('message');
    ws.reconnect = reconnect;
    ws.terminate();
  };

  /**
   * Called when socket errors
   * @param {object} error - error object message
   * @return {undefined}
   */
  const handleSocketError = function (error) {
    /* Errors ultimately result in a `close` event.
         see: https://github.com/websockets/ws/blob/828194044bf247af852b31c49e2800d557fedeff/lib/websocket.js#L126 */
    common.options.log(
      'WebSocket error: ' +
        this.endpoint +
        (error.code ? ' (' + error.code + ')' : '') +
        (error.message ? ' ' + error.message : '')
    );
  };

  /**
   * Used to subscribe to a single websocket endpoint
   * @param {string} endpoint - endpoint to connect to
   * @param {function} callback - the function to call when information is received
   * @param {boolean} reconnect - whether to reconnect on disconnect
   * @param {object} opened_callback - the function to call when opened
   * @return {WebSocket} - websocket reference
   */
  const subscribe = function (
    endpoint,
    callback,
    reconnect = false,
    opened_callback = false
  ) {
    let httpsproxy = process.env.https_proxy || false;
    let socksproxy = process.env.socks_proxy || false;
    let ws = false;

    if (socksproxy !== false) {
      socksproxy = proxyReplacewithIp(socksproxy);
      if (common.options.verbose)
        common.options.log('using socks proxy server ' + socksproxy);
      let agent = new SocksProxyAgent({
        protocol: parseProxy(socksproxy)[0],
        host: parseProxy(socksproxy)[1],
        port: parseProxy(socksproxy)[2],
      });
      ws = new WebSocket(common.stream + endpoint, { agent: agent });
    } else if (httpsproxy !== false) {
      if (common.options.verbose)
        common.options.log('using proxy server ' + agent);
      let config = url.parse(httpsproxy);
      let agent = new HttpsProxyAgent(config);
      ws = new WebSocket(common.stream + endpoint, { agent: agent });
    } else {
      ws = new WebSocket(common.stream + endpoint);
    }

    if (common.options.verbose) common.options.log('Subscribed to ' + endpoint);
    ws.reconnect = common.options.reconnect;
    ws.endpoint = endpoint;
    ws.isAlive = false;
    ws.on('open', handleSocketOpen.bind(ws, opened_callback));
    ws.on('pong', handleSocketHeartbeat);
    ws.on('error', handleSocketError);
    ws.on('close', handleSocketClose.bind(ws, reconnect));
    ws.on('message', (data) => {
      try {
        callback(JSON.parse(data));
      } catch (error) {
        common.options.log('Parse error: ' + error.message);
      }
    });
    return ws;
  };

  /**
   * Converts the previous day stream into friendly object
   * @param {object} data - user data callback data type
   * @return {object} - user friendly data type
   */
  const prevDayConvertData = (data) => {
    let convertData = (data) => {
      let {
        e: eventType,
        E: eventTime,
        s: symbol,
        p: priceChange,
        P: percentChange,
        w: averagePrice,
        x: prevClose,
        c: close,
        Q: closeQty,
        b: bestBid,
        B: bestBidQty,
        a: bestAsk,
        A: bestAskQty,
        o: open,
        h: high,
        l: low,
        v: volume,
        q: quoteVolume,
        O: openTime,
        C: closeTime,
        F: firstTradeId,
        L: lastTradeId,
        n: numTrades,
      } = data;
      return {
        eventType,
        eventTime,
        symbol,
        priceChange,
        percentChange,
        averagePrice,
        prevClose,
        close,
        closeQty,
        bestBid,
        bestBidQty,
        bestAsk,
        bestAskQty,
        open,
        high,
        low,
        volume,
        quoteVolume,
        openTime,
        closeTime,
        firstTradeId,
        lastTradeId,
        numTrades,
      };
    };
    if (Array.isArray(data)) {
      const result = [];
      for (let obj of data) {
        let converted = convertData(obj);
        result.push(converted);
      }
      return result;
      // eslint-disable-next-line no-else-return
    } else {
      return convertData(data);
    }
  };

  /**
   * Parses the previous day stream and calls the user callback with friendly object
   * @param {object} data - user data callback data type
   * @param {function} callback - user data callback data type
   * @return {undefined}
   */
  const prevDayStreamHandler = (data, callback) => {
    const converted = prevDayConvertData(data);
    callback(null, converted);
  };

  /**
   * Used to subscribe to a single futures websocket endpoint
   * @param {string} endpoint - endpoint to connect to
   * @param {function} callback - the function to call when information is received
   * @param {object} params - Optional reconnect {boolean} (whether to reconnect on disconnect), openCallback {function}, id {string}
   * @return {WebSocket} - websocket reference
   */
  const futuresSubscribeSingle = function (endpoint, callback, params = {}) {
    if (typeof params === 'boolean') params = { reconnect: params };
    if (!params.reconnect) params.reconnect = false;
    if (!params.openCallback) params.openCallback = false;
    if (!params.id) params.id = false;
    let httpsproxy = process.env.https_proxy || false;
    let socksproxy = process.env.socks_proxy || false;
    let ws = false;

    if (socksproxy !== false) {
      socksproxy = proxyReplacewithIp(socksproxy);
      if (common.options.verbose)
        common.options.log(
          `futuresSubscribeSingle: using socks proxy server: ${socksproxy}`
        );
      let agent = new SocksProxyAgent({
        protocol: parseProxy(socksproxy)[0],
        host: parseProxy(socksproxy)[1],
        port: parseProxy(socksproxy)[2],
      });
      ws = new WebSocket(common.fstreamSingle + endpoint, { agent });
    } else if (httpsproxy !== false) {
      if (common.options.verbose)
        common.options.log(
          `futuresSubscribeSingle: using proxy server: ${agent}`
        );
      let config = url.parse(httpsproxy);
      let agent = new HttpsProxyAgent(config);
      ws = new WebSocket(common.fstreamSingle + endpoint, { agent });
    } else {
      ws = new WebSocket(common.fstreamSingle + endpoint);
    }

    if (common.options.verbose)
      common.options.log('futuresSubscribeSingle: Subscribed to ' + endpoint);
    ws.reconnect = common.options.reconnect;
    ws.endpoint = endpoint;
    ws.isAlive = false;
    ws.on('open', handleFuturesSocketOpen.bind(ws, params.openCallback));
    ws.on('pong', handleFuturesSocketHeartbeat);
    ws.on('error', handleFuturesSocketError);
    ws.on('close', handleFuturesSocketClose.bind(ws, params.reconnect));
    ws.on('message', (data) => {
      try {
        callback(JSON.parse(data));
      } catch (error) {
        common.options.log('Parse error: ' + error.message);
      }
    });
    return ws;
  };

  /**
   * Called when a futures socket is opened, subscriptions are registered for later reference
   * @param {function} openCallback - a callback function
   * @return {undefined}
   */
  const handleFuturesSocketOpen = function (openCallback) {
    this.isAlive = true;
    if (Object.keys(common.futuresSubscriptions).length === 0) {
      common.socketHeartbeatInterval = setInterval(
        futuresSocketHeartbeat,
        30000
      );
    }
    common.futuresSubscriptions[this.endpoint] = this;
    if (typeof openCallback === 'function') openCallback(this.endpoint);
  };

  /**
   * Called when futures websocket is closed, subscriptions are de-registered for later reference
   * @param {boolean} reconnect - true or false to reconnect the socket
   * @param {string} code - code associated with the socket
   * @param {string} reason - string with the response
   * @return {undefined}
   */
  const handleFuturesSocketClose = function (reconnect, code, reason) {
    delete common.futuresSubscriptions[this.endpoint];
    if (
      common.futuresSubscriptions &&
      Object.keys(common.futuresSubscriptions).length === 0
    ) {
      clearInterval(common.socketHeartbeatInterval);
    }
    common.options.log(
      'Futures WebSocket closed: ' +
        this.endpoint +
        (code ? ' (' + code + ')' : '') +
        (reason ? ' ' + reason : '')
    );
    if (common.options.reconnect && this.reconnect && reconnect) {
      if (this.endpoint && parseInt(this.endpoint.length, 10) === 60)
        common.options.log('Futures account data WebSocket reconnecting...');
      else
        common.options.log(
          'Futures WebSocket reconnecting: ' + this.endpoint + '...'
        );
      setTimeout(() => {
        try {
          reconnect();
        } catch (error) {
          common.options.log(
            'Futures WebSocket reconnect error: ' + error.message
          );
        }
      }, 10000);
    }
  };

  /**
   * Called when a futures websocket errors
   * @param {object} error - error object message
   * @return {undefined}
   */
  const handleFuturesSocketError = function (error) {
    common.options.log(
      'Futures WebSocket error: ' +
        this.endpoint +
        (error.code ? ' (' + error.code + ')' : '') +
        (error.message ? ' ' + error.message : '')
    );
  };

  /**
   * Futures heartbeat code with a shared single interval tick
   * @return {undefined}
   */
  const futuresSocketHeartbeat = () => {
    /* Sockets removed from subscriptions during a manual terminate()
         will no longer be at risk of having functions called on them */
    for (let endpointId in common.futuresSubscriptions) {
      const ws = common.futuresSubscriptions[endpointId];
      if (ws.isAlive) {
        ws.isAlive = false;
        if (ws.readyState === WebSocket.OPEN) ws.ping(noop);
      } else if (!common.options.forcedReconnect) {
        if (common.options.verbose)
          common.options.log(
            `Terminating zombie futures WebSocket: ${ws.endpoint}`
          );
        if (ws.readyState === WebSocket.OPEN) ws.terminate();
      }
    }
  };

  /**
   * Called on each futures socket heartbeat
   * @return {undefined}
   */
  const handleFuturesSocketHeartbeat = function () {
    this.isAlive = true;
  };

  /**
   * Used to subscribe to a combined futures websocket endpoint
   * @param {string} streams - streams to connect to
   * @param {function} callback - the function to call when information is received
   * @param {object} params - Optional reconnect {boolean} (whether to reconnect on disconnect), openCallback {function}, id {string}
   * @return {WebSocket} - websocket reference
   */
  const futuresSubscribe = function (streams, callback, params = {}) {
    if (typeof streams === 'string')
      return futuresSubscribeSingle(streams, callback, params);
    if (typeof params === 'boolean') params = { reconnect: params };
    if (!params.reconnect) params.reconnect = false;
    if (!params.openCallback) params.openCallback = false;
    if (!params.id) params.id = false;
    let httpsproxy = process.env.https_proxy || false;
    let socksproxy = process.env.socks_proxy || false;
    const queryParams = streams.join('/');
    let ws = false;
    if (socksproxy !== false) {
      socksproxy = proxyReplacewithIp(socksproxy);
      if (common.options.verbose)
        common.options.log(
          `futuresSubscribe: using socks proxy server ${socksproxy}`
        );
      let agent = new SocksProxyAgent({
        protocol: parseProxy(socksproxy)[0],
        host: parseProxy(socksproxy)[1],
        port: parseProxy(socksproxy)[2],
      });
      ws = new WebSocket(common.fstream + queryParams, { agent });
    } else if (httpsproxy !== false) {
      if (common.options.verbose)
        common.options.log(
          `futuresSubscribe: using proxy server ${httpsproxy}`
        );
      let config = url.parse(httpsproxy);
      let agent = new HttpsProxyAgent(config);
      ws = new WebSocket(common.fstream + queryParams, { agent });
    } else {
      ws = new WebSocket(common.fstream + queryParams);
    }

    ws.reconnect = common.options.reconnect;
    ws.endpoint = stringHash(queryParams);
    ws.isAlive = false;
    if (common.options.verbose) {
      common.options.log(
        `futuresSubscribe: Subscribed to [${ws.endpoint}] ${queryParams}`
      );
    }
    ws.on('open', handleFuturesSocketOpen.bind(ws, params.openCallback));
    ws.on('pong', handleFuturesSocketHeartbeat);
    ws.on('error', handleFuturesSocketError);
    ws.on('close', handleFuturesSocketClose.bind(ws, params.reconnect));
    ws.on('message', (data) => {
      try {
        callback(JSON.parse(data).data);
      } catch (error) {
        common.options.log(`futuresSubscribe: Parse error: ${error.message}`);
      }
    });
    return ws;
  };

  /**
   * Used to terminate a futures websocket
   * @param {string} endpoint - endpoint identifier associated with the web socket
   * @param {boolean} reconnect - auto reconnect after termination
   * @return {undefined}
   */
  const futuresTerminate = function (endpoint, reconnect = false) {
    let ws = common.futuresSubscriptions[endpoint];
    if (!ws) return;
    ws.removeAllListeners('message');
    ws.reconnect = reconnect;
    ws.terminate();
  };

  /**
   * Combines all futures OHLC data with the latest update
   * @param {string} symbol - the symbol
   * @param {"1m"|"3m"|"5m"|"15m"|"30m"|"1h"|"2h"|"4h"|"6h"|"8h"|"12h"|"1d"|"3d"|"1w"|"1M"} interval - the callback function
   * @return {array} - interval data for given symbol
   */
  const futuresKlineConcat = (symbol, interval) => {
    let last_updated,
      output = common.futuresTicks[symbol][interval];
    const realTime = common.futuresRealtime[symbol][interval];
    const { time } = realTime;

    if (typeof time === 'undefined') return output;

    if (common.options.arrayBased) {
      last_updated = output[output.length - 1];
      if (time === last_updated[0]) {
        const { open, high, low, close, volume, closeTime } = realTime;
        output[time] = [
          time,
          parseFloat(open),
          parseFloat(high),
          parseFloat(low),
          parseFloat(close),
          parseFloat(volume),
          closeTime,
          0, // isFinal
        ];

        last_updated[7] = 0;
      }
    } else {
      last_updated = Object.keys(common.futuresTicks[symbol][interval]).pop();
      if (time >= last_updated) {
        output[time] = realTime;
        output[last_updated].isFinal = true;
        output[time].isFinal = false;
      }
    }

    return output;
  };

  const getFuturesKlineSnapshot = async (symbol, interval, callback, limit) => {
    common.options.log('getFuturesKlineSnapshot');
    common.futuresMeta[symbol][interval].timestamp = 0;
    let data = await promiseRequest(
      common,
      'v1/klines',
      { symbol, interval, limit },
      { base: common.fapi }
    );
    common.futuresTicks[symbol][interval].length = 0;
    futuresKlineData(symbol, interval, data);
    //common.options.log('/futures klines at ' + common.futuresMeta[symbol][interval].timestamp);
    if (typeof common.futuresKlineQueue[symbol][interval] !== 'undefined') {
      const len = common.futuresKlineQueue[symbol][interval].length;
      for (let i = 0; i < len; i++) {
        const kline = common.futuresKlineQueue[symbol][interval][i];
        futuresKlineHandler(
          symbol,
          kline,
          common.futuresMeta[symbol][interval].timestamp
        );
      }
      delete common.futuresKlineQueue[symbol][interval];
    }
    if (callback)
      callback(symbol, interval, common.futuresTicks[symbol][interval]);
    // callback(symbol, interval, futuresKlineConcat(symbol, interval));
  };

  let getSymbolKlineSnapshot = (symbol, interval, callback, limit) => {
    common.options.log('getSpotKlineSnapshot');
    common.info[symbol][interval].timestamp = 0;
    publicRequest(
      common,
      common.base + 'v3/klines',
      { symbol, interval, limit },
      function (error, data) {
        common.ohlc[symbol][interval].length = 0;
        klineData(symbol, interval, data);
        //common.options.log('/klines at ' + common.info[symbol][interval].timestamp);
        if (typeof common.klineQueue[symbol][interval] !== 'undefined') {
          const len = common.klineQueue[symbol][interval].length;
          for (let i = 0; i < len; i++) {
            const kline = common.klineQueue[symbol][interval][i];
            klineHandler(
              symbol,
              kline,
              common.info[symbol][interval].timestamp
            );
          }
          delete common.klineQueue[symbol][interval];
        }
        if (callback) callback(symbol, interval, common.ohlc[symbol][interval]);
      }
    );
  };

  /**
   * Used for websocket futures @kline
   * @param {string} symbol - the symbol
   * @param {object} kline - object with kline info
   * @param {string} firstTime - time filter
   * @return {undefined}
   */
  const futuresKlineHandler = (symbol, kline, firstTime = 0) => {
    // eslint-disable-next-line no-unused-vars
    let { e: eventType, E: eventTime, k: ticks } = kline;
    // eslint-disable-next-line no-unused-vars
    const { arrayBased } = common.options;

    let {
      o: open,
      h: high,
      l: low,
      c: close,
      v: volume,
      i: interval,
      x: isFinal,
      q: quoteVolume,
      V: takerBuyBaseVolume,
      Q: takerBuyQuoteVolume,
      n: trades,
      t: time,
      T: closeTime,
    } = ticks;
    const myTicks = common.futuresTicks[symbol][interval];
    const lastTime = common.futuresMeta[symbol][interval].timestamp;
    const myLastTick =
      myTicks && (arrayBased ? myTicks[myTicks.length - 1] : myTicks[lastTime]);

    if (time <= firstTime) return;
    if (lastTime > time) return;

    common.futuresRealtime[symbol][interval] = {
      time,
      closeTime,
      open,
      high,
      low,
      close,
      volume,
      quoteVolume,
      takerBuyBaseVolume,
      takerBuyQuoteVolume,
      trades,
      isFinal,
    };

    if (arrayBased) {
      const newTick = [
        time,
        parseFloat(open),
        parseFloat(high),
        parseFloat(low),
        parseFloat(close),
        parseFloat(volume),
        closeTime,
        isFinal ? 1 : 0,
      ];
      if (lastTime === time) {
        myTicks[myTicks.length - 1] = newTick;
      } else {
        myTicks.shift();
        myTicks.push(newTick);
        if (!myLastTick[7]) return true;
      }
    } else {
      myTicks[time] = {
        time,
        closeTime,
        open,
        high,
        low,
        close,
        volume,
        quoteVolume,
        takerBuyBaseVolume,
        takerBuyQuoteVolume,
        trades,
        isFinal,
      };
      if (time > lastTime) {
        const first_updated = Object.keys(myTicks).shift();
        if (first_updated) delete myTicks[first_updated];
        if (!myLastTick.isFinal) return true;
      }
    }

    if (time - lastTime > times[interval].ms) return true;
    // needed snapshot again
    else common.futuresMeta[symbol][interval].timestamp = time;
  };

  /**
   * Converts the futures ticker stream data into a friendly object
   * @param {object} data - user data callback data type
   * @return {object} - user friendly data type
   */
  const fTickerConvertData = (data) => {
    let friendlyData = (data) => {
      let {
        e: eventType,
        E: eventTime,
        s: symbol,
        p: priceChange,
        P: percentChange,
        w: averagePrice,
        c: close,
        Q: closeQty,
        o: open,
        h: high,
        l: low,
        v: volume,
        q: quoteVolume,
        O: openTime,
        C: closeTime,
        F: firstTradeId,
        L: lastTradeId,
        n: numTrades,
      } = data;
      return {
        eventType,
        eventTime,
        symbol,
        priceChange,
        percentChange,
        averagePrice,
        close,
        closeQty,
        open,
        high,
        low,
        volume,
        quoteVolume,
        openTime,
        closeTime,
        firstTradeId,
        lastTradeId,
        numTrades,
      };
    };
    if (Array.isArray(data)) {
      const result = [];
      for (let obj of data) {
        result.push(friendlyData(obj));
      }
      return result;
    }
    return friendlyData(data);
  };

  /**
   * Converts the futures miniTicker stream data into a friendly object
   * @param {object} data - user data callback data type
   * @return {object} - user friendly data type
   */
  const fMiniTickerConvertData = (data) => {
    let friendlyData = (data) => {
      let {
        e: eventType,
        E: eventTime,
        s: symbol,
        c: close,
        o: open,
        h: high,
        l: low,
        v: volume,
        q: quoteVolume,
      } = data;
      return {
        eventType,
        eventTime,
        symbol,
        close,
        open,
        high,
        low,
        volume,
        quoteVolume,
      };
    };
    if (Array.isArray(data)) {
      const result = [];
      for (let obj of data) {
        result.push(friendlyData(obj));
      }
      return result;
    }
    return friendlyData(data);
  };

  /**
   * Converts the futures bookTicker stream data into a friendly object
   * @param {object} data - user data callback data type
   * @return {object} - user friendly data type
   */
  const fBookTickerConvertData = (data) => {
    let {
      u: updateId,
      s: symbol,
      b: bestBid,
      B: bestBidQty,
      a: bestAsk,
      A: bestAskQty,
    } = data;
    return {
      updateId,
      symbol,
      bestBid,
      bestBidQty,
      bestAsk,
      bestAskQty,
    };
  };

  /**
   * Converts the futures markPrice stream data into a friendly object
   * @param {object} data - user data callback data type
   * @return {object} - user friendly data type
   */
  const fMarkPriceConvertData = (data) => {
    let friendlyData = (data) => {
      let {
        e: eventType,
        E: eventTime,
        s: symbol,
        p: markPrice,
        r: fundingRate,
        T: fundingTime,
      } = data;
      return {
        eventType,
        eventTime,
        symbol,
        markPrice,
        fundingRate,
        fundingTime,
      };
    };
    if (Array.isArray(data)) {
      const result = [];
      for (let obj of data) {
        result.push(friendlyData(obj));
      }
      return result;
    }
    return friendlyData(data);
  };

  /**
   * Converts the futures aggTrade stream data into a friendly object
   * @param {object} data - user data callback data type
   * @return {object} - user friendly data type
   */
  const fAggTradeConvertData = (data) => {
    let friendlyData = (data) => {
      let {
        e: eventType,
        E: eventTime,
        s: symbol,
        a: aggTradeId,
        p: price,
        q: amount,
        f: firstTradeId,
        l: lastTradeId,
        T: timestamp,
        m: maker,
      } = data;
      return {
        eventType,
        eventTime,
        symbol,
        aggTradeId,
        price,
        amount,
        total: price * amount,
        firstTradeId,
        lastTradeId,
        timestamp,
        maker,
      };
    };
    if (Array.isArray(data)) {
      const result = [];
      for (let obj of data) {
        result.push(friendlyData(obj));
      }
      return result;
    }
    return friendlyData(data);
  };

  /**
   * Used as part of the user data websockets callback
   * @param {object} data - user data callback data type
   * @return {undefined}
   */
  const userDataHandler = (data) => {
    let type = data.e;
    if (type === 'outboundAccountInfo') {
      common.options.balance_callback(data);
    } else if (type === 'executionReport') {
      if (common.options.execution_callback)
        common.options.execution_callback(data);
    } else if (type === 'listStatus') {
      if (common.options.list_status_callback)
        common.options.list_status_callback(data);
    } else if (type === 'outboundAccountPosition') {
      // TODO: Does this mean something?
    } else {
      common.options.log('Unexpected userData: ' + type);
    }
  };

  /**
   * Used as part of the user data websockets callback
   * @param {object} data - user data callback data type
   * @return {undefined}
   */
  const userMarginDataHandler = (data) => {
    let type = data.e;
    if (type === 'outboundAccountInfo') {
      common.options.margin_balance_callback(data);
    } else if (type === 'executionReport') {
      if (common.options.margin_execution_callback)
        common.options.margin_execution_callback(data);
    } else if (type === 'listStatus') {
      if (common.options.margin_list_status_callback)
        common.options.margin_list_status_callback(data);
    } else if (type === 'outboundAccountPosition') {
      // TODO: Does this mean something?
    } else {
      common.options.log('Unexpected userMarginData: ' + type);
    }
  };

  /**
   * Used by web sockets depth and populates OHLC and info
   * @param {string} symbol - symbol to get candlestick info
   * @param {"1m"|"3m"|"5m"|"15m"|"30m"|"1h"|"2h"|"4h"|"6h"|"8h"|"12h"|"1d"|"3d"|"1w"|"1M"} interval - the callback function, 1m, 3m, 5m ....
   * @param {array} ticks - tick array
   * @return {undefined}
   */
  const klineData = (symbol, interval, ticks) => {
    if (isIterable(ticks)) {
      const len = ticks.length;
      for (let i = 0; i < len; i++) {
        const tick = ticks[i];
        if (common.options.arrayBased) {
          common.ohlc[symbol][interval].push([
            tick[0],
            parseFloat(tick[1]),
            parseFloat(tick[2]),
            parseFloat(tick[3]),
            parseFloat(tick[4]),
            parseFloat(tick[5]),
            tick[6],
            1,
          ]);
        } else {
          // eslint-disable-next-line no-unused-vars
          let [
            time,
            open,
            high,
            low,
            close,
            volume,
            closeTime,
            assetVolume,
            trades,
            buyBaseVolume,
            buyAssetVolume,
            ignored,
          ] = tick;
          common.ohlc[symbol][interval][time] = {
            time,
            closeTime,
            open,
            high,
            low,
            close,
            volume,
            assetVolume,
            buyBaseVolume,
            buyAssetVolume,
            trades,
            isFinal: 1,
          };
        }
      }

      common.info[symbol][interval].timestamp = ticks[len - 1][0];
    }
  };

  /**
   * Combines all OHLC data with latest update
   * @param {string} symbol - the symbol
   * @param {"1m"|"3m"|"5m"|"15m"|"30m"|"1h"|"2h"|"4h"|"6h"|"8h"|"12h"|"1d"|"3d"|"1w"|"1M"} interval - the callback function, 1m, 3m, 5m ....
   * @return {array} - interval data for given symbol
   */
  const klineConcat = (symbol, interval) => {
    let output = common.ohlc[symbol][interval];
    const latest = common.ohlcLatest[symbol][interval];
    const time = common.options.arrayBased ? latest[0] : latest.time;
    if (typeof time === 'undefined') return output;
    const last_updated = Object.keys(common.ohlc[symbol][interval]).pop();
    if (time >= last_updated) {
      output[time] = latest;
      delete output[time].time;
      output[time].isFinal = false;
    }
    return output;
  };

  /**
   * Used for websocket @kline
   * @param {string} symbol - the symbol
   * @param {object} kline - object with kline info
   * @param {string} firstTime - time filter
   * @return {undefined}
   */
  const klineHandler = (symbol, kline, firstTime = 0) => {
    // TODO: add Taker buy base asset volume
    // eslint-disable-next-line no-unused-vars
    let { e: eventType, E: eventTime, k: ticks } = kline;
    // eslint-disable-next-line no-unused-vars
    const { arrayBased } = common.options;

    let {
      o: open,
      h: high,
      l: low,
      c: close,
      v: volume,
      i: interval,
      x: isFinal,
      q: assetVolume,
      V: buyBaseVolume,
      Q: buyAssetVolume,
      n: trades,
      t: time,
      T: closeTime,
    } = ticks; //n:trades, V:buyVolume, Q:quoteBuyVolume
    const myTicks = common.ohlc[symbol][interval];
    const lastTime = common.info[symbol][interval].timestamp;
    const myLastTick =
      myTicks && (arrayBased ? myTicks[myTicks.length - 1] : myTicks[lastTime]);
    if (time <= firstTime) return;
    if (lastTime > time) return;

    common.ohlcLatest[symbol][interval] = {
      time,
      closeTime,
      open,
      high,
      low,
      close,
      volume,
      assetVolume,
      buyBaseVolume,
      buyAssetVolume,
      trades,
      isFinal,
    };

    if (arrayBased) {
      const newTick = [
        time,
        parseFloat(open),
        parseFloat(high),
        parseFloat(low),
        parseFloat(close),
        parseFloat(volume),
        closeTime,
        isFinal ? 1 : 0,
      ];
      if (lastTime === time) {
        myTicks[myTicks.length - 1] = newTick;
      } else {
        myTicks.shift();
        myTicks.push(newTick);
        if (!myLastTick[7]) return true;
      }
    } else {
      myTicks[time] = {
        time,
        closeTime,
        open,
        high,
        low,
        close,
        volume,
        assetVolume,
        buyBaseVolume,
        buyAssetVolume,
        trades,
        isFinal,
      };
      if (time > lastTime) {
        const first_updated = Object.keys(myTicks).shift();
        if (first_updated) delete myTicks[first_updated];
        if (!myLastTick.isFinal) return true;
      }
    }

    if (time - lastTime > times[interval].ms) return true;
    // needed snapshot again
    else common.info[symbol][interval].timestamp = time;
  };

  /**
   * Used by futures websockets chart cache
   * @param {string} symbol - symbol to get candlestick info
   * @param {"1m"|"3m"|"5m"|"15m"|"30m"|"1h"|"2h"|"4h"|"6h"|"8h"|"12h"|"1d"|"3d"|"1w"|"1M"} interval - the callback function, 1m, 3m, 5m ....
   * @param {array} ticks - tick array
   * @return {undefined}
   */
  const futuresKlineData = (symbol, interval, ticks) => {
    if (isIterable(ticks)) {
      const len = ticks.length;
      for (let i = 0; i < len; i++) {
        const tick = ticks[i];

        if (common.options.arrayBased) {
          // common.futuresTicks[symbol][interval][tick[0]] = [
          common.futuresTicks[symbol][interval].push([
            tick[0],
            parseFloat(tick[1]),
            parseFloat(tick[2]),
            parseFloat(tick[3]),
            parseFloat(tick[4]),
            parseFloat(tick[5]),
            tick[6],
            1,
          ]);
        } else {
          let [
            time,
            open,
            high,
            low,
            close,
            volume,
            closeTime,
            quoteVolume,
            trades,
            takerBuyBaseVolume,
            takerBuyQuoteVolume,
            ignored,
          ] = tick;
          common.futuresTicks[symbol][interval][time] = {
            time,
            closeTime,
            open,
            high,
            low,
            close,
            volume,
            quoteVolume,
            takerBuyBaseVolume,
            takerBuyQuoteVolume,
            trades,
            isFinal: 1,
          };
        }
      }
      common.futuresMeta[symbol][interval].timestamp = ticks[len - 1][0];
    }
  };

  /**
   * Used for /depth endpoint
   * @param {object} depth - information
   * @return {undefined}
   */
  const depthHandler = (depth) => {
    let symbol = depth.s,
      obj;
    let context = common.depthCacheContext[symbol];
    let updateDepthCache = () => {
      common.depthCache[symbol].eventTime = depth.E;
      for (obj of depth.b) {
        //bids
        if (obj[1] === '0.00000000') {
          delete common.depthCache[symbol].bids[obj[0]];
        } else {
          common.depthCache[symbol].bids[obj[0]] = parseFloat(obj[1]);
        }
      }
      for (obj of depth.a) {
        //asks
        if (obj[1] === '0.00000000') {
          delete common.depthCache[symbol].asks[obj[0]];
        } else {
          common.depthCache[symbol].asks[obj[0]] = parseFloat(obj[1]);
        }
      }
      context.skipCount = 0;
      context.lastEventUpdateId = depth.u;
      context.lastEventUpdateTime = depth.E;
    };

    // This now conforms 100% to the Binance docs constraints on managing a local order book
    if (context.lastEventUpdateId) {
      const expectedUpdateId = context.lastEventUpdateId + 1;
      if (depth.U <= expectedUpdateId) {
        updateDepthCache();
      } else {
        let msg =
          'depthHandler: [' + symbol + '] The depth cache is out of sync.';
        msg +=
          ' Symptom: Unexpected Update ID. Expected "' +
          expectedUpdateId +
          '", got "' +
          depth.U +
          '"';
        if (common.options.verbose) common.options.log(msg);
        throw new Error(msg);
      }
    } else if (depth.U > context.snapshotUpdateId + 1) {
      /* In this case we have a gap between the data of the stream and the snapshot.
             This is an out of sync error, and the connection must be torn down and reconnected. */
      let msg =
        'depthHandler: [' + symbol + '] The depth cache is out of sync.';
      msg += ' Symptom: Gap between snapshot and first stream data.';
      if (common.options.verbose) common.options.log(msg);
      throw new Error(msg);
    } else if (depth.u < context.snapshotUpdateId + 1) {
      /* In this case we've received data that we've already had since the snapshot.
             This isn't really an issue, and we can just update the cache again, or ignore it entirely. */
      // do nothing
    } else {
      // This is our first legal update from the stream data
      updateDepthCache();
    }
  };

  /**
   * Userdata websockets function
   * @param {function} callback - the callback function
   * @param {function} execution_callback - optional execution callback
   * @param {function} subscribed_callback - subscription callback
   * @param {function} list_status_callback - status callback
   * @return {undefined}
   */
  this.userData = function userData(
    callback,
    execution_callback = false,
    subscribed_callback = false,
    list_status_callback = false
  ) {
    let reconnect = () => {
      if (common.options.reconnect)
        userData(callback, execution_callback, subscribed_callback);
    };
    apiRequest(
      common,
      common.base + 'v3/userDataStream',
      {},
      function (error, response) {
        common.options.listenKey = response.listenKey;
        setTimeout(function userDataKeepAlive() {
          // keepalive
          try {
            apiRequest(
              common,
              common.base +
                'v3/userDataStream?listenKey=' +
                common.options.listenKey,
              {},
              function (err) {
                if (err) setTimeout(userDataKeepAlive, 60000);
                // retry in 1 minute
                else setTimeout(userDataKeepAlive, 60 * 30 * 1000); // 30 minute keepalive
              },
              'PUT'
            );
          } catch (error) {
            setTimeout(userDataKeepAlive, 60000); // retry in 1 minute
          }
        }, 60 * 30 * 1000); // 30 minute keepalive
        common.options.balance_callback = callback;
        common.options.execution_callback = execution_callback;
        common.options.list_status_callback = list_status_callback;
        const subscription = subscribe(
          common.options.listenKey,
          userDataHandler,
          reconnect
        );
        if (subscribed_callback) subscribed_callback(subscription.endpoint);
      },
      'POST'
    );
  };

  /**
   * Margin Userdata websockets function
   * @param {function} callback - the callback function
   * @param {function} execution_callback - optional execution callback
   * @param {function} subscribed_callback - subscription callback
   * @param {function} list_status_callback - status callback
   * @return {undefined}
   */
  this.userMarginData = function userMarginData(
    callback,
    execution_callback = false,
    subscribed_callback = false,
    list_status_callback = false
  ) {
    let reconnect = () => {
      if (common.options.reconnect)
        userMarginData(callback, execution_callback, subscribed_callback);
    };
    apiRequest(
      common,
      common.sapi + 'v1/userDataStream',
      {},
      function (error, response) {
        common.options.listenMarginKey = response.listenKey;
        setTimeout(function userDataKeepAlive() {
          // keepalive
          try {
            apiRequest(
              common,
              common.sapi +
                'v1/userDataStream?listenKey=' +
                common.options.listenMarginKey,
              {},
              function (err) {
                if (err) setTimeout(userDataKeepAlive, 60000);
                // retry in 1 minute
                else setTimeout(userDataKeepAlive, 60 * 30 * 1000); // 30 minute keepalive
              },
              'PUT'
            );
          } catch (error) {
            setTimeout(userDataKeepAlive, 60000); // retry in 1 minute
          }
        }, 60 * 30 * 1000); // 30 minute keepalive
        common.options.margin_balance_callback = callback;
        common.options.margin_execution_callback = execution_callback;
        common.options.margin_list_status_callback = list_status_callback;
        const subscription = subscribe(
          common.options.listenMarginKey,
          userMarginDataHandler,
          reconnect
        );
        if (subscribed_callback) subscribed_callback(subscription.endpoint);
      },
      'POST'
    );
  };

  /**
   * Subscribe to a generic websocket
   * @param {string} url - the websocket endpoint
   * @param {function} callback - optional execution callback
   * @param {boolean} reconnect - subscription callback
   * @return {WebSocket} the websocket reference
   */
  this.subscribe = function (url, callback, reconnect = false) {
    return subscribe(url, callback, reconnect);
  };

  /**
   * Subscribe to a generic combined websocket
   * @param {string} url - the websocket endpoint
   * @param {function} callback - optional execution callback
   * @param {boolean} reconnect - subscription callback
   * @return {WebSocket} the websocket reference
   */
  this.subscribeCombined = function (url, callback, reconnect = false) {
    return subscribeCombined(url, callback, reconnect);
  };

  /**
   * Returns the known websockets subscriptions
   * @return {array} array of web socket subscriptions
   */
  this.subscriptions = function () {
    return common.subscriptions;
  };

  /**
   * Terminates a web socket
   * @param {string} endpoint - the string associated with the endpoint
   * @return {undefined}
   */
  this.terminate = function (endpoint) {
    if (common.options.verbose)
      common.options.log('WebSocket terminating:', endpoint);
    return terminate(endpoint);
  };

  /**
   * Websocket depth chart
   * @param {array/string} symbols - an array or string of symbols to query
   * @param {function} callback - callback function
   * @return {string} the websocket
   */
  this.depth = function depth(symbols, callback) {
    let reconnect = () => {
      if (common.options.reconnect) depth(symbols, callback);
    };
    let subscription;
    if (Array.isArray(symbols)) {
      if (!isArrayUnique(symbols))
        throw Error('depth: "symbols" cannot contain duplicate elements.');
      let streams = symbols.map(function (symbol) {
        return symbol.toLowerCase() + '@depth@100ms';
      });
      subscription = subscribeCombined(streams, callback, reconnect);
    } else {
      let symbol = symbols;
      subscription = subscribe(
        symbol.toLowerCase() + '@depth@100ms',
        callback,
        reconnect
      );
    }
    return subscription;
  };

  /**
   * Websocket depth cache
   * @param {array/string} symbols - an array or string of symbols to query
   * @param {function} callback - callback function
   * @param {int} limit - the number of entries
   * @return {string} the websocket
   */
  this.depthCache = function depthCacheFunction(
    symbols,
    callback,
    limit = 500
  ) {
    let reconnect = () => {
      if (common.options.reconnect)
        depthCacheFunction(symbols, callback, limit);
    };

    let symbolDepthInit = (symbol) => {
      if (typeof common.depthCacheContext[symbol] === 'undefined')
        common.depthCacheContext[symbol] = {};
      let context = common.depthCacheContext[symbol];
      context.snapshotUpdateId = null;
      context.lastEventUpdateId = null;
      context.messageQueue = [];
      common.depthCache[symbol] = { bids: {}, asks: {} };
    };

    let assignEndpointIdToContext = (symbol, endpointId) => {
      if (common.depthCacheContext[symbol]) {
        let context = common.depthCacheContext[symbol];
        context.endpointId = endpointId;
      }
    };

    let handleDepthStreamData = (depth) => {
      let symbol = depth.s;
      let context = common.depthCacheContext[symbol];
      if (context.messageQueue && !context.snapshotUpdateId) {
        context.messageQueue.push(depth);
      } else {
        try {
          depthHandler(depth);
        } catch (err) {
          return terminate(context.endpointId, true);
        }
        if (callback) callback(symbol, common.depthCache[symbol], context);
      }
    };

    let getSymbolDepthSnapshot = (symbol, cb) => {
      publicRequest(
        common,
        common.base + 'v3/depth',
        { symbol: symbol, limit: limit },
        function (error, json) {
          if (error) {
            return cb(error, null);
          }
          // Store symbol next use
          json.symb = symbol;
          cb(null, json);
        }
      );
    };

    let updateSymbolDepthCache = (json) => {
      // Get previous store symbol
      let symbol = json.symb;
      // Initialize depth cache from snapshot
      common.depthCache[symbol] = depthData(json);
      // Prepare depth cache context
      let context = common.depthCacheContext[symbol];
      context.snapshotUpdateId = json.lastUpdateId;
      context.messageQueue = context.messageQueue.filter(
        (depth) => depth.u > context.snapshotUpdateId
      );
      // Process any pending depth messages
      for (let depth of context.messageQueue) {
        /* Although sync errors shouldn't ever happen here, we catch and swallow them anyway
                         just in case. The stream handler function above will deal with broken caches. */
        try {
          depthHandler(depth);
        } catch (err) {
          // Do nothing
        }
      }
      delete context.messageQueue;
      if (callback) callback(symbol, common.depthCache[symbol]);
    };

    /* If an array of symbols are sent we use a combined stream connection rather.
                 This is transparent to the developer, and results in a single socket connection.
                 This essentially eliminates "unexpected response" errors when subscribing to a lot of data. */
    let subscription;
    if (Array.isArray(symbols)) {
      if (!isArrayUnique(symbols))
        throw Error('depthCache: "symbols" cannot contain duplicate elements.');
      symbols.forEach(symbolDepthInit);
      let streams = symbols.map(function (symbol) {
        return symbol.toLowerCase() + `@depth@100ms`;
      });
      subscription = subscribeCombined(
        streams,
        handleDepthStreamData,
        reconnect,
        function () {
          async.mapLimit(
            symbols,
            50,
            getSymbolDepthSnapshot,
            (err, results) => {
              if (err) throw err;
              results.forEach(updateSymbolDepthCache);
            }
          );
        }
      );
      symbols.forEach((s) =>
        assignEndpointIdToContext(s, subscription.endpoint)
      );
    } else {
      let symbol = symbols;
      symbolDepthInit(symbol);
      subscription = subscribe(
        symbol.toLowerCase() + `@depth@100ms`,
        handleDepthStreamData,
        reconnect,
        function () {
          async.mapLimit(
            [symbol],
            1,
            getSymbolDepthSnapshot,
            (err, results) => {
              if (err) throw err;
              results.forEach(updateSymbolDepthCache);
            }
          );
        }
      );
      assignEndpointIdToContext(symbol, subscription.endpoint);
    }
    return subscription;
  };

  /**
   * Clear Websocket depth cache
   * @param {String|Array} symbols   - a single symbol, or an array of symbols, to clear the cache of
   * @returns {void}
   */
  this.clearDepthCache = function (symbols) {
    const symbolsArr = Array.isArray(symbols) ? symbols : [symbols];
    symbolsArr.forEach((thisSymbol) => {
      delete common.depthCache[thisSymbol];
    });
  };

  /**
   * Websocket staggered depth cache
   * @param {array/string} symbols - an array of symbols to query
   * @param {function} callback - callback function
   * @param {int} limit - the number of entries
   * @param {int} stagger - ms between each depth cache
   * @return {Promise} the websocket endpoint
   */
  this.depthCacheStaggered = function (
    symbols,
    callback,
    limit = 100,
    stagger = 200
  ) {
    if (!Array.isArray(symbols)) symbols = [symbols];
    let chain = null;

    symbols.forEach((symbol) => {
      let promise = () =>
        new Promise((resolve) => {
          this.depthCache(symbol, callback, limit);
          setTimeout(resolve, stagger);
        });
      chain = chain ? chain.then(promise) : promise();
    });

    return chain;
  };

  /**
   * Websocket aggregated trades
   * @param {array/string} symbols - an array or string of symbols to query
   * @param {function} callback - callback function
   * @return {string} the websocket
   */
  this.aggTrades = function trades(symbols, callback) {
    let reconnect = () => {
      if (common.options.reconnect) trades(symbols, callback);
    };
    let subscription;
    if (Array.isArray(symbols)) {
      if (!isArrayUnique(symbols))
        throw Error('trades: "symbols" cannot contain duplicate elements.');
      let streams = symbols.map(function (symbol) {
        return symbol.toLowerCase() + '@aggTrade';
      });
      subscription = subscribeCombined(streams, callback, reconnect);
    } else {
      let symbol = symbols;
      subscription = subscribe(
        symbol.toLowerCase() + '@aggTrade',
        callback,
        reconnect
      );
    }
    return subscription;
  };

  /**
   * Websocket raw trades
   * @param {array/string} symbols - an array or string of symbols to query
   * @param {function} callback - callback function
   * @return {string} the websocket
   */
  this.trades = function trades(symbols, callback) {
    let reconnect = () => {
      if (common.options.reconnect) trades(symbols, callback);
    };

    let subscription;
    if (Array.isArray(symbols)) {
      if (!isArrayUnique(symbols))
        throw Error('trades: "symbols" cannot contain duplicate elements.');
      let streams = symbols.map(function (symbol) {
        return symbol.toLowerCase() + '@trade';
      });
      subscription = subscribeCombined(streams, callback, reconnect);
    } else {
      let symbol = symbols;
      subscription = subscribe(
        symbol.toLowerCase() + '@trade',
        callback,
        reconnect
      );
    }
    return subscription;
  };

  /**
   * Websocket klines
   * @param {array/string} symbols - an array or string of symbols to query
   * @param {"1m"|"3m"|"5m"|"15m"|"30m"|"1h"|"2h"|"4h"|"6h"|"8h"|"12h"|"1d"|"3d"|"1w"|"1M"} interval - the callback function
   * @param {function} callback - callback function
   * @param {int} limit - maximum results, no more than 1000
   * @return {string} the websocket
   */
  this.chart = function chart(symbols, interval, callback, limit = 500) {
    let reconnect = () => {
      if (common.options.reconnect) chart(symbols, interval, callback, limit);
    };

    let symbolChartInit = (symbol) => {
      if (typeof common.info[symbol] === 'undefined') common.info[symbol] = {};
      if (typeof common.info[symbol][interval] === 'undefined')
        common.info[symbol][interval] = {};
      if (typeof common.ohlc[symbol] === 'undefined') common.ohlc[symbol] = {};
      if (typeof common.ohlc[symbol][interval] === 'undefined') {
        if (common.options.arrayBased) common.ohlc[symbol][interval] = [];
        else common.ohlc[symbol][interval] = {};
      }
      if (typeof common.ohlcLatest[symbol] === 'undefined')
        common.ohlcLatest[symbol] = {};
      if (typeof common.ohlcLatest[symbol][interval] === 'undefined')
        common.ohlcLatest[symbol][interval] = {};
      if (typeof common.klineQueue[symbol] === 'undefined')
        common.klineQueue[symbol] = {};
      if (typeof common.klineQueue[symbol][interval] === 'undefined')
        common.klineQueue[symbol][interval] = [];
      common.info[symbol][interval].timestamp = 0;
    };

    let handleKlineStreamData = (kline) => {
      let symbol = kline.s;
      if (!common.info[symbol][interval].timestamp) {
        if (
          typeof common.klineQueue[symbol][interval] !== 'undefined' &&
          kline !== null
        ) {
          common.klineQueue[symbol][interval].push(kline);
        }
      } else {
        //common.options.log('@klines at ' + kline.k.t);
        if (klineHandler(symbol, kline))
          getSymbolKlineSnapshot(symbol, interval, callback, limit);
        if (callback) callback(symbol, interval, common.ohlc[symbol][interval]);
      }
    };

    let subscription;
    if (Array.isArray(symbols)) {
      if (!isArrayUnique(symbols))
        throw Error('chart: "symbols" cannot contain duplicate elements.');
      symbols.forEach(symbolChartInit);
      let streams = symbols.map(function (symbol) {
        return symbol.toLowerCase() + '@kline_' + interval;
      });
      subscription = subscribeCombined(
        streams,
        handleKlineStreamData,
        reconnect
      );
      symbols.forEach((element) =>
        getSymbolKlineSnapshot(element, interval, callback, limit)
      );
    } else {
      let symbol = symbols;
      symbolChartInit(symbol);
      subscription = subscribe(
        symbol.toLowerCase() + '@kline_' + interval,
        handleKlineStreamData,
        reconnect
      );
      getSymbolKlineSnapshot(symbol, interval, callback, limit);
    }
    return subscription;
  };

  /**
   * Websocket candle sticks
   * @param {array/string} symbols - an array or string of symbols to query
   * @param {"1m"|"3m"|"5m"|"15m"|"30m"|"1h"|"2h"|"4h"|"6h"|"8h"|"12h"|"1d"|"3d"|"1w"|"1M"} interval - the callback function
   * @param {function} callback - callback function
   * @return {string} the websocket
   */
  this.candlesticks = function candlesticks(symbols, interval, callback) {
    let reconnect = () => {
      if (common.options.reconnect) candlesticks(symbols, interval, callback);
    };

    /* If an array of symbols are sent we use a combined stream connection rather.
                 This is transparent to the developer, and results in a single socket connection.
                 This essentially eliminates "unexpected response" errors when subscribing to a lot of data. */
    let subscription;
    if (Array.isArray(symbols)) {
      if (!isArrayUnique(symbols))
        throw Error(
          'candlesticks: "symbols" cannot contain duplicate elements.'
        );
      let streams = symbols.map(function (symbol) {
        return symbol.toLowerCase() + '@kline_' + interval;
      });
      subscription = subscribeCombined(streams, callback, reconnect);
    } else {
      let symbol = symbols.toLowerCase();
      subscription = subscribe(
        symbol + '@kline_' + interval,
        callback,
        reconnect
      );
    }
    return subscription;
  };

  /**
   * Websocket mini ticker
   * @param {function} callback - callback function
   * @return {string} the websocket
   */
  this.miniTicker = function miniTicker(callback) {
    let reconnect = () => {
      if (common.options.reconnect) miniTicker(callback);
    };
    let subscription = subscribe(
      '!miniTicker@arr',
      function (data) {
        let markets = {};
        for (let obj of data) {
          markets[obj.s] = {
            close: obj.c,
            open: obj.o,
            high: obj.h,
            low: obj.l,
            volume: obj.v,
            quoteVolume: obj.q,
            eventTime: obj.E,
          };
        }
        callback(markets);
      },
      reconnect
    );
    return subscription;
  };

  /**
   * Spot WebSocket bookTicker (bid/ask quotes including price & amount)
   * @param {symbol} symbol name or false. can also be a callback
   * @param {function} callback - callback function
   * @return {string} the websocket
   */
  this.bookTickers = function bookTickerStream(
    symbol = false,
    callback = console.log
  ) {
    if (typeof symbol == 'function') {
      callback = symbol;
      symbol = false;
    }
    let reconnect = () => {
      if (common.options.reconnect) bookTickerStream(symbol, callback);
    };
    const endpoint = symbol
      ? `${symbol.toLowerCase()}@bookTicker`
      : '!bookTicker';
    let subscription = subscribe(
      endpoint,
      (data) => callback(fBookTickerConvertData(data)),
      reconnect
    );
    return subscription;
  };

  /**
   * Websocket prevday percentage
   * @param {array/string} symbols - an array or string of symbols to query
   * @param {function} callback - callback function
   * @param {boolean} singleCallback - avoid call one callback for each symbol in data array
   * @return {string} the websocket
   */
  this.daily = function daily(symbols, callback, singleCallback) {
    let reconnect = () => {
      if (common.options.reconnect) daily(symbols, callback);
    };

    let subscription;
    // Combine stream for array of symbols
    if (Array.isArray(symbols)) {
      if (!isArrayUnique(symbols))
        throw Error('daily: "symbols" cannot contain duplicate elements.');
      let streams = symbols.map(function (symbol) {
        return symbol.toLowerCase() + '@ticker';
      });
      subscription = subscribeCombined(
        streams,
        function (data) {
          prevDayStreamHandler(data, callback);
        },
        reconnect
      );
      // Raw stream for  a single symbol
    } else if (symbols) {
      let symbol = symbols;
      subscription = subscribe(
        symbol.toLowerCase() + '@ticker',
        function (data) {
          prevDayStreamHandler(data, callback);
        },
        reconnect
      );
      // Raw stream of all listed symbols
    } else {
      subscription = subscribe(
        '!ticker@arr',
        function (data) {
          if (singleCallback) {
            prevDayStreamHandler(data, callback);
          } else {
            for (let line of data) {
              prevDayStreamHandler(line, callback);
            }
          }
        },
        reconnect
      );
    }
    return subscription;
  };

  /**
   * Subscribe to a combined futures websocket
   * @param {string} streams - the list of websocket endpoints to connect to
   * @param {function} callback - optional execution callback
   * @param {object} params - Optional reconnect {boolean} (whether to reconnect on disconnect), openCallback {function}, id {string}
   * @return {WebSocket} the websocket reference
   */
  this.futuresSubscribe = function (streams, callback, params = {}) {
    return futuresSubscribe(streams, callback, params);
  };

  /**
   * Returns the known futures websockets subscriptions
   * @return {array} array of futures websocket subscriptions
   */
  this.futuresSubscriptions = function () {
    return common.futuresSubscriptions;
  };

  // Futures WebSocket Functions:
  /**
   * Subscribe to a single futures websocket
   * @param {string} url - the futures websocket endpoint
   * @param {function} callback - optional execution callback
   * @param {object} params - Optional reconnect {boolean} (whether to reconnect on disconnect), openCallback {function}, id {string}
   * @return {WebSocket} the websocket reference
   */
  this.futuresSubscribeSingle = function (url, callback, params = {}) {
    return futuresSubscribeSingle(url, callback, params);
  };

  /**
   * Terminates a futures websocket
   * @param {string} endpoint - the string associated with the endpoint
   * @return {undefined}
   */
  this.futuresTerminate = function (endpoint) {
    if (common.options.verbose)
      common.options.log('Futures WebSocket terminating:', endpoint);
    return futuresTerminate(endpoint);
  };

  /**
   * Futures WebSocket aggregated trades
   * @param {array/string} symbols - an array or string of symbols to query
   * @param {function} callback - callback function
   * @return {string} the websocket
   */
  this.futuresAggTradeStream = function futuresAggTradeStream(
    symbols,
    callback
  ) {
    let reconnect = () => {
      if (common.options.reconnect) futuresAggTradeStream(symbols, callback);
    };
    let subscription,
      cleanCallback = (data) => callback(fAggTradeConvertData(data));
    if (Array.isArray(symbols)) {
      if (!isArrayUnique(symbols))
        throw Error(
          'futuresAggTradeStream: "symbols" cannot contain duplicate elements.'
        );
      let streams = symbols.map((symbol) => symbol.toLowerCase() + '@aggTrade');
      subscription = futuresSubscribe(streams, cleanCallback, { reconnect });
    } else {
      let symbol = symbols;
      subscription = futuresSubscribeSingle(
        symbol.toLowerCase() + '@aggTrade',
        cleanCallback,
        { reconnect }
      );
    }
    return subscription;
  };

  /**
   * Futures WebSocket mark price
   * @param {symbol} symbol name or false. can also be a callback
   * @param {function} callback - callback function
   * @param {string} speed - 1 second updates. leave blank for default 3 seconds
   * @return {string} the websocket
   */
  this.futuresMarkPriceStream = function fMarkPriceStream(
    symbol = false,
    callback = console.log,
    speed = '@1s'
  ) {
    if (typeof symbol == 'function') {
      callback = symbol;
      symbol = false;
    }
    let reconnect = () => {
      if (common.options.reconnect) fMarkPriceStream(symbol, callback);
    };
    const endpoint = symbol
      ? `${symbol.toLowerCase()}@markPrice`
      : '!markPrice@arr';
    let subscription = futuresSubscribeSingle(
      endpoint + speed,
      (data) => callback(fMarkPriceConvertData(data)),
      { reconnect }
    );
    return subscription;
  };

  /**
   * Futures WebSocket daily ticker
   * @param {symbol} symbol name or false. can also be a callback
   * @param {function} callback - callback function
   * @return {string} the websocket
   */
  this.futuresTickerStream = function fTickerStream(
    symbol = false,
    callback = console.log
  ) {
    if (typeof symbol == 'function') {
      callback = symbol;
      symbol = false;
    }
    let reconnect = () => {
      if (common.options.reconnect) fTickerStream(symbol, callback);
    };
    const endpoint = symbol ? `${symbol.toLowerCase()}@ticker` : '!ticker@arr';
    let subscription = futuresSubscribeSingle(
      endpoint,
      (data) => callback(fTickerConvertData(data)),
      { reconnect }
    );
    return subscription;
  };

  /**
   * Futures WebSocket miniTicker
   * @param {symbol} symbol name or false. can also be a callback
   * @param {function} callback - callback function
   * @return {string} the websocket
   */
  this.futuresMiniTickerStream = function fMiniTickerStream(
    symbol = false,
    callback = console.log
  ) {
    if (typeof symbol == 'function') {
      callback = symbol;
      symbol = false;
    }
    let reconnect = () => {
      if (common.options.reconnect) fMiniTickerStream(symbol, callback);
    };
    const endpoint = symbol
      ? `${symbol.toLowerCase()}@miniTicker`
      : '!miniTicker@arr';
    let subscription = futuresSubscribeSingle(
      endpoint,
      (data) => callback(fMiniTickerConvertData(data)),
      { reconnect }
    );
    return subscription;
  };

  /**
   * Futures WebSocket bookTicker
   * @param {symbol} symbol name or false. can also be a callback
   * @param {function} callback - callback function
   * @return {string} the websocket
   */
  this.futuresBookTickerStream = function fBookTickerStream(
    symbol = false,
    callback = console.log
  ) {
    if (typeof symbol == 'function') {
      callback = symbol;
      symbol = false;
    }
    let reconnect = () => {
      if (common.options.reconnect) fBookTickerStream(symbol, callback);
    };
    const endpoint = symbol
      ? `${symbol.toLowerCase()}@bookTicker`
      : '!bookTicker';
    let subscription = futuresSubscribeSingle(
      endpoint,
      (data) => callback(fBookTickerConvertData(data)),
      { reconnect }
    );
    return subscription;
  };

  /**
   * Websocket futures klines
   * @param {array/string} symbols - an array or string of symbols to query
   * @param {"1m"|"3m"|"5m"|"15m"|"30m"|"1h"|"2h"|"4h"|"6h"|"8h"|"12h"|"1d"|"3d"|"1w"|"1M"} interval - the callback function
   * @param {function} callback - callback function
   * @param {int} limit - maximum results, no more than 1000
   * @return {string} the websocket
   */
  this.futuresChart = async function futuresChart(
    symbols,
    interval,
    callback,
    limit = 500
  ) {
    const reconnect = () => {
      if (common.options.reconnect)
        futuresChart(symbols, interval, callback, limit);
    };

    let futuresChartInit = (symbol) => {
      if (typeof common.futuresMeta[symbol] === 'undefined')
        common.futuresMeta[symbol] = {};
      if (typeof common.futuresMeta[symbol][interval] === 'undefined')
        common.futuresMeta[symbol][interval] = {};
      if (typeof common.futuresTicks[symbol] === 'undefined')
        common.futuresTicks[symbol] = {};
      if (typeof common.futuresTicks[symbol][interval] === 'undefined') {
        if (common.options.arrayBased)
          common.futuresTicks[symbol][interval] = [];
        else common.futuresTicks[symbol][interval] = {};
      }
      if (typeof common.futuresRealtime[symbol] === 'undefined')
        common.futuresRealtime[symbol] = {};
      if (typeof common.futuresRealtime[symbol][interval] === 'undefined')
        common.futuresRealtime[symbol][interval] = {};
      if (typeof common.futuresKlineQueue[symbol] === 'undefined')
        common.futuresKlineQueue[symbol] = {};
      if (typeof common.futuresKlineQueue[symbol][interval] === 'undefined')
        common.futuresKlineQueue[symbol][interval] = [];
      common.futuresMeta[symbol][interval].timestamp = 0;
    };

    let handleFuturesKlineStream = (kline) => {
      let symbol = kline.s;
      if (!common.futuresMeta[symbol][interval].timestamp) {
        if (
          typeof common.futuresKlineQueue[symbol][interval] !== 'undefined' &&
          kline !== null
        ) {
          common.futuresKlineQueue[symbol][interval].push(kline);
        }
      } else {
        //common.options.log('futures klines at ' + kline.k.t);
        if (futuresKlineHandler(symbol, kline))
          getFuturesKlineSnapshot(symbol, interval, callback, limit);
        if (callback)
          callback(symbol, interval, common.futuresTicks[symbol][interval]);
        // callback(symbol, interval, futuresKlineConcat(symbol, interval));
      }
    };

    let subscription;
    if (Array.isArray(symbols)) {
      if (!isArrayUnique(symbols))
        throw Error(
          'futuresChart: "symbols" array cannot contain duplicate elements.'
        );
      symbols.forEach(futuresChartInit);
      let streams = symbols.map(
        (symbol) => `${symbol.toLowerCase()}@kline_${interval}`
      );
      subscription = futuresSubscribe(
        streams,
        handleFuturesKlineStream,
        reconnect
      );
      symbols.forEach((element) =>
        getFuturesKlineSnapshot(element, interval, callback, limit)
      );
    } else {
      let symbol = symbols;
      futuresChartInit(symbol);
      subscription = futuresSubscribeSingle(
        symbol.toLowerCase() + '@kline_' + interval,
        handleFuturesKlineStream,
        { reconnect }
      );
      getFuturesKlineSnapshot(symbol, interval, callback, limit);
    }
    return subscription;
  };

  /**
   * Websocket futures candlesticks
   * @param {array/string} symbols - an array or string of symbols to query
   * @param {"1m"|"3m"|"5m"|"15m"|"30m"|"1h"|"2h"|"4h"|"6h"|"8h"|"12h"|"1d"|"3d"|"1w"|"1M"} interval - the callback function
   * @param {function} callback - callback function
   * @return {string} the websocket
   */
  this.futuresCandlesticks = function futuresCandlesticks(
    symbols,
    interval,
    callback
  ) {
    let reconnect = () => {
      if (common.options.reconnect)
        futuresCandlesticks(symbols, interval, callback);
    };
    let subscription;
    if (Array.isArray(symbols)) {
      if (!isArrayUnique(symbols))
        throw Error(
          'futuresCandlesticks: "symbols" array cannot contain duplicate elements.'
        );
      let streams = symbols.map(
        (symbol) => symbol.toLowerCase() + '@kline_' + interval
      );
      subscription = futuresSubscribe(streams, callback, {
        reconnect,
      });
    } else {
      let symbol = symbols.toLowerCase();
      subscription = futuresSubscribeSingle(
        symbol + '@kline_' + interval,
        callback,
        {
          reconnect,
        }
      );
    }
    return subscription;
  };

  /**
   * Futures WebSocket liquidations stream
   * @param {symbol} symbol name or false. can also be a callback
   * @param {function} callback - callback function
   * @return {string} the websocket
   */
  this.futuresLiquidationStream = function fLiquidationStream(
    symbol = false,
    callback = console.log
  ) {
    if (typeof symbol == 'function') {
      callback = symbol;
      symbol = false;
    }
    let reconnect = () => {
      if (common.options.reconnect) fLiquidationStream(symbol, callback);
    };
    const endpoint = symbol
      ? `${symbol.toLowerCase()}@forceOrder`
      : '!forceOrder@arr';
    let subscription = futuresSubscribeSingle(
      endpoint,
      (data) => callback(fLiquidationConvertData(data)),
      { reconnect }
    );
    return subscription;
  };
};
