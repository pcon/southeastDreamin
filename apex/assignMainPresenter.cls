String event_id = 'a031K00002u3wYEQAY';

List<Session__c> sessions = [select Id, (select Speaker_Contact__c from Speakers__r where Speaker_Type__c = 'Main Speaker') from Session__c where Event__c = :event_id];
for (Session__c session: sessions) {
    if (session.Speakers__r.isEmpty()) {
        System.debug(session.Id);
        continue;
    }
	session.Main_Presenter__c = session.Speakers__r.get(0).Speaker_Contact__c;
}
update sessions;