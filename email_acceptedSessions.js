/*jslint browser: true, regexp: true */
/*global require, console */

var fs = require('fs');
var lo = require('lodash');
var handlebars = require('handlebars');
var Q = require('q');
var bunyan = require('bunyan');

var logger = bunyan.createLogger({
    name: "email_acceptedSessions",
    stream: process.stdout
});

var sfdc = require('./lib/sfdc.js');
var email = require('./lib/email.js');

var template = {
    subject: undefined,
    html: undefined,
    text: undefined
};

var readFile = function (fname) {
    'use strict';

    var deferred = Q.defer();

    fs.readFile(fname, 'utf8', function (err, data) {
        if (err) {
            deferred.reject(err);
        } else {
            deferred.resolve(data);
        }
    });

    return deferred.promise;
};

var readTemplates = function () {
    'use strict';

    var deferred = Q.defer();

    readFile('tmpl/2017/sessionAcceptance.sub')
        .then(function (subject) {
            template.subject = handlebars.compile(subject);

            readFile('tmpl/2017/sessionAcceptance.html')
                .then(function (html) {
                    template.html = handlebars.compile(html);

                    readFile('tmpl/2017/sessionAcceptance.txt')
                        .then(function (text) {
                            template.text = handlebars.compile(text);

                            deferred.resolve();
                        }).catch(function (err) {
                            deferred.reject(err);
                        });
                }).catch(function (err) {
                    deferred.reject(err);
                });
        }).catch(function (err) {
            deferred.reject(err);
        });


    return deferred.promise;
};

var getAcceptedSessions = function () {
    'use strict';

    var deferred = Q.defer();

    sfdc.query('select Name, Session_Manager__r.Email, Related_Contact__r.FirstName, Related_Contact__r.Email from Session__c where RecordType.Name = \'Chosen/Picked\' and Related_Contact__r.Email != null and Session_Status__c = \'Accepted\'')
        .then(function (data) {
            deferred.resolve(data);
        }).catch(function (err) {
            deferred.reject(err);
        });

    return deferred.promise;
};

var mogrifySessionData = function (sessions) {
    'use strict';

    var sessionMap = {},
        deferred = Q.defer();

    lo.forEach(sessions, function (session) {
        if (!sessionMap.hasOwnProperty(session.Related_Contact__r.Email)) {
            sessionMap[session.Related_Contact__r.Email] = {
                Email: session.Related_Contact__r.Email,
                Name: session.Related_Contact__r.FirstName,
                ManagerEmail: session.Session_Manager__r.Email,
                Sessions: []
            };
        }

        sessionMap[session.Related_Contact__r.Email].Sessions.push({Title: session.Name});
    });

    deferred.resolve(lo.values(sessionMap));

    return deferred.promise;
};

var sendEmail = function (session) {
    'use strict';

    var deferred = Q.defer();

    email.send(template, session)
        .then(function () {
            deferred.resolve();
        }).catch(function (err) {
            logger.error('Unable to send email to ' + session.Email);
            deferred.reject(err);
        });

    return deferred.promise;
};

var sendEmails = function (sessions) {
    'use strict';

    var success = true,
        promises = [],
        deferred = Q.defer();

    lo.forEach(sessions, function (session) {
        promises.push(sendEmail(session));
    });

    Q.allSettled(promises)
        .then(function (results) {
            results.forEach(function (result) {
                if (result.state !== 'fulfilled') {
                    logger.error(results.reason);
                    success = false;
                }
            });

            if (success) {
                deferred.resolve();
            } else {
                deferred.reject(new Error('Something went wrong sending emails'));
            }
        });

    return deferred.promise;
};

readTemplates()
    .then(getAcceptedSessions)
    .then(mogrifySessionData)
    .then(sendEmails)
    .catch(function (err) {
        'use strict';

        logger.error(err);
    });