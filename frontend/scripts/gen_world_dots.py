"""Builds the dotted world map behind the site footer.

Run from `frontend/`:  python3 scripts/gen_world_dots.py

Builds public/dc-pages/world-dots.svg from coarse continent outlines.

Nothing is traced from an image: each landmass is a hand-written polygon in
lon/lat, a dot grid is sampled against them with a point-in-polygon test, and
the survivors are projected equirectangular. Coarse on purpose - this is a
background texture, so recognisable beats accurate.
"""

LAND = {
"north_america": [(-168,66),(-160,71),(-140,70),(-125,70),(-110,68),(-95,70),(-85,70),(-80,63),
                  (-64,60),(-55,52),(-60,46),(-67,45),(-70,42),(-75,35),(-81,25),(-90,29),
                  (-97,26),(-105,20),(-110,23),(-115,30),(-125,40),(-130,50),(-140,60),
                  (-150,59),(-165,62)],
"central_america": [(-105,20),(-95,15),(-85,10),(-77,7),(-80,12),(-88,16),(-96,18),(-102,20)],
"south_america": [(-80,8),(-75,11),(-60,10),(-52,5),(-50,0),(-35,-5),(-38,-15),(-48,-25),
                  (-55,-35),(-58,-40),(-65,-45),(-70,-52),(-75,-50),(-73,-40),(-71,-30),
                  (-70,-18),(-75,-5),(-79,0),(-80,5)],
"greenland": [(-45,60),(-20,62),(-18,70),(-25,80),(-45,83),(-58,80),(-55,70),(-50,62)],
"africa": [(-17,15),(-16,20),(-10,27),(0,32),(10,34),(20,32),(32,31),(35,25),(38,18),(43,12),
           (51,12),(45,5),(41,-2),(40,-10),(35,-18),(32,-25),(28,-32),(20,-35),(18,-30),
           (13,-20),(12,-10),(9,0),(5,5),(-5,5),(-12,8),(-16,12)],
"europe": [(-10,44),(-5,36),(3,42),(12,45),(18,40),(24,38),(28,41),(30,45),(35,45),(40,48),
           (45,50),(40,55),(35,60),(30,66),(28,70),(20,70),(10,63),(5,58),(0,52),(-5,50),(-8,47)],
"asia": [(30,45),(45,42),(50,38),(55,26),(60,25),(68,24),(72,20),(78,8),(80,12),(85,21),(90,22),
         (92,17),(95,10),(100,6),(105,10),(108,15),(110,20),(115,23),(120,30),(122,38),(126,42),
         (130,45),(135,50),(140,55),(145,60),(160,62),(170,65),(178,68),(175,71),(160,73),
         (140,75),(120,75),(100,77),(80,75),(70,72),(60,70),(50,68),(45,60),(40,55),(35,50)],
"india_tip": [(72,20),(76,12),(78,8),(80,12),(82,17),(78,22)],
"australia": [(113,-22),(120,-18),(130,-12),(140,-12),(145,-16),(150,-22),(153,-28),(150,-37),
              (143,-39),(135,-35),(129,-32),(120,-34),(115,-33),(113,-26)],
"japan": [(129,32),(136,34),(141,39),(146,44),(143,46),(138,38),(132,34)],
"new_zealand": [(166,-46),(170,-44),(174,-41),(178,-38),(175,-35),(171,-39),(167,-43)],
"madagascar": [(43,-12),(50,-15),(50,-25),(45,-25),(43,-19)],
"uk": [(-7,50),(-2,50),(1,53),(-1,59),(-6,58),(-7,54)],
"indonesia": [(95,5),(105,2),(115,0),(120,-2),(118,-8),(105,-7),(96,0)],
"borneo_png": [(130,-2),(142,-4),(150,-8),(145,-10),(134,-8),(129,-4)],
"philippines": [(120,6),(126,8),(126,16),(122,18),(119,13)],
"caribbean": [(-78,18),(-70,19),(-64,18),(-68,21),(-76,22)],
"sri_lanka": [(80,6),(82,7),(82,9),(80,9)],
}

def inside(x, y, poly):
    hit = False
    n = len(poly)
    for i in range(n):
        x1, y1 = poly[i]
        x2, y2 = poly[(i + 1) % n]
        if (y1 > y) != (y2 > y):
            xint = (x2 - x1) * (y - y1) / (y2 - y1) + x1
            if x < xint:
                hit = not hit
    return hit

STEP_LON, STEP_LAT = 2.0, 2.0
LON0, LON1, LAT0, LAT1 = -170.0, 180.0, -56.0, 78.0
R = 2.6          # dot radius, applied once via CSS rather than per dot
SPACING = 8      # px between dot centres; whole numbers keep every coord an integer

dots, counts = [], {}
lat = LAT1
while lat >= LAT0:
    lon = LON0
    while lon <= LON1:
        for name, poly in LAND.items():
            if inside(lon, lat, poly):
                col = (lon - LON0) / STEP_LON
                row = (LAT1 - lat) / STEP_LAT
                dots.append((int(col * SPACING + SPACING / 2), int(row * SPACING + SPACING / 2)))
                counts[name] = counts.get(name, 0) + 1
                break
        lon += STEP_LON
    lat -= STEP_LAT

W = int(((LON1 - LON0) / STEP_LON + 1) * SPACING)
H = int(((LAT1 - LAT0) / STEP_LAT + 1) * SPACING)

circles = "".join(f'<circle cx="{x}" cy="{y}"/>' for x, y in dots)
svg = (
    f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" width="{W}" height="{H}" '
    f'role="presentation" aria-hidden="true">'
    f'<style>circle{{r:{R};fill:#e11d2e}}</style>{circles}</svg>'
)

open("public/dc-pages/world-dots.svg", "w").write(svg)
print(f"{len(dots)} dots, viewBox 0 0 {W} {H}, {len(svg)} bytes")
for k in sorted(counts, key=lambda k: -counts[k]):
    print(f"  {k:18} {counts[k]}")
