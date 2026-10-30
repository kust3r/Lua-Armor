const MAGIC_BYTES = {
  lua51: [27, 76, 117, 97, 81],
  // \x1BLuaQ
  lua52: [27, 76, 117, 97, 82],
  // \x1BLuaR
  lua53: [27, 76, 117, 97, 83],
  // \x1BLuaS
  lua54: [27, 76, 117, 97, 84],
  // \x1BLuaT
  luajit: [27, 76, 74],
  // \x1BLJ
  luau: [0]
  // Luau uses version 0 + specific format
};
class BinaryReader {
  view;
  offset = 0;
  littleEndian = true;
  constructor(buffer, littleEndian = true) {
    this.view = new DataView(buffer);
    this.littleEndian = littleEndian;
  }
  get position() {
    return this.offset;
  }
  get remaining() {
    return this.view.byteLength - this.offset;
  }
  readByte() {
    return this.view.getUint8(this.offset++);
  }
  readBytes(n) {
    const result = [];
    for (let i = 0; i < n; i++) result.push(this.readByte());
    return result;
  }
  readInt32() {
    const v = this.view.getInt32(this.offset, this.littleEndian);
    this.offset += 4;
    return v;
  }
  readUint32() {
    const v = this.view.getUint32(this.offset, this.littleEndian);
    this.offset += 4;
    return v;
  }
  readFloat64() {
    const v = this.view.getFloat64(this.offset, this.littleEndian);
    this.offset += 8;
    return v;
  }
  readString() {
    const len = this.readInt32();
    if (len === 0) return "";
    const bytes = this.readBytes(len);
    const end = bytes[bytes.length - 1] === 0 ? bytes.length - 1 : bytes.length;
    return String.fromCharCode(...bytes.slice(0, end));
  }
  readVarInt() {
    let result = 0;
    let shift = 0;
    let byte;
    do {
      byte = this.readByte();
      result |= (byte & 127) << shift;
      shift += 7;
    } while (byte & 128);
    return result;
  }
}
class BinaryWriter {
  buffer = [];
  littleEndian = true;
  constructor(littleEndian = true) {
    this.littleEndian = littleEndian;
  }
  writeByte(v) {
    this.buffer.push(v & 255);
  }
  writeBytes(bytes) {
    for (const b of bytes) this.writeByte(b);
  }
  writeInt32(v) {
    const buf = new ArrayBuffer(4);
    new DataView(buf).setInt32(0, v, this.littleEndian);
    const arr = new Uint8Array(buf);
    for (let i = 0; i < 4; i++) this.buffer.push(arr[i]);
  }
  writeUint32(v) {
    const buf = new ArrayBuffer(4);
    new DataView(buf).setUint32(0, v, this.littleEndian);
    const arr = new Uint8Array(buf);
    for (let i = 0; i < 4; i++) this.buffer.push(arr[i]);
  }
  writeFloat64(v) {
    const buf = new ArrayBuffer(8);
    new DataView(buf).setFloat64(0, v, this.littleEndian);
    const arr = new Uint8Array(buf);
    for (let i = 0; i < 8; i++) this.buffer.push(arr[i]);
  }
  writeString(s) {
    this.writeInt32(s.length + 1);
    for (let i = 0; i < s.length; i++) this.writeByte(s.charCodeAt(i));
    this.writeByte(0);
  }
  toUint8Array() {
    return new Uint8Array(this.buffer);
  }
}
function detectVersion(data) {
  if (data.length < 4) return null;
  if (data[0] !== 27) return null;
  if (data[1] === 76 && data[2] === 74) return "luajit";
  if (data[1] === 76 && data[2] === 117 && data[3] === 97) {
    const ver = data[4];
    if (ver === 81) return "lua51";
    if (ver === 82) return "lua52";
    if (ver === 83) return "lua53";
    if (ver === 84) return "lua54";
  }
  if (data[0] === 0) return "luau";
  return null;
}
function decodeLua51Instruction(raw) {
  const opcode = raw & 63;
  const a = raw >> 6 & 255;
  const b = raw >> 23 & 511;
  const c = raw >> 14 & 511;
  const bx = raw >> 14 & 262143;
  const sbx = bx - 131071;
  return { opcode, a, b, c, bx, sbx };
}
function encodeLua51Instruction(instr) {
  return instr.opcode & 63 | (instr.a & 255) << 6 | (instr.b & 511) << 23 | (instr.c & 511) << 14;
}
function serializeHeader(header) {
  const w = new BinaryWriter(header.endianness === "little");
  const magic = MAGIC_BYTES[header.version] || MAGIC_BYTES.lua51;
  w.writeBytes(magic);
  w.writeByte(header.format);
  w.writeByte(header.endianness === "little" ? 1 : 0);
  w.writeByte(header.intSize);
  w.writeByte(header.sizeT);
  w.writeByte(header.instructionSize);
  w.writeByte(header.numberSize);
  w.writeByte(header.integralFlag ? 1 : 0);
  return w.toUint8Array();
}
function defaultHeader(version = "lua51") {
  return {
    version,
    format: 0,
    endianness: "little",
    intSize: 4,
    sizeT: 4,
    instructionSize: 4,
    numberSize: 8,
    integralFlag: false
  };
}
function serializePrototype(proto, header) {
  const w = new BinaryWriter(header.endianness === "little");
  w.writeString(proto.source);
  w.writeInt32(proto.lineDefined);
  w.writeInt32(proto.lastLineDefined);
  w.writeByte(proto.numUpvalues);
  w.writeByte(proto.numParams);
  w.writeByte(proto.isVararg ? 2 : 0);
  w.writeByte(proto.maxStackSize);
  w.writeInt32(proto.instructions.length);
  for (const instr of proto.instructions) {
    w.writeUint32(encodeLua51Instruction(instr));
  }
  w.writeInt32(proto.constants.length);
  for (const k of proto.constants) {
    switch (k.type) {
      case "nil":
        w.writeByte(0);
        break;
      case "boolean":
        w.writeByte(1);
        w.writeByte(k.value ? 1 : 0);
        break;
      case "number":
        w.writeByte(3);
        w.writeFloat64(k.value);
        break;
      case "string":
        w.writeByte(4);
        w.writeString(k.value);
        break;
    }
  }
  w.writeInt32(proto.protos.length);
  for (const sub of proto.protos) {
    const subBytes = serializePrototype(sub, header);
    w.writeBytes(Array.from(subBytes));
  }
  w.writeInt32(proto.lineInfo.length);
  for (const line of proto.lineInfo) w.writeInt32(line);
  w.writeInt32(0);
  w.writeInt32(0);
  return w.toUint8Array();
}
function serializeChunk(chunk) {
  const headerBytes = serializeHeader(chunk.header);
  const protoBytes = serializePrototype(chunk.mainProto, chunk.header);
  const result = new Uint8Array(headerBytes.length + protoBytes.length);
  result.set(headerBytes);
  result.set(protoBytes, headerBytes.length);
  return result;
}
function deserializePrototype51(reader) {
  const source = reader.readString();
  const lineDefined = reader.readInt32();
  const lastLineDefined = reader.readInt32();
  const numUpvalues = reader.readByte();
  const numParams = reader.readByte();
  const isVararg = reader.readByte() !== 0;
  const maxStackSize = reader.readByte();
  const numInstr = reader.readInt32();
  const instructions = [];
  for (let i = 0; i < numInstr; i++) {
    instructions.push(decodeLua51Instruction(reader.readUint32()));
  }
  const numConstants = reader.readInt32();
  const constants = [];
  for (let i = 0; i < numConstants; i++) {
    const type = reader.readByte();
    switch (type) {
      case 0:
        constants.push({ type: "nil", value: null });
        break;
      case 1:
        constants.push({ type: "boolean", value: reader.readByte() !== 0 });
        break;
      case 3:
        constants.push({ type: "number", value: reader.readFloat64() });
        break;
      case 4:
        constants.push({ type: "string", value: reader.readString() });
        break;
      default:
        constants.push({ type: "nil", value: null });
        break;
    }
  }
  const numProtos = reader.readInt32();
  const protos = [];
  for (let i = 0; i < numProtos; i++) {
    protos.push(deserializePrototype51(reader));
  }
  const numLines = reader.readInt32();
  const lineInfo = [];
  for (let i = 0; i < numLines; i++) lineInfo.push(reader.readInt32());
  const numLocals = reader.readInt32();
  for (let i = 0; i < numLocals; i++) {
    reader.readString();
    reader.readInt32();
    reader.readInt32();
  }
  const numUpvalueNames = reader.readInt32();
  for (let i = 0; i < numUpvalueNames; i++) reader.readString();
  return {
    source,
    lineDefined,
    lastLineDefined,
    numUpvalues,
    numParams,
    isVararg,
    maxStackSize,
    instructions,
    constants,
    protos,
    lineInfo,
    upvalueInfo: []
  };
}
function deserializeChunk(data) {
  const reader = new BinaryReader(data.buffer);
  const magic = reader.readBytes(4);
  if (magic[0] !== 27 || magic[1] !== 76 || magic[2] !== 117 || magic[3] !== 97) {
    throw new Error("Invalid Lua bytecode header");
  }
  const versionByte = reader.readByte();
  let version = "lua51";
  if (versionByte === 82) version = "lua52";
  else if (versionByte === 83) version = "lua53";
  else if (versionByte === 84) version = "lua54";
  const format = reader.readByte();
  const endianness = reader.readByte() === 1 ? "little" : "big";
  const intSize = reader.readByte();
  const sizeT = reader.readByte();
  const instructionSize = reader.readByte();
  const numberSize = reader.readByte();
  const integralFlag = reader.readByte() !== 0;
  const header = {
    version,
    format,
    endianness,
    intSize,
    sizeT,
    instructionSize,
    numberSize,
    integralFlag
  };
  const mainProto = deserializePrototype51(reader);
  return { header, mainProto };
}
export {
  MAGIC_BYTES,
  defaultHeader,
  deserializeChunk,
  detectVersion,
  serializeChunk,
  serializeHeader,
  serializePrototype
};
