import { command, run, string, positional } from "cmd-ts"
import * as fs from "fs"

interface Conic {
    height: number
    lower_diam: number
    upper_diam: number
}

interface Hole {
    elev: number
    diam: number
}

interface Emb {
    elev: number
    diam: number
    eccentricity: number
}

interface FluteSpec {
    name: string
    description: string[]
    outer_body: Conic[]
    outer_facets: number
    inner_bore: Conic[]
    holes: Hole[]
    emb: Emb
}

interface Geom {
    str(i: number): string
}

function indent(i: number): string {
    return "   ".repeat(i)
}

class Cylinder implements Geom {
    height: number
    lower_diam: number
    upper_diam: number
    facets: number

    constructor(h: number, l: number, u: number, facets?: number) {
        this.height = h
        this.lower_diam = l
        this.upper_diam = u
        if (facets) {
            this.facets = facets
        } else {
            this.facets = 0
        }
    }

    str(i: number): string {
        return (
            `${indent(i)}cylinder(h=${this.height}, ` +
            `r1=${this.lower_diam}, r2=${this.upper_diam},` +
            `$fn=${this.facets});\n`
        )
    }

    render(i: number, out: TextStreamWriter): void {
        out.Write(this.str(i))
    }
}

class Labelled implements Geom {
    comment: string
    geom: Geom
    constructor(comment: string, geom: Geom) {
        this.comment = comment
        this.geom = geom
    }

    str(i: number): string {
        return `${indent(i)}// ${this.comment}\n${this.geom.str(i)}`
    }
}

abstract class GeoModule implements Geom {
    geoms: Geom[]
    name: string
    constructor(name: string, geoms: Geom[]) {
        this.name = name
        this.geoms = geoms
    }

    abstract render_params(): string

    str(i: number): string {
        let result = ""
        result += `${indent(i)}${this.name}(`
        result += this.render_params()
        result += ") {\n"
        for (const g of this.geoms) {
            result = result.concat(g.str(i + 1))
        }
        result = result.concat(`${indent(i)}}\n`)
        return result
    }

    add(geom: Geom): void {
        this.geoms.push(geom)
    }
}

class Union extends GeoModule {
    constructor(...geoms: Geom[]) {
        super("union", geoms)
    }

    render_params(): string {
        return ""
    }
}

class Difference extends GeoModule {
    constructor(...geoms: Geom[]) {
        super("difference", geoms)
    }

    render_params(): string {
        return ""
    }
}

class Intersection extends GeoModule {
    constructor(...geoms: Geom[]) {
        super("intersection", geoms)
    }

    render_params(): string {
        return ""
    }
}

class Translate extends GeoModule {
    offset: [number, number, number]
    constructor(offset: [number, number, number], ...geoms: Geom[]) {
        super("translate", geoms)
        this.offset = offset
    }

    render_params(): string {
        return `[${this.offset[0]}, ${this.offset[1]}, ${this.offset[2]}]`
    }
}

class Rotate extends GeoModule {
    rotation: [number, number, number]
    constructor(rotation: [number, number, number], ...geoms: Geom[]) {
        super("rotate", geoms)
        this.rotation = rotation
    }
    render_params(): string {
        return `[${this.rotation[0]}, ${this.rotation[1]}, ${this.rotation[2]}]`
    }
}

class Scale extends GeoModule {
    scale: [number, number, number]
    constructor(scale: [number, number, number], ...geoms: Geom[]) {
        super("scale", geoms)
        this.scale = scale
    }
    render_params(): string {
        return `[${this.scale[0]}, ${this.scale[1]}, ${this.scale[2]}]`
    }
}

class Flute {
    name: string
    facets: number
    desc: string[]
    inner: Conic[]
    outer: Conic[]
    holes: Hole[]
    emb: Emb

    constructor(spec: FluteSpec) {
        this.facets = spec.outer_facets
        this.inner = spec.inner_bore
        this.outer = spec.outer_body
        this.holes = spec.holes
        this.emb = spec.emb
        this.desc = spec.description
        this.name = spec.name
    }

