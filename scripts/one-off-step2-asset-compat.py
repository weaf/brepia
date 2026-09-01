from pathlib import Path

path = Path('src/worker/openSCAD.ts')
text = path.read_text()
old = """      instance.FS.writeFile(projectPath, file.content);
    }
    if (!this.fileExists(instance, '/libraries')) {
"""
new = """      instance.FS.writeFile(projectPath, file.content);
    }

    // Existing uploaded mesh files are intentionally still an external cache
    // until the explicit project-asset phase. OpenSCAD resolves import()
    // relative to the importing script, so mirror each cached basename beside
    // the entrypoint to preserve the v1 import(\"mesh.stl\") behavior after
    // moving the script from /input.scad into /project/<entrypoint>.
    const entrypointSegments = normalizedProject.entrypointPath.split('/');
    entrypointSegments.pop();
    const entrypointDir = entrypointSegments.join('/');
    const projectSourcePaths = new Set(
      normalizedProject.files.map((file) => `${projectRoot}/${file.path}`),
    );
    for (const externalFile of this.files) {
      if (!externalFile.path) continue;
      const externalName = externalFile.path
        .replace(/\\\\/g, '/')
        .split('/')
        .pop();
      if (!externalName || externalName === '.' || externalName === '..') {
        continue;
      }
      const externalPath = `${projectRoot}/${
        entrypointDir ? `${entrypointDir}/` : ''
      }${externalName}`;
      if (projectSourcePaths.has(externalPath)) {
        throw new Error(
          `External OpenSCAD asset collides with project source: ${externalName}`,
        );
      }
      const externalContent = await externalFile.arrayBuffer();
      instance.FS.writeFile(externalPath, new Int8Array(externalContent));
    }

    if (!this.fileExists(instance, '/libraries')) {
"""
count = text.count(old)
if count != 1:
    raise SystemExit(f'expected one project mount insertion point, found {count}')
path.write_text(text.replace(old, new))
print('Applied entrypoint-relative external mesh compatibility patch.')
