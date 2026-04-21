/**
 * CatalogService definition.
 * Best Practice: To accurately audit log *who* accessed the data, 
 * the service should require authentication so a user ID is present in the context.
 */
@requires: 'authenticated-user'
service CatalogService {

    /**
     * @PersonalData.EntitySemantics defines the role of this entity in data privacy.
     * * Possible Choices:
     * - 'DataSubject'        : This entity represents the person themselves (e.g., User, Employee).
     * - 'DataSubjectDetails' : This entity contains related info linked to a Data Subject (e.g., UserAddress).
     * - 'Other'              : Contains personal data, but isn't the primary subject or directly linked details.
     */
    @PersonalData.EntitySemantics: 'DataSubject'
    
    /**
     * @AuditLog.Operation explicitly controls which operations are sent to the Audit Log.
     * Note: SAP CAP often automatically infers these based on the @PersonalData annotations below,
     * but you can explicitly define them to enforce specific logging behaviors.
     * * Possible Choices (Booleans):
     * - Read, Insert, Update, Delete
     */
    @AuditLog.Operation: { Read: true, Insert: true, Update: true, Delete: true }
    entity Books {
        
        /**
         * @PersonalData.FieldSemantics identifies the key fields for data privacy tracking.
         * * Possible Choices:
         * - 'DataSubjectID' : The unique identifier for the subject. Mandatory if EntitySemantics 
         * is 'DataSubject'. The Audit Log uses this to tag *whose* data was accessed.
         */
        @PersonalData.FieldSemantics: 'DataSubjectID'
        key ID     : Integer;

        /**
         * @PersonalData.IsPotentiallyPersonal flags standard PII (Personally Identifiable Information).
         * * Audit Log Impact:
         * Triggers Data Modification Logging (DML). The Audit Log will automatically record 
         * whenever this field is Created, Updated, or Deleted. It does NOT log simple reads.
         */
        @PersonalData.IsPotentiallyPersonal
        title  : String;

        /**
         * @PersonalData.IsPotentiallySensitive flags highly sensitive PII (e.g., medical info, passwords, race).
         * * Audit Log Impact:
         * Triggers Data Read Logging (DRL) AND Data Modification Logging (DML). The Audit Log 
         * will record EVERY time this data is viewed (Read) as well as changed.
         * * Warning: Use this sparingly! Read logging generates a massive volume of audit logs.
         */
        @PersonalData.IsPotentiallySensitive
        author : String;
        
        /**
         * @AuditLog.Ignore explicitly excludes a field from being logged.
         * * Use Case:
         * If you have an entity with sensitive data, but one specific field is completely 
         * harmless (like a status flag or a non-personal category) and changes frequently, 
         * you can tell the Audit Log to ignore it to save storage space.
         */
        @AuditLog.Ignore
        genre  : String;
    }
}
