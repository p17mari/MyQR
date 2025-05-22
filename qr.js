function createMatrix(dataBits) {
    const size = 21;
    const matrix = Array.from({ length: size }, () => Array(size).fill(null));

    addFinderPatterns(matrix);
    addTimingPatterns(matrix);

    let dirUp = true;
    let col = size - 1;
    let bitIndex = 0;

    while (col > 0) {
        if (col === 6) col--; // Skip timing column

        for (let row = 0; row < size; row++) {
            let actualRow = dirUp ? size - 1 - row : row;

            for (let i = 0; i < 2; i++) {
                const x = col - i;
                const y = actualRow;
                if (matrix[y][x] === null) {
                    const bit = bitIndex < dataBits.length ? dataBits[bitIndex++] === '1' : false;
                    matrix[y][x] = bit;
                }
            }
        }

        col -= 2;
        dirUp = !dirUp;
    }

    // Fill remaining nulls with false (white)
    for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
            if (matrix[y][x] === null) matrix[y][x] = false;
        }
    }

    return matrix;
}
function addFinderPatterns(matrix) {
    const positions = [
        [0, 0], // Top-left
        [0, 14], // Top-right
        [14, 0], // Bottom-left
    ];

    positions.forEach(([y, x]) => {
        for (let dy = 0; dy < 7; dy++) {
            for (let dx = 0; dx < 7; dx++) {
                const isBorder = dy === 0 || dx === 0 || dy === 6 || dx === 6;
                const isCenter = dy >= 2 && dy <= 4 && dx >= 2 && dx <= 4;
                matrix[y + dy][x + dx] = isBorder || isCenter;
            }
        }
    });
}

function addTimingPatterns(matrix) {
    for (let i = 8; i < 21 - 8; i++) {
        const bit = i % 2 === 0;
        matrix[6][i] = bit;
        matrix[i][6] = bit;
    }
}
function generateQR() {
    const text = document.getElementById("text").value;
    const binary = encodeData(text);
    const matrix = createMatrix(binary);
    renderMatrix(matrix);
}
function reedSolomon(dataBytes, ecLength) {
    const gfExp = new Array(512);
    const gfLog = new Array(256);
    let x = 1;

    for (let i = 0; i < 255; i++) {
        gfExp[i] = x;
        gfLog[x] = i;
        x <<= 1;
        if (x & 0x100) x ^= 0x11d;
    }
    for (let i = 255; i < 512; i++) gfExp[i] = gfExp[i - 255];

    function multiply(a, b) {
        return a === 0 || b === 0 ? 0 : gfExp[gfLog[a] + gfLog[b]];
    }

    const ec = new Array(ecLength).fill(0);
    for (let i = 0; i < dataBytes.length; i++) {
        const factor = dataBytes[i] ^ ec[0];
        ec.shift();
        ec.push(0);
        if (factor !== 0) {
            for (let j = 0; j < ecLength; j++) {
                ec[j] ^= multiply(factor, generator[ecLength][j]);
            }
        }
    }

    return ec;
}

// Generator polynomials for ECC length 7
const generator = {
    7: [87, 229, 146, 149, 238, 102, 21]
};

function encodeData(text) {
    const modeIndicator = '0100';
    const charCount = text.length.toString(2).padStart(8, '0');
    const binaryData = Array.from(text).map(ch => ch.charCodeAt(0).toString(2).padStart(8, '0')).join('');
    let bitstream = modeIndicator + charCount + binaryData;
    bitstream = bitstream.padEnd(152, '0');

    const bytes = [];
    for (let i = 0; i < 152; i += 8) {
        bytes.push(parseInt(bitstream.substr(i, 8), 2));
    }

    while (bytes.length < 19) {
        bytes.push(bytes.length % 2 ? 0x11 : 0xEC);
    }

    const ecc = reedSolomon(bytes, 7);
    const fullBytes = bytes.concat(ecc);
    return fullBytes.map(b => b.toString(2).padStart(8, '0')).join('');
}

function applyMask(matrix) {
    const size = matrix.length;
    for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
            if (isDataArea(x, y)) {
                matrix[y][x] ^= (x + y) % 2 === 0;
            }
        }
    }
}

function isDataArea(x, y) {
    // Avoid reserved areas (finder, timing, etc.)
    return !(
        (x < 9 && y < 9) || // top-left
        (x >= matrix.length - 8 && y < 9) || // top-right
        (x < 9 && y >= matrix.length - 8) || // bottom-left
        x === 6 || y === 6 // timing patterns
    );
}

function applyFormatInfo(matrix) {
    const formatBits = "111011111000100"; // From QR spec for (L, mask 0)
    const size = matrix.length;

    for (let i = 0; i < 15; i++) {
        const bit = formatBits[i] === '1';

        // Vertical near top-left
        if (i < 6) matrix[i][8] = bit;
        else if (i === 6) matrix[i + 1][8] = bit;
        else matrix[size - 15 + i][8] = bit;

        // Horizontal near top-left
        if (i < 8) matrix[8][size - i - 1] = bit;
        else matrix[8][14 - i] = bit;
    }
}

function renderMatrix(matrix) {
    const size = matrix.length;
    const cellSize = 10;
    const border = 4;
    const fullSize = (size + border * 2) * cellSize;

    let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${fullSize}" height="${fullSize}">`;
    svg += `<rect width="${fullSize}" height="${fullSize}" fill="white"/>`;

    for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
            if (matrix[y][x]) {
                svg += `<rect x="${(x + border) * cellSize}" y="${(y + border) * cellSize}" width="${cellSize}" height="${cellSize}" fill="black"/>`;
            }
        }
    }

    svg += "</svg>";
    document.getElementById("qrcode").innerHTML = svg;
}
