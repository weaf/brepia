// Låda med botten - Parametrar
box_width = 150;        // [50:5:300]  Bredd
box_depth = 100;        // [30:5:200]  Djup
box_height = 80;        // [20:5:150]  Höjd
wall_thickness = 3;     // [1:0.5:6]   Vägg-tjocklek
bottom_thickness = 4;   // [1.5:0.5:8] Bottentjocklek
fillet_radius = 2;      // [0:0.5:6]   Filé-radie
box_color = "SaddleBrown";  //             Lådfärg

module box_with_bottom(w, d, h, wt, bt, fr, col) {
    // Inre mått
    iw = w - 2 * wt;       // inner width
    id = d - 2 * wt;       // inner depth
    ih = h - bt;            // inner height

    union() {
        // Bottenplatta
        color("Silver")
        cube([w, d, bt], center = false);

        // Vägg- och hörn-kropp
        color(col)
        union() {
            // Framvägg
            cube([w, wt, h], center = false);

            // Bakvägg
            translate([0, d - wt, 0])
            cube([w, wt, h], center = false);

            // Vänster vägg (mellan fram/bak)
            translate([wt, 0, bt])
            cube(wt, id, ih);

            // Höger vägg (mellan fram/bak)
            translate([w - wt, 0, bt])
            cube(wt, id, ih);

            // Filéerade hörn (om filé är aktiverad)
            if (fr > 0) {
                // Fram-vänster hörn
                translate([wt - fr, wt - fr, h - fr])
                sphere(r = fr, $fn = 16);

                // Fram-höger hörn
                translate([w - wt + fr - fr, wt - fr, h - fr])
                sphere(r = fr, $fn = 16);

                // Bak-vänster hörn
                translate([wt - fr, d - wt + fr - fr, h - fr])
                sphere(r = fr, $fn = 16);

                // Bak-höger hörn
                translate([w - wt + fr - fr, d - wt + fr - fr, h - fr])
                sphere(r = fr, $fn = 16);
            }
        }
    }
}

// Skapa lådan
box_with_bottom(box_width, box_depth, box_height, wall_thickness, bottom_thickness, fillet_radius, box_color);
