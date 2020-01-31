const lo = require('lodash');
const Q = require('q');
const bunyan = require('bunyan');

global.logger = bunyan.createLogger({
    name: 'email_remindSessions',
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
    'Session_Status__c = \'Notified\''
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

utils.readTemplates(EVENT_YEAR, 'sessionReminder')
    .then(getAcceptedSessions)
    .then(utils.mogrifySessionData)
    .then(utils.sendEmails)
    .catch(function (err) {
        global.logger.error(err);
    });