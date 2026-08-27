import * as THREE from 'three';
import { zipSync, strToU8 } from 'fflate';

export const CONVERTIBLE_3D_EXTENSIONS = ['stl', 'obj'] as const;

function geometryToModelXml(geometry: THREE.BufferGeometry): string {
  const position = geometry.getAttribute('position');
  const index = geometry.getIndex();

  const vertexLines: string[] = [];
  for (let i = 0; i < position.count; i++) {
    vertexLines.push(`<vertex x="${position.getX(i)}" y="${position.getY(i)}" z="${position.getZ(i)}"/>`);
  }

  const triangleLines: string[] = [];
  if (index) {
    for (let i = 0; i < index.count; i += 3) {
      triangleLines.push(`<triangle v1="${index.getX(i)}" v2="${index.getX(i + 1)}" v3="${index.getX(i + 2)}"/>`);
    }
  } else {
    for (let i = 0; i < position.count; i += 3) {
      triangleLines.push(`<triangle v1="${i}" v2="${i + 1}" v3="${i + 2}"/>`);
    }
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<model unit="millimeter" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02">
  <resources>
    <object id="1" type="model">
      <mesh>
        <vertices>${vertexLines.join('')}</vertices>
        <triangles>${triangleLines.join('')}</triangles>
      </mesh>
    </object>
  </resources>
  <build>
    <item objectid="1"/>
  </build>
</model>`;
}

/** Packs a mesh into a minimal, valid .3mf (a ZIP with the required OPC parts). */
export function geometryTo3mfBlob(geometry: THREE.BufferGeometry): Blob {
  const contentTypesXml = `<?xml version="1.0" encoding="UTF-8"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="model" ContentType="application/vnd.ms-package.3dmanufacturing-3dmodel+xml"/>
</Types>`;

  const relsXml = `<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Target="/3D/3dmodel.model" Id="rel0" Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel"/>
</Relationships>`;

  const zipped = zipSync({
    '[Content_Types].xml': strToU8(contentTypesXml),
    '_rels/.rels': strToU8(relsXml),
    '3D/3dmodel.model': strToU8(geometryToModelXml(geometry)),
  });

  return new Blob([new Uint8Array(zipped)], { type: 'model/3mf' });
}

/** Converts an .stl or .obj file to a .3mf Blob, entirely client-side. Throws on unsupported
 * formats or unparsable files. */
export async function convertModelTo3mf(file: File): Promise<Blob> {
  const ext = file.name.toLowerCase().split('.').pop();
  const buffer = await file.arrayBuffer();

  if (ext === 'stl') {
    const { STLLoader } = await import('three/examples/jsm/loaders/STLLoader.js');
    const geometry = new STLLoader().parse(buffer);
    return geometryTo3mfBlob(geometry);
  }

  if (ext === 'obj') {
    const { OBJLoader } = await import('three/examples/jsm/loaders/OBJLoader.js');
    const { mergeGeometries } = await import('three/examples/jsm/utils/BufferGeometryUtils.js');
    const text = new TextDecoder().decode(buffer);
    const group = new OBJLoader().parse(text);
    const geometries: THREE.BufferGeometry[] = [];
    group.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) geometries.push((child as THREE.Mesh).geometry);
    });
    if (geometries.length === 0) throw new Error('no mesh found in OBJ');
    const merged = geometries.length === 1 ? geometries[0] : mergeGeometries(geometries, false);
    return geometryTo3mfBlob(merged);
  }

  throw new Error(`unsupported format: ${ext}`);
}
