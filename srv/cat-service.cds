@odata
service CatalogService {
  @PersonalData.EntitySemantics: 'DataSubject'
  entity Books {
        @PersonalData.FieldSemantics: 'DataSubjectID'
    key ID     : Integer;

        @PersonalData.IsPotentiallyPersonal
        title  : String;

        @PersonalData.IsPotentiallySensitive
        author : String;
  }
}
