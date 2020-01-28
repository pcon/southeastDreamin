const lo = require('lodash');
const Q = require('q');
const bunyan = require('bunyan');

global.logger = bunyan.createLogger({
    name: 'email_acceptedSessions',
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
    'RecordType.Name = \'Chosen/Picked\'',
    'Main_Presenter__r.Email != null',
    'Session_Status__c = \'Accepted\''
];

const QUERY_PARTS = [
    'select',
    lo.join(FIELDS, ','),
    'from Session__c',
    'where',
    lo.join(CONDITIONS, ' and ')
];
const QUERY = lo.join(QUERY_PARTS, ' ');

const getAcceptedSessions = sfdc.query.bind(null, QUERY);

/**
 * Updates the status of the sessions to notified
 * @returns {Promise} A promise for when the sessions have been updated
 */
var updateStatus = function () {
    var successful_records = [];
    var deferred = Q.defer();

    lo.forEach(global.notified_sessions, function (id) {
        successful_records.push({
            Id: id,
            Session_Status__c: 'Notified'
        });
    });

    global.logger.info('Updating ' + lo.size(successful_records) + '\n' + lo.join(global.notified_sessions, '\n'));
    sfdc.update('Session__c', successful_records)
        .then(function () {
            deferred.resolve();
        }).catch(function (err) {
            deferred.reject(err);
        });

    return deferred.promise;
};

utils.readTemplates(EVENT_YEAR, 'sessionAcceptance')
    .then(getAcceptedSessions)
    .then(utils.mogrifySessionData)
    .then(utils.sendEmails)
    .then(updateStatus)
    .catch(function (err) {
        global.logger.error(err);
    });