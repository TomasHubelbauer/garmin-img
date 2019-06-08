class GarminLblSubfile {
  constructor(/** @type{DataView} */ dataView) {
    this.creationYear = dataView.getUint16(0xe, true);
    this.creationMonth = dataView.getUint8(0x10);
    this.creationDay = dataView.getUint8(0x11);
    this.creationHour = dataView.getUint8(0x12);
    this.creationMinute = dataView.getUint8(0x13);
    this.creationSecond = dataView.getUint8(0x14);

    const dataOffset = dataView.getUint32(0x15, true) + 2;
    const dataLength = dataView.getUint32(0x19, true);
    const dataLabelOffsetMultiplier = dataView.getUint8(0x1d);
    const labelCoding = dataView.getUint8(0x1e);
    if (labelCoding !== 10) {
      throw new Error('Unexpected coding');
    }

    const dataSlice = dataView.buffer.slice(dataView.byteOffset + dataOffset, dataView.byteOffset + dataOffset + dataLength);

    const bytes = [];
    let bits = [];
    let chars = '';

    // Attempt frequency analysis to maybe find the letters?
    const freqs = {};

    // TODO: Turn this into an iterator for performance
    for (const byte of new Uint8Array(dataSlice)) {
      //bytes.push(byte);
      for (let bit = 0; bit < 8; bit++) {
        bits.push((byte & (1 << bit)) ? 1 : 0);
        if (bits.length === 10) {
          const char = bits.join('');
          freqs[char] = (freqs[char] || 0) + 1;

          // Mimic the 6 bit encoding - although this doesn't seem to work that well
          switch (char) {
            case '0000000000': chars += ' '; break;
            case '0000000001': chars += 'A'; break;
            case '0000000010': chars += 'B'; break;
            case '0000000011': chars += 'C'; break;
            case '0000000100': chars += 'D'; break;
            case '0000000101': chars += 'E'; break;
            case '0000000110': chars += 'F'; break;
            case '0000000111': chars += 'G'; break;
            case '0000001000': chars += 'H'; break;
            case '0000001001': chars += 'I'; break;
            case '0000001010': chars += 'J'; break;
            case '0000001011': chars += 'K'; break;
          }

          bits = [];
        }
      }
    }

    const mostFrequent = Object.keys(freqs).filter(k => freqs[k] > 100).map(k => k + ' ' + freqs[k]);

    this.data = {
      bytes,
      bits,
      chars,
      mostFrequent,
    };

    const countryDefsOffset = dataView.getUint32(0x1f, true);
    const countryDefsLength = dataView.getUint32(0x23, true);
    const countryDefSize = dataView.getUint16(0x27, true);
    if (countryDefSize !== 3) {
      throw new Error(countryDefSize);
    }

    this.countryDefs = [];
    const countryDefsDataView = new DataView(dataView.buffer, dataView.byteOffset + countryDefsOffset);
    for (let offset = 0; offset < countryDefsLength; offset += countryDefSize) {
      const countryDef = {
        pointer: countryDefsDataView.getUint24(0, true),
      };

      this.countryDefs.push(countryDef);
    }

    const regionDefsOffset = dataView.getUint32(0x2d, true);
    const regionDefsLength = dataView.getUint32(0x31, true);
    const regionDefSize = dataView.getUint16(0x35, true);
    if (regionDefSize !== 5) {
      throw new Error(regionDefSize);
    }

    this.regionDefs = [];
    const regionDefsDataView = new DataView(dataView.buffer, dataView.byteOffset + regionDefsOffset);
    for (let offset = 0; offset < regionDefsLength; offset += regionDefSize) {
      const regionDef = {
        countryIndex: regionDefsDataView.getUint16(0, true),
        pointer: regionDefsDataView.getUint24(2, true),
      };

      this.regionDefs.push(regionDef);
    }

    const cityDefsOffset = dataView.getUint32(0x3b, true);
    const cityDefsLength = dataView.getUint32(0x3f, true);
    const cityDefSize = dataView.getUint16(0x43, true);
    if (cityDefSize !== 5) {
      throw new Error(cityDefSize);
    }

    this.cityDefs = [];
    const cityDefsDataView = new DataView(dataView.buffer, dataView.byteOffset + cityDefsOffset);
    for (let offset = 0; offset < cityDefsLength; offset += cityDefSize) {
      const cityDef = {
        data: cityDefsDataView.getUint24(0, true),
        info: cityDefsDataView.getUint16(3, true),
      };

      this.cityDefs.push(cityDef);
    }

    const poiProsOffset = dataView.getUint32(0x57, true);
    const poiPropLength = dataView.getUint32(0x5b, true);
    const poiPropsOffsetMultiplier = dataView.getUint8(0x5f);
    const poiProsMask = dataView.getUint8(0x60);

    const zipDefsOffset = dataView.getUint32(0x72, true);
    const zipDefsLength = dataView.getUint32(0x76, true);
    const zipDefSize = dataView.getUint16(0x7a, true);
    if (zipDefSize !== 3) {
      throw new Error(zipDefSize);
    }

    this.zipDefs = [];
    const zipDefsDataView = new DataView(dataView.buffer, dataView.byteOffset + zipDefsOffset);
    for (let offset = 0; offset < zipDefsLength; offset += zipDefSize) {
      const zipDef = {
        pointer: zipDefsDataView.getUint24(0, true),
      };

      this.zipDefs.push(zipDef);
    }
  }
}
