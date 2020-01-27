var config = require('../credentials.json');
var Q = require('q');

/**
 * Sends and email via mailgun
 * @param {Object} template The template
 * @param {Object} session The session
 * @returns {Promise} A promise for when the email has been sent
 */
var send = function (template, session) {
    var mailgun = require('mailgun-js')({ // eslint-disable-line global-require
        apiKey: config.mailgun.key,
        domain: config.mailgun.domain
    });
    var deferred = Q.defer();

    if (session.ManagerEmail === undefined) {
        session.ManagerEmail = 'sessions@sedreamin.com';
    }

    var data = {
        //to: session.Email,
        to: 'patrick@deadlypenguin.com',
        from: 'Southeast Dreamin <sessions@sedreamin.com>',
        subject: template.subject(session),
        text: template.text(session),
        html: template.html(session),
        'h:Reply-To': session.ManagerEmail
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