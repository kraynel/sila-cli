var url = 'http://www.silaexpert01.fr/SILAE/IWCF/IWCF.svc';

var cbaSerialization = require('./cbaSerialization');
var crypto = require('crypto');
var extractAES = require('./extractAES');
var fs = require('fs');
var Handlebars = require('Handlebars');
var NodeRSA = require('node-rsa');
var payloads = require('./payloads');
var request = require('request');
var uuid = require('uuid');
var zlib = require('zlib');

var login = '---'
var password = '---';

console.log("Generating client keys")
var serverKey = new NodeRSA(undefined, undefined, {encryptionScheme: 'pkcs1'});
var clientKey = new NodeRSA(undefined, undefined, {encryptionScheme: 'pkcs1'}).generateKeyPair();
var clientPublic = clientKey.exportKey('components-public').n.slice(1).toString("base64");

console.log("Loading request templates");
var loginRequest = Handlebars.compile(fs.readFileSync('loginRequest.xml').toString());
var loginResponse = Handlebars.compile(fs.readFileSync('loginResponse.xml').toString());
var genericRequest = Handlebars.compile(fs.readFileSync('genericRequest.xml').toString());
var genericResponse = Handlebars.compile(fs.readFileSync('genericResponse.xml').toString());

var aesClient = {key: crypto.randomBytes(32), iv: crypto.randomBytes(32)};
var aesServer = null;

console.log("Sending login request");
sendLoginRequest(clientPublic, function($usr) {
  console.log("RSA key exchange ok, got id", $usr);
  exchangeAES($usr, function(serverResponse) {
    console.log("AES exchange OK, requesting pdf list");
    cbaSerialization.setBuffer(serverResponse);
    result = cbaSerialization.readHashtable();
    deepInspect(result);
    var userInfo = result.value.$R.value.ONG1.value.P.value;
    console.log(userInfo);

    var idPaiSalarie = userInfo.ID_PAISALARIE.value;
    var idSuperviseur = userInfo.ID_SUPERVISEUR_SVN.value;
    var idClient = userInfo.ID_CLIENT.value;
    var idDroit = userInfo.ID_DROIT.value;

    var payload = payloads.AcquisitionBulletins($usr, idDroit, idSuperviseur, idClient, idPaiSalarie);
    sendGenericRequest($usr, payload, function(serverResponse) {
      console.log("AES exchange OK, requesting pdf list");

      cbaSerialization.setBuffer(serverResponse);
      result = cbaSerialization.readHashtable();
      deepInspect(result);

      var dataTable = result.value.$R.value.OR.value.dt.decoded;
      console.log("Paie dispo: ", dataTable);

      var payload = payloads.GenererPdf($usr, idDroit, idSuperviseur, idClient, idPaiSalarie, dataTable[1].row[0].value.value);
      sendGenericRequest($usr, payload, function(bulletinResponseBuffer){
        console.log("Download PDF", dataTable[1].row[0].value.value);
        cbaSerialization.setBuffer(bulletinResponseBuffer);
        var result = cbaSerialization.readHashtable();
        var pdfBuffer = result.value.$R.value.OR.value;
        var fileName = 'bulletin_'+ dataTable[1].row[0].value.value +'.pdf';
        fs.writeFileSync(fileName, pdfBuffer);
        console.log("Wrote", fileName);
      });
    });
  });
});


function sendLoginRequest(publicKey, callback) {
  var fakeRequestBody = loginRequest({
    uuid: uuid.v4(),
    clientKey: publicKey
  });

  request.post({
    url: url,
    body : fakeRequestBody,
    headers: {'Content-Type': 'application/soap+xml; charset=utf-8'}
  }, function (error, response, body) {
      if (!error && response.statusCode == 200) {
        serverKey.importKey({
          n: new Buffer(getKey(body), "base64"),
          e: 65537
        }, 'components-public');
        callback(getUserId(body));
      }
    }
  );
}

function exchangeAES(clientId, callback) {
  var payload = payloads.loginRequest(login, password, clientId);
  var encryptedPayload = extractAES.encrypt(payload, aesClient);
  var payloadWithKey = extractAES.insertAESKey(encryptedPayload, aesClient, serverKey);

  var fakeRequestBody = genericRequest({
    uuid: uuid.v4(),
    userId: clientId,
    payload: payloadWithKey.toString("base64")
  });

  request.post({
    url: url,
    body : fakeRequestBody,
    headers: {'Content-Type': 'application/soap+xml; charset=utf-8'}
  }, function (error, response, body) {
      if (!error && response.statusCode == 200) {
        var bufferPayload = new Buffer(getPayload(body), "base64");
        aesServer = extractAES.extractAESKey(new Buffer(bufferPayload.slice(1).toString("hex"), "hex"), clientKey);

        var cryptedBuffer = new Buffer(bufferPayload.slice(1 + 256 + 32 + 4 + 4).toString("hex"), "hex");
        var decryptedBuffer = extractAES.decrypt(cryptedBuffer, aesServer);

        callback(decryptedBuffer);
      }
    }
  );
}

function sendGenericRequest($usr, payload, callback) {
  console.log("PAYLOAD", payload.toString("base64"));
  var encryptedPayload = extractAES.encrypt(payload, aesClient);
  var toSend = Buffer.alloc(encryptedPayload.length + 1);
  toSend[0] = 0;
  encryptedPayload.copy(toSend, 1);

  var fakeRequestBody = genericRequest({
    uuid: uuid.v4(),
    userId: $usr,
    payload: toSend.toString("base64")
  });

  request.post({
    url: url,
    body : fakeRequestBody,
    headers: {'Content-Type': 'application/soap+xml; charset=utf-8'}
  }, function (error, response, body) {
      if (!error && response.statusCode == 200) {
        var cryptedBuffer = new Buffer(getPayload(body), "base64").slice(1);

        var decryptedBuffer = extractAES.decrypt(cryptedBuffer, aesServer);
        callback(decryptedBuffer);
      }
    }
  );
}

function AcquisitionBulletins($usr, idDroit, idSuperviseur, idClient, idPaiSalarie, callback) {
  var payload = payloads.AcquisitionBulletins($usr, idDroit, idSuperviseur, idClient, idPaiSalarie);
  sendGenericRequest(payload, callback);
}

function DownloadBulletin($usr, idDroit, idSuperviseur, idClient, idPaiSalarie, callback) {
  var payload = payloads.GenererPdf($usr, idDroit, idSuperviseur, idClient, idPaiSalarie, idPaiBulletin);
  sendGenericRequest(payload, callback);
}

function deepInspect(data) {
  if(data == null || data.value == null || typeof data.value != 'object') return;

  for(key in data.value) {
    // console.log("Inspect key", key);
    // console.log("value", data.value[key]);
    if(key == "BA" && data.value[key].type == 99) {
      if(data.value[key].value.length > 32) {
        cbaSerialization.setBuffer(data.value[key].value);
        try {
        } catch(e) {

        }
      }
    } else if(key == "dt") {
      var unzippedBuffer = zlib.inflateRawSync(data.value[key].value);
      cbaSerialization.setBuffer(unzippedBuffer);
      data.value[key].decoded = cbaSerialization.readDataTable();
    }

    if(typeof data.value[key] == 'object') {
      deepInspect(data.value[key]);
    }
  }
}

getKey = function (body) {
  return /Modulus&gt;([^\&]+)&lt/.exec(body)[1];
}

getPayload = function (body) {
  return /base64Binary[^>]+>([^<]+)/.exec(body)[1];
}

getUserId = function (body) {
  return /\$USR.*XMLSchema">([^<]+)</.exec(body)[1];
}
