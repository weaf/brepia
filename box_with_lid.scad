// Box parameters
box_length = 100;       // [50:1:200]    Box length (X direction)
box_width = 100;        // [50:1:200]    Box width (Y direction)
box_height = 60;        // [30:1:150]    Box height (Z direction)
wall_thickness = 3;     // [1:1:10]      Wall thickness
lid_height = 15;        // [5:1:30]      Height of the lid
lid_overlap = 2;          // [0:0.5:5]    How much the lid overlaps the box edges
box_color = "SaddleBrown";
lid_color = "DarkSlateGray";

module box_body() {
    difference() {
        cube([box_length, box_width, box_height]);
        translate([wall_thickness, wall_thickness, wall_thickness])
        cube([box_length - 2*wall_thickness, box_width - 2*wall_thickness, box_height]);
    }
}

module lid() {
    difference() {
        translate([0, 0, box_height])
        cube([box_length + 2*lid_overlap, box_width + 2*lid_overlap, lid_height]);
        translate([wall_thickness, wall_thickness, box_height - wall_thickness])
        cube([box_length - 2*wall_thickness, box_width - 2*wall_thickness, lid_height]);
    }
}

module lid_standoff() {
    translate([0, 0, box_height + lid_height - wall_thickness])
    cube([box_length + 2*lid_overlap, box_width + 2*lid_overlap, wall_thickness]);
}

color(box_color) box_body();
color(lid_color) lid();