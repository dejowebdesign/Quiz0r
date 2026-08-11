/**
 * Postinstall script to patch html2canvas for Tailwind CSS 4 compatibility.
 * 
 * Tailwind CSS 4 generates CSS with lab() and oklab() color functions,
 * which html2canvas 1.4.1 doesn't support by default.
 * 
 * This script patches the html2canvas source to add lab/oklab support.
 */

const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'node_modules', 'html2canvas', 'dist', 'html2canvas.js');

try {
  let content = fs.readFileSync(filePath, 'utf8');

  // Check if already patched
  if (content.includes('labRgbFunc')) {
    console.log('[patch-html2canvas] Already patched, skipping');
    process.exit(0);
  }

  // Find the SUPPORTED_COLOR_FUNCTIONS definition
  const regex = /var SUPPORTED_COLOR_FUNCTIONS = \{[^}]+\}/;
  const match = content.match(regex);

  if (!match) {
    console.error('[patch-html2canvas] ERROR: Could not find SUPPORTED_COLOR_FUNCTIONS');
    process.exit(1);
  }

  // LAB to RGB conversion function
  const labFunc = `var labRgbFunc = function(context, args) {
    var tokens = args.filter(nonFunctionArgSeparator);
    var L = tokens[0], a = tokens[1], b = tokens[2], alpha = tokens[3];
    var l = isLengthPercentage(L) ? L.number / 100 * 100 : 0;
    var aa = isLengthPercentage(a) ? a.number : (a && a.number ? a.number : 0);
    var bb = isLengthPercentage(b) ? b.number : (b && b.number ? b.number : 0);
    var al = typeof alpha !== 'undefined' && isLengthPercentage(alpha) ? alpha.number : 1;
    var y = (l + 16) / 116;
    var x = aa / 500 + y;
    var z = y - bb / 200;
    var f = function(t) { return t > 0.206893 ? t * t * t : (t - 16 / 116) / 7.787; };
    x = f(x) * 0.95047; y = f(y) * 1.0; z = f(z) * 1.08883;
    var r = x * 3.2406 + y * -1.5372 + z * -0.4986;
    var g = x * -0.9689 + y * 1.8758 + z * 0.0415;
    var bv = x * 0.0557 + y * -0.204 + z * 1.057;
    var gc = function(v) { return v > 0.0031308 ? 1.055 * Math.pow(v, 1/2.4) - 0.055 : 12.92 * v; };
    return pack(Math.round(Math.max(0, Math.min(1, gc(r))) * 255), Math.round(Math.max(0, Math.min(1, gc(g))) * 255), Math.round(Math.max(0, Math.min(1, gc(bv))) * 255), al);
  };`;

  // OKLAB to RGB conversion function
  const oklabFunc = `var oklabRgbFunc = function(context, args) {
    var tokens = args.filter(nonFunctionArgSeparator);
    var L = tokens[0], a = tokens[1], b = tokens[2], alpha = tokens[3];
    var l = isLengthPercentage(L) ? L.number / 100 * 100 : 0;
    var aa = isLengthPercentage(a) ? a.number : (a && a.number ? a.number : 0);
    var bb = isLengthPercentage(b) ? b.number : (b && b.number ? b.number : 0);
    var al = typeof alpha !== 'undefined' && isLengthPercentage(alpha) ? alpha.number : 1;
    var l_ = l + 0.3963377774 * aa + 0.2158037573 * bb;
    var m_ = l - 0.1055613458 * aa - 0.0638541728 * bb;
    var s_ = l - 0.0894841775 * aa - 1.291485548 * bb;
    var lD = l_ * l_ * l_, mD = m_ * m_ * m_, sD = s_ * s_ * s_;
    var r = 4.0767416621 * lD - 3.3077115913 * mD + 0.2309699292 * sD;
    var g = -1.2684380046 * lD + 2.6097574011 * mD - 0.3413193965 * sD;
    var bv = -0.0041960863 * lD - 0.7034186147 * mD + 1.707614701 * sD;
    var gc = function(v) { return v > 0.0031308 ? 1.055 * Math.pow(v, 1/2.4) - 0.055 : 12.92 * v; };
    return pack(Math.round(Math.max(0, Math.min(1, gc(r))) * 255), Math.round(Math.max(0, Math.min(1, gc(g))) * 255), Math.round(Math.max(0, Math.min(1, gc(bv))) * 255), al);
  };`;

  // Updated SUPPORTED_COLOR_FUNCTIONS
  const newSupported = `var SUPPORTED_COLOR_FUNCTIONS = {
        hsl: hsl,
        hsla: hsl,
        rgb: rgb,
        rgba: rgb,
        lab: labRgbFunc,
        oklab: oklabRgbFunc
    };`;

  const patch = labFunc + oklabFunc + newSupported;
  content = content.replace(match[0], patch);
  fs.writeFileSync(filePath, content);
  console.log('[patch-html2canvas] Successfully patched html2canvas for lab/oklab support');
} catch (err) {
  console.error('[patch-html2canvas] Error:', err.message);
  // Don't fail the install, just warn
  console.warn('[patch-html2canvas] Warning: Could not patch html2canvas. html2canvas features may not work with Tailwind CSS 4.');
  process.exit(0);
}
