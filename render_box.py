import trimesh
import numpy as np

# Ladda STL
scene = trimesh.load('/home/thn/ai/pCAD/parametric_låda.stl', file_type='stl')

# Rendera till bild med flera vinklar
from PIL import Image, ImageDraw, ImageFont

# Skapa en stor bild med 6 vyer
canvas_size = 800
rows, cols = 2, 3
total_w, total_h = cols * canvas_size, rows * canvas_size

canvas = Image.new('RGB', (total_w, total_h), 'white')
draw = ImageDraw.Draw(canvas)

# Definiera kameravinklar
angles = [
    ('Främre', 0, 0),
    ('Sidan', 90, 0),
    ('Ovanifrån', 0, -90),
    ('Isometrisk', 45, 30),
    ('Bakifrån', 180, 0),
    ('Undersidan', 0, 90),
]

for idx, (name, azim, elev) in enumerate(angles):
    row = idx // cols
    col = idx % cols
    
    x0 = col * canvas_size
    y0 = row * canvas_size
    
    # Rendera varje vy
    rot = trimesh.transformations.rotation_matrix(
        np.radians(azim), [0, 0, 1],
        point=scene.centroid
    )
    rot = rot @ trimesh.transformations.rotation_matrix(
        np.radians(elev), [1, 0, 0],
        point=scene.centroid
    )
    
    # Använd simple renderer
    try:
        renderer = trimesh.rendering.create_renderer(
            view_matrix=trimesh.transformations.look_at(
                scene.centroid + [200, 200, 200],
                scene.centroid,
                [0, 0, 1]
            ),
            texture_size=canvas_size
        )
        img_array = renderer.render_surface(scene,
                                           view=True,
                                           camera_transform=True)
        img = Image.fromarray(img_array)
    except Exception as e:
        # Fallback: skapa en textbild om rendering misslyckas
        img = Image.new('RGB', (canvas_size, canvas_size), 'lightblue')
        idraw = ImageDraw.Draw(img)
        idraw.text((100, 350), f"{name} vy", fill='black')
        idraw.text((100, 400), f"(renderade ej)", fill='red')
    
    canvas.paste(img, (x0, y0))
    draw.rectangle([x0, y0, x0+canvas_size-1, y0+canvas_size-1], outline='gray', width=2)
    draw.text((20, y0+20), name, fill='darkblue')

# Spara
output_path = '/home/thn/ai/pCAD/parametric_låda_render.png'
canvas.save(output_path)
print(f"Renderad till: {output_path}")
print(f"Canvas: {canvas.size}")
