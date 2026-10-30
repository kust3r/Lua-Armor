function byteStringAccumulator(result) {
  return {
    setup: `local ${result}='';local _stringParts={};local _stringPart='';local _stringPartSize=0;`,
    append: (expression) => `_stringPart=_stringPart..${expression};_stringPartSize+=1;if _stringPartSize==128 then _stringParts[#_stringParts+1]=_stringPart;_stringPart='';_stringPartSize=0 end;`,
    finish: `_stringParts[#_stringParts+1]=_stringPart;${result}=table.concat(_stringParts);`
  };
}
export {
  byteStringAccumulator
};
