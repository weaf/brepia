// 20mm cube with centered 6mm through-hole
difference() {
    cube(20, center = true);
    cylinder(h = 22, d = 6, center = true);
}
