


// Generate a section of a conical flute body, based
// on a vector set of conic section specifications.
// Each vector in the spec has the form [height, bottom_radius, top_radis].
// Args:
//   spec: the vector of conic section specifications
//   facets: the number of facets to use in the approximation
//      of the outer circle. (0 = as many as possible.)
module generate_compound_conic(spec, facets=0) {
  // Given a vector of cone specs (height, r1, r2)
  // returns a vector of the cumulative sums of those heights.
  function cumulative_height(values) =
    [ for (a=0, b=values[0][0];
           a < len(values);
           a= a+1, b=b+values[a][0])
           b
    ];

  // Convert a list of cumulative heights, convert it to a list
  // of the starting height of each segment.
  function prefixes(values) =
    let (c = cumulative_height(values))
    concat([0], [ for (x=0; x < len(c)-1; x = x + 1) c[x] ]);

  // merge a list of starting elevations with a list of cone specs.
  function prefix_with_elevation(values) =
      let (p = prefixes(values))
        [ for (i = 0;
               i < len(values);
               i = i + 1)
              concat([p[i]], values[i])
        ];

  sections_with_elevation = prefix_with_elevation(spec);
  for (section = sections_with_elevation) {
    elev = section[0];
    height = section[1];
    r1 = section[2];
    r2 = section[3];
    translate([0, 0, elev]) {
      cylinder(h=height, r1=r1, r2=r2, $fn=facets);
    }
  }
}


// Generate the cylinder for a finger hole on a conical-bore
// flute.
// Args:
//   offset: the elevation of the hole from the foot of the flute.
//   outer_diameter: the maximum outer diameter of the flute section
//      where the hole will be placed.
//   radius: the radius of the finger hole to generate.
module generate_conic_flute_finger_hole(offset, outer_diameter, radius) {
   rotate([0, -90, 0]) {
        translate([offset, 0, 0]) {
            cylinder(h=outer_diameter,
              r=radius);
        }
    }
}

// Generate the embouchure hole for a conical-bore flute.
// Args:
//    pos: the elevation of the embouchure hole from the foot of the flute.
//    outer_diam: the outer diameter of the flute at the embouchure hole position.
//    radius: the radius of the embouchure hole.
//    eccentricity: a 3-vector describing the distortion of the
//       embouchure hole. (Most flutes have a slightly oval-shaped
//       embouchure, which coresponds roughly to an eccentricity
//       of [1.2, 1.0, 1.0])
module generate_embouchure_hole(pos, outer_diam, radius, eccentricity=[1.2, 1.0, 1.0]) {
    rotate([0, -90, 0]) {
      translate([pos, 0, 0]) {
          scale(eccentricity) {
        cylinder(
          h=outer_diam,
          r=radius,
          $fn=72
        );
      }
    }
  }
}


module plate_base() {
  intersection() {
    scale([1.8, 1.2, 1.0]) {
      cylinder(h=1000, r=10.0);
    }
    translate([-100, 0, 0.0]) {
      rotate([0, 90, 0]) {
        cylinder(h=200, r=16);
      }
    }
  }
}


// Create the embouchure plate for the flute.
// Args:
//   - elevation: the distance of the center of the embouchure hole from the foot of the flute.
//   - outer_diameter: the outer diameter of the flute at the embouchure hole
//   - emb_radius: the radius of the embouchure hole.
//   - emb_eccentricity: the eccentricity vector of the embouchure hole.
module generate_emb_plate(elevation, outer_diameter, emb_radius,
          emb_eccentricity) {


    translate([0, 0, elevation]) {
        rotate([0, -90, 0]) {
            translate([0, 0, 0]) {
                difference() {
                    plate_base();
                    translate([0, 0, -3]) {
                        plate_base();
                    }
                    scale([1.2, 1.0, 1.0]) {
                        cylinder(h=100, r=emb_radius, $fn=200);
                    }
                }
            }
        }
    }
}


// Create a 3d model of a conic bore flute.
// Args:
//   outer: a vector of conic sections for the outer body shape of the flute.
//         (see the generate_compound_conic module for more info)
//   inner: a vector of conic sections for the inner bore of the flute.
//   holes: a vector of hole specifications for the finger holes of the flute.
//         Each element has the form [elevation, radius].
//   emb_elev: the elevation of the embouchure hole from the foot of the flute.
//   emb_radius: the radius of the embouchure hole.
//   emb_ecc: the eccentricity of the embouchure hole.
//         (See generate_embouchure_hole for details)
module flute(outer_facets, outer, inner, holes, emb_elev, emb_radius, emb_ecc=[1.2, 1.0, 1.0]) {
    function max_diameter(spec) = max([for (x =  spec) x[2]]);

    max_diam = max_diameter(outer);

    union() {
        difference() {
            rotate([0, 0, 22.5]) {
                generate_compound_conic
              (spec = outer, facets=outer_facets);
            }
            generate_compound_conic(spec = inner);
            generate_embouchure_hole(emb_elev, max_diam, emb_radius, emb_ecc);
            for (hole = holes) {
                echo("Adding hole", hole);
                generate_conic_flute_finger_hole(offset = hole[0], outer_diameter = max_diam, radius = hole[1]);
            }
        }
        // plate
        generate_emb_plate(elevation = emb_elev, outer_diameter = max_diam, emb_radius = emb_radius, emb_eccentricity=emb_ecc);
        
        cork_pos = emb_elev + 3.5*emb_radius;
        cork_rad = inner[len(inner)-1][2] + 0.1;
        // cork
        translate([0, 0, cork_pos]) {
            cylinder(20, r=cork_rad);
        }
    }
}

// With that out of the way, we can finally make a flute!
// This my version of an odd little flute, where the primary scale is
// a natural minor (so the major scale starts with the bottom two fingers open),
// plus a couple of cross fingering to allow it to play in more keys.
//
// The numbers here were initially generated by demakein (a package that I simultaneously
// love and loathe), and then manually tweaked until they worked.
module e_minor_conic_flute() {
  e_minor_inner_cone_spec = [
    [172.4, 6.9, 6.9],   
    [46.1, 6.9, 8.05],   // 172.4
    [165.1, 8.05, 9.15],  // 218.5
    [4.6, 9.15, 10.5],    // 383.6
    [58.5, 10.5, 10.5],   // 388.2
    [5.4, 10.5, 9.2],    // 446.7
    [59.6, 9.2, 9.2]    // 452.2
    ];

    

  e_minor_outer_cone_spec = [
    [230.5, 12.3, 14.5],
    [271.3, 14.5, 14.5]
 ];



  e_minor_holes = [
    [72.5, 6.0],
    [113.3, 4.5],
    [154.1, 6.0],
    [200.1, 4.5],
    [213.8, 4.25],
    [242.6, 5.6]];


  emb_radius = 5.65;

  emb_elev = 460.0;

  flute(outer_facets=8,
        outer=e_minor_outer_cone_spec,
        inner=e_minor_inner_cone_spec,
        holes=e_minor_holes,
        emb_elev = emb_elev,
        emb_radius=emb_radius);
}

e_minor_conic_flute();

