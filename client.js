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
var util = require('util');

var serverKey, clientKey, clientPublic, loginRequest, genericRequest, aesClient, aesServer;

function init() {
  console.log("Generating client keys")
  serverKey = new NodeRSA(undefined, undefined, {encryptionScheme: 'pkcs1'});
  clientKey = new NodeRSA(undefined, undefined, {encryptionScheme: 'pkcs1'}).generateKeyPair();
  clientPublic = clientKey.exportKey('components-public').n.slice(1).toString("base64");

  console.log("Loading request templates");
  loginRequest = Handlebars.compile(fs.readFileSync('./soap/loginRequest.xml').toString());
  genericRequest = Handlebars.compile(fs.readFileSync('./soap/genericRequest.xml').toString());

  aesClient = {key: crypto.randomBytes(32), iv: crypto.randomBytes(32)};
  aesServer = null;
}

function downloadLast(login, password, outputPath) {
  init();
  console.log("Sending login request");
  sendLoginRequest(clientPublic, function($usr) {
    console.log("RSA key exchange ok, got id", $usr);
    exchangeAES(login, password, $usr, function(serverResponse) {
      console.log("AES exchange OK, requesting pdf list");
      cbaSerialization.setBuffer(serverResponse);
      result = cbaSerialization.readHashtable();
      deepInspect(result);
      try {
        var userInfo = result.value.$R.value.ONG1.value.P.value;
      } catch(e) {
        console.log("Bad user info.")
        process.exit(1);
      }

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
        listPayslips(dataTable);

        console.log("Download PDF #", dataTable[1].row[0].value.value);
        var payload = payloads.GenererPdf($usr, idDroit, idSuperviseur, idClient, idPaiSalarie, dataTable[1].row[0].value.value);
        sendGenericRequest($usr, payload, function(bulletinResponseBuffer){
          cbaSerialization.setBuffer(bulletinResponseBuffer);
          var result = cbaSerialization.readHashtable();
          var pdfBuffer = result.value.$R.value.OR.value;

          var pdfDate = dataTable[2].row[0].value.value.toISOString().slice(0, 7);
          var fileName = outputPath || 'bulletin_'+ pdfDate +'.pdf';
          fs.writeFileSync(fileName, pdfBuffer);
          console.log("Wrote", fileName);
        });
      });
    });
  });
}

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

function exchangeAES(login, password, clientId, callback) {
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

function deepInspect(data) {
  if(data == null || data.value == null || typeof data.value != 'object') return;

  for(key in data.value) {
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

function listPayslips(dataTable) {
  console.log('------------');
  for(var i=0; i<dataTable[0].row.length; i++) {
    console.log([
      "Paie #",
      dataTable[1].row[i].value.value,
      " for month ",
      dataTable[2].row[i].value.value
    ].join(''));
  }
  console.log('------------');
}

function getKey(body) {
  return /Modulus&gt;([^\&]+)&lt/.exec(body)[1];
}

function getPayload(body) {
  return /base64Binary[^>]+>([^<]+)/.exec(body)[1];
}

function getUserId(body) {
  return /\$USR.*XMLSchema">([^<]+)</.exec(body)[1];
}

module.exports = {
  downloadLast: downloadLast
}
