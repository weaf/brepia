// Parametrisk låda med lock - CAD-klar
// Alla parametrar synliga i Customizer

// === Huvuddimensioner ===
length    = 120;   // [50:1:200]    Längd (mm)
width     = 80;    // [40:1:150]    Bredd (mm)
height    = 50;    // [20:1:120]    Höjd (mm)

// === Vägg = tjocklek ===
wall      = 2.5;   // [1:0.5:6]    Vägg tjocklek (mm)

// === Lock ===
lid_thick = 3;     // [1.5:0.5:6]    Lock tjocklek (mm)
lip       = 2;     // [0:0.5:4]      Lock överblick (mm)
gap       = 0.3;   // [0:0.05:1]    Passform gap (mm)

// === Hörn ===
fillet    = 3;     // [0:0.5:10]    Utvändigt fillet (mm)
chamfer   = 1;     // [0:0.25:3]    Invändig kantsläpning (mm)

// === Extra ===
hinge_hole= 6;     // [4:1:10]      Hångelhål diameter (mm)
label     = "Min Låda";

// ============================================
// HELPER MODULES
// ============================================

module rounded_base(w, d, h, r) {
    if (r > 0) {
        hull() {
            translate([r, r, 0]) cylinder(h, r, r, center=false);
            translate([w-r, r, 0]) cylinder(h, r, r, center=false);
            translate([r, d-r, 0]) cylinder(h, r, r, center=false);
            translate([w-r, d-r, 0]) cylinder(h, r, r, center=false);
        }
    } else {
        cube([w, d, h], center=false);
    }
}

module rounded_rect_extrude(w, d, h, r) {
    linear_extrude(height=h, center=false) {
        if (r > 0) {
            offset(r)
                square([w-2*r, d-2*r], center=false);
        } else {
            square([w, d], center=false);
        }
    }
}

// ============================================
// BODYPARTS
// ============================================

module bottom() {
    difference() {
        // Yttre
        rounded_rect_extrude(length, width, wall, fillet);

        // Inre (hollow)
        if (fillet > wall + chamfer) {
            translate([wall+chamfer, wall+chamfer, wall])
                rounded_rect_extrude(
                    length - 2*(wall+chamfer),
                    width - 2*(wall+chamfer),
                    height - wall - chamfer,
                    max(0, fillet - wall - chamfer)
                );
        } else {
            translate([wall+chamfer, wall+chamfer, wall])
                cube([
                    length - 2*(wall+chamfer),
                    width - 2*(wall+chamfer),
                    height - wall - chamfer
                ], center=false);
        }
    }
}

module walls() {
    front_y = 0;
    back_y  = width - wall;
    left_x  = 0;
    right_x = length - wall;

    // 4 väggar
    color("lightsteelblue")
    union() {
        // Front
        translate([wall + chamfer, front_y, wall + chamfer])
            cube([length - 2*(wall+chamfer), wall, height - wall - chamfer]);
        // Back
        translate([wall + chamfer, back_y, wall + chamfer])
            cube([length - 2*(wall+chamfer), wall, height - wall - chamfer]);
        // Left (between front/back)
        translate([left_x, wall + chamfer, wall + chamfer])
            cube([wall, width - 2*(wall+chamfer), height - wall - chamfer]);
        // Right (between front/back)
        translate([right_x, wall + chamfer, wall + chamfer])
            cube([wall, width - 2*(wall+chamfer), height - wall - chamfer]);
    }
}

module lid() {
    diff = gap;

    color("wheat")
    difference() {
        // Yttre lock
        union() {
            rounded_rect_extrude(length + 2*lip, width + 2*lip, lid_thick, fillet);

            // Lip som hänger över lådan
            translate([0, 0, lid_thick])
                rounded_rect_extrude(length + 2*lip - diff, width + 2*lip - diff, lip, max(0, fillet - diff));
        }

        // Inre av lock (halv-hollow)
        if (lid_thick > wall + chamfer) {
            translate([
                wall + chamfer + lip - diff,
                wall + chamfer + lip - diff,
                0
            ])
            rounded_rect_extrude(
                length + 2*lip - 2*(wall+chamfer) - 2*diff,
                width + 2*lip - 2*(wall+chamfer) - 2*diff,
                lid_thick - chamfer,
                max(0, fillet - wall - chamfer - diff)
            );
        }
    }
}

module hinges() {
    hinge_y_front = 5;
    hinge_y_back  = width - 5 - hinge_hole;
    hinge_z       = height - 8;
    offset_x      = 10;

    color("gray")
    union() {
        // Vänster
        translate([offset_x, 0, hinge_z])
            cylinder(h=hinge_hole, r=wall/2, center=true, $fn=16);
        translate([length-offset_x, 0, hinge_z])
            cylinder(h=hinge_hole, r=wall/2, center=true, $fn=16);
        // Höger
        translate([offset_x, width, hinge_z])
            cylinder(h=hinge_hole, r=wall/2, center=true, $fn=16);
        translate([length-offset_x, width, hinge_z])
            cylinder(h=hinge_hole, r=wall/2, center=true, $fn=16);
    }
}

// ============================================
// ASSEMBLY
// ============================================

color("SaddleBrown")
bottom();

color("lightsteelblue")
walls();

// Lock flyttad uppåt för visning
translate([0, 0, height + lid_thick + lip + 10])
lid();

// Hängslen på baksidan
translate([0, 0, 0])
hinges();
