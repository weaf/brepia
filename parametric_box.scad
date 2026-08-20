// Parametrisk låda med lock - v4
// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
// Metod: Hel kub med chamfer (mink) + inre cube för väggtjocklek.
// Lock med lip som hänger ner utanpå lådan.
// Locket placeras exakt ovanpå lådan med korrekt överhäng.

// === Grundparametrar ===
box_w         = 100;   // Total bredd
box_d         = 80;    // Total djup
box_h         = 50;    // Total höjd
wall_thickness = 3;     // Väggtjocklek
chamfer_r     = 5;     // Chamfer-radie på yttre kanter

// === Lockparametrar ===
lid_overhang  = 4;     // Överhäng runt hela lådan
lid_plate_h   = 3;     // Lockplattans tjocklek
lid_lip_h     = 5;     // Lip/hängsle som hänger ner
// Total lockhöjd = 8mm

// === Bottenlåda med chamferade kanter ===
module chamfered_box(outer_w, outer_d, outer_h, wt, cr) {
    // Yttre form med chamfer + inre kub för väggtjocklek
    difference() {
        // Yttre kub med chamfer
        minkowski() {
            cube([outer_w - 2*cr, outer_d - 2*cr, outer_h - cr], center=false);
            sphere(r=cr);
        }
        
        // Inre kub - skär ut insidan
        // Botten och väggar får tjocklek wt
        translate([wt - 0.001, wt - 0.001, wt - 0.001])
            cube([outer_w - 2*wt + 0.002, outer_d - 2*wt + 0.002, outer_h - wt + 0.002]);
    }
}

// === Lock med lip ===
module lid_box(overhang, plate_h, lip_h) {
    // Lockplattans yttre mått
    plate_w = box_w + 2*overhang;
    plate_d = box_d + 2*overhang;
    
    // Lockplattan (övre plana delen)
    cube([plate_w, plate_d, plate_h], center=false);
    
    // Lip (kant som hänger ner på alla fyra sidor)
    // Fram
    cube([plate_w, overhang, lip_h], center=false);
    // Bak
    translate([0, plate_d - overhang, 0])
        cube([plate_w, overhang, lip_h], center=false);
    // Vänster (mellan fram och bak för att undvika dubbel-material)
    translate([0, 0, 0])
        cube([overhang, plate_d - 2*overhang, lip_h], center=false);
    // Höger
    translate([plate_w - overhang, 0, 0])
        cube([overhang, plate_d - 2*overhang, lip_h], center=false);
}

// === Huvudsektion ===
union() {
    // Bottenlåda
    color([0.35, 0.55, 0.85])
    translate([0, 0, 0])
    chamfered_box(box_w, box_d, box_h, wall_thickness, chamfer_r);
    
    // Lock (placerat ovanpå, centrerat)
    color([0.85, 0.35, 0.35])
    // Lockets bas (botten av lippen) ska vara exakt vid lådans övre kant
    // Lockets x/y-position: lådans kant är vid 0..box_w / 0..box_d
    // Locket är box_w + 2*overhang, så vänster kant = -overhang
    translate([-lid_overhang, -lid_overhang, box_h])
    lid_box(lid_overhang, lid_plate_h, lid_lip_h);
}

echo("Box: ", box_w, "x", box_d, "x", box_h);
echo("Lid: overhang=", lid_overhang, " total_h=", lid_plate_h + lid_lip_h);
