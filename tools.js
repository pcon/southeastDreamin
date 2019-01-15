var bunyan = require('bunyan');
var csvWriter = require('csv-writer');
var lo = require('lodash');
var Q = require('q');
var util = require('util');
var yargs = require('yargs');

var sfdc = require('./lib/sfdc.js');

var logger = bunyan.createLogger({
    name: "tools",
    stream: process.stdout
});
var file_name = '/tmp/output.csv';

var logAndExit = function (error) {
    logger.error(error);
    process.exit(1);
}

var querySessions = function (eventId) {
    var deferred = Q.defer();
    var RECORD_TYPE_NAME = 'Chosen/Picked'
    var query = util.format(
        'select Id, Name, Session_Abstract__c, Start_Time__c, End_Time__c, Track__r.Name, Room__r.Name, ' +
        '(select Speaker_Contact__r.Name from Speakers__r) ' +
        'from Session__c ' +
        'where Event__c = \'%s\' and RecordType.Name = \'%s\' order by Name',
        eventId, RECORD_TYPE_NAME
        );

    sfdc.query(query)
        .then(function (rows) {
            deferred.resolve(rows);
        }).catch(function (error) {
            deferred.reject(error);
        })

    return deferred.promise;
};

var squashContacts = function (speakers) {
    var speakerNames = [];

    lo.forEach(speakers.records, function (speaker) {
        speakerNames.push(speaker.Speaker_Contact__r.Name);
    });

    return lo.join(speakerNames, ';');
};

var squashSessions = function (session) {
    return {
        Id: session.Id,
        Name: session.Name,
        Abstract: session.Session_Abstract__c,
        Start: session.Start_Time__c,
        End: session.End_Time__c,
        Track: session.Track__r.Name,
        Room: session.Room__r.Name,
        Speakers: squashContacts(session.Speakers__r)
    };
};

var mogrifyData = function (data) {
    var deferred = Q.defer();

    deferred.resolve(lo.map(data, squashSessions));

    return deferred.promise;
};

var printCSV = function (data) {
    var deferred = Q.defer();

    logger.info(data);

    var writer = csvWriter.createObjectCsvWriter({
        path: file_name,
        header: [
            {id: 'Id', title: 'Id'},
            {id: 'Name', title: 'Name'},
            {id: 'Abstract', title: 'Abstract'},
            {id: 'Start', title: 'Start'},
            {id: 'End', title: 'End'},
            {id: 'Track', title: 'Track'},
            {id: 'Room', title: 'Room'},
            {id: 'Speakers', title: 'Speakers'},
        ]
    });

    writer.writeRecords(data)
        .then(function () {
            deferred.resolve();
        });

    return deferred.promise;
}

var dump = function (argv) {
    if (argv.file) {
        file_name = argv.file;
    }

    querySessions(argv.eventId)
        .then(mogrifyData)
        .then(printCSV)
        .catch(logAndExit)
};

yargs.usage('$0 <cmd> [args]')
    .command('dump [eventId]', 'Dump the event information', (yargs) => {
        yargs.positional('eventId', {
            type: 'string',
            describe: 'The event id'
        })
    }, dump)
    .options({
        file: {
            describe: 'The output file'
        }
    })
    .help()
    .argv;