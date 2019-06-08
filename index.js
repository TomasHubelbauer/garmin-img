window.addEventListener('load', async () => {
  // https://download.bbbike.org/osm/bbbike/Prag/
  // http://mirror74.boot-keys.org/Soft/Map/GPS/gpsVP/svn_v375/doc/imgformat.pdf
  const response = await fetch('Prag.img');
  const arrayBuffer = await response.arrayBuffer();
  const dataView = new DataView(arrayBuffer);
  document.body.textContent = JSON.stringify(new GarminImg(dataView), null, 2);
});

class GarminImg {
  constructor(/** @type{DataView} */ dataView) {
    this.xorByte = dataView.getUint8(0x0);
    if (this.xorByte !== 0) {
      throw new Error('XOR byte is not implemented');
    }

    this.updateMonth = dataView.getUint8(0xa);
    this.updateYear = dataView.getUint8(0xb);
    if (this.updateYear >= 0x63) {
      this.updateYear += 1900;
    } else {
      this.updateYear += 2000;
    }

    this.checksum = dataView.getUint8(0xf);
    this.signature = String.fromCharCode(...new Uint8Array(dataView.buffer.slice(0x10, 0x17)));
    if (this.signature !== 'DSKIMG\0') {
      throw new Error(`Invalid signature value '${signature}'.`);
    }

    this.creationYear = dataView.getUint16(0x39, true);
    this.creationMonth = dataView.getUint8(0x3b);
    this.creationDay = dataView.getUint8(0x3c);
    this.creationHour = dataView.getUint8(0x3d);
    this.creationMinute = dataView.getUint8(0x3e);
    this.creationSecond = dataView.getUint8(0x3f);
    this.mapFileId = String.fromCharCode(...new Uint8Array(dataView.buffer.slice(0x41, 0x48)));
    if (this.mapFileId !== 'GARMIN\0') {
      throw new Error(`Invalid map file identifier value '${mapFileId}'.`);
    }

    this.mapDescription = String.fromCharCode(...new Uint8Array(dataView.buffer.slice(0x49, 0x5d)));
    this.mapName = String.fromCharCode(...new Uint8Array(dataView.buffer.slice(0x65, 0x83 /* Drop \0 terminator */))).trim();

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

    this.subfiles = [];
    for (const offset of offsets) {
      const subfileDataView = new DataView(dataView.buffer, offset);
      const type = String.fromCharCode(...new Uint8Array(subfileDataView.buffer.slice(offset + 0x2, offset + 0xc)));
      switch (type) {
        case 'GARMIN RGN': this.subfiles.push(new GarminRgnSubfile(subfileDataView)); break;
        case 'GARMIN TRE': this.subfiles.push(new GarminTreSubfile(subfileDataView)); break;
        case 'GARMIN LBL': this.subfiles.push(new GarminTreSubfile(subfileDataView)); break;
        case 'GARMIN NET': this.subfiles.push(new GarminNetSubfile(subfileDataView)); break;
        case 'GARMIN NOD': this.subfiles.push(new GarminNodSubfile(subfileDataView)); break;
        case 'GARMIN MDR': this.subfiles.push(new GarminMdrSubfile(subfileDataView)); break;
        case 'GARMIN SRT': this.subfiles.push(new GarminSrtSubfile(subfileDataView)); break;
        case 'GARMIN LTD': this.subfiles.push(new GarminLtdSubfile(subfileDataView)); break;
        case 'GARMIN IMA': this.subfiles.push(new GarminImaSubfile(subfileDataView)); break;
        default: throw new Error(`Unpexpected subfile type: '${type}' at offset ${offset}.`);
      }
    }
  }
}

class GarminRgnSubfile {
  constructor(/** @type{DataView} */ dataView) {
    this.creationYear = dataView.getUint16(0xe, true);
    this.creationMonth = dataView.getUint8(0x10);
    this.creationDay = dataView.getUint8(0x11);
    this.creationHour = dataView.getUint8(0x12);
    this.creationMinute = dataView.getUint8(0x13);
    this.creationSecond = dataView.getUint8(0x14);
    this.dataOffset = dataView.getUint32(0x15, true);
    this.dataLength = dataView.getUint32(0x19, true);
  }
}

