"""Generates icons/16.png, icons/48.png, icons/128.png — no external deps."""
import struct, zlib, os, math

def make_png(size):
    w = h = size
    cx, cy = w / 2.0, h / 2.0

    # Geometry
    corner_r  = size * 0.20          # rounded-rect corner radius
    diamond_r = size * 0.34          # outer diamond half-span
    inner_r   = size * 0.17          # inner highlight half-span

    # BG colour  #111111
    BG   = (0x11, 0x11, 0x11, 255)
    # Outer diamond  #6366f1
    DIA  = (0x63, 0x66, 0xf1, 255)
    # Inner highlight  #a5b4fc
    HIGH = (0xa5, 0xb4, 0xfc, 255)
    CLEAR = (0, 0, 0, 0)

    def in_rounded_rect(x, y):
        r = corner_r
        if x < r and y < r:     return math.hypot(x-r, y-r) <= r
        if x > w-r and y < r:   return math.hypot(x-(w-r), y-r) <= r
        if x < r and y > h-r:   return math.hypot(x-r, y-(h-r)) <= r
        if x > w-r and y > h-r: return math.hypot(x-(w-r), y-(h-r)) <= r
        return True

    rows = []
    for y in range(h):
        row = bytearray()
        row.append(0)               # filter byte
        for x in range(w):
            dx, dy = abs(x - cx), abs(y - cy)
            if dx + dy <= inner_r:
                row.extend(HIGH)
            elif dx + dy <= diamond_r:
                row.extend(DIA)
            elif in_rounded_rect(x, y):
                row.extend(BG)
            else:
                row.extend(CLEAR)
        rows.append(bytes(row))

    raw = b''.join(rows)
    comp = zlib.compress(raw, 9)

    def chunk(tag, data):
        c = tag + data
        return struct.pack('>I', len(data)) + c + struct.pack('>I', zlib.crc32(c) & 0xffffffff)

    ihdr = struct.pack('>II', w, h) + bytes([8, 6, 0, 0, 0])   # 8-bit RGBA
    return (b'\x89PNG\r\n\x1a\n'
            + chunk(b'IHDR', ihdr)
            + chunk(b'IDAT', comp)
            + chunk(b'IEND', b''))

os.makedirs('icons', exist_ok=True)
for size in (16, 48, 128):
    path = f'icons/{size}.png'
    with open(path, 'wb') as f:
        f.write(make_png(size))
    print(f'  created {path}')

print('Done.')
