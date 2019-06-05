window.addEventListener('load', async () => {
  // https://download.bbbike.org/osm/bbbike/Prag/
  // http://mirror74.boot-keys.org/Soft/Map/GPS/gpsVP/svn_v375/doc/imgformat.pdf
  const response = await fetch('Prag.img');
  const arrayBuffer = await response.arrayBuffer();
  const uint8Array = new Uint8Array(arrayBuffer);
  const dataView = new DataView(arrayBuffer);

  const xorByte = dataView.getUint8(0x0);
  if (xorByte !== 0) {
    throw new Error('XOR byte is not implemented');
  }

  const unknown1 = uint8Array.slice(0x1, 0xa);
  const updateMonth = dataView.getUint8(0xa);
  let updateYear = dataView.getUint8(0xb);
  if (updateYear >= 0x63) {
    updateYear += 1900;
  } else {
    updateYear += 2000;
  }

  const unknown2 = uint8Array.slice(0xc, 0xf);
  const checksum = dataView.getUint8(0xf);
  const signature = String.fromCharCode(...uint8Array.slice(0x10, 0x17));
  if (signature !== 'DSKIMG\0') {
    throw new Error(`Invalid signature value '${signature}'.`);
  }

  const creationYear = dataView.getUint16(0x39, true);
  const creationMonth = dataView.getUint8(0x3b);
  const creationDay = dataView.getUint8(0x3c);
  const creationHour = dataView.getUint8(0x3d);
  const creationMinute = dataView.getUint8(0x3e);
  const creationSecond = dataView.getUint8(0x3f);
  const mapFileId = String.fromCharCode(...uint8Array.slice(0x41, 0x48));
  if (mapFileId !== 'GARMIN\0') {
    throw new Error(`Invalid map file identifier value '${mapFileId}'.`);
  }

  const mapDescription = String.fromCharCode(...uint8Array.slice(0x49, 0x5d));
  const mapName = String.fromCharCode(...uint8Array.slice(0x65, 0x83 /* Drop \0 terminator */)).trim();

  // TODO: Figure out how to calculate the subsequent offsets (the FAT?)
  const firstSubfileOffset = dataView.getUint32(0x40c, true);
  const offsets = [
    firstSubfileOffset, // 19456 RGN
    89600, // TRE
    90624, // LBL
    93229, // LTD
    93295, // LTD
    93311, // IMA
    102912, // NET
    197120, // NOD
    391168, // RGN
    489472, // TRE
    490496, // LBL
    494571, // LTD
    494637, // LTD
    494653, // IMA
    508416, // NET
    627200, // NOD
    882688, // RGN
    976896, // TRE
    977920, // LBL
    981385, // LTD
    981451, // LTD
    981467, // IMA
    993280, // NET
    1098752, // NOD
    1322496, // RGN
    1395712, // TRE
    1396736, // LBL
    1399165, // LTD
    1399231, // LTD
    1399247, // IMA
    1408000, // NET
    1495552, // NOD
    1686016, // RGN
    1780736, // TRE
    1781760, // LBL
    1787695, // LTD
    1787761, // LTD
    1787777, // IMA
    1801216, // NET
    1914368, // NOD
    2152960, // MDR
    2175488, // SRT
  ];

  const types = ['RGN', 'LBL', 'TRE', 'NET', 'NOD', 'MDR', 'LTD', 'IMA', 'SRT'];
  for (const offset of offsets) {
    const headerLength = dataView.getUint16(offset + 0x0, true);
    const type = String.fromCharCode(...uint8Array.slice(offset + 0x2, offset + 0xc));
    if (type.length !== 10 || !type.startsWith('GARMIN ') || !types.includes(type.substring('GARMIN '.length))) {
      throw new Error(`Unknown subfile type '${type}'`);
    }

    switch (type) {
      case 'GARMIN RGN': {
        const creationYear = dataView.getUint16(offset + 0xe, true);
        const creationMonth = dataView.getUint8(offset + 0x10);
        const creationDay = dataView.getUint8(offset + 0x11);
        const creationHour = dataView.getUint8(offset + 0x12);
        const creationMinute = dataView.getUint8(offset + 0x13);
        const creationSecond = dataView.getUint8(offset + 0x14);
        const dataOffset = dataView.getUint32(offset + 0x15, true);
        const dataLength = dataView.getUint32(offset + 0x19, true);
        console.log('RNG at', offset, 'size', dataLength);
        break;
      }
      case 'GARMIN TRE': {
        const locked = dataView.getUint8(offset + 0xd);
        if (locked !== 0) {
          throw new Error(`The TRE section at offset ${offset} is locked ('${locked}').`)
        }

        const creationYear = dataView.getUint16(offset + 0xe, true);
        const creationMonth = dataView.getUint8(offset + 0x10);
        const creationDay = dataView.getUint8(offset + 0x11);
        const creationHour = dataView.getUint8(offset + 0x12);
        const creationMinute = dataView.getUint8(offset + 0x13);
        const creationSecond = dataView.getUint8(offset + 0x14);
        const northBoundary = arrayBuffer.slice(offset + 0x15, offset + 0x18);
        const eastBoundary = arrayBuffer.slice(offset + 0x18, offset + 0x1b);
        const southBoundary = arrayBuffer.slice(offset + 0x1b, offset + 0x1e);
        const westBoundary = arrayBuffer.slice(offset + 0x1e, offset + 0x21);
        const mapLevelsOffset = dataView.getUint32(offset + 0x21, true);
        const mapLevelsSize = dataView.getUint32(offset + 0x25, true);
        const subdivisionsOffset = dataView.getUint32(offset + 0x29, true);
        const subdivisionsSize = dataView.getUint32(offset + 0x2d, true);
        const copyrightOffset = dataView.getUint32(offset + 0x31, true);
        const copyrightSize = dataView.getUint32(offset + 0x35, true);
        const copyrightRecordSize = dataView.getUint16(offset + 0x39, true);
        if (headerLength > 116) {
          // TODO
        }

        if (headerLength > 120) {
          // TODO
        }

        if (headerLength > 154) {
          // TODO
        }

        for (let index = 0; index < mapLevelsSize / 4; index++) {
          const zoom = dataView.getUint8(offset + mapLevelsOffset + index * 4 + 0x0);
          const zoomLevel = (zoom & (1 << 3)) + (zoom & (1 << 2)) + (zoom & (1 << 1)) + (zoom & (1 << 0));
          const zoomBit4 = zoom & (1 << 4) ? 1 : 0;
          const zoomBit5 = zoom & (1 << 5) ? 1 : 0;
          const zoomBit6 = zoom & (1 << 6) ? 1 : 0;
          if (zoomBit4 + zoomBit5 + zoomBit6 > 0) {
            throw new Error('The unknown section ');
          }

          const inherited = zoom & (1 << 7) ? true : false;
          const bits = dataView.getUint8(offset + mapLevelsOffset + index * 4 + 0x1);
          const subdivisions = dataView.getUint16(offset + mapLevelsOffset + index * 4 + 0x2);
        }

        // TODO: Account for the fact that subdivisions vary in size depending on map level between 14 and 16 bytes
        for (let index = 0; index < 1; index++) {
          // TODO: Check this is actually correct
          // Convert from 24 bit to 32 bit
          const rgnOffsetDataView = new DataView(new ArrayBuffer(4));
          rgnOffsetDataView.setUint8(0, dataView.getUint8(offset + subdivisionsOffset + index * 14 + 0x0));
          rgnOffsetDataView.setUint8(1, dataView.getUint8(offset + subdivisionsOffset + index * 14 + 0x1));
          rgnOffsetDataView.setUint8(2, dataView.getUint8(offset + subdivisionsOffset + index * 14 + 0x2));
          const rgnOffset = rgnOffsetDataView.getUint32(0, true);

          // TODO: Decode the or'd flags: points: 0x10, indexedPoints: 0x20, polylines: 0x40, polygons: 0x80
          const types = dataView.getUint8(offset + subdivisionsOffset + index * 14 + 0x3);
          const longitudeCenter = arrayBuffer.slice(offset + subdivisionsOffset + index * 14 + 0x4, offset + subdivisionsOffset + index * 14 + 0x4 + 3);
          const latitudeCenter = arrayBuffer.slice(offset + subdivisionsOffset + index * 14 + 0x7, offset + subdivisionsOffset + index * 14 + 0x7 + 3);

          // TODO: Pull out the terminating bit
          const width = dataView.getUint8(offset + subdivisionsOffset + index * 14 + 0xa);
          const height = dataView.getUint8(offset + subdivisionsOffset + index * 14 + 0xc);
          // TODO: Read the last two bytes if we are not in the lower map level
          console.log(rgnOffset, getUint24(dataView, offset + subdivisionsOffset, true), types, { points: 0x10, indexedPoints: 0x20, polylines: 0x40, polygons: 0x80 });
        }

        break;
      }
      case 'GARMIN LBL': {
        const creationYear = dataView.getUint16(offset + 0xe, true);
        const creationMonth = dataView.getUint8(offset + 0x10);
        const creationDay = dataView.getUint8(offset + 0x11);
        const creationHour = dataView.getUint8(offset + 0x12);
        const creationMinute = dataView.getUint8(offset + 0x13);
        const creationSecond = dataView.getUint8(offset + 0x14);

        break;
      }
      case 'GARMIN NET': {
        const creationYear = dataView.getUint16(offset + 0xe, true);
        const creationMonth = dataView.getUint8(offset + 0x10);
        const creationDay = dataView.getUint8(offset + 0x11);
        const creationHour = dataView.getUint8(offset + 0x12);
        const creationMinute = dataView.getUint8(offset + 0x13);
        const creationSecond = dataView.getUint8(offset + 0x14);

        break;
      }
      case 'GARMIN NOD': {
        const creationYear = dataView.getUint16(offset + 0xe, true);
        const creationMonth = dataView.getUint8(offset + 0x10);
        const creationDay = dataView.getUint8(offset + 0x11);
        const creationHour = dataView.getUint8(offset + 0x12);
        const creationMinute = dataView.getUint8(offset + 0x13);
        const creationSecond = dataView.getUint8(offset + 0x14);

        break;
      }
      case 'GARMIN MDR': {
        const creationYear = dataView.getUint16(offset + 0xe, true);
        const creationMonth = dataView.getUint8(offset + 0x10);
        const creationDay = dataView.getUint8(offset + 0x11);
        const creationHour = dataView.getUint8(offset + 0x12);
        const creationMinute = dataView.getUint8(offset + 0x13);
        const creationSecond = dataView.getUint8(offset + 0x14);

        break;
      }
      case 'GARMIN SRT': {
        const creationYear = dataView.getUint16(offset + 0xe, true);
        const creationMonth = dataView.getUint8(offset + 0x10);
        const creationDay = dataView.getUint8(offset + 0x11);
        const creationHour = dataView.getUint8(offset + 0x12);
        const creationMinute = dataView.getUint8(offset + 0x13);
        const creationSecond = dataView.getUint8(offset + 0x14);

        break;
      }
      case 'GARMIN LTD': {
        break;
      }
      case 'GARMIN IMA': {
        break;
      }
      default: {
        throw new Error(`Unpexpected subfile type: '${type}'.`);
      }
    }
  }
});

function getUint24(dataView, offset, littleEndian) {
  let b1, b2, b3;
  if (littleEndian) {
    b1 = dataView.getUint8(offset);
    b2 = dataView.getUint8(offset + 1);
    b3 = dataView.getUint8(offset + 2);
  } else {
    b3 = dataView.getUint8(offset);
    b2 = dataView.getUint8(offset + 1);
    b1 = dataView.getUint8(offset + 2);
  }

  return (b3 << 16) + (b2 << 8) + b1;
}
