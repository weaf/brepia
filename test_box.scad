// Box with lid parameters
box_length = 100;      // [50:10:200]
box_width = 80;        // [40:10:200]
box_height = 60;       // [30:10:150]
wall_thickness = 5;    // [2:1:15]
lid_height = 15;       // [5:1:50]
base_color = "LightBlue";
lid_color = "LightGreen";

module box_base() {
    color(base_color)
    difference() {
        cube([box_length, box_width, box_height]);
        translate([wall_thickness, wall_thickness, 0])
        cube([box_length - 2*wall_thickness, box_width - 2*wall_thickness, box_height]);
    }
}

module box_lid() {
    color(lid_color)
    translate([0, 0, box_height])
    difference() {
        cube([box_length, box_width, lid_height]);
        translate([wall_thickness, wall_thickness, -0.1])
        cube([box_length - 2*wall_thickness, box_width - 2*wall_thickness, lid_height + 0.2]);
    }
}

box_base();
box_lid();