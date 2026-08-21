// Enkel låda med botten

/* Låda */
box_width = 100;        // [50:1:200]
box_depth = 80;         // [50:1:150]
box_height = 50;        // [20:1:100]
wall_thickness = 3;     // [1:0.5:8]
bottom_thickness = 3;   // [1:0.5:8]
box_color = "Wheat";

module simple_box() {
    color(box_color)
    difference() {
        // Ytterform
        cube([box_width, box_depth, box_height], center = false);

        // Håla ut insidan (lämnar botten och väggar)
        translate([wall_thickness, wall_thickness, bottom_thickness])
            cube([
                box_width - 2 * wall_thickness,
                box_depth - 2 * wall_thickness,
                box_height - bottom_thickness
            ], center = false);
    }
}

simple_box();
