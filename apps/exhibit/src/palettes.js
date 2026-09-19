/**
 * Six colour schemes, each taken from a real animal.
 *
 * These are not decoration. The creatures are drawn as translucent gel with
 * additive wireframe, additive points and additive strands over it, and
 * additive layers behave nothing like the paint-on-canvas model a palette is
 * usually chosen under: they SUM. Four rules fall out of that, and every
 * scheme below was corrected against them rather than picked by eye.
 *
 * 1. THREE STOPS ON THE BELL, NEVER TWO. A sweep from one hue to a distant
 *    other interpolates through the desaturated middle of the colour cube. A
 *    two-stop mint-to-gold bell reads as olive across its whole midband, which
 *    is the largest area on screen. `bellMid` pins the route the sweep takes.
 *
 * 2. LEAVE HEADROOM. No channel above ~235. A colour at 255 in one channel
 *    clips the moment a second additive layer lands on it, and once a channel
 *    clips the R:G:B ratio is gone — which is to say the hue is gone. The
 *    first version of this file had four swatches at ceiling green and turned
 *    highlighter-yellow wherever two layers crossed.
 *
 * 3. THE GEL HAS TO SURVIVE. It is drawn at 0.26 opacity, so a gel much more
 *    than twice as dark as the apex contributes almost nothing and the animal
 *    reads as a hollow ring instead of a body. Every gel here sits within 2.5x
 *    of its bell's luminance.
 *
 * 4. MOTES ARE WATER, NOT CREATURE. Suspended particles within a few degrees
 *    of the bell's hue read as shed fragments of the animal. Every mote colour
 *    is at least 25 degrees away from its own bellTop.
 *
 * Rules 1 and 4 have one deliberate exception, Aequorin Frost, which is
 * near-achromatic on purpose: a crystal jelly has no pigment at all, and its
 * one chromatic event is the light it makes itself.
 */

window.PALETTES = [
  {
    name: "Frost Lantern",
    organism: "Bathykorus bouilloni",
    note: "1,000–2,500 m, Canada Basin. No daylight reaches it; the only colour it ever has is the 480 nm light it makes itself.",
    bellTop: "#9ECCE8",
    bellMid: "#6BABD2",
    bellMargin: "#2F72A6",
    gel: "#7FB9D1",
    tentacleNear: "#AED6E8",
    tentacleTip: "#3AA8DC",
    glow: "#35DCD2",
    water: "#020509",
    motes: "#9A90B0",
    keyLight: "#DCEFFA",
    fillLight: "#2C6B86",
  },
  {
    name: "Ember Nettle",
    organism: "Chrysaora fuscescens",
    note: "The Pacific sea nettle, backlit in shallow coastal water — one of the few jellies that is genuinely hot in hue.",
    bellTop: "#EBC06B",
    bellMid: "#C9722A",
    bellMargin: "#96280C",
    gel: "#B0561A",
    tentacleNear: "#E8A03C",
    tentacleTip: "#A8221A",
    glow: "#E87A1A",
    water: "#050B0D",
    motes: "#7E9A8E",
    keyLight: "#F5D49E",
    fillLight: "#1E7A72",
  },
  {
    name: "Sulphur Bloom",
    organism: "Tomopteris nisseni",
    note: "Almost all ocean light is blue. This worm burns yellow at 570 nm, which is as close to a warning colour as the deep sea gets.",
    bellTop: "#E8E257",
    bellMid: "#8FBE3A",
    bellMargin: "#17703A",
    gel: "#16846F",
    tentacleNear: "#C6E63A",
    tentacleTip: "#2FB585",
    glow: "#B4E82A",
    water: "#040A07",
    motes: "#6E9A9C",
    keyLight: "#E4F5B8",
    fillLight: "#1F9E86",
  },
  {
    name: "Diffraction Bloom",
    organism: "Beroe forskalii",
    note: "A comb jelly has next to no pigment. The running rainbow is light diffracting off beating cilia, so the hue travels with the wave.",
    bellTop: "#62E8C0",
    bellMid: "#C6DC46",
    bellMargin: "#E0913A",
    gel: "#1C8C80",
    tentacleNear: "#E8A542",
    tentacleTip: "#3CD8C4",
    glow: "#8CE034",
    water: "#03080B",
    motes: "#8E9AA8",
    keyLight: "#E0F5EC",
    fillLight: "#C07830",
  },
  {
    name: "Cinder Lure",
    organism: "Erenna sirena",
    note: "Red light does not exist at 1,600 m, so a red animal is invisible. This siphonophore chooses to emit red anyway, and flicks the lure.",
    bellTop: "#E8A238",
    bellMid: "#C23C24",
    bellMargin: "#8E1230",
    gel: "#B03A22",
    tentacleNear: "#932018",
    tentacleTip: "#E84A22",
    glow: "#E85212",
    water: "#0A0506",
    motes: "#8C9AA6",
    keyLight: "#F2C48E",
    fillLight: "#6E1828",
  },
  {
    name: "Aequorin Frost",
    organism: "Aequorea victoria",
    note: "The crystal jelly is effectively colourless glass. Its one hue is the 509 nm ring of light along the bell margin — the protein that made cells glow green in every lab since.",
    bellTop: "#D2E8DC",
    bellMid: "#93B4AC",
    bellMargin: "#4E7A72",
    gel: "#A4C4BE",
    tentacleNear: "#CFE8DC",
    tentacleTip: "#5E868C",
    glow: "#5CE8B4",
    water: "#060B0C",
    motes: "#A09488",
    keyLight: "#D4EDE2",
    fillLight: "#34605A",
  },
];
