const lo = require('lodash');
const Q = require('q');
const bunyan = require('bunyan');

global.logger = bunyan.createLogger({
    name: 'email_declinedSessions',
    stream: process.stdout
});

const sfdc = require('./lib/sfdc');
const utils = require('./lib/utils');

global.template = {
    subject: undefined,
    html: undefined,
    text: undefined
};

global.notified_sessions = [];
global.failed_sessions = [];

const EVENT_ID = 'a031K00002u3wYEQAY';
const EVENT_YEAR = '2020';

const FIELDS = [
    'Id',
    'Name',
    'Session_Manager__r.Email',
    'Main_Presenter__r.FirstName',
    'Main_Presenter__r.Email'
];

const CONDITIONS = [
    `Event__c = '${EVENT_ID}'`,
    'RecordType.Name = \'Submitted\'',
    'Main_Presenter__r.Email != null'
];

const QUERY_PARTS = [
    'select',
    lo.join(FIELDS, ','),
    'from Session__c',
    'where',
    lo.join(CONDITIONS, ' and '),
    'order by Main_Presenter__r.Email'
];
const QUERY = lo.join(QUERY_PARTS, ' ');

const getDeclinedSessions = sfdc.query.bind(null, QUERY);

/**
 * Set the record type to Rejected
 * @returns {Promise} A promise for when the sessions have been updated
 */
var updateRecordTypes = function () {
    var successful_records = [];
    const deferred = Q.defer();

    sfdc.query('select Id from RecordType where Name = \'Rejected\'')
        .then(function (data) {
            lo.forEach(global.notified_sessions, function (id) {
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

utils.readTemplates(EVENT_YEAR, 'sessionRejection')
    .then(getDeclinedSessions)
    .then(utils.mogrifySessionData)
    .then(utils.sendEmails)
    .then(updateRecordTypes)
    .then(function () {
        global.logger.info('Notified');
        global.logger.info(global.notified_sessions);

        global.logger.info('Failed');
        global.logger.info(global.failed_sessions);
    }).catch(function (err) {
        global.logger.error(err);
    });