class GarminTreSubfile {
  constructor(/** @type{DataView} */ dataView) {
    this.locked = dataView.getUint8(0xd);
    if (this.locked !== 0) {
      throw new Error(`The TRE section at offset ${dataView.byteOffset} is locked ('${this.locked}').`)
    }

    this.creationYear = dataView.getUint16(0xe, true);
    this.creationMonth = dataView.getUint8(0x10);
    this.creationDay = dataView.getUint8(0x11);
    this.creationHour = dataView.getUint8(0x12);
    this.creationMinute = dataView.getUint8(0x13);
    this.creationSecond = dataView.getUint8(0x14);
    this.northBoundary = dataView.buffer.slice(0x15, 0x18);
    this.eastBoundary = dataView.buffer.slice(0x18, 0x1b);
    this.southBoundary = dataView.buffer.slice(0x1b, 0x1e);
    this.westBoundary = dataView.buffer.slice(0x1e, 0x21);
    this.mapLevelsOffset = dataView.getUint32(0x21, true);
    this.mapLevelsSize = dataView.getUint32(0x25, true);
    this.subdivisionsOffset = dataView.getUint32(0x29, true);
    this.subdivisionsSize = dataView.getUint32(0x2d, true);
    this.copyrightOffset = dataView.getUint32(0x31, true);
    this.copyrightSize = dataView.getUint32(0x35, true);
    this.copyrightRecordSize = dataView.getUint16(0x39, true);

    const headerLength = dataView.getUint16(0x0, true);

    if (headerLength > 116) {
      // TODO
    }

    if (headerLength > 120) {
      // TODO
    }

    if (headerLength > 154) {
      // TODO
    }

    const mapLevelDataView = new DataView(dataView.buffer, this.mapLevelsOffset);
    for (let index = 0; index < this.mapLevelsSize / 4; index++) {
      const zoom = mapLevelDataView.getUint8(index * 4 + 0x0);
      this.zoomLevel = (zoom & (1 << 3)) + (zoom & (1 << 2)) + (zoom & (1 << 1)) + (zoom & (1 << 0));
      if (zoom & (1 << 4) + zoom & (1 << 5) + zoom & (1 << 6) > 0) {
        throw new Error(`The unknown section isn't all zeroes unlike expected.`);
      }

      this.inherited = zoom & (1 << 7) ? true : false;
      this.bits = mapLevelDataView.getUint8(index * 4 + 0x1);
      this.subdivisions = mapLevelDataView.getUint16(index * 4 + 0x2);
    }

    // TODO: Account for the fact that subdivisions vary in size depending on map level between 14 and 16 bytes
    const subdivisionsDataView = new DataView(dataView.buffer, this.subdivisionsOffset);
    for (let index = 0; index < 1; index++) {
      // TODO: Check this is actually correct
      // Convert from 24 bit to 32 bit
      const rgnOffsetDataView = new DataView(new ArrayBuffer(4));
      rgnOffsetDataView.setUint8(0, subdivisionsDataView.getUint8(index * 14 + 0x0));
      rgnOffsetDataView.setUint8(1, subdivisionsDataView.getUint8(index * 14 + 0x1));
      rgnOffsetDataView.setUint8(2, subdivisionsDataView.getUint8(index * 14 + 0x2));
      const rgnOffset = rgnOffsetDataView.getUint32(0, true);

      // TODO: Decode the or'd flags: points: 0x10, indexedPoints: 0x20, polylines: 0x40, polygons: 0x80
      this.types = subdivisionsDataView.getUint8(index * 14 + 0x3);
      this.longitudeCenter = subdivisionsDataView.buffer.slice(index * 14 + 0x4, index * 14 + 0x4 + 3);
      this.latitudeCenter = subdivisionsDataView.buffer.slice(index * 14 + 0x7, index * 14 + 0x7 + 3);

      // TODO: Pull out the terminating bit
      this.width = subdivisionsDataView.getUint8(index * 14 + 0xa);
      this.height = subdivisionsDataView.getUint8(index * 14 + 0xc);
      // TODO: Read the last two bytes if we are not in the lower map level
    }
  }
}

class GarminLblSubfile {
  constructor(/** @type{DataView} */ dataView) {
    this.creationYear = dataView.getUint16(0xe, true);
    this.creationMonth = dataView.getUint8(0x10);
    this.creationDay = dataView.getUint8(0x11);
    this.creationHour = dataView.getUint8(0x12);
    this.creationMinute = dataView.getUint8(0x13);
    this.creationSecond = dataView.getUint8(0x14);
  }
}

class GarminNetSubfile {
  constructor(/** @type{DataView} */ dataView) {
    this.creationYear = dataView.getUint16(0xe, true);
    this.creationMonth = dataView.getUint8(0x10);
    this.creationDay = dataView.getUint8(0x11);
    this.creationHour = dataView.getUint8(0x12);
    this.creationMinute = dataView.getUint8(0x13);
    this.creationSecond = dataView.getUint8(0x14);
  }
}

class GarminNodSubfile {
  constructor(/** @type{DataView} */ dataView) {
    this.creationYear = dataView.getUint16(0xe, true);
    this.creationMonth = dataView.getUint8(0x10);
    this.creationDay = dataView.getUint8(0x11);
    this.creationHour = dataView.getUint8(0x12);
    this.creationMinute = dataView.getUint8(0x13);
    this.creationSecond = dataView.getUint8(0x14);
  }
}

class GarminMdrSubfile {
  constructor(/** @type{DataView} */ dataView) {
    this.creationYear = dataView.getUint16(0xe, true);
    this.creationMonth = dataView.getUint8(0x10);
    this.creationDay = dataView.getUint8(0x11);
    this.creationHour = dataView.getUint8(0x12);
    this.creationMinute = dataView.getUint8(0x13);
    this.creationSecond = dataView.getUint8(0x14);
  }
}

class GarminSrtSubfile {
  constructor(/** @type{DataView} */ dataView) {
    this.creationYear = dataView.getUint16(0xe, true);
    this.creationMonth = dataView.getUint8(0x10);
    this.creationDay = dataView.getUint8(0x11);
    this.creationHour = dataView.getUint8(0x12);
    this.creationMinute = dataView.getUint8(0x13);
    this.creationSecond = dataView.getUint8(0x14);
  }
}
