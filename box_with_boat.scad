// Box with Boat
box_length = 200;       // [100:5:400]
box_width = 120;        // [60:5:250]
box_height = 80;        // [30:5:150]
wall_thickness = 4;     // [2:0.5:8]
box_color = "SaddleBrown";

boat_length = 70;       // [40:5:120]
boat_width = 25;        // [15:1:50]
boat_hull_depth = 12;   // [6:1:25]
mast_height = 50;       // [20:5:100]
sail_color = "LightGray";
deck_color = "Tan";
hull_color = "Black";

// ---- BOX ----
color(box_color)
difference() {
    // Outer box
    cube([box_length, box_width, box_height]);
    
    // Hollow interior (open at top)
    translate([wall_thickness, wall_thickness, wall_thickness])
        cube([box_length - wall_thickness * 2, box_width - wall_thickness * 2, box_height - wall_thickness]);
}

// ---- BOAT ----
boat_x = box_length / 2 - boat_length / 2;
boat_y = boat_width / 2;
boat_z = box_height - wall_thickness - boat_hull_depth;

// Hull
translate([boat_x, boat_y, boat_z])
color(hull_color)
difference() {
    // Main hull body - rounded boat shape
    hull() {
        // Front tip (rounded prow)
        translate([-(boat_length / 2 - 6), 0, 0])
            cylinder(h = boat_width, r = boat_width / 2, center = true, $fn = 24);
        // Back tip (rounded stern)
        translate([boat_length / 2 - 6, 0, 0])
            cylinder(h = boat_width, r = boat_width / 2, center = true, $fn = 24);
        // Mid section
        translate([0, 0, 0])
            cylinder(h = boat_width, r = boat_width / 2, center = true, $fn = 24);
    }
    // Carve out interior
    translate([0, 0, 1])
        cylinder(h = boat_hull_depth + 10, r = boat_width / 2 - wall_thickness, center = false, $fn = 24);
}

// Deck
translate([boat_x, boat_y, boat_z + boat_hull_depth / 2 - 1])
color(deck_color)
cube([boat_length - 12, boat_width - 6, 2.5]);

// Mast
translate([boat_x, boat_y, boat_z + boat_hull_depth / 2 - 1])
color("Brown")
cylinder(h = mast_height, r = 2, center = true, $fn = 12);

// Sail - triangular
translate([boat_x, boat_y, boat_z + boat_hull_depth / 2 + mast_height / 2 - 10])
color(sail_color)
linear_extrude(height = 2, center = false)
polygon(points=[[0,0],[0,mast_height - 18],[22,0]]);
