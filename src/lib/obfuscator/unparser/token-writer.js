class TokenWriter {
  tokens = [];
  lastChar = "";
  indent = 0;
  atLineStart = true;
  compact = false;
  needSep(next) {
    if (!this.lastChar) return false;
    const p = this.lastChar, n = next[0] || "";
    if (p === "-" && n === "-") return true;
    if (/[A-Za-z0-9_]/.test(p) && /[A-Za-z0-9_]/.test(n)) return true;
    if (/\d/.test(p) && n === ".") return true;
    if (p === "." && /\d/.test(n)) return true;
    if (p === "." && n === ".") return true;
    if (p === ">" && n === ">") return true;
    if (p === "<" && n === "<") return true;
    if ("=~<>:/.".includes(p) && n === "=") return true;
    if (p === "/" && n === "/") return true;
    if (p === "[" && n === "[") return true;
    return false;
  }
  write(tok) {
    if (!tok) return this;
    if (!this.compact && this.atLineStart && tok !== "\n") {
      this.tokens.push("  ".repeat(this.indent));
      this.atLineStart = false;
    }
    if (this.needSep(tok)) this.tokens.push(" ");
    this.tokens.push(tok);
    this.lastChar = tok[tok.length - 1];
    if (tok.endsWith("\n")) this.atLineStart = true;
    return this;
  }
  space() {
    if (!this.compact) {
      this.tokens.push(" ");
      this.lastChar = " ";
    } else if (this.needSep(" ")) this.tokens.push(" ");
    return this;
  }
  newline() {
    if (!this.compact) {
      this.tokens.push("\n");
      this.atLineStart = true;
      this.lastChar = "";
    }
    return this;
  }
  semi() {
    if (this.compact) this.write(";");
    return this;
  }
  pushIndent() {
    this.indent++;
    return this;
  }
  popIndent() {
    this.indent = Math.max(0, this.indent - 1);
    return this;
  }
  toString() {
    return this.tokens.join("");
  }
}
export {
  TokenWriter
};
