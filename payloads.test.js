var fs = require('fs');
var cbaSerialization = require('./cbaSerialization.js')
var util = require('util');
const zlib = require('zlib');
var payload = require('./payloads.js');


var loginRequest = payload.loginRequest('kevinr@theodo.fr', 'mhj5tb', '56237');
console.log(loginRequest.toString('base64'));

// var genererPdfReq = payload.GenererPdf('53160', '96374', '94', '1204', '16520', '651355');
// console.log(genererPdfReq.toString('base64'));
