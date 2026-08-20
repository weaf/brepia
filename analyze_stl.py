# Analyze STL for hollow box geometry
import re
import sys

if len(sys.argv) < 2:
    print("Usage: python3 analyze_stl.py <file.stl>")
    sys.exit(1)

with open(sys.argv[1], 'r') as f:
    content = f.read()

vertices = []
for match in re.finditer(r'vertex\s+([\d.e+-]+)\s+([\d.e+-]+)\s+([\d.e+-]+)', content):
    vertices.append((float(match.group(1)), float(match.group(2)), float(match.group(3))))

if not vertices:
    print("No vertices found!")
    sys.exit(1)

xs = [v[0] for v in vertices]
ys = [v[1] for v in vertices]
zs = [v[2] for v in vertices]
num_triangles = content.count('facet normal')

print(f'Total triangles: {num_triangles}')
print(f'Total vertices: {len(vertices)}')
print()
print('=== Bounding Box ===')
print(f'  X: {min(xs):.3f} to {max(xs):.3f}  (width:  {max(xs)-min(xs):.3f})')
print(f'  Y: {min(ys):.3f} to {max(ys):.3f}  (depth:  {max(ys)-min(ys):.3f})')
print(f'  Z: {min(zs):.3f} to {max(zs):.3f}  (height: {max(zs)-min(zs):.3f})')
print()

# Wall thickness analysis: check where inner wall vertices are
# For a correct hollow box with 2mm walls:
# - Outer walls should be at x=0 and x=100
# - Inner walls should be at x=2 and x=98
# - Same for y=0 and y=60 / y=2 and y=58

# Find vertices clustered near expected wall positions
print('=== Wall Position Analysis ===')
print('X-axis vertex distribution:')
x_bins = {}
for x in xs:
    bin_key = round(x / 2) * 2
    x_bins[bin_key] = x_bins.get(bin_key, 0) + 1

for bx in sorted(x_bins.keys()):
    bar = '█' * (x_bins[bx] // 10)
    label = ''
    if 1 < bx < 3: label = ' <-- inner wall (x=2)'
    if 97 < bx < 99: label = ' <-- inner wall (x=98)'
    if bx < 1: label = ' <-- outer wall (x=0)'
    if bx > 99: label = ' <-- outer wall (x=100)'
    print(f'  X {bx:5.1f}: {x_bins[bx]:5d} {bar}{label}')

print()
print('Y-axis vertex distribution:')
y_bins = {}
for y in ys:
    bin_key = round(y / 2) * 2
    y_bins[bin_key] = y_bins.get(bin_key, 0) + 1

for by in sorted(y_bins.keys()):
    bar = '█' * (y_bins[by] // 10)
    label = ''
    if 1 < by < 3: label = ' <-- inner wall (y=2)'
    if 57 < by < 59: label = ' <-- inner wall (y=58)'
    if by < 1: label = ' <-- outer wall (y=0)'
    if by > 59: label = ' <-- outer wall (y=60)'
    print(f'  Y {by:5.1f}: {y_bins[by]:5d} {bar}{label}')

print()

# Count vertices at different Z levels
print('=== Z Distribution ===')
z_bins = {}
for z in zs:
    bin_key = round(z)
    z_bins[bin_key] = z_bins.get(bin_key, 0) + 1

for bz in sorted(z_bins.keys()):
    bar = '█' * (z_bins[bz] // 10)
    label = ''
    if bz == 0: label = ' <-- bottom plate'
    elif bz == 30: label = ' <-- top opening'
    elif 1 <= bz <= 29: label = ' <-- walls'
    print(f'  Z {bz:3d}: {z_bins[bz]:5d} {bar}{label}')

print()

# Final verdict
has_outer_x = any(x < 1 for x in xs) or any(x > 99 for x in xs)
has_outer_y = any(y < 1 for y in ys) or any(y > 59 for y in ys)
has_inner_x = any(1.5 < x < 2.5 for x in xs)
has_inner_y = any(1.5 < y < 2.5 for y in ys)
has_inner_x_far = any(97.5 < x < 98.5 for x in xs)
has_inner_y_far = any(57.5 < y < 58.5 for y in ys)
has_bottom = any(0 <= z < 3 for z in zs)
has_top = any(28 <= z <= 30 for z in zs)
has_walls = any(2 <= z <= 28 for z in zs)

print('=== VERDICT ===')
print(f'  Outer X edges (x≈0, x≈100): {has_outer_x} ✓' if has_outer_x else f'  Outer X edges: MISSING ✗')
print(f'  Outer Y edges (y≈0, y≈60):  {has_outer_y} ✓' if has_outer_y else f'  Outer Y edges: MISSING ✗')
print(f'  Inner X walls (x≈2, x≈98):  {has_inner_x and has_inner_x_far} ✓' if has_inner_x and has_inner_x_far else f'  Inner X walls: MISSING ✗')
print(f'  Inner Y walls (y≈2, y≈58):  {has_inner_y and has_inner_y_far} ✓' if has_inner_y and has_inner_y_far else f'  Inner Y walls: MISSING ✗')
print(f'  Bottom plate (z≈0):          {has_bottom} ✓' if has_bottom else f'  Bottom: MISSING ✗')
print(f'  Walls (z=2..28):             {has_walls} ✓' if has_walls else f'  Walls: MISSING ✗')
print(f'  Top opening (z≈30):          {has_top} ✓' if has_top else f'  Top: MISSING ✗')

hollow = has_outer_x and has_outer_y and has_inner_x and has_inner_x_far and has_inner_y and has_inner_y_far
print()
if hollow:
    print('✅ Model is a HOLLOW box with walls!')
else:
    print('❌ Model is SOLID or has MISSING walls')
