/* eslint-disable space-in-parens */
const { signedRequest, publicRequest } = require('../common');

module.exports = function (common) {
  // wapi (withdraw api)

  /**
   * Gets the dust log for user
   * @param {function} callback - the callback function
   * @param {object} tempKeys - temporary keys
   * @return {?promise} returs promise if callback is not defined
   */
  this.dustLog = function (callback, tempKeys) {
    return signedRequest(
      common,
      common.wapi + '/v3/userAssetDribbletLog.html',
      {},
      callback,
      tempKeys
    );
  };

  /**
   * Gets the the system status
   * @param {function} callback - the callback function
   * @return {promise or undefined} - omitting the callback returns a promise
   */
  this.systemStatus = function (callback) {
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
          common.wapi + 'v3/systemStatus.html',
          {},
          callback
        );
      });
    } else {
      publicRequest(common, common.wapi + 'v3/systemStatus.html', {}, callback);
    }
  };
  /**
   * Withdraws asset to given wallet id
   * @param {string} asset - the asset symbol
   * @param {string} address - the wallet to transfer it to
   * @param {number} amount - the amount to transfer
   * @param {string} addressTag - and addtional address tag
   * @param {function} callback - the callback function
   * @param {string} name - the name to save the address as. Set falsy to prevent Binance saving to address book
   * @param {object} tempKeys - temporary keys
   * @return {?promise} returs promise if callback is not defined
   */
  this.withdraw = function (
    asset,
    address,
    amount,
    addressTag = false,
    callback = false,
    tempKeys
  ) {
    let params = { asset, address, amount };
    if (addressTag) params.addressTag = addressTag;
    return signedRequest(
      common,
      common.wapi + 'v3/withdraw.html',
      params,
      callback,
      tempKeys,
      false,
      'POST'
    );
  };

  /**
   * Get the Withdraws history for a given asset
   * @param {function} callback - the callback function
   * @param {object} params - supports limit and fromId parameters
   * @param {object} tempKeys - temporary keys
   * @return {?promise} returs promise if callback is not defined
   */
  this.withdrawHistory = function (callback, params = {}, tempKeys) {
    if (typeof params === 'string') params = { asset: params };
    return signedRequest(
      common,
      common.wapi + 'v3/withdrawHistory.html',
      params,
      callback,
      tempKeys
    );
  };

  /**
   * Get the deposit history
   * @param {function} callback - the callback function
   * @param {object} params - additional params
   ** @param {object} tempKeys - temporary keys
   * @return {?promise} returs promise if callback is not defined
   */
  this.depositHistory = function (callback, params = {}, tempKeys) {
    if (typeof params === 'string') params = { asset: params }; // Support 'asset' (string) or optional parameters (object)
    return signedRequest(
      common,
      common.wapi + 'v3/depositHistory.html',
      params,
      callback,
      tempKeys
    );
  };

  /**
   * Get the deposit history for given asset
   * @param {string} asset - the asset
   * @param {function} callback - the callback function
   * @param {object} tempKeys - temporary keys
   * @return {?promise} returs promise if callback is not defined
   */
  this.depositAddress = function (asset, callback, tempKeys) {
    return signedRequest(
      common,
      common.wapi + 'v3/depositAddress.html',
      { asset },
      callback,
      tempKeys
    );
  };
  /**
   * Get the account status
   * @param {function} callback - the callback function
   * @param {object} tempKeys - temporary keys
   * @return {?promise} returs promise if callback is not defined
   */
  this.accountStatus = function (callback, tempKeys) {
    return signedRequest(
      common,
      common.wapi + 'v3/accountStatus.html',
      {},
      callback,
      tempKeys
    );
  };

  /**
   * Get the trade fee
   * @param {function} callback - the callback function
   * @param {string} symbol (optional)
   * @param {object} tempKeys - temporary keys
   * @return {?promise} returs promise if callback is not defined
   */
  this.tradeFee = function (callback, symbol = false, tempKeys) {
    let params = symbol ? { symbol } : {};
    return signedRequest(
      common,
      common.wapi + 'v3/tradeFee.html',
      params,
      callback,
      tempKeys
    );
  };

  /**
   * Fetch asset detail (minWithdrawAmount, depositStatus, withdrawFee, withdrawStatus, depositTip)
   * @param {function} callback - the callback function
   * @param {object} tempKeys - temporary keys
   * @return {?promise} returs promise if callback is not defined
   */
  this.assetDetail = function (callback, tempKeys) {
    return signedRequest(
      common,
      common.wapi + 'v3/assetDetail.html',
      {},
      callback,
      tempKeys
    );
  };
};
