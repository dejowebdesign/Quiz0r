// Utility functions to make html2canvas work with modern CSS color functions like oklab()
// that are not supported by html2canvas v1.4.1

/**
 * Clones an element and its children, preserving attributes and event listeners
 * Note: This is a shallow clone that doesn't preserve event listeners or complex state
 * For html2canvas purposes, we mainly need the DOM structure and styles
 */
export function cloneElementForHtml2canvas(element: HTMLElement): HTMLElement {
  // Create a clone of the element
  const clone = element.cloneNode(true) as HTMLElement;
  
  // Remove ids to avoid duplicate ID issues in the document
  clone.removeAttribute('id');
  
  // Recursively remove ids from children
  const removeIds = (el: Element) => {
    el.removeAttribute('id');
    el.querySelectorAll('*').forEach(child => child.removeAttribute('id'));
  };
  
  removeIds(clone);
  
  return clone;
}

/**
 * Attempts to convert an oklab() color value to an rgb() equivalent
 * This is a simplified approximation - for production use, consider a proper color conversion library
 * 
 * @param oklabValue - A string like "oklab(65% 0.1 0.2)" or "oklab(0.65 0.1 0.2)"
 * @returns An rgb() string or the original value if conversion fails
 */
export function approximateOklabToRgb(oklabValue: string): string {
  try {
    // Extract values from oklab(lightness a b) or oklab(lightness% a b)
    const match = oklabValue.match(/oklab\s*\(\s*([\d.]+)%?\s+([\d.-]+)\s+([\d.-]+)\s*\)/i);
    if (!match) return oklabValue;
    
    const [, lightnessStr, aStr, bStr] = match;
    let L = parseFloat(lightnessStr);
    const a = parseFloat(aStr);
    const b = parseFloat(bStr);
    
    // If lightness is given as a percentage, convert to decimal
    if (oklabValue.includes('%')) {
      L = L / 100;
    }
    
    // Convert oklab to linear rgb (simplified approximation)
    // This is not accurate but provides a reasonable fallback
    // For accurate conversion, you would need to implement the full oklab to rgb conversion
    // which involves converting to XYZ then to sRGB
    
    // Simple approximation: adjust lightness and shift towards the a,b values
    // This is very rough but better than nothing for a screenshot fallback
    const l = Math.max(0, Math.min(1, L));
    const r = Math.max(0, Math.min(255, l * 255 + a * 100));
    const g = Math.max(0, Math.min(255, l * 255));
    const bVal = Math.max(0, Math.min(255, l * 255 + b * 100));
    
    return `rgb(${Math.round(r)}, ${Math.round(g)}, ${Math.round(bVal)})`;
  } catch (e) {
    // If anything goes wrong, return the original value
    return oklabValue;
  }
}

/**
 * Sanitizes an element by replacing unsupported color functions in its styles
 * with approximations that html2canvas can handle
 * 
 * @param element - The element to sanitize (will be modified in place)
 */
export function sanitizeElementForHtml2canvas(element: HTMLElement): void {
  // Process the element itself
  processElementStyles(element);
  
  // Process all children
  element.querySelectorAll('*').forEach(el => {
    processElementStyles(el as HTMLElement);
  });
}

/**
 * Processes the styles of a single element, replacing unsupported color functions
 */
function processElementStyles(element: HTMLElement): void {
  // Check inline style attribute
  const styleAttr = element.getAttribute('style');
  if (styleAttr) {
    const sanitizedStyle = styleAttr.replace(/oklab\s*\([^)]*\)/gi, (match) => {
      return approximateOklabToRgb(match);
    });
    if (sanitizedStyle !== styleAttr) {
      element.setAttribute('style', sanitizedStyle);
    }
  }
  
  // Note: We cannot easily modify computed styles (from CSS classes) without 
  // changing the actual class or inline styles, which could cause visual flicker.
  // For html2canvas, inline styles take precedence, so this should cover most cases.
  // If there are issues with CSS class-based oklab colors, we might need to 
  // add those as inline styles during sanitization.
}

/**
 * Prepares an element for html2canvas by cloning it and sanitizing unsupported color values
 * 
 * @param element - The original element to capture
 * @returns A cloned and sanitized element safe to use with html2canvas
 */
export function prepareElementForHtml2canvas(element: HTMLElement): HTMLElement {
  const clone = cloneElementForHtml2canvas(element);
  sanitizeElementForHtml2canvas(clone);
  return clone;
}