# Native BRep runner dependency inventory

- `build123d==0.8.0`: Apache-2.0 (upstream project license).
- OpenCascade Technology, brought in through build123d/OCP: LGPL-2.1 with the OCCT exception.

The image is pinned by the `BUILD123D_VERSION` build argument. The runner has
no network at execution time. Before distributing a built image, retain the
upstream license notices required by these dependencies.
