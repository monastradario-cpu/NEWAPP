"""Controlla che una schermata PNG non sia vuota (solo libreria standard).
Uso: python3 tests/png_check.py schermata.png
Esce con errore se la parte centrale dello schermo è uniforme.
"""
import struct, sys, zlib

def rows(path):
    data = open(path, 'rb').read()
    assert data[:8] == b'\x89PNG\r\n\x1a\n', 'non è un PNG'
    pos, idat = 8, b''
    w = h = ctype = None
    while pos < len(data):
        ln, typ = struct.unpack('>I4s', data[pos:pos + 8])
        chunk = data[pos + 8:pos + 8 + ln]
        if typ == b'IHDR':
            w, h, depth, ctype = struct.unpack('>IIBB', chunk[:10])
        elif typ == b'IDAT':
            idat += chunk
        pos += 12 + ln
    bpp = {6: 4, 2: 3, 0: 1, 4: 2}[ctype]
    raw = zlib.decompress(idat)
    stride = 1 + w * bpp
    prev = bytearray(w * bpp)
    out = []
    for y in range(h):
        line = raw[y * stride:(y + 1) * stride]
        f, cur = line[0], bytearray(line[1:])
        for i in range(len(cur)):
            a = cur[i - bpp] if i >= bpp else 0
            b = prev[i]
            c = prev[i - bpp] if i >= bpp else 0
            if f == 1: cur[i] = (cur[i] + a) & 255
            elif f == 2: cur[i] = (cur[i] + b) & 255
            elif f == 3: cur[i] = (cur[i] + ((a + b) >> 1)) & 255
            elif f == 4:
                p = a + b - c
                pa, pb, pc = abs(p - a), abs(p - b), abs(p - c)
                cur[i] = (cur[i] + (a if pa <= pb and pa <= pc else b if pb <= pc else c)) & 255
        out.append(bytes(cur))
        prev = cur
    return w, h, bpp, out

w, h, bpp, px = rows(sys.argv[1])
colors = set()
dark = 0
for y in range(int(h * 0.12), int(h * 0.88), 4):
    r = px[y]
    for x in range(0, w, 4):
        c = r[x * bpp:x * bpp + 3]
        colors.add(c)
        if sum(c) < 200:
            dark += 1
print(f'schermata {w}x{h}: {len(colors)} colori distinti, {dark} punti scuri nella parte centrale')
if len(colors) < 12 or dark < 50:
    print('SCHERMATA VUOTA: il contenuto dell\'app non è visibile')
    sys.exit(1)
print('Schermata con contenuto visibile')
