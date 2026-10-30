import { binaryToBytes } from "./literal-values";
const DATA_CHECK = "_lpyDataCheck";
const MOD = 16777213;
function transportChecksum(value, count) {
  let h = 1;
  const add = (n) => {
    h = (h * 31 + n) % MOD;
  };
  const visit = (v, n) => {
    if (v === null) {
      add(1);
      return;
    }
    if (typeof v === "boolean") {
      add(v ? 3 : 2);
      return;
    }
    if (typeof v === "number") {
      add(4);
      if (Number.isNaN(v)) add(1);
      else if (v === Infinity) add(2);
      else if (v === -Infinity) add(3);
      else {
        add(4);
        add(Object.is(v, -0) || v < 0 ? 1 : 0);
        let magnitude = Math.abs(v);
        let exponent = 0;
        if (magnitude) {
          while (magnitude >= 1) {
            magnitude /= 2;
            exponent++;
          }
          while (magnitude < 0.5) {
            magnitude *= 2;
            exponent--;
          }
        }
        add(exponent + 1074);
        for (let i = 0; i < 7; i++) {
          magnitude *= 256;
          const byte = Math.floor(magnitude);
          add(byte);
          magnitude -= byte;
        }
      }
      return;
    }
    if (typeof v === "string") {
      const bytes = binaryToBytes(v);
      add(5);
      add(bytes.length);
      bytes.forEach(add);
      return;
    }
    add(6);
    const size = n ?? v.length;
    add(size);
    for (let i = 0; i < size; i++) visit(v[i] ?? null);
  };
  visit(value, count);
  return h;
}
function checkedTransport(expression, value, count) {
  return `${DATA_CHECK}(${expression},${transportChecksum(value, count)}${count === void 0 ? "" : `,${count}`})`;
}
function emitTransportVerifier() {
  return `local function ${DATA_CHECK}(_v,_expected,_count) local _h=1;local function _add(_n) _h=(_h*31+_n)%16777213 end;local function _visit(_x,_n) local _t=type(_x);if _x==nil then _add(1) elseif _t=='boolean' then _add(_x and 3 or 2) elseif _t=='number' then _add(4);if _x~=_x then _add(1) elseif _x==math.huge then _add(2) elseif _x==-math.huge then _add(3) else _add(4);_add((_x<0 or _x==0 and 1/_x<0) and 1 or 0);local _m=math.abs(_x);local _e=0;if _m~=0 then while _m>=1 do _m=_m/2;_e=_e+1 end;while _m<0.5 do _m=_m*2;_e=_e-1 end end;_add(_e+1074);for _j=1,7 do _m=_m*256;local _b=math.floor(_m);_add(_b);_m=_m-_b end end elseif _t=='string' then _add(5);_add(#_x);for _i=1,#_x do _add(string.byte(_x,_i)) end elseif _t=='table' then _add(6);local _size=_n or #_x;_add(_size);for _i=1,_size do _visit(_x[_i]) end else error('E_INTEGRITY',0) end end;_visit(_v,_count);if _h~=_expected then error('E_INTEGRITY',0) end;return _v end;`;
}
export {
  DATA_CHECK,
  checkedTransport,
  emitTransportVerifier,
  transportChecksum
};
