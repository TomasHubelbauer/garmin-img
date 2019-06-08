window.addEventListener('load', async () => {
  // https://download.bbbike.org/osm/bbbike/Prag/
  // https://github.com/jerome077/gpsvp/blob/master/doc/imgformat.pdf
  const response = await fetch('Prag.img');
  const arrayBuffer = await response.arrayBuffer();
  const dataView = new DataView(arrayBuffer);
  const garminImg = new GarminImg(dataView);
  document.body.textContent = JSON.stringify(garminImg.subfiles, null, 2);
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

    const firstSubfileOffset = dataView.getUint32(0x40c, true);

    const fatOffset = 0x600;
    const fatLength = firstSubfileOffset - fatOffset;
    const blockSize = 512;
    const blockCount = fatLength / blockSize;

    const files = [];

    for (let blockIndex = 0; blockIndex < blockCount; blockIndex++) {
      const blockDataView = new DataView(dataView.buffer, fatOffset + blockIndex * 512);
      const blockFlag = blockDataView.getUint8(0x0);
      if (blockFlag === 0x0) {
        if (blockIndex !== blockCount - 1) {
          throw new Error('Dummy block found but is not last block!');
        }

        break;
      }

      const blockSubfileName = String.fromCharCode(...new Uint8Array(blockDataView.buffer.slice(blockDataView.byteOffset + 0x1, blockDataView.byteOffset + 0x9)));
      const blockSubfileType = String.fromCharCode(...new Uint8Array(blockDataView.buffer.slice(blockDataView.byteOffset + 0x9, blockDataView.byteOffset + 0xc)));
      const blockSubfileSize = blockDataView.getUint16(0xc, true); // If blockSubfilePart === 0x0
      const blockSubfilePart = blockDataView.getUint16(0x10, true);

      let file;
      if (blockSubfilePart === 0) {
        file = files.find(f => f.name === blockSubfileName && f.type === blockSubfileType);
        if (file) {
          throw new Error('File already exists!');
        }

        file = { name: blockSubfileName, type: blockSubfileType, size: blockSubfileSize };
        files.push(file);
      } else {
        file = files.find(f => f.name === blockSubfileName && f.type === blockSubfileType);
        if (!file) {
          throw new Error('File does not exist!');
        }
      }

      const blockSequenceNumbers = blockDataView.buffer.slice(0x20, 0x200);
      const sequenceNumberCount = blockSequenceNumbers.byteLength / 2;
      for (let sequenceNumberIndex = 0; sequenceNumberIndex < sequenceNumberCount; sequenceNumberIndex++) {
        const sequenceNumber = blockDataView.getUint16(0x20 + sequenceNumberIndex * 2 /* 2 bytes in uint16 */, true);
        if (file.blocks === undefined) {
          if (sequenceNumber === 0xffff) {
            throw new Error('No blocks? Is this a zero-sized file?');
          }

          file.blocks = { sequenceNumber, count: 1, terminated: false };
        } else if (file.blocks.terminated) {
          if (sequenceNumber !== 0xffff) {
            throw new Error('Expected only padding now!');
          }
        } else {
          if (sequenceNumber === 0xffff) {
            file.blocks.terminated = true;
            continue;
          }

          if (file.blocks.count !== sequenceNumber - file.blocks.sequenceNumber) {
            throw new Error('Numbers are not sequential');
          }

          file.blocks.count++;
        }
      }

      delete file.blocks.terminated;
    }

    // These offsets found using the FAT:
    // 19456, 89600, 90624, 102912, 197120, 391168, 489472, 490496, 508416, 627200, 882688, 976896, 977920, 993280, 1098752, 1322496, 1395712, 1396736, 1408000, 1495552, 1686016, 1780736, 1781760, 1801216, 1914368, 2152960, 2175488
    for (const file of files) {
      file.offset = file.blocks.sequenceNumber * 512;
    }

    // TODO: Find out why these offsets do not appear in the FAT (these were found by full text search for "GARMIN ")
    files.push({ offset: 93229, type: 'LTD' });
    files.push({ offset: 93295, type: 'LTD' });
    files.push({ offset: 93311, type: 'IMA' });
    files.push({ offset: 494571, type: 'LTD' });
    files.push({ offset: 494637, type: 'LTD' });
    files.push({ offset: 494653, type: 'IMA' });
    files.push({ offset: 981385, type: 'LTD' });
    files.push({ offset: 981451, type: 'LTD' });
    files.push({ offset: 981467, type: 'IMA' });
    files.push({ offset: 1399165, type: 'LTD' });
    files.push({ offset: 1399231, type: 'LTD' });
    files.push({ offset: 1399247, type: 'IMA' });
    files.push({ offset: 1787695, type: 'LTD' });
    files.push({ offset: 1787761, type: 'LTD' });
    files.push({ offset: 1787777, type: 'IMA' });

    this.subfiles = [];
    for (const file of files) {
      // TODO: Figure this file out
      if (file.name === 'MAKEGMAP') {
        continue;
      }

      // TODO: Limit the data view length to `file.blocks.count * 512` when I have `blocks` for the offsets found by full text
      const subfileDataView = new DataView(dataView.buffer, file.offset);
      const type = String.fromCharCode(...new Uint8Array(subfileDataView.buffer.slice(file.offset + 0x2, file.offset + 0xc)));
      if ('GARMIN ' + file.type !== type) {
        throw new Error(`Type mismatch between FAT (${file.type}) and data (${type})`);
      }

      switch (file.type) {
        case 'RGN': this.subfiles.push(new GarminRgnSubfile(subfileDataView)); break;
        case 'TRE': this.subfiles.push(new GarminTreSubfile(subfileDataView)); break;
        case 'LBL': this.subfiles.push(new GarminTreSubfile(subfileDataView)); break;
        case 'NET': this.subfiles.push(new GarminNetSubfile(subfileDataView)); break;
        case 'NOD': this.subfiles.push(new GarminNodSubfile(subfileDataView)); break;
        case 'MDR': this.subfiles.push(new GarminMdrSubfile(subfileDataView)); break;
        case 'SRT': this.subfiles.push(new GarminSrtSubfile(subfileDataView)); break;
        case 'LTD': this.subfiles.push(new GarminLtdSubfile(subfileDataView)); break;
        case 'IMA': this.subfiles.push(new GarminImaSubfile(subfileDataView)); break;
        default: throw new Error(`Unpexpected subfile type: '${file.type}' at offset ${file.offset}.`);
      }
    }
  }
}

