class GarminTreSubfile {
  constructor(/** @type{DataView} */ dataView) {
    const headerLength = dataView.getUint16(0x0, true);
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

    const mapLevelsOffset = dataView.getUint32(0x21, true);
    const mapLevelsSize = dataView.getUint32(0x25, true);

    const subdivisionsOffset = dataView.getUint32(0x29, true);
    const subdivisionsSize = dataView.getUint32(0x2d, true);

    const copyrightOffset = dataView.getUint32(0x31, true);
    const copyrightSize = dataView.getUint32(0x35, true);
    const copyrightRecordSize = dataView.getUint16(0x39, true);

    const polylinesOffset = dataView.getUint32(0x4a, true);
    const polylinesSize = dataView.getUint32(0x4e, true);
    const polylinesRecordSize = dataView.getInt16(0x52, true);
    if (polylinesRecordSize !== 2 && polylinesRecordSize !== 3) {
      throw new Error('Unexpected polyline record size');
    }

    const polygonsOffset = dataView.getUint32(0x58, true);
    const polygonsSize = dataView.getUint32(0x5c, true);
    const polygonsRecordSize = dataView.getInt16(0x60, true);
    if (polygonsRecordSize !== 2 && polygonsRecordSize !== 3) {
      throw new Error('Unexpected polygon record size');
    }

    const pointsOffset = dataView.getUint32(0x66, true);
    const pointsSize = dataView.getUint32(0x6a, true);
    const pointsRecordSize = dataView.getInt16(0x6e, true);
    if (pointsRecordSize !== 3) {
      throw new Error('Unexpected point record size');
    }

    if (headerLength > 116) {
      // TODO
    }

    if (headerLength > 120) {
      // TODO
    }

    if (headerLength > 154) {
      // TODO
    }

    this.mapLevels = [];
    const mapLevelDataView = new DataView(dataView.buffer, dataView.byteOffset + mapLevelsOffset);
    const mapLevelCount = mapLevelsSize / 4;
    for (let index = 0; index < mapLevelCount; index++) {
      const mapLevel = {};

      const zoom = mapLevelDataView.getUint8(index * 4 + 0x0);

      // Note that 0 is ground level
      mapLevel.zoom = (zoom & (1 << 3)) + (zoom & (1 << 2)) + (zoom & (1 << 1)) + (zoom & (1 << 0));
      if ((zoom & (1 << 4)) + (zoom & (1 << 5)) + (zoom & (1 << 6)) > 0) {
        //console.log('PROBLEM')
        //throw new Error(`The unknown section isn't all zeroes unlike expected.`);
      }

      mapLevel.inherited = zoom & (1 << 7) ? true : false;
      mapLevel.coordBits = mapLevelDataView.getUint8(index * 4 + 0x1);
      mapLevel.unitDegrees = 360 / (Math.pow(2, mapLevel.coordBits));

      // Note that the higher the zoom the lower the number of subdivisions, generally
      mapLevel.subdivisions = mapLevelDataView.getUint16(index * 4 + 0x2);

      this.mapLevels.push(mapLevel);
    }

    // Note that the first subdivision is in the highest zoomed, least detailed map level
    this.subdivisions = [];
    const subdivisionsDataView = new DataView(dataView.buffer, dataView.byteOffset + subdivisionsOffset);

    // TODO: Account for the fact that subdivisions vary in size depending on map level between 14 and 16 bytes
    for (let index = 0; index < 10; index++) {
      const subdivision = {};

      subdivision.rgnOffset = subdivisionsDataView.getUint24(index * 14, true);
      subdivision.types = subdivisionsDataView.getUint8(index * 14 + 0x3);
      subdivision.hasPoints = (subdivision.types & 0x10) !== 0;
      subdivision.hasIndexedPoints = (subdivision.types & 0x20) !== 0;
      subdivision.hasPolylines = (subdivision.types & 0x40) !== 0;
      subdivision.hasPolygons = (subdivision.types & 0x80) !== 0;
      subdivision.longitudeCenter = subdivisionsDataView.getUint24(index * 14 + 0x4, true);
      subdivision.latitudeCenter = subdivisionsDataView.getUint24(index * 14 + 0x7, true);

      // TODO: Find out how to bitshift this so that the last bit (terminator) gets lost - including endianness concerns
      subdivision.width = subdivisionsDataView.getUint16(index * 14 + 0xa);

      // TODO: Realize from byte to read this from - first or second, and first or last bit? The file is little endian
      subdivision.terminates = subdivisionsDataView.getUint8(0xa) & (1 << 7) ? true : false;
      subdivision.height = subdivisionsDataView.getUint16(index * 14 + 0xc);
      // TODO: Read the last two bytes if we are not in the lower map level

      subdivision.nextIndex = subdivisionsDataView.getUint16(index * 14, true);

      this.subdivisions.push(subdivision);
    }

    this.polylines = [];
    const polylinesDataView = new DataView(dataView.buffer, dataView.byteOffset + polylinesOffset);
    for (let offset = 0; offset < polylinesSize; offset += polylinesRecordSize) {
      const polyline = {};
      polyline.type = polylinesDataView.getUint8(0);
      polyline.highestLevel = polylinesDataView.getUint8(1);

      // Note that when the record size is 3, the last byte is unknown
      this.polylines.push(polyline);
    }

    this.polygons = [];
    const polygonsDataView = new DataView(dataView.buffer, dataView.byteOffset + polygonsOffset);
    for (let offset = 0; offset < polygonsSize; offset += polygonsRecordSize) {
      const polygon = {};
      polygon.type = polygonsDataView.getUint8(0);
      polygon.highestLevel = polygonsDataView.getUint8(1);

      // Note that when the record size is 3, the last byte is unknown
      this.polygons.push(polygon);
    }

    this.points = [];
    const pointsDataView = new DataView(dataView.buffer, dataView.byteOffset + pointsOffset);
    for (let offset = 0; offset < pointsSize; offset += pointsRecordSize) {
      const point = {};
      point.type = pointsDataView.getUint8(0);
      point.highestLevel = pointsDataView.getUint8(1);
      point.subtype = pointsDataView.getUint8(2);
      this.points.push(point);
    }
  }
}
