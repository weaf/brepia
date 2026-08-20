// Låda med båt
box_length = 200;       // [100:5:300]
box_width = 120;        // [60:5:200]
box_height = 60;        // [30:2:100]
wall_thickness = 3;     // [2:0.5:6]
box_color = "SaddleBrown";

// Båt-parametrar
boat_length = 80;        // [40:2:120]
boat_width = 28;         // [15:1:50]
boat_height = 15;        // [8:1:30]
mast_height = 70;        // [30:2:120]
sail_color = "LightGray";
hull_color = "IndianRed";

// Låda (öppen åt upp)
difference() {
    color(box_color)
    union() {
        // Botten
        cube([box_length, box_width, wall_thickness]);
        // Framsidan
        translate([0, 0, wall_thickness])
            cube([box_length, wall_thickness, box_height - wall_thickness]);
        // Baksidan
        translate([0, box_width - wall_thickness, wall_thickness])
            cube([box_length, wall_thickness, box_height - wall_thickness]);
        // Vänster sida
        translate([0, wall_thickness, wall_thickness])
            cube(wall_thickness, box_width - 2 * wall_thickness, box_height - wall_thickness);
        // Höger sida
        translate([box_length - wall_thickness, wall_thickness, wall_thickness])
            cube(wall_thickness, box_width - 2 * wall_thickness, box_height - wall_thickness);
    }
    // Inre utrymme
    translate([wall_thickness, wall_thickness, 0])
        cube([box_length - 2 * wall_thickness, box_width - 2 * wall_thickness, box_height]);
}

// Båt
translate([(box_length - boat_length) / 2 + wall_thickness, 
           (box_width - boat_length) / 2 + wall_thickness,
           wall_thickness + 2])
union() {
    // Skroppsdel
    color(hull_color)
    hull() {
        // Botten (plattare del)
        translate([-boat_length / 2, -boat_width / 2, 0])
            cube([boat_length, boat_width, boat_height * 0.4]);
        // Förstäv (spetsig fram)
        translate([-boat_length / 2 - boat_width * 0.3, -boat_width / 2 + boat_width * 0.1, 0])
            cube([boat_width * 0.6, boat_width * 0.8, boat_height * 0.8]);
        // Aktern (bredare bak)
        translate([-boat_length / 2 + boat_length * 0.5, -boat_width / 2, boat_height * 0.1])
            cube([boat_length * 0.5, boat_width, boat_height * 0.6]);
    }
    // Mast
    color("DarkSlateGray")
    translate([0, 0, boat_height * 0.4])
    cylinder(h = mast_height, r = 2.5, center = false);
    // Segel
    color(sail_color)
    translate([2, 0, boat_height * 0.4 + mast_height * 0.15])
    rotate([0, 0, -3])
    linear_extrude(height = 1)
    polygon(points = [[0, 0], [0, mast_height * 0.7], [boat_length * 0.35, 0]]);
}
