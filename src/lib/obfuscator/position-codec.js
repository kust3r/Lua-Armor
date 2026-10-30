import { checkedTransport } from "./constant-integrity";
import { quoteBytes, utf8Bytes } from "./literal-values";
import { decimalBytes } from "./name-transport";
const POSITION_ALPHABET = "!#$%&()*+,-./0369258147:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[]^abcdefghijklmnopqrstuvwxyz";
const MAX_POSITION = 85 ** 3 - 1;
const fail = () => {
  throw new Error("Invalid constant position map");
};
function triple(n) {
  return POSITION_ALPHABET[Math.floor(n / 7225)] + POSITION_ALPHABET[Math.floor(n / 85) % 85] + POSITION_ALPHABET[n % 85];
}
function encodePositions(slots, version = 2) {
  let previous = 0, output = "";
  for (let i = 0; i < slots.length; i++) {
    const slot = slots[i];
    if (!Number.isInteger(slot) || slot <= previous || slot > MAX_POSITION) fail();
    if (version === 2 && slot === previous + 1) {
      let count = 1;
      while (i + count < slots.length && slots[i + count] === slot + count && count < MAX_POSITION) count++;
      if (count > 4) {
        output += "|" + triple(count);
        previous = slot + count - 1;
        i += count - 1;
        continue;
      }
    }
    const delta = slot - previous;
    output += delta <= 85 ? POSITION_ALPHABET[delta - 1] : "~" + triple(slot);
    previous = slot;
  }
  return output;
}
function decodePositions(data, expected, maxSlot, version = 2) {
  if (!Number.isInteger(expected) || expected < 0 || expected > maxSlot || !Number.isInteger(maxSlot) || maxSlot < 0 || maxSlot > MAX_POSITION) fail();
  const slots = [];
  let slot = 0;
  const digit = (c) => {
    if (c === void 0) return fail();
    const d = POSITION_ALPHABET.indexOf(c);
    if (d < 0) fail();
    return d;
  };
  for (let cursor = 0; cursor < data.length; ) {
    const c = data[cursor++];
    let count = 1, next;
    if (c === "~" || c === "|" && version === 2) {
      const n = digit(data[cursor++]) * 7225 + digit(data[cursor++]) * 85 + digit(data[cursor++]);
      if (c === "|") {
        count = n;
        next = slot + count;
        if (count < 1) fail();
      } else next = n;
    } else next = slot + digit(c) + 1;
    if (next <= slot || next > maxSlot || slots.length + count > expected) fail();
    if (count === 1) slots.push(next);
    else for (let j = 1; j <= count; j++) slots.push(slot + j);
    slot = next;
  }
  if (slots.length !== expected) fail();
  return slots;
}
function emitPositionDecoder(data, expected, maxSlot, constants, getter, version, integrity = false) {
  const chunks = [];
  for (let i = 0; i < data.length; i += 512) chunks.push(quoteBytes(utf8Bytes(data.slice(i, i + 512))));
  return `do local _map=${integrity ? checkedTransport(`table.concat({${chunks.join(",")}})`, data) : `table.concat({${chunks.join(",")}})`};local _alphabet=${integrity ? checkedTransport(decimalBytes(POSITION_ALPHABET), POSITION_ALPHABET) : decimalBytes(POSITION_ALPHABET)};local _lut={};for _i=1,85 do _lut[string.byte(_alphabet,_i)]=_i-1 end;local function _scan(_apply) local _cursor=1;local _slot=0;local _index=0;while _cursor<=#_map do local _char=string.byte(_map,_cursor);_cursor+=1;local _count=1;local _next;if _char==126${version === 2 ? " or _char==124" : ""} then local _a,_b,_c=_lut[string.byte(_map,_cursor)],_lut[string.byte(_map,_cursor+1)],_lut[string.byte(_map,_cursor+2)];if _a==nil or _b==nil or _c==nil then error("",0) end;local _n=_a*7225+_b*85+_c;_cursor+=3;` + (version === 2 ? `if _char==124 then _count=_n;_next=_slot+_count else _next=_n end;` : `_next=_n;`) + `else local _d=_lut[_char];if _d==nil then error("",0) end;_next=_slot+_d+1 end;if _count<1 or _next<=_slot or _next>${maxSlot} or _index+_count>${expected} then error("",0) end;if _apply then if _count==1 then ${constants}[_next]=${getter}(_index+1) else for _j=1,_count do ${constants}[_slot+_j]=${getter}(_index+_j) end end end;_index+=_count;_slot=_next end;if _index~=${expected} then error("",0) end end;_scan(false);_scan(true) end;`;
}
function emitBestPositionDecoder(slots, maxSlot, constants, getter, integrity = false) {
  const alternatives = [1, 2].map((v) => emitPositionDecoder(encodePositions(slots, v), slots.length, maxSlot, constants, getter, v, integrity));
  return alternatives[1].length < alternatives[0].length ? alternatives[1] : alternatives[0];
}
export {
  MAX_POSITION,
  POSITION_ALPHABET,
  decodePositions,
  emitBestPositionDecoder,
  emitPositionDecoder,
  encodePositions
};
