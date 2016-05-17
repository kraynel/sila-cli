var fs = require('fs');
var cbaSerialization = require('./cbaSerialization.js')
var util = require('util');
const zlib = require('zlib');

var fileNames = fs.readdirSync('full_exchange_3').sort();
console.log(fileNames);
// fileNames = [fileNames[1]]
for(var file of fileNames) {
  if(file.indexOf('.pdf') >= 0) continue;
  console.log('--------------')
  console.log('file:', file);
  var request1 = fs.readFileSync('full_exchange_3/' + file);
  cbaSerialization.setBuffer(request1);
  result = cbaSerialization.readHashtable();

  for(var key in result) {
    if(result[key] == 'SILAE.CM_SUPERVISION+CSupervisionContexte') {
      var index = key.split('')[1];
      console.log("GOT Supervision context for P", index)
      cbaSerialization.setBuffer(result["P"+index].BA);
      result["P"+index].decoded = cbaSerialization.readHashtable()
    }
  }

  deepInspect(result);
  console.log(util.inspect(result, false, null));

}

function deepInspect(data) {
  if(data == null || data.value == null || typeof data.value != 'object') return;

  for(key in data.value) {
    // console.log("Inspect key", key);
    // console.log("value", data.value[key]);
    if(key == "BA" && data.value[key].type == 99) {
      console.log("GOT BA", data.value[key]);
      if(data.value[key].value.length > 32) {
        cbaSerialization.setBuffer(data.value[key].value);
        try {
          console.log("DECODED", cbaSerialization.readHashtable());
        } catch(e) {

        }
      }
    } else if(key == "dt") {
      console.log("GOT DT", data.value[key]);
      var unzippedBuffer = zlib.inflateRawSync(data.value[key].value);
      cbaSerialization.setBuffer(unzippedBuffer);
      data.value[key].decoded = cbaSerialization.readDataTable();
    }

    if(typeof data.value[key] == 'object') {
      deepInspect(data.value[key]);
    }
  }
}
