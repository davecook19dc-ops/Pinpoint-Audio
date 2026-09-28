/**
 * Lightweight SVG QR Code / Matrix Generator for Pairing Codes
 * Generates an SVG path data string for a 2D matrix representing the string payload.
 */

function simpleHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

export function generateQrMatrix(data: string, size: number = 21): boolean[][] {
  const matrix: boolean[][] = Array.from({ length: size }, () =>
    Array.from({ length: size }, () => false)
  );

  // Helper to place 7x7 finder pattern
  const addFinder = (row: number, col: number) => {
    for (let r = -1; r <= 7; r++) {
      for (let c = -1; c <= 7; c++) {
        const nr = row + r;
        const nc = col + c;
        if (nr >= 0 && nr < size && nc >= 0 && nc < size) {
          if (r === -1 || r === 7 || c === -1 || c === 7) {
            matrix[nr][nc] = false;
          } else if (r === 0 || r === 6 || c === 0 || c === 6) {
            matrix[nr][nc] = true;
          } else if (r >= 2 && r <= 4 && c >= 2 && c <= 4) {
            matrix[nr][nc] = true;
          } else {
            matrix[nr][nc] = false;
          }
        }
      }
    }
  };

  // 1. Finder patterns at Top-Left, Top-Right, Bottom-Left
  addFinder(0, 0);
  addFinder(0, size - 7);
  addFinder(size - 7, 0);

  // 2. Timing patterns
  for (let i = 8; i < size - 8; i++) {
    matrix[6][i] = i % 2 === 0;
    matrix[i][6] = i % 2 === 0;
  }

  // 3. Fill data pseudo-randomly seeded by data string
  let seed = simpleHash(data || 'PINPOINT');
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      // Skip finder corners
      const isTopLeft = r < 8 && c < 8;
      const isTopRight = r < 8 && c >= size - 8;
      const isBottomLeft = r >= size - 8 && c < 8;
      const isTiming = r === 6 || c === 6;

      if (!isTopLeft && !isTopRight && !isBottomLeft && !isTiming) {
        seed = (seed * 9301 + 49297) % 233280;
        const bit = seed % 2 === 0;
        matrix[r][c] = bit;
      }
    }
  }

  return matrix;
}

export function generateQrSvgPath(data: string, matrixSize: number = 21): string {
  const matrix = generateQrMatrix(data, matrixSize);
  let path = '';
  for (let r = 0; r < matrixSize; r++) {
    for (let c = 0; c < matrixSize; c++) {
      if (matrix[r][c]) {
        path += `M${c},${r}h1v1h-1z `;
      }
    }
  }
  return path;
}
