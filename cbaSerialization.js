var biguintFormat = require('biguint-format');
var bigInteger = require('big-integer');

var buffer;
var offset = 0;

function setBuffer(buf) {
  buffer = buf;
  offset = 0;
}

function getBuffer() {
  return new Buffer(buffer.slice(0, offset).toString('hex'), 'hex');
}

var TYPEENUM = {
  2: {
    name: 'BOOL',
    read: readBool,
    write: writeBool
  },
  3: {
    name: 'BYTE',
    read: readByte,
    write: writeByte
  },
  0x62: {
    name: 'BYTEARRAY',
    read: readByteArray,
    write: writeByteArray
  },
  0x12: {
    name: 'CHAR',
    read: readChar,
    write: writeChar
  },
  0x10: {
    name: 'DATATABLE',
    read: readDataTable,
    write: writeNotYet()
  },
  14: {
    name: 'DATETIME',
    read: readDateTime,
    write: writeNotYet()
  },
  60: {
    name: 'DBNULLVALUE',
    read: readNotYet(0),
    write: writeNotYet()
  },
  11: {
    name: 'DOUBLE',
    read: readDouble,
    write: writeNotYet()
  },
  10: {
    name: 'FLOAT',
    read: readFloat,
    write: writeNotYet()
  },
  0x63: {
    name: 'HASHTABLE',
    read: readHashtable,
    write: writeHashtable
  },
  4: {
    name: 'INT16',
    read: readInt16,
    write: writeInt16
  },
  5: {
    name: 'INT32',
    read: readInt32,
    write: writeInt32
  },
  0x61: {
    name: 'INT32ARRAY',
    read: readInt32Array,
    write: writeNotYet()
  },
  6: {
    name: 'INT64',
    read: readInt64,
    write: writeNotYet()
  },
  1: {
    name: 'NULL',
    read: function() { return null;},
    write: writeNotYet()
  },
  15: {
    name: 'NULLABLEDATETIME',
    read: readInt64,
    write: writeNotYet()
  },
  13: {
    name: 'STRING32',
    read: readString32,
    write: writeString32
  },
  12: {
    name: 'STRING8',
    read: readString8,
    write: writeString8
  },
  7: {
    name: 'UINT16',
    read: readNotYet(16),
    write: writeNotYet()
  },
  8: {
    name: 'UINT32',
    read: readNotYet(32),
    write: writeNotYet()
  },
  9: {
    name: 'UINT64',
    read: readNotYet(64),
    write: writeNotYet()
  },
  0x11: {
    name: 'XMLDATATABLE',
    read: readString32,
    write: writeNotYet()
  }
}

function readHashtable() {
  var result = {}
  var str = "";
  var num = readInt16().value;

  for(var i = 0; i< num; i++){
    str = readString8().value
    var type = readByte().value;
    result[str] = TYPEENUM[type].read();
  }

  return {type: 0x63, value: result};
}

function readNotYet(off) {
  return function() {
    offset += off;
    return 'not-yet';
  }
}

function writeNotYet() {
  return function() {
  }
}

function readBool() {
  var result = buffer[offset] != 0;
  offset++;
  return {type: 2, value: result};
}

function writeBool(toWrite) {
  if(toWrite) {
    writeByte(1);
  } else {
    writeByte(0);
  }
}

function readByte() {
  var result = buffer[offset];
  offset++;
  return {type: 3, value: result};
}

function writeByte(byte) {
  buffer[offset] = byte;
  offset++;
}

function readString8() {
  return {type: 12, value: readChar().value};
}

function writeString8(toWrite) {
  writeChar(toWrite);
}

function readString32() {
  var count = readInt32().value;

  var result = new Buffer(count);
  buffer.copy(result, 0, offset, count+offset);
  offset += count;
  return {type: 13, value: result.toString()};
}

function writeString32(toWrite) {
  writeByteArray(new Buffer(toWrite));
}

function readByteArray() {
    var byteArraySize = readInt32().value;
    var result = new Buffer(byteArraySize);
    buffer.copy(result, 0, offset, byteArraySize+offset);
    offset += byteArraySize;
    return {type: 0x63, value: result};
}

function writeByteArray(array) {
    var byteArraySize = array.length;
    buffer.writeInt32LE(byteArraySize, offset);
    offset += 4;

    array.copy(buffer, offset);
    offset += byteArraySize;
}

function readChar() {
  var count = readByte().value;
  var result = new Buffer(count);
  buffer.copy(result, 0, offset, count+offset);
  offset += count;
  return {type: 0x12, value: result.toString()};
}

function writeChar(toWrite) {
  var toWriteBuffer = new Buffer(toWrite);
  writeByte(toWriteBuffer.length);
  toWriteBuffer.copy(buffer, offset);
  offset += toWriteBuffer.length;
}

function readDataTable() {
  var dataTable = [];
  var num = readInt32().value;

  for(var i=0; i<num; i++) {
    var colName = readString8().value;
    var type = readByte().value;
    dataTable.push({name: colName, type: type, row: []});
  }

  var rowN = readInt32().value;

  for(var j=0; j<rowN; j++) {
    for(var k=0; k<num; k++) {
      if(readBool().value) {
        var data = TYPEENUM[dataTable[k].type].read();
        dataTable[k].row.push({type: dataTable[k].type, value: data});
      }
    }
  }

  return dataTable;
}

function readDouble() {
  offset += 8;
  return {type: 11, value: 0.0};
}

function readFloat() {
  offset += 4;
  return {type: 10, value: 0.0};
}

function readInt16() {
  var result = buffer.readInt16LE(offset);
  offset += 2;
  return {type: 4, value: result};
}

function writeInt16(towrite) {
  buffer.writeInt16LE(towrite, offset);
  offset += 2;
}

function readInt32() {
  var result = buffer.readInt32LE(offset);
  offset += 4;
  return {type: 5, value: result};
}

function writeInt32(towrite) {
  buffer.writeInt32LE(towrite, offset);
  offset += 4;
}

function readInt64() {
  var result = new Buffer(8);
  buffer.copy(result, 0, offset, 8+offset);

  offset += 8;
  return  {type: 6, value: bigInteger(biguintFormat(result, 'dec', {format: 'LE'}))};
}

function readDateTime() {
  var dateTime = readInt64().value.divide(10000);
  var epoch = bigInteger('62135596800000'); // 01/01/1970 : http://stackoverflow.com/a/7844741
  var delta = dateTime.subtract(epoch);
  return {type: 14, value: new Date(delta.toJSNumber())};
}

function readInt32Array() {
  var size = readInt32();
  var result = [];
  for(var i = 0; i<size; i++) {
    result.push(readInt32().value);
  }
  return {type: 0x61, value: result};
}


function writeHashtable(toWrite) {
  if(Buffer.isBuffer(toWrite)) {
    toWrite.copy(buffer, offset);
    offset += toWrite.length;
    return;
  }

  var count = Object.keys(toWrite).length;
  writeInt16(count);
  for(var key in toWrite) {
    if(toWrite[key] == null || toWrite[key].value == null) {
      writeString8(key);
      writeByte(1);
    } else {
      var type = toWrite[key].type;
      writeString8(key);
      writeByte(type);
      TYPEENUM[type].write(toWrite[key].value);
    }
  }
}

module.exports = {
  readHashtable: readHashtable,
  writeHashtable: writeHashtable,
  readDataTable: readDataTable,
  getBuffer: getBuffer,
  setBuffer: setBuffer
}