    gen_stack(name: string, facets: number, cones: Conic[]): Geom {
        const result = new Union()
        let elev = 0
        for (const cone of cones) {
            result.add(
                new Translate(
                    [0, 0, elev],
                    new Cylinder(
                        cone.height,
                        cone.lower_diam / 2,
                        cone.upper_diam / 2,
                        facets
                    )
                )
            )
            elev += cone.height
        }
        return new Labelled(`${name} stack`, result)
    }

    private _diam_at(
        target: any,
        label: string,
        elev: number,
        stack: Conic[]
    ): number {
        console.error(`Computing ${label} diameter`, target, stack, elev)
        let current_elev = 0
        for (const cone of stack) {
            if (current_elev < elev && current_elev + cone.height >= elev) {
                const result = (cone.lower_diam + cone.upper_diam) / 2
                console.error(`Found ${label} diameter point at`, cone, result)
                return result
            }
            current_elev += cone.height
        }
        return 0
    }

    diameters_at(target: any, elev: number): { inner: number; outer: number } {
        return {
            inner: this._diam_at(target, "inner", elev, this.inner),
            outer: this._diam_at(target, "outer", elev, this.outer),
        }
    }

    gen_ring(hole: Hole, ring_width: number): Geom {
        let { inner, outer } = this.diameters_at(hole, hole.elev)
        console.error("Inner and outer for hole", hole, inner, outer)
        return new Labelled(
            "hole ring",
            new Rotate(
                [0, -90, 0],
                new Translate(
                    [hole.elev, 0, inner / 2],
                    new Difference(
                        new Cylinder(
                            (outer - inner) / 2 + 2,
                            hole.diam / 2 + ring_width,
                            hole.diam / 2 + ring_width
                        ),
                        new Cylinder(
                            (outer - inner) / 2 + 2,
                            hole.diam / 2,
                            hole.diam / 2
                        )
                    )
                )
            )
        )
    }

    gen_hole(hole: Hole, body_diam: number): Geom {
        return new Labelled(
            "hole",
            new Rotate(
                [0, -90, 0],
                new Translate(
                    [hole.elev, 0, 0],
                    new Cylinder(body_diam / 2, hole.diam / 2, hole.diam / 2)
                )
            )
        )
    }

    gen_emb(
        elev: number,
        diam: number,
        eccen: number,
        body_diam: number,
        thickness: number
    ): Geom {
        // The embechoure plate is basically on oval draped over a cylinder the diameter of the flute
        // bore. But OpenSTL doesn't support that kind of operation, se we need to do it in a slightly
        // harder way.
        //
        // Basically, we start with a cylinder that matches the flute bore.
        // Then we create a second cylinder that's larger than the bore - the outer body diameter,
        // plus the desired thickness of the plate.
        // We subtract the bore from that - and now we've got a hollow cylinder.
        // Then we intersect that with a ovoid cylinder the size of the desired plate placed at a right angle.
        // That will give us two mirror images of the basic plate.
        // We extract one of them by intersecting with a cube, and voila - we have a plate.
        const { inner, outer } = this.diameters_at("body", elev)

        const inner_cylinder = new Cylinder(
            this.emb.diam * 8,
            inner / 2,
            inner / 2
        )
        const outer_cylinder = new Cylinder(
            this.emb.diam * 8,
            outer / 2 + thickness,
            outer / 2 + thickness
        )
        const hollow = new Difference(outer_cylinder, inner_cylinder)
        const oval = new Translate(
            [0, 0, this.emb.diam * 2],
            new Rotate(
                [90, 0, 0],
                new Scale(
                    [1, 1.6, 1.0],
                    new Cylinder(outer * 3, this.emb.diam, this.emb.diam)
                )
            )
        )

        const plate = new Labelled(
            "new plate",
            new Rotate([0, 0, -90], new Intersection(hollow, oval))
        )
        const with_hole = new Labelled(
            "with hole",
            new Difference(
                plate,
                new Translate(
                    [0, 0, this.emb.diam * 2],
                    new Rotate(
                        [0, -90, 0],
                        new Scale(
                            [eccen, 1.0, 1.0],
                            new Cylinder(
                                100,
                                this.emb.diam / 2,
                                this.emb.diam / 2
                            )
                        )
                    )
                )
            )
        )

        return new Labelled(
            "plate plate plate",
            new Translate([0, 0, elev - this.emb.diam * 2], with_hole)
        )
    }

