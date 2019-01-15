/*jslint browser: true, regexp: true */
/*global require, console */

var fs = require('fs');
var lo = require('lodash');
var handlebars = require('handlebars');
var Q = require('q');
var bunyan = require('bunyan');

var logger = bunyan.createLogger({
    name: "email_declinedSessions",
    stream: process.stdout
});

var sfdc = require('./lib/sfdc.js');
var email = require('./lib/email.js');

var template = {
    subject: undefined,
    html: undefined,
    text: undefined
};

var notified_sessions = [];
var failed_sessions = [];

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

    readFile('tmpl/2019/sessionRejection.sub')
        .then(function (subject) {
            template.subject = handlebars.compile(subject);

            readFile('tmpl/2019/sessionRejection.html')
                .then(function (html) {
                    template.html = handlebars.compile(html);

                    readFile('tmpl/2019/sessionRejection.txt')
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

var getDeclinedSessions = function () {
    'use strict';

    var deferred = Q.defer();

    sfdc.query('select Id, Name, Main_Presenter__r.FirstName, Main_Presenter__r.Email from Session__c where Event__c = \'a034100002l1htyAAA\' and RecordType.Name = \'Rejected\' and Main_Presenter__r.Email != null order by Main_Presenter__r.Email')
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
        if (!sessionMap.hasOwnProperty(session.Main_Presenter__r.Email)) {
            sessionMap[session.Main_Presenter__r.Email] = {
                Ids: [],
                Email: session.Main_Presenter__r.Email,
                Name: session.Main_Presenter__r.FirstName,
                Sessions: []
            };
        }

        sessionMap[session.Main_Presenter__r.Email].Sessions.push({Title: session.Name});
        sessionMap[session.Main_Presenter__r.Email].Ids.push(session.Id);
    });

    deferred.resolve(lo.values(sessionMap));

    return deferred.promise;
};

var sendEmail = function (session) {
    'use strict';

    var deferred = Q.defer();

    email.send(template, session)
        .then(function () {
            logger.info('Email sent for ' + session.Ids);
            notified_sessions = lo.union(notified_sessions, session.Ids);
            deferred.resolve();
        }).catch(function (err) {
            logger.error('Unable to send email to ' + session.Email + ' - ' + session.Id);
            failed_sessions = lo.union(failed_sessions, session.Ids);
            deferred.reject(err);
        });

    return deferred.promise;
};

var sendEmails = function (sessions) {
    'use strict';

    var promises = [],
        deferred = Q.defer();

    lo.forEach(sessions, function (session) {
        promises.push(sendEmail(session));
    });

    Q.allSettled(promises)
        .then(function () {
            deferred.resolve();
        });

    return deferred.promise;
};

var updateRecordTypes = function () {
    'use strict';

    var successful_records = [],
        deferred = Q.defer();

    sfdc.query('select Id from RecordType where Name = \'Rejected\'')
        .then(function (data) {
            lo.forEach(notified_sessions, function (id) {
                successful_records.push({
                    Id: id,
                    RecordTypeId: data[0].Id
                });
            });

            sfdc.update('Session__c', successful_records)
                .then(function () {
                    deferred.resolve();
                }).catch(function (err) {
                    deferred.reject(err);
                });
        }).catch(function (err) {
            deferred.reject(err);
        });

    return deferred.promise;
};

readTemplates()
    .then(getDeclinedSessions)
    .then(mogrifySessionData)
    .then(sendEmails)
//    .then(updateRecordTypes)
    .then(function () {
        'use strict';

        logger.info('Notified');
        logger.info(notified_sessions);

        logger.info('Failed');
        logger.info(failed_sessions);
    }).catch(function (err) {
        'use strict';

        logger.error(err);
    });