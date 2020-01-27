const fs = require('fs');
const Q = require('q');
const lodash = require('lodash');
const handlebars = require('handlebars');

const email = require('./lib/email');

/**
 * Reads a file from disk
 * @param {String} fname The filename
 * @returns {Promise} A promise for when the file has been read
 */
function readFile(fname) {
    var deferred = Q.defer();

    fs.readFile(fname, 'utf8', function (err, data) {
        if (err) {
            deferred.reject(err);
        } else {
            deferred.resolve(data);
        }
    });

    return deferred.promise;
}

/**
 * Reads all the templates from disk
 * @param {String} event_year The event year
 * @param {String} name The template name
 * @returns {Promise} A promise for when all the templates have been read
 */
function readTemplates(event_year, name) {
    var deferred = Q.defer();

    readFile(`tmpl/${event_year}/${name}.sub`)
        .then(function (subject) {
            global.template.subject = handlebars.compile(subject);

            readFile(`tmpl/${event_year}/${name}.html`)
                .then(function (html) {
                    global.template.html = handlebars.compile(html);

                    readFile(`tmpl/${event_year}/${name}.txt`)
                        .then(function (text) {
                            global.template.text = handlebars.compile(text);

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
}

/**
 * Modifies the session data to make it easier to use
 * @param {Object[]} sessions The sessions to modify their data
 * @returns {Promise} A promise for when the session data has been modified
 */
function mogrifySessionData(sessions) {
    var sessionMap = {};
    var deferred = Q.defer();

    lodash.forEach(sessions, function (session) {
        if (!lodash.has(sessionMap, session.Main_Presenter__r.Email)) {
            sessionMap[session.Main_Presenter__r.Email] = {
                Ids: [],
                Email: session.Main_Presenter__r.Email,
                Name: session.Main_Presenter__r.FirstName,
                ManagerEmail: session.Session_Manager__r.Email,
                Sessions: []
            };
        }

        sessionMap[session.Main_Presenter__r.Email].Sessions.push({
            Title: session.Name
        });
        sessionMap[session.Main_Presenter__r.Email].Ids.push(session.Id);
    });

    deferred.resolve(lodash.values(sessionMap));

    return deferred.promise;
}

/**
 * Sends a single email
 * @param {Object} session A session
 * @returns {Promise} A promise for when the email has been sent
 */
var sendEmail = function (session) {
    var deferred = Q.defer();

    email.send(global.template, session)
        .then(function () {
            global.logger.info(`Email sent for ${session.Ids}`);
            global.notified_sessions = lodash.union(global.notified_sessions, session.Ids);
            deferred.resolve();
        }).catch(function (err) {
            global.logger.error(`Unable to send email to ${session.Email} - ${lodash.join(session.Ids, ',')}`);
            global.failed_sessions = lodash.union(global.failed_sessions, session.Ids);
            deferred.reject(err);
        });

    return deferred.promise;
};

/**
 * Emails all the session submitters
 * @param {Object[]} sessions The sessions to email about
 * @returns {Promise} A promise for when the emails have been sent
 */
var sendEmails = function (sessions) {
    var promises = [];
    var deferred = Q.defer();

    lodash.forEach(sessions, function (session) {
        promises.push(sendEmail(session));
    });

    Q.allSettled(promises)
        .then(function () {
            deferred.resolve();
        });

    return deferred.promise;
};

module.exports = {
    sendEmails: sendEmails,
    readTemplates: readTemplates,
    mogrifySessionData: mogrifySessionData
};