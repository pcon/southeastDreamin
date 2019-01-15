/*jslint browser: true, regexp: true */
/*global require, module */

var config = require('../credentials.json');

var Q = require('q');
//var MailComposer = require('nodemailer/lib/mail-composer');

var send = function (template, session) {
    'use strict';

    var mailgun = require('mailgun-js')({ apiKey: config.mailgun.key, domain: config.mailgun.domain });
    var deferred = Q.defer();

    if (session.ManagerEmail === undefined) {
        session.ManagerEmail = 'sessions@sedreamin.com';
    }

    var data = {
        to: session.Email,
        from: 'Southeast Dreamin <sessions@sedreamin.com>',
        subject: template.subject(session),
        text: template.text(session),
        html: template.html(session),
        "h:Reply-To": session.ManagerEmail
    };
    mailgun.messages().send(data, function (error, body) {
        if (error) {
            deferred.reject(error);
        } else {
            deferred.resolve(body);
        }
    });

    return deferred.promise;
};

module.exports = {
    send: send
};