    body_diam(): number {
        return Math.max(...this.outer.map((c) => c.upper_diam))
    }

    gen_body(): Geom {
        const rotation =
            this.facets != null && this.facets > 0 ? 360 / this.facets / 2 : 0
        const ring_func = (me: Flute) => {
            return (h: Hole) => me.gen_ring(h, 3)
        }
        const hole_rings: Geom[] = this.holes.map(ring_func(this))
        const body = new Difference(
            new Labelled(
                "body + holerings",
                new Union(
                    // Rotate outer body so that the facets line up with the finger holes.
                    new Rotate(
                        [0, 0, rotation],
                        this.gen_stack(
                            "outer body stack",
                            this.facets,
                            this.outer
                        )
                    ),
                    ...hole_rings
                )
            ),

            this.gen_stack("inner bore stack", 0, this.inner),
            new Translate(
                [0, 0, this.emb.elev],
                new Rotate(
                    [0, -90, 0],
                    new Scale(
                        [1.2, 1.0, 1.0],
                        new Cylinder(
                            this.body_diam(),
                            this.emb.diam / 2,
                            this.emb.diam / 2
                        )
                    )
                )
            )
        )

      holes.forEach {
        h ->
        body.add(genHole(h))
      }

        return body
    }

    gen_cork(): Geom {
        const cork_pos = this.emb.elev + 1.75 * this.emb.diam
        const cork_rad = this.inner[this.inner.length - 1].upper_diam / 2.0 + 1
        const cork_thickness = cork_pos - this.emb.elev
        return new Labelled(
            "cork",
            new Translate(
                [0, 0, cork_pos],
                new Cylinder(cork_thickness, cork_rad, cork_rad)
            )
        )
    }

    gen_flute(): Geom {
        return new Union(
            this.gen_body(),
            this.gen_emb(
                this.emb.elev,
                this.emb.diam,
                this.emb.eccentricity,
                this.body_diam(),
                2
            ),
            this.gen_cork()
        )
    }

    str(): string {
        const d: string = this.desc.map((s) => "// " + s).join("\n")
        return `// ${this.name}\n\n${d}\n\n${this.gen_flute().str(0)}`
    }
}

// function example() {
//   const  inner = [
//     { height: 101.9, lower_diam: 13.8, upper_diam: 13.8},
//     { height: 29.6, lower_diam: 13.8, upper_diam: 16.1},
//     { height: 34.9, lower_diam: 16.1, upper_diam: 18.4},
//     { height: 64.5, lower_diam: 18.4, upper_diam: 21.0},
//     { height: 58.9, lower_diam: 21.0, upper_diam: 21.0},
//     { height: 3.0, lower_diam: 21.0, upper_diam: 18.4},
//     { height: 17.0, lower_diam: 18.4, upper_diam: 18.4}
//   ]
//   const outer = [
//     { height: 116.6, lower_diam: 24.6,  upper_diam: 24.6},
//     { height: 147.9, lower_diam: 24.6,  upper_diam: 29.0},
//     { height: 35.2, lower_diam: 29.0,  upper_diam: 29.0}
//   ]
//   const holes = [
//     { elev: 78.4, diam: 6.7},
//     { elev: 93.4, diam: 6.2},
//     { elev: 116.6, diam: 10.0},
//     { elev: 144.3, diam: 10.0},
//     { elev: 159.3, diam: 7.8},
//     { elev: 184.3, diam: 9.4}
//   ]

//   const emb = { diam: 10.0, elev: 252.2, eccentricity: 1.2 }
//  console.log("Creating flute")
//  const fl = new Flute(8, inner, outer, holes, emb)
//
//  console.log(fl.str())
//}

const app = command({
    name: "flutulus",
    args: {
        spec: positional({ type: string, displayName: "flute_spec" }),
    },
    handler: ({ spec }) => {
        const spec_data = fs.readFileSync(spec, { encoding: "utf-8" })
        const flute_spec: FluteSpec = JSON.parse(spec_data)
        process.stdout.write(new Flute(flute_spec).str())
    },
})

run(app, process.argv.slice(2))
