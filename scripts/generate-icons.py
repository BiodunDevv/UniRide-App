#!/usr/bin/env python3
"""
Generate UniRide app icons and splash screen images from the SVG logo paths.
Uses Pillow to render the logo onto colored backgrounds at various sizes.

Output files:
  - assets/images/icon.png              (1024x1024 — universal app icon)
  - assets/images/favicon.png           (48x48   — web favicon)
  - assets/images/adaptive-icon.png     (1024x1024 — Android adaptive foreground)
  - assets/images/splash-icon.png       (288x288 — splash screen icon)
"""

import struct, zlib, math, os

ASSETS = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "assets", "images")

# ─── Colors ──────────────────────────────────────────────────────────────────
BG_COLOR = (4, 47, 64)        # #042F40
LOGO_COLOR = (240, 241, 243)  # #F0F1F3
GOLD = (212, 160, 23)         # #D4A017

# ─── SVG Path data (from Logo.tsx, viewBox 0 0 144 88) ──────────────────────
# We'll parse the key path segments and render them as filled polygons.

def parse_path_to_polygons(d):
    """Very simple SVG path parser - handles M, L, C, Z for our specific paths.
    Returns list of polygon point lists, approximating curves."""
    polygons = []
    current = []
    x, y = 0, 0
    start_x, start_y = 0, 0
    
    # Tokenize
    tokens = []
    i = 0
    while i < len(d):
        c = d[i]
        if c in 'MLCZmlcz':
            tokens.append(c)
            i += 1
        elif c in '0123456789.-':
            j = i
            if c == '-':
                i += 1
            while i < len(d) and (d[i] in '0123456789.' or (d[i] == 'e' and i+1 < len(d))):
                i += 1
            tokens.append(float(d[j:i]))
        else:
            i += 1
    
    idx = 0
    while idx < len(tokens):
        t = tokens[idx]
        if t == 'M':
            if current:
                polygons.append(current[:])
            x, y = tokens[idx+1], tokens[idx+2]
            start_x, start_y = x, y
            current = [(x, y)]
            idx += 3
        elif t == 'L':
            x, y = tokens[idx+1], tokens[idx+2]
            current.append((x, y))
            idx += 3
        elif t == 'C':
            # Cubic bezier - approximate with line segments
            x1, y1 = tokens[idx+1], tokens[idx+2]
            x2, y2 = tokens[idx+3], tokens[idx+4]
            ex, ey = tokens[idx+5], tokens[idx+6]
            # Subdivide the curve
            for step in range(1, 11):
                tt = step / 10.0
                u = 1 - tt
                px = u*u*u*x + 3*u*u*tt*x1 + 3*u*tt*tt*x2 + tt*tt*tt*ex
                py = u*u*u*y + 3*u*u*tt*y1 + 3*u*tt*tt*y2 + tt*tt*tt*ey
                current.append((px, py))
            x, y = ex, ey
            idx += 7
        elif t == 'Z' or t == 'z':
            current.append((start_x, start_y))
            polygons.append(current[:])
            current = []
            idx += 1
        elif isinstance(t, float):
            # Continuation of previous command - try as L
            x, y = t, tokens[idx+1]
            current.append((x, y))
            idx += 2
        else:
            idx += 1
    
    if current:
        polygons.append(current)
    return polygons


# SVG path d strings from Logo.tsx
PATH1 = "M106.08 59.0068C103.18 65.5675 98.36 71.3363 91.8446 75.3487C74.7389 85.8909 52.4411 80.3787 42.0436 63.037C36.3476 53.5388 35.4055 42.4614 38.5252 32.6535L33.0395 30.3C29.21 41.8376 30.2396 54.9456 36.9654 66.1647C49.0673 86.351 75.0194 92.7657 94.9293 80.4982C104.485 74.6099 110.909 65.4878 113.674 55.3615L106.08 59.0068Z"
PATH1B = "M54.1893 12.5513C69.7615 2.95582 89.6363 6.66748 100.919 20.4922L109.143 21.868C109.117 21.8282 109.095 21.7796 109.069 21.7398C96.9667 1.55344 71.0146 -4.86566 51.1047 7.40628C49.2119 8.56976 47.4417 9.86597 45.7986 11.2684L54.0404 12.6486C54.0886 12.6176 54.1411 12.5823 54.1893 12.5513Z"
PATH2 = "M60.8408 74.0525L144.45 33.9011L109.143 37.9711L83.3402 45.3236L60.8408 74.0525Z"
PATH3 = "M83.3403 45.3237L144.45 33.9011L0.589844 9.82178L83.3403 45.3237Z"


