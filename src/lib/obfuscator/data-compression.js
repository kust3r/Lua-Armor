function compressedDataExpression(input) {
  const alphabet = Array.from({ length: 94 }, (_, i) => String.fromCharCode(i + 33)).filter((c) => c !== '"' && c !== "\\").join("");
  const cap = alphabet.length ** 2 - 1;
  let dictionary = /* @__PURE__ */ new Map();
  const reset = () => {
    dictionary = new Map(Array.from({ length: 256 }, (_, i) => [String.fromCharCode(i), i]));
  };
  reset();
  let next = 256, word = "";
  const codes = [];
  for (const c of input) {
    if (c.charCodeAt(0) > 255) throw new Error("VM data must contain bytes");
    if (dictionary.has(word + c)) {
      word += c;
      continue;
    }
    const code = dictionary.get(word);
    if (code === void 0) throw new Error("Invalid data compression state");
    codes.push(code);
    dictionary.set(word + c, next++);
    if (next > cap) {
      reset();
      next = 256;
    }
    word = c;
  }
  if (word) {
    const code = dictionary.get(word);
    if (code === void 0) throw new Error("Invalid final code");
    codes.push(code);
  }
  const payload = codes.map((c) => alphabet[Math.floor(c / alphabet.length)] + alphabet[c % alphabet.length]).join("");
  const literal = (s) => '"' + s.replace(/\\/g, "\\\\").replace(/"/g, '\\"') + '"';
  return `(function() local a=${literal(alphabet)};local p=${literal(payload)};if #p==0 then return "" end;local lut={};for i=1,#a do lut[string.byte(a,i)]=i-1 end;local d={};for i=0,255 do d[i]=string.char(i) end;local n=256;local w;local out={};for i=1,#p,2 do local h,l=lut[string.byte(p,i)],lut[string.byte(p,i+1)];if h==nil or l==nil then error("",0) end;local code=h*#a+l;local e=d[code];if not e then if w and code==n then e=w..string.sub(w,1,1) else error("",0) end end;out[#out+1]=e;if w then d[n]=w..string.sub(e,1,1);n+=1;if n>${cap} then d={};for j=0,255 do d[j]=string.char(j) end;n=256 end end;w=e end;return table.concat(out) end)()`;
}
export {
  compressedDataExpression
};
