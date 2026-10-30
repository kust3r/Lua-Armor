import { encodeWords } from "./word-data";
import { quoteBytes, binaryToBytes } from "./literal-values";
function encodePrototypeMetadata(entries) {
  let previous = 0;
  const words = [];
  for (const entry of entries) {
    if (!Number.isInteger(entry.position) || entry.position <= previous || entry.position > 4294967295 || new Set(entry.captures).size !== entry.captures.length || entry.captures.some((r) => !Number.isInteger(r) || r < 0 || r > 4294967295)) throw new Error("Invalid prototype metadata");
    words.push(entry.position - previous, entry.captures.length, ...entry.captures);
    previous = entry.position;
  }
  return encodeWords(words);
}
function emitPrototypeMetadata(entries) {
  if (!entries.length) throw new Error("Empty prototype metadata");
  const data = encodePrototypeMetadata(entries);
  const last = entries[entries.length - 1].position;
  return `local _prototypeMetadata={};do local _data=${quoteBytes(binaryToBytes(data))};local _cursor=1;local _position=0;local function _read() local _v=0;local _factor=1;local _width=0;while true do local _b=string.byte(_data,_cursor);_cursor+=1;_width+=1;if _b==nil or _width>5 then error("E_PROTO",0) end;_v+=(_b%128)*_factor;if _v>4294967295 then error("E_PROTO",0) end;if _b<128 then if _width>1 and _b==0 then error("E_PROTO",0) end;return _v end;_factor*=128 end end;for _i=1,${entries.length} do local _delta=_read();if _delta<1 then error("E_PROTO",0) end;_position+=_delta;if _position>${last} then error("E_PROTO",0) end;local _count=_read();if _count>#_data-_cursor+1 then error("E_PROTO",0) end;local _layout=false;if _count>0 then _layout={};for _j=1,_count do _layout[_j]=_read() end end;_prototypeMetadata[_position]=_layout end;if _cursor~=#_data+1 or _position~=${last} then error("E_PROTO",0) end end;`;
}
export {
  emitPrototypeMetadata,
  encodePrototypeMetadata
};