def fill_polygon(pixels, width, height, polygon, color):
    """Scanline fill a polygon into a pixel buffer."""
    if len(polygon) < 3:
        return
    
    # Find y bounds
    min_y = max(0, int(min(p[1] for p in polygon)))
    max_y = min(height - 1, int(max(p[1] for p in polygon)))
    
    for y in range(min_y, max_y + 1):
        # Find all x intersections
        intersections = []
        n = len(polygon)
        for i in range(n):
            j = (i + 1) % n
            y1, y2 = polygon[i][1], polygon[j][1]
            if y1 == y2:
                continue
            if y < min(y1, y2) or y >= max(y1, y2):
                continue
            x_intersect = polygon[i][0] + (y - y1) / (y2 - y1) * (polygon[j][0] - polygon[i][0])
            intersections.append(x_intersect)
        
        intersections.sort()
        
        # Fill between pairs
        for k in range(0, len(intersections) - 1, 2):
            x_start = max(0, int(intersections[k]))
            x_end = min(width - 1, int(intersections[k + 1]))
            for x in range(x_start, x_end + 1):
                idx = (y * width + x) * 4
                pixels[idx] = color[0]
                pixels[idx + 1] = color[1]
                pixels[idx + 2] = color[2]
                pixels[idx + 3] = 255


def write_png(filename, pixels, width, height):
    """Write RGBA pixel data to a PNG file."""
    def make_chunk(chunk_type, data):
        chunk = chunk_type + data
        return struct.pack('>I', len(data)) + chunk + struct.pack('>I', zlib.crc32(chunk) & 0xFFFFFFFF)
    
    header = b'\x89PNG\r\n\x1a\n'
    ihdr = struct.pack('>IIBBBBB', width, height, 8, 6, 0, 0, 0)  # 8-bit RGBA
    
    # Build raw image data with filter bytes
    raw = bytearray()
    for y in range(height):
        raw.append(0)  # No filter
        offset = y * width * 4
        raw.extend(pixels[offset:offset + width * 4])
    
    compressed = zlib.compress(bytes(raw), 9)
    
    with open(filename, 'wb') as f:
        f.write(header)
        f.write(make_chunk(b'IHDR', ihdr))
        f.write(make_chunk(b'IDAT', compressed))
        f.write(make_chunk(b'IEND', b''))


def render_logo_on_bg(size, logo_scale, bg_color, logo_color, rounded=False, padding_ratio=0.2):
    """Render the UniRide logo centered on a background."""
    width = height = size
    pixels = bytearray(width * height * 4)
    
    # Fill background
    for i in range(width * height):
        pixels[i*4] = bg_color[0]
        pixels[i*4+1] = bg_color[1]
        pixels[i*4+2] = bg_color[2]
        pixels[i*4+3] = 255
    
    if rounded:
        # Make corners transparent for rounded effect
        radius = size // 4  # iOS-style radius
        for y in range(height):
            for x in range(width):
                # Check if pixel is outside rounded rect
                in_corner = False
                if x < radius and y < radius:
                    if (x - radius)**2 + (y - radius)**2 > radius**2:
                        in_corner = True
                elif x >= width - radius and y < radius:
                    if (x - (width - radius - 1))**2 + (y - radius)**2 > radius**2:
                        in_corner = True
                elif x < radius and y >= height - radius:
                    if (x - radius)**2 + (y - (height - radius - 1))**2 > radius**2:
                        in_corner = True
                elif x >= width - radius and y >= height - radius:
                    if (x - (width - radius - 1))**2 + (y - (height - radius - 1))**2 > radius**2:
                        in_corner = True
                if in_corner:
                    pixels[(y*width+x)*4+3] = 0
    
    # Logo viewBox is 144x88. Calculate transform to center it.
    logo_w, logo_h = 144, 88
    
    usable = size * (1 - 2 * padding_ratio)
    scale = min(usable / logo_w, usable / logo_h) * logo_scale
    
    offset_x = (size - logo_w * scale) / 2
    offset_y = (size - logo_h * scale) / 2
    
    # Parse and render each path
    for path_d in [PATH1, PATH1B, PATH2, PATH3]:
        polygons = parse_path_to_polygons(path_d)
        for poly in polygons:
            # Transform to pixel coords
            scaled = [(p[0] * scale + offset_x, p[1] * scale + offset_y) for p in poly]
            fill_polygon(pixels, width, height, scaled, logo_color)
    
    return pixels


