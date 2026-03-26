// Design token extraction script — run via browser_evaluate
// Extracts CSS custom properties, computed colors, typography, borders, and shadows
() => {
  const result = { colors: [], typography: [], borders: {}, shadows: {}, cssVariables: {} };

  // CSS custom properties from :root
  for (const sheet of document.styleSheets) {
    try {
      for (const rule of sheet.cssRules) {
        if (rule.selectorText === ':root' || rule.selectorText === ':root, :host') {
          (rule.cssText.match(/--[^:]+:\s*[^;]+/g) || []).forEach(v => {
            const [name, ...val] = v.split(':');
            result.cssVariables[name.trim()] = val.join(':').trim();
          });
        }
      }
    } catch(e) {}
  }

  // Computed styles from key elements
  const colorSet = new Set(), fontSet = new Set();
  document.querySelectorAll('h1,h2,h3,p,a,button,table,th,td,input,nav,[class]').forEach(el => {
    const s = getComputedStyle(el);
    colorSet.add(s.color); colorSet.add(s.backgroundColor);
    if (s.borderColor !== 'rgb(0, 0, 0)') colorSet.add(s.borderColor);
    fontSet.add(`${s.fontFamily}|${s.fontSize}|${s.fontWeight}|${s.lineHeight}`);
    if (s.boxShadow !== 'none') result.shadows[el.tagName + '.' + (el.className?.split?.(' ')?.[0] || '')] = s.boxShadow;
    if (s.borderRadius !== '0px') result.borders[el.tagName + '.' + (el.className?.split?.(' ')?.[0] || '')] = { radius: s.borderRadius, width: s.borderWidth, color: s.borderColor };
  });

  result.colors = [...colorSet].filter(c => c && c !== 'rgba(0, 0, 0, 0)');
  result.typography = [...fontSet].map(f => { const [family, size, weight, lineHeight] = f.split('|'); return { family, size, weight, lineHeight }; });
  return result;
}
