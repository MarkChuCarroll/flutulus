# Conic Bore Flute Generator

Since I discovered that 3d printers have become precise enough
to actually print working, playable woodwinds that genuinely
sound good, I've been obsessed.

This repository is where I'll be keeping my designs. 

My first working instrument is a b-minor conic bore flute with a lip-plate. The outer body has octagonal facets, because I thought they look nice, and feel good when you hold the flute.

The hole pattern was initially generated by demakein[^1], and then
the measurements generated by demakein were put into my scad program and manually tweaked to come up with a working instrument.

[^1]: Demakein is an interesting piece of software, which I simultaneously love and loathe. On the positive side, it's doing
really impressive mathematical analysis to come up with an optimal layout for a working instrument, and that's awesome. But on the negative side, it was written for Python 2.7 and never
updated, it's totally undocumented, and it's flaky as all hell.
I'm actually trying to convert it to Python3, but it's a tough
slog, because most of the time, I have no clue what it's doing,
and there's absolutely no guidance in the code.
