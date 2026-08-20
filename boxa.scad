// Parameterar för låda
box_width = 100;      // [20:1:200] Bred
box_depth = 80;       // [20:1:200] Djup
box_height = 60;      // [20:1:200] Hög
wall_thickness = 3;   // [1:0.5:10] Vägg tjocklek
bottom_thickness = 3; // [1:0.5:10] Botten tjocklek
box_color = "Wheat";  // ["Wheat","Brown","LightGray","SandyBrown"] Färg

color(box_color)
difference() {
    // Hel låda (yttre)
    cube([box_width, box_depth, box_height], center = false);

    // Skär ut insidan — lämnar botten + väggar
    translate([wall_thickness, wall_thickness, bottom_thickness])
    cube([box_width - 2 * wall_thickness,
          box_depth - 2 * wall_thickness,
          box_height - bottom_thickness],
         center = false);
}
