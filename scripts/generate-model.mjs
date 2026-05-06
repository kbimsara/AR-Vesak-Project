/**
 * Generates a minimal placeholder lantern.glb using raw GLB binary.
 * This is a valid GLB file containing a simple box mesh — replace with
 * a real Vesak lantern asset when available.
 *
 * Run: node scripts/generate-model.mjs
 */

import { writeFileSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = join(__dirname, "../public/models");

mkdirSync(outDir, { recursive: true });

// Minimal valid GLB: a single triangle mesh (bright gold box approximation)
// Built from spec-compliant GLB 2.0 binary structure
// Buffer data: positions for a unit box (12 triangles × 3 vertices × 3 floats)
const positions = new Float32Array([
  // Front face
  -0.5,-0.5, 0.5,  0.5,-0.5, 0.5,  0.5, 0.5, 0.5,
  -0.5,-0.5, 0.5,  0.5, 0.5, 0.5, -0.5, 0.5, 0.5,
  // Back face
   0.5,-0.5,-0.5, -0.5,-0.5,-0.5, -0.5, 0.5,-0.5,
   0.5,-0.5,-0.5, -0.5, 0.5,-0.5,  0.5, 0.5,-0.5,
  // Left face
  -0.5,-0.5,-0.5, -0.5,-0.5, 0.5, -0.5, 0.5, 0.5,
  -0.5,-0.5,-0.5, -0.5, 0.5, 0.5, -0.5, 0.5,-0.5,
  // Right face
   0.5,-0.5, 0.5,  0.5,-0.5,-0.5,  0.5, 0.5,-0.5,
   0.5,-0.5, 0.5,  0.5, 0.5,-0.5,  0.5, 0.5, 0.5,
  // Top face
  -0.5, 0.5, 0.5,  0.5, 0.5, 0.5,  0.5, 0.5,-0.5,
  -0.5, 0.5, 0.5,  0.5, 0.5,-0.5, -0.5, 0.5,-0.5,
  // Bottom face
  -0.5,-0.5,-0.5,  0.5,-0.5,-0.5,  0.5,-0.5, 0.5,
  -0.5,-0.5,-0.5,  0.5,-0.5, 0.5, -0.5,-0.5, 0.5,
]);

const vertexCount = positions.length / 3;
const binBuffer = Buffer.from(positions.buffer);
// Pad to 4-byte boundary
const paddedBin = binBuffer.length % 4 === 0 ? binBuffer : Buffer.concat([binBuffer, Buffer.alloc(4 - (binBuffer.length % 4))]);

const min = [-0.5, -0.5, -0.5];
const max = [ 0.5,  0.5,  0.5];

const json = JSON.stringify({
  asset: { version: "2.0", generator: "AR-Vesak placeholder" },
  scene: 0,
  scenes: [{ nodes: [0] }],
  nodes: [{ mesh: 0, name: "Lantern" }],
  meshes: [{
    name: "LanternMesh",
    primitives: [{
      attributes: { POSITION: 0 },
      material: 0,
    }],
  }],
  materials: [{
    name: "Gold",
    pbrMetallicRoughness: {
      baseColorFactor: [0.788, 0.659, 0.298, 1.0], // Vesak gold
      metallicFactor: 0.8,
      roughnessFactor: 0.2,
    },
  }],
  accessors: [{
    bufferView: 0,
    componentType: 5126, // FLOAT
    count: vertexCount,
    type: "VEC3",
    min,
    max,
  }],
  bufferViews: [{
    buffer: 0,
    byteOffset: 0,
    byteLength: binBuffer.length,
    target: 34962, // ARRAY_BUFFER
  }],
  buffers: [{ byteLength: paddedBin.length }],
});

const jsonBytes = Buffer.from(json, "utf8");
const jsonPad = jsonBytes.length % 4 === 0 ? 0 : 4 - (jsonBytes.length % 4);
const jsonChunk = Buffer.concat([jsonBytes, Buffer.alloc(jsonPad, 0x20)]); // space pad

const totalLength = 12 + (8 + jsonChunk.length) + (8 + paddedBin.length);
const header = Buffer.alloc(12);
header.writeUInt32LE(0x46546C67, 0); // magic "glTF"
header.writeUInt32LE(2, 4);           // version 2
header.writeUInt32LE(totalLength, 8);

const jsonChunkHeader = Buffer.alloc(8);
jsonChunkHeader.writeUInt32LE(jsonChunk.length, 0);
jsonChunkHeader.writeUInt32LE(0x4E4F534A, 4); // "JSON"

const binChunkHeader = Buffer.alloc(8);
binChunkHeader.writeUInt32LE(paddedBin.length, 0);
binChunkHeader.writeUInt32LE(0x004E4942, 4); // "BIN\0"

const glb = Buffer.concat([header, jsonChunkHeader, jsonChunk, binChunkHeader, paddedBin]);
const outPath = join(outDir, "lantern.glb");
writeFileSync(outPath, glb);
console.log(`✓ Written ${glb.length} bytes → ${outPath}`);
