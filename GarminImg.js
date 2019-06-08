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

    this.files = [];

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
        file = this.files.find(f => f.name === blockSubfileName && f.type === blockSubfileType);
        if (file) {
          throw new Error('File already exists!');
        }

        file = { name: blockSubfileName, type: blockSubfileType, size: blockSubfileSize };
        this.files.push(file);
      } else {
        file = this.files.find(f => f.name === blockSubfileName && f.type === blockSubfileType);
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
    for (const file of this.files) {
      file.offset = file.blocks.sequenceNumber * 512;

      // TODO: Keep this to calculate the data view size in the loop below later on
      delete file.blocks;
    }

    // TODO: Find out why these offsets do not appear in the FAT (these were found by full text search for "GARMIN ")
    this.files.push({ offset: 93229, type: 'LTD' });
    this.files.push({ offset: 93295, type: 'LTD' });
    this.files.push({ offset: 93311, type: 'IMA' });
    this.files.push({ offset: 494571, type: 'LTD' });
    this.files.push({ offset: 494637, type: 'LTD' });
    this.files.push({ offset: 494653, type: 'IMA' });
    this.files.push({ offset: 981385, type: 'LTD' });
    this.files.push({ offset: 981451, type: 'LTD' });
    this.files.push({ offset: 981467, type: 'IMA' });
    this.files.push({ offset: 1399165, type: 'LTD' });
    this.files.push({ offset: 1399231, type: 'LTD' });
    this.files.push({ offset: 1399247, type: 'IMA' });
    this.files.push({ offset: 1787695, type: 'LTD' });
    this.files.push({ offset: 1787761, type: 'LTD' });
    this.files.push({ offset: 1787777, type: 'IMA' });

    for (const file of this.files) {
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
        case 'RGN': file.subfile = new GarminRgnSubfile(subfileDataView); break;
        case 'TRE': file.subfile = new GarminTreSubfile(subfileDataView); break;
        case 'LBL': file.subfile = new GarminLblSubfile(subfileDataView); break;
        case 'NET': file.subfile = new GarminNetSubfile(subfileDataView); break;
        case 'NOD': file.subfile = new GarminNodSubfile(subfileDataView); break;
        case 'MDR': file.subfile = new GarminMdrSubfile(subfileDataView); break;
        case 'SRT': file.subfile = new GarminSrtSubfile(subfileDataView); break;
        case 'LTD': file.subfile = new GarminLtdSubfile(subfileDataView); break;
        case 'IMA': file.subfile = new GarminImaSubfile(subfileDataView); break;
        default: throw new Error(`Unpexpected subfile type: '${file.type}' at offset ${file.offset}.`);
      }
    }
  }
}
