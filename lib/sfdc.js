var config = require('../credentials.json');

var jsforce = require('jsforce');
var Q = require('q');

/**
 * Logs into Salesforce
 * @returns {Promise} A promise for when the user is logged in
 */
var login = function () {
    const conn = new jsforce.Connection({
        maxRequest: 200
    });
    var deferred = Q.defer();

    conn.login(config.salesforce.user, config.salesforce.pass + config.salesforce.token, function (err) {
        if (err) {
            deferred.reject(err);
        } else {
            deferred.resolve(conn);
        }
    });

    return deferred.promise;
};

/**
 * Queries records
 * @param {String} query The query
 * @returns {Promise} A promise for the queried records
 */
var query = function (query) {
    var deferred = Q.defer();

    login()
        .then(function (conn) {
            conn.query(query, function (err, res) {
                if (err) {
                    deferred.reject(err);
                } else {
                    deferred.resolve(res.records);
                }
            });
        }).catch(function (err) {
            deferred.reject(err);
        });

    return deferred.promise;
};

/**
 * Updates records
 * @param {String} obj_name The object name
 * @param {Object[]} data The data to update
 * @returns {Promise} A promise for when the records are updated
 */
var update = function (obj_name, data) {
    var deferred = Q.defer();

    login()
        .then(function (conn) {
            conn.sobject(obj_name).update(data, function (err, rets) {
                if (err) {
                    deferred.reject(err);
                } else {
                    deferred.resolve(rets);
                }
            });
        }).catch(function (err) {
            deferred.reject(err);
        });

    return deferred.promise;
};

module.exports = {
    login: login,
    query: query,
    update: update
};