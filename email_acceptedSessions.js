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

    readFile('tmpl/2019/sessionAcceptance.sub')
        .then(function (subject) {
            template.subject = handlebars.compile(subject);

            readFile('tmpl/2019/sessionAcceptance.html')
                .then(function (html) {
                    template.html = handlebars.compile(html);

                    readFile('tmpl/2019/sessionAcceptance.txt')
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

    sfdc.query('select Id, Name, Session_Manager__r.Email, Main_Presenter__r.FirstName, Main_Presenter__r.Email from Session__c where Event__c = \'a034100002l1htyAAA\' and RecordType.Name = \'Chosen/Picked\' and Main_Presenter__r.Email != null and Session_Status__c = \'Accepted\'')
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
                ManagerEmail: session.Session_Manager__r.Email,
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
			logger.error('Unable to send email to ' + session.Email + ' - ' + lo.join(session.Ids, ','));
            failed_sessions = lo.union(failed_sessions, session.Ids);
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
            deferred.resolve();
        });

    return deferred.promise;
};

var updateStatus = function () {
    'use strict';

    var successful_records = [],
        deferred = Q.defer();

	lo.forEach(notified_sessions, function (id) {
		successful_records.push({
			Id: id,
			Session_Status__c: 'Notified'
		});
	});

	logger.info('Updating ' + lo.size(successful_records) + '\n' + lo.join(notified_sessions, '\n'));
	sfdc.update('Session__c', successful_records)
		.then(function () {
			deferred.resolve();
		}).catch(function (err) {
			deferred.reject(err);
		});

    return deferred.promise;
};

readTemplates()
    .then(getAcceptedSessions)
    .then(mogrifySessionData)
    .then(sendEmails)
	.then(updateStatus)
    .catch(function (err) {
        'use strict';

        logger.error(err);
    });