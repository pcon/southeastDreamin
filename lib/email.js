/*jslint browser: true, regexp: true */
/*global require, module */

var config = require('../credentials.json');

var Q = require('q');

var send = function (template, session) {
    'use strict';

    var send = require('gmail-send')({
            user: config.gmail.user,
            pass: config.gmail.pass,
            to: session.Email,
            from: config.gmail.from,
            replyTo: session.ManagerEmail,
            subject: template.subject(session),
            text: template.text(session),
            html: template.html(session)
        }),
        deferred = Q.defer();

    send({}, function (err, res) {
        if (err) {
            deferred.reject(err);
        } else {
            deferred.resolve(res);
        }
    });

    return deferred.promise;
};

module.exports = {
    send: send
};