class GarminRgnSubfile {
  constructor(/** @type{DataView} */ dataView) {
    this.type = 'RGN';
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
    this.type = 'TRE';
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

    const mapLevelDataView = new DataView(dataView.buffer, dataView.byteOffset + this.mapLevelsOffset);
    for (let index = 0; index < this.mapLevelsSize / 4; index++) {
      const zoom = mapLevelDataView.getUint8(index * 4 + 0x0);
      this.zoomLevel = (zoom & (1 << 3)) + (zoom & (1 << 2)) + (zoom & (1 << 1)) + (zoom & (1 << 0));
      if ((zoom & (1 << 4)) + (zoom & (1 << 5)) + (zoom & (1 << 6)) > 0) {
        //throw new Error(`The unknown section isn't all zeroes unlike expected.`);
      }

      this.inherited = zoom & (1 << 7) ? true : false;
      this.bits = mapLevelDataView.getUint8(index * 4 + 0x1);
      this.subdivisions = mapLevelDataView.getUint16(index * 4 + 0x2);
    }

    // TODO: Account for the fact that subdivisions vary in size depending on map level between 14 and 16 bytes
    const subdivisionsDataView = new DataView(dataView.buffer, dataView.byteOffset + this.subdivisionsOffset);
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
    this.type = 'LBL';
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
    this.type = 'NET';
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
    this.type = 'NOD';
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
    this.type = 'MDR';
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
    this.type = 'SRT';
    this.creationYear = dataView.getUint16(0xe, true);
    this.creationMonth = dataView.getUint8(0x10);
    this.creationDay = dataView.getUint8(0x11);
    this.creationHour = dataView.getUint8(0x12);
    this.creationMinute = dataView.getUint8(0x13);
    this.creationSecond = dataView.getUint8(0x14);
  }
}

class GarminLtdSubfile {
  constructor(/** @type{DataView} */ dataView) {
    this.type = 'LTD';
  }
}

class GarminImaSubfile {
  constructor(/** @type{DataView} */ dataView) {
    this.type = 'IMA';
  }
}
