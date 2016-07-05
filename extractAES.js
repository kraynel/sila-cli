var mcrypt = require('js-rijndael');

function extractAESKey(buffer, rsaPrivateKey) {
  var rsaEncryptedAesKeySize = buffer.readInt32LE(0);
  var rsaEncryptedAesKey = new Buffer(rsaEncryptedAesKeySize);
  buffer.copy(rsaEncryptedAesKey, 0, 4, rsaEncryptedAesKeySize + 4);

  var ivKeySize = buffer.readInt32LE(4+rsaEncryptedAesKeySize);
  var ivKey = new Buffer(ivKeySize);
  buffer.copy(ivKey, 0, rsaEncryptedAesKeySize+8, ivKeySize + rsaEncryptedAesKeySize+8);

  var aesKey = rsaPrivateKey.decrypt(rsaEncryptedAesKey);
  return {key: aesKey, iv: ivKey};
}

function insertAESKey(payload, aesInfo, rsaPublicKey) {
  var encryptedPublicKey = rsaPublicKey.encrypt(aesInfo.key);
  var result = Buffer.concat([
    new Buffer("01", "hex"),
    new Buffer("00010000", "hex"),
    encryptedPublicKey,
    new Buffer("20000000", "hex"),
    aesInfo.iv,
    payload
  ])
  return result;
}

function decrypt(encrypted, aesInfo) {
  var encryptedArray = encrypted.toJSON().data;
  var iv = aesInfo.iv.toJSON().data;
  var key = aesInfo.key.toJSON().data;
  return new Buffer(mcrypt.decrypt(encryptedArray, iv, key, 'rijndael-256', 'cbc'));
}

function encrypt(clearText, aesInfo) {
  var clearTextArray = clearText.toJSON().data;
  var iv = aesInfo.iv.toJSON().data;
  var key = aesInfo.key.toJSON().data;
  return new Buffer(mcrypt.encrypt(clearTextArray, iv, key, 'rijndael-256', 'cbc'));
}


module.exports = {
  extractAESKey: extractAESKey,
  insertAESKey: insertAESKey,
  decrypt: decrypt,
  encrypt: encrypt
}
