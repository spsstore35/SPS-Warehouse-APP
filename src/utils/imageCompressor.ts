/**
 * Utilities for client-side image compression from mobile cameras and file galleries
 * Keeps base64 payloads lightweight (~30-60KB) for seamless localStorage persistence.
 */

export async function compressImage(
  file: File,
  maxWidth = 800,
  maxHeight = 800,
  quality = 0.82
): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(event.target?.result as string);
          return;
        }

        // Clean white background for transparent PNG inputs
        ctx.fillStyle = '#1e293b';
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);

        const dataUrl = canvas.toDataURL('image/jpeg', quality);
        resolve(dataUrl);
      };
      img.onerror = (err) => reject(err);
      img.src = event.target?.result as string;
    };
    reader.onerror = (err) => reject(err);
    reader.readAsDataURL(file);
  });
}

/**
 * Returns a high-fidelity studio apparel mockup data URI
 * Rendered on clean minimal studio surfaces with realistic seams, folds, and details.
 */
export function getApparelCategoryFallback(
  category: string,
  garmentColor = '#18181b',
  garmentName = 'Apparel'
): string {
  const bgSurface = '#f1f3f5';
  const shadowColor = 'rgba(15, 23, 42, 0.08)';

  let garmentSvg = '';

  if (category.includes('Hoodie')) {
    // Realistic oversized hoodie with double hood, kangaroo pocket, drop shoulders, and cuffs
    garmentSvg = `
      <!-- Drop shadow -->
      <path d="M70 70 L200 45 L330 70 L380 180 L320 200 L300 150 L300 340 L100 340 L100 150 L80 200 L20 180 Z" fill="${shadowColor}" transform="translate(4, 10)" filter="blur(8px)"/>
      <!-- Body and Sleeves -->
      <path d="M70 70 L200 45 L330 70 L380 170 L325 190 L300 145 L300 335 L100 335 L100 145 L75 190 L20 170 Z" fill="${garmentColor}"/>
      <!-- Shading & Texture -->
      <path d="M100 145 L100 335 L120 335 L120 150 Z" fill="#000" fill-opacity="0.12"/>
      <path d="M300 145 L300 335 L280 335 L280 150 Z" fill="#000" fill-opacity="0.12"/>
      <!-- Kangaroo Pocket -->
      <path d="M130 230 L270 230 L255 315 L145 315 Z" fill="${garmentColor}" stroke="rgba(255,255,255,0.18)" stroke-width="2"/>
      <path d="M130 230 L150 270 L145 315" fill="none" stroke="rgba(0,0,0,0.25)" stroke-width="2"/>
      <path d="M270 230 L250 270 L255 315" fill="none" stroke="rgba(0,0,0,0.25)" stroke-width="2"/>
      <!-- Hood -->
      <path d="M140 60 C140 20 260 20 260 60 C250 100 150 100 140 60 Z" fill="${garmentColor}" stroke="rgba(0,0,0,0.2)" stroke-width="3"/>
      <path d="M165 65 C165 42 235 42 235 65 C225 88 175 88 165 65 Z" fill="#0f172a" fill-opacity="0.22"/>
      <!-- Ribbed Waist Hem -->
      <rect x="100" y="325" width="200" height="15" fill="${garmentColor}" stroke="rgba(0,0,0,0.2)" stroke-width="1.5"/>
    `;
  } else if (category.includes('Pants') || category.includes('Jeans')) {
    // Realistic folded selvedge denim jeans / sweatpants with belt loops, coin pocket, and crease
    garmentSvg = `
      <!-- Shadow -->
      <path d="M110 50 L290 50 L300 340 L215 340 L200 170 L185 340 L100 340 Z" fill="${shadowColor}" transform="translate(4, 10)" filter="blur(8px)"/>
      <!-- Denim Body -->
      <path d="M110 50 L290 50 L300 340 L215 340 L200 170 L185 340 L100 340 Z" fill="${garmentColor}"/>
      <!-- Waistband -->
      <rect x="110" y="50" width="180" height="26" fill="${garmentColor}" stroke="rgba(255,255,255,0.2)" stroke-width="2"/>
      <!-- Fly stitch & rivet -->
      <path d="M200 76 L200 135 C190 150 180 150 170 140" fill="none" stroke="#d97706" stroke-width="2" stroke-dasharray="3,2"/>
      <circle cx="200" cy="63" r="4" fill="#cbd5e1" stroke="#475569" stroke-width="1"/>
      <!-- Pockets -->
      <path d="M115 76 C135 76 150 95 150 120" fill="none" stroke="#d97706" stroke-width="2"/>
      <path d="M285 76 C265 76 250 95 250 120" fill="none" stroke="#d97706" stroke-width="2"/>
      <!-- Inner seam & Selvedge cuffs -->
      <path d="M200 170 L185 340" stroke="rgba(0,0,0,0.3)" stroke-width="2"/>
      <path d="M200 170 L215 340" stroke="rgba(0,0,0,0.3)" stroke-width="2"/>
      <rect x="100" y="328" width="85" height="12" fill="${garmentColor}" stroke="#d97706" stroke-width="1.5"/>
      <rect x="215" y="328" width="85" height="12" fill="${garmentColor}" stroke="#d97706" stroke-width="1.5"/>
    `;
  } else if (category.includes('Jacket')) {
    // Realistic utility bomber jacket with brass zipper, ribbed collar, and sleeve pocket
    garmentSvg = `
      <!-- Shadow -->
      <path d="M90 65 L200 45 L310 65 L370 180 L315 200 L295 155 L295 330 L105 330 L105 155 L85 200 L30 180 Z" fill="${shadowColor}" transform="translate(4, 10)" filter="blur(8px)"/>
      <!-- Jacket Body -->
      <path d="M90 65 L200 45 L310 65 L370 180 L315 200 L295 155 L295 330 L105 330 L105 155 L85 200 L30 180 Z" fill="${garmentColor}"/>
      <!-- Metal Center Zipper -->
      <line x1="200" y1="58" x2="200" y2="330" stroke="#f59e0b" stroke-width="3.5" stroke-dasharray="4,2"/>
      <polygon points="196,80 204,80 202,95 198,95" fill="#f59e0b"/>
      <!-- Ribbed collar -->
      <path d="M150 55 C165 42 235 42 250 55 C235 68 165 68 150 55 Z" fill="#0f172a" stroke="rgba(255,255,255,0.15)" stroke-width="1.5"/>
      <!-- Utility arm pocket -->
      <rect x="42" y="140" width="30" height="38" rx="4" fill="${garmentColor}" stroke="rgba(255,255,255,0.25)" stroke-width="1.5"/>
      <line x1="57" y1="140" x2="57" y2="178" stroke="#f59e0b" stroke-width="2"/>
      <rect x="40" y="165" width="6" height="22" fill="#ef4444" rx="2"/>
      <!-- Flap pockets -->
      <rect x="120" y="240" width="55" height="40" rx="3" fill="${garmentColor}" stroke="rgba(0,0,0,0.3)" stroke-width="1.5"/>
      <rect x="225" y="240" width="55" height="40" rx="3" fill="${garmentColor}" stroke="rgba(0,0,0,0.3)" stroke-width="1.5"/>
    `;
  } else {
    // Drop-shoulder heavy boxy t-shirt with ribbed neck and sleeve roll
    garmentSvg = `
      <!-- Shadow -->
      <path d="M100 65 L200 45 L300 65 L385 140 L330 185 L285 150 L285 335 L115 335 L115 150 L70 185 L15 140 Z" fill="${shadowColor}" transform="translate(4, 10)" filter="blur(8px)"/>
      <!-- T-Shirt Body -->
      <path d="M100 65 L200 45 L300 65 L385 140 L330 185 L285 150 L285 335 L115 335 L115 150 L70 185 L15 140 Z" fill="${garmentColor}"/>
      <!-- Ribbed Crew Neck -->
      <path d="M160 52 C170 78 230 78 240 52 C230 46 170 46 160 52 Z" fill="${garmentColor}" stroke="rgba(0,0,0,0.25)" stroke-width="2.5"/>
      <path d="M172 56 C180 70 220 70 228 56" fill="none" stroke="rgba(0,0,0,0.18)" stroke-width="1.5"/>
      <!-- Fold creases -->
      <path d="M130 155 Q 200 170 270 155" fill="none" stroke="rgba(0,0,0,0.1)" stroke-width="2"/>
      <path d="M140 240 Q 200 255 260 240" fill="none" stroke="rgba(0,0,0,0.08)" stroke-width="2"/>
      <!-- Hem lines -->
      <line x1="115" y1="326" x2="285" y2="326" stroke="rgba(0,0,0,0.15)" stroke-width="1.5" stroke-dasharray="4,2"/>
    `;
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 370" width="400" height="370" fill="none">
    <!-- Studio backdrop -->
    <rect width="400" height="370" fill="${bgSurface}" />
    <radialGradient id="studioLighting" cx="50%" cy="30%" r="70%">
      <stop offset="0%" stop-color="#ffffff" stop-opacity="0.9" />
      <stop offset="100%" stop-color="${bgSurface}" stop-opacity="1" />
    </radialGradient>
    <rect width="400" height="370" fill="url(#studioLighting)" />
    
    <!-- Garment vector art -->
    ${garmentSvg}

    <!-- Clean Studio Tag in corner -->
    <text x="20" y="352" font-family="'Plus Jakarta Sans', system-ui, sans-serif" font-size="11" font-weight="700" fill="#64748b" letter-spacing="1.5">${category.toUpperCase()}</text>
  </svg>`;

  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

