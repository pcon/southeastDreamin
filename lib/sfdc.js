/*jslint browser: true, regexp: true */
/*global require, module */

var config = require('../credentials.json');

var jsforce = require('jsforce');
var Q = require('q');

var login = function () {
    'use strict';

    var conn = new jsforce.Connection({
        maxRequest: 200
    }),
        deferred = Q.defer();

    conn.login(config.salesforce.user, config.salesforce.pass + config.salesforce.token, function (err) {
        if (err) {
            deferred.reject(err);
        } else {
            deferred.resolve(conn);
        }
    });

    return deferred.promise;
};

var query = function (query) {
    'use strict';

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

var update = function (obj_name, data) {
    'use strict';

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