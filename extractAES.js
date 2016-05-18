var NodeRSA = require('node-rsa');
var MCrypt = require('mcrypt').MCrypt;

// RijndaelToDecrypt.KeySize = 0x100;
// RijndaelToDecrypt.BlockSize = 0x100;
// RijndaelToDecrypt.Mode = CipherMode.CBC;
// RijndaelToDecrypt.Padding = PaddingMode.PKCS7;
var mc = new MCrypt('rijndael-256', 'cbc');
mc.validateIvSize(false); // disable iv size checking

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
  mc.open(aesInfo.key, aesInfo.iv);
  return mc.decrypt(encrypted);
}

function encrypt(clearText, aesInfo) {
  mc.open(aesInfo.key, aesInfo.iv);
  return mc.encrypt(clearText);
}


module.exports = {
  extractAESKey: extractAESKey,
  insertAESKey: insertAESKey,
  decrypt: decrypt,
  encrypt: encrypt
}
