var serialization = require('./cbaSerialization.js')

function loginRequest(login, password, $usr) {
  var result = Buffer.alloc(1024*10);
  serialization.setBuffer(result);
  serialization.writeHashtable({
    '$METHODE': { type: 12, value: 'Identification' },
    P4: { type: 12, value: 'IE9WIN7' },
    '$CLASSE': { type: 12, value: 'CM_IDENTIFICATION' },
    P2: { type: 12, value: password },
    '$DOM': { type: 12, value: '' },
    P3: { type: 99, value: { N: { type: 5, value: 0 } } },
    '$APP': { type: 12, value: 'SilaeClient.exe' },
    '$USR': { type: 12, value: $usr },
    T3: { type: 12, value: 'SILAE.CListeSerialisable`1[System.String]' },
    P1: { type: 12, value: login }
  });
  return addPadding(serialization.getBuffer());
}

function AcquisitionBulletins($usr, idDroit, idSuperviseur, idClient, idPaiSalarie) {
  var cSupervisionContexte = supervisionContext(idDroit, idSuperviseur);

  var result = Buffer.alloc(1024*10);
  serialization.setBuffer(result);
  serialization.writeHashtable({
      '$METHODE': { type: 12, value: 'AcquisitionBulletins' },
      P4: { type: 5, value: 0 },
      '$APP': { type: 12, value: 'SilaeClient.exe' },
      P2: { type: 5, value: idDroit },
      '$DOM': { type: 12, value: '' },
      P5:
        { type: 99,
          value:
           { BA:
              { type: 0x62,
                value: cSupervisionContexte } }},
       T5: { type: 12, value: 'SILAE.CM_SUPERVISION+CSupervisionContexte' },
       P3: { type: 5, value: idPaiSalarie },
       '$CLASSE': { type: 12, value: 'CM_PAIPORTAILCP' },
       '$USR': { type: 12, value: $usr },
       P1: { type: 5, value: idClient }
  });
  return addPadding(serialization.getBuffer());
}

function supervisionContext(idDroit, idSuperviseur) {
  var result = Buffer.alloc(1024*10);
  serialization.setBuffer(result);
  serialization.writeHashtable({
     'Option_ListeRecursiveSupervises': { type: 2, value: true },
     'OngletNatureUtilisateurSalarie': { type: 2, value: true },
     'ID_DROIT': { type: 5, value: idDroit },
     'ID_SUPERVISEUR_SVN': { type: 5, value: idSuperviseur } });

  return serialization.getBuffer();
}

function GenererPdf($usr, idDroit, idSuperviseur, idClient, idPaiSalarie, idPaiBulletin) {
  var cSupervisionContexte = supervisionContext(idDroit, idSuperviseur);
  var arrayPaieSalarie = getIntArray([idPaiSalarie]);
  var arrayPaiBulletin = getIntArray([idPaiBulletin]);

  var result = Buffer.alloc(1024*10);
  serialization.setBuffer(result);
  serialization.writeHashtable({
     '$METHODE': { type: 12, value: 'ConstruirePDF' },
     P4: { type: 3, value: 0 },
     T2: { type: 12, value: 'SILAE.CListeSerialisable`1[System.Int32]' },
     '$APP': { type: 12, value: 'SilaeClient.exe' },
     P2:
      { type: 99,
        value: { BA: { type: 0x62, value: arrayPaiBulletin } } },
     '$DOM': { type: 12, value: '' },
     P5:
      { type: 99,
        value:
         { BA:
            { type: 0x62,
              value: cSupervisionContexte } } },
     T5: { type: 12, value: 'SILAE.CM_SUPERVISION+CSupervisionContexte' },
     P3:
      { type: 99,
        value: { BA: { type: 0x62, value: arrayPaieSalarie } } },
     '$CLASSE': { type: 12, value: 'CM_PAIPORTAILCP' },
     '$USR': { type: 12, value: $usr },
     T3: { type: 12, value: 'SILAE.CListeSerialisable`1[System.Int32]' },
     P1: { type: 5, value: idClient }
   });
   return addPadding(serialization.getBuffer());
}

function getIntArray(intArray) {
  var result = Buffer.alloc((intArray.length + 1) * 4);
  result.writeInt32LE(intArray.length);
  var offset = 4;
  for(var i=0; i<intArray.length; i++) {
    result.writeInt32LE(intArray[i], offset);
    offset += 4;
  }

  return result;
}

function addPadding(buffer) {
  var paddingToAdd = 32 - buffer.length % 32;
  var bufferLength = buffer.length + paddingToAdd;
  var result = Buffer.alloc(bufferLength);
  for(var i=buffer.length; i<bufferLength; i++) {
    result[i] = paddingToAdd;
  }
  buffer.copy(result)
  return result;
}

module.exports = {
  loginRequest: loginRequest,
  AcquisitionBulletins: AcquisitionBulletins,
  GenererPdf: GenererPdf
}
