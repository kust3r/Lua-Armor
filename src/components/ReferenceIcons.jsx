const defaults = { viewBox: "0 0 32 32", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true };
function ObfuscationIcon(props) {
  return <svg {...defaults} {...props}><circle cx="16" cy="16" r="14" /><circle cx="15" cy="15" r="4.6" /><path d="m18.5 11.5 5-5M19.6 15v7c0 3-2.5 4-6.6 3M12 23h6" /></svg>;
}
function ExitIcon(props) {
  return <svg {...defaults} strokeWidth={2.8} {...props}><path d="M10 6H6a3 3 0 0 0-3 3v14a3 3 0 0 0 3 3h4M12 16h17M21 7l9 9-9 9" /></svg>;
}
function ThemeSun(props) {
  return <svg {...defaults} {...props}><circle cx="16" cy="16" r="9" /><path d="M16 1v2M16 29v2M1 16h2M29 16h2M5.4 5.4l1.5 1.5M25.1 25.1l1.5 1.5M5.4 26.6l1.5-1.5M25.1 6.9l1.5-1.5" /></svg>;
}
function FileDownloadIcon(props) {
  return <svg viewBox="0 0 32 32" fill="currentColor" aria-hidden="true" {...props}><path d="M7 2h12l7 7v21H7z" /><path className="obf-file-cutout" d="M19 2v8h7M15 13h4v7h4l-6 6-6-6h4z" /></svg>;
}
function PanelTexture() {
  return <svg className="obf-texture" viewBox="0 0 1200 500" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><defs><pattern id="obf-particles" width="46" height="42" patternUnits="userSpaceOnUse"><circle cx="5" cy="8" r="1" /><circle cx="31" cy="29" r=".7" /></pattern></defs><rect width="1200" height="500" fill="url(#obf-particles)" opacity=".3" />{Array.from({ length: 18 }, (_, row) => Array.from({ length: 70 }, (_2, col) => {
    const x = col * 19 - 60;
    const y = 265 + row * 9 + Math.sin(col / 10 + row / 30) * 65;
    return <circle key={`${row}-${col}`} cx={x} cy={y} r={0.8 + row / 24} opacity={0.16 + row / 38} />;
  }))}</svg>;
}
export {
  ExitIcon,
  FileDownloadIcon,
  ObfuscationIcon,
  PanelTexture,
  ThemeSun
};