def render_splash_icon(size):
    """Render just the logo on transparent background for splash."""
    width = height = size
    pixels = bytearray(width * height * 4)  # All transparent
    
    logo_w, logo_h = 144, 88
    padding = 0.1
    usable = size * (1 - 2 * padding)
    scale = min(usable / logo_w, usable / logo_h)
    
    offset_x = (size - logo_w * scale) / 2
    offset_y = (size - logo_h * scale) / 2
    
    for path_d in [PATH1, PATH1B, PATH2, PATH3]:
        polygons = parse_path_to_polygons(path_d)
        for poly in polygons:
            scaled = [(p[0] * scale + offset_x, p[1] * scale + offset_y) for p in poly]
            fill_polygon(pixels, width, height, scaled, LOGO_COLOR)
    
    return pixels


def render_adaptive_foreground(size):
    """Android adaptive icon foreground: logo on transparent bg, with safe zone padding."""
    width = height = size
    pixels = bytearray(width * height * 4)  # All transparent
    
    logo_w, logo_h = 144, 88
    # Android adaptive icons need ~33% padding for safe zone
    padding = 0.30
    usable = size * (1 - 2 * padding)
    scale = min(usable / logo_w, usable / logo_h)
    
    offset_x = (size - logo_w * scale) / 2
    offset_y = (size - logo_h * scale) / 2
    
    for path_d in [PATH1, PATH1B, PATH2, PATH3]:
        polygons = parse_path_to_polygons(path_d)
        for poly in polygons:
            scaled = [(p[0] * scale + offset_x, p[1] * scale + offset_y) for p in poly]
            fill_polygon(pixels, width, height, scaled, LOGO_COLOR)
    
    return pixels


def render_solid_bg(size, color):
    """Solid color image for Android adaptive background."""
    pixels = bytearray(size * size * 4)
    for i in range(size * size):
        pixels[i*4] = color[0]
        pixels[i*4+1] = color[1]
        pixels[i*4+2] = color[2]
        pixels[i*4+3] = 255
    return pixels


def render_monochrome(size):
    """Monochrome icon: white logo on transparent bg."""
    return render_adaptive_foreground(size)  # Same as foreground, white on transparent


def main():
    os.makedirs(ASSETS, exist_ok=True)
    
    print("Generating UniRide app icons...")
    
    # 1. Main icon (1024x1024) - logo on dark bg
    print("  → icon.png (1024x1024)")
    pixels = render_logo_on_bg(1024, 1.0, BG_COLOR, LOGO_COLOR, rounded=False, padding_ratio=0.22)
    write_png(os.path.join(ASSETS, "icon.png"), pixels, 1024, 1024)
    
    # 2. Favicon (48x48)
    print("  → favicon.png (48x48)")
    pixels = render_logo_on_bg(48, 1.0, BG_COLOR, LOGO_COLOR, padding_ratio=0.15)
    write_png(os.path.join(ASSETS, "favicon.png"), pixels, 48, 48)
    
    # 3. Android adaptive foreground (1024x1024, logo on transparent)
    print("  → android-icon-foreground.png (1024x1024)")
    pixels = render_adaptive_foreground(1024)
    write_png(os.path.join(ASSETS, "android-icon-foreground.png"), pixels, 1024, 1024)
    
    # 4. Android adaptive background (1024x1024, solid color)
    print("  → android-icon-background.png (1024x1024)")
    pixels = render_solid_bg(1024, BG_COLOR)
    write_png(os.path.join(ASSETS, "android-icon-background.png"), pixels, 1024, 1024)
    
    # 5. Android monochrome (1024x1024)
    print("  → android-icon-monochrome.png (1024x1024)")
    pixels = render_monochrome(1024)
    write_png(os.path.join(ASSETS, "android-icon-monochrome.png"), pixels, 1024, 1024)
    
    # 6. Splash icon (288x288, logo on transparent)
    print("  → splash-icon.png (288x288)")
    pixels = render_splash_icon(288)
    write_png(os.path.join(ASSETS, "splash-icon.png"), pixels, 288, 288)
    
    print("\n✅ All icons generated in assets/images/")
    print("   Run 'npx expo prebuild --clean' to apply changes.")


if __name__ == "__main__":
    main()
