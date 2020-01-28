String event_id = 'a031K00002u3wYEQAY';

RecordType rt = [
    select Id
    from RecordType
    where Name = 'Rejected'
];

List<Session__c> sessions = new List<Session__c>();

for (Session__c session : [
    select Id
    from Session__c
    where Event__c = :event_id and
    	RecordType.Name = 'Submission'
]) {
    session.RecordTypeId = rt.Id;
    sessions.add(session);
}

update sessions;