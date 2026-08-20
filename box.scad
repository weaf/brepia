// Låda parametrar
box_width = 100;        // [50:1:200]    Bredd (mm)
box_depth = 80;         // [40:1:150]    Djup (mm)
box_height = 50;        // [20:1:150]    Höjd (mm)
wall_thickness = 3;     // [1.5:0.5:8]   Vägg tjocklek (mm)
corner_radius = 5;      // [0:0.5:15]    Hörn radie (mm)
lid_thickness = 3;      // [1.5:0.5:6]   Lock tjocklek (mm)
show_lid = true;        //                // Visa lock
box_color = "SaddleBrown";
lid_color = "RosyBrown";

module rounded_box_body(w, d, h, r, t) {
    outer_r = r;
    inner_r = max(0, r - t);
    inner_w = w - 2*t;
    inner_d = d - 2*t;
    inner_h = h - t;

    color(box_color)
    difference() {
        // Yttre form
        if (outer_r > 0) {
            linear_extrude(h, center = false)
            offset(outer_r)
            rect([w - 2*outer_r, d - 2*outer_r], center = false);
        } else {
            linear_extrude(h, center = false)
            rect([w, d], center = false);
        }

        // Inre utskärning (hollow)
        translate([t, t, t])
        if (inner_r > 0) {
            linear_extrude(inner_h, center = false)
            offset(inner_r)
            rect([inner_w - 2*inner_r, inner_d - 2*inner_r], center = false);
        } else {
            linear_extrude(inner_h, center = false)
            rect([inner_w, inner_d], center = false);
        }
    }
}

module box_lid(w, d, h, r, t) {
    lip_height = t * 1.5;
    lip_overhang = 2;
    total_h = h + lip_height;

    color(lid_color)
    union() {
        // Huvudkropp
        outer_w = w + 2*lip_overhang;
        outer_d = d + 2*lip_overhang;
        if (r > 0) {
            linear_extrude(h, center = false)
            offset(r)
            rect([outer_w - 2*r, outer_d - 2*r], center = false);
        } else {
            linear_extrude(h, center = false)
            rect([outer_w, outer_d], center = false);
        }

        // Lip/kanter som hänger över lådan
        translate([0, 0, h])
        if (r > 0) {
            inner_w_lid = w;
            inner_d_lid = d;
            lip_r = max(0, r);
            linear_extrude(lip_height, center = false)
            if (lip_r > 0) {
                offset(lip_r)
                rect([inner_w_lid - 2*lip_r, inner_d_lid - 2*lip_r], center = false);
            } else {
                rect([inner_w_lid, inner_d_lid], center = false);
            }
        } else {
            linear_extrude(lip_height, center = false)
            rect([w, d], center = false);
        }
    }
}

// Bygg låda
translate([box_width/2, box_depth/2, 0])
rounded_box_body(box_width, box_depth, box_height, corner_radius, wall_thickness);

// Bygg lock om visningsflagga är på
if (show_lid) {
    translate([box_width/2, box_depth/2, box_height + lid_thickness + 15])
    box_lid(box_width, box_depth, lid_thickness, corner_radius, wall_thickness);
}
