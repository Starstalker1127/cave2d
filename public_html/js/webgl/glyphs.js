/**
 * A collection of printable characters, as ModelStamp objects in the "stamps" map.
 * @param glyphMaker
 * @param {boolean} flat true to make 'em 2d.
 * @constructor
 */
function Glyphs(glyphMaker, flat) {
  this.glyphMaker = glyphMaker;
  this.flat = flat;
  this.models = null;
  this.stamps = null;
}

Glyphs.prototype.initModels = function() {
  if (!this.models) {
    this.models = {};
    let r = this.glyphMaker.lineWidth / 2;
    let h = 1.5;
    let w = 1;
    let self = this;

    function g() {
      self.glyphMaker.clear();
      for (let i = 1; i < arguments.length; i += 4) {
        if (self.flat) {
          self.glyphMaker.addSegment(arguments[i], arguments[i + 1], arguments[i + 2], arguments[i + 3]);
        } else {
          self.glyphMaker.addStick(arguments[i], arguments[i + 1], arguments[i + 2], arguments[i + 3]);
        }
      }
      self.models[arguments[0]] = self.glyphMaker.addToRigidModel(new RigidModel());
    }

    g('A',
        -w, -h, -r / 5, h,
        w, -h, r / 5, h,
        -w / 2, -h * 0.33, w / 2, -h * 0.33);
    g('B',
        -w, h, -w, -h,
        -w, h, w * 0.33, h,
        w * 0.33, h, w * 0.33, 0,
        -w, 0, w, 0,
        w, 0, w, -h,
        w, -h, -w, -h);
    g('C',
        -w + r, h, w / 2, h,
        -w, h - r, -w, -h + r,
        -w + r, -h, w - r, -h);
    g('D',
        -w, h - r, -w, -h,
        -w, -h, w, -h,
        w, -h, w, 0,
        w - r / 2, r, -w, h);
    g('E',
        w * 0.5, h, -w, h,
        -w, h, -w, -h,
        -w, -h, w, -h,
        -w, 0, w * 0.5, 0);
    g('F',
        w, h, -w, h,
        -w, h, -w, -h,
        -w, 0, w * 0.33, 0);
    g('G',
        w * 0.5, h, -w, h,
        -w, h, -w, -h,
        -w, -h, w, -h,
        w, -h, w, 0,
        w * 0.2, 0, w * 1.2, 0);
    g('H',
        -w, h, -w, -h,
        w, h, w, -h,
        w, 0, -w, 0);
    g('I',
        0, h, 0, -h,
        -w, h, w, h,
        -w, -h, w, -h);
    g('J',
        -w, -h * 0.33, -w, -h,
        -w, -h, w, -h,
        w, -h, w, h);
    g('K',
        -w, h, -w, -h,
        -w * (1 - r), -h * 0.2, w * 0.6, h,
        -w * 0.2, 0, w, -h);
    g('L',
        -w, h, -w, -h,
        -w, -h, w, -h);
    g('M',
        -w, -h, -w, h,
        -w + r * 0.6, h - r / 2, -r * 0.2, h * 0.33,
        -r * 0.2, h * 0.33, w - r * 0.6, h - r / 2,
        w, h, w, -h);
    g('N',
        -w, -h, -w, h,
        -w + r / 2, h - r / 2, w - r / 2, -h + r / 2,
        w, -h, w, h);
    g('O',
        -w, h - r, -w, -h + r,
        -w + r, h, w - r, h,
        w, h - r, w, -h + r,
        -w + r, -h, w - r, -h);
    g('P',
        -w, h, -w, -h,
        -w, h, w, h,
        w, h, w, 0,
        w, 0, -w, 0);
    g('Q',
        -w, h - r, -w, -h + r,
        -w + r, h, w - r, h,
        w, h - r, w, -h + r,
        -w + r, -h, w - r, -h,
        w * 0.4, -h * 0.4, w * 1.4, -h);
    g('R',
        -w, h, -w, -h,
        -w, h, w, h,
        w, h, w, 0,
        w, 0, -w, 0,
        0, -r, w, -h);
    g('S',
        w, h, -w / 2 + r, h,
        -w / 2, h - r / 2, -w, h / 2,
        -w, h / 2, w, -h / 2,
        w, -h / 2, w / 2, -h + r / 2,
        w / 2 - r, -h, -w, -h);
    g('T',
        w, h, -w, h,
        0, h, 0, -h);
    g('U',
        -w, h, -w, -h + r,
        w, h, w, -h + r,
        -w + r, -h, w - r, -h);
    g('V',
        -w, h, -r / 5, -h,
        w, h, r / 5, -h);
    g('W',
        -w, h, -w, -h,
        -w + r * 0.6, -h + r / 3, -r * 0.2, -h * 0.5,
        -r * 0.2, -h * 0.5, w - r * 0.6, -h + r / 3,
        w, -h, w, h);
    g('X',
        -w, h, w, -h,
        w, h, -w, -h);
    g('Y',
        -w, h, -r / 2, 0,
        w, h, r / 2, 0,
        0, 0, 0, -h);
    g('Z',
        -w, h, w, h,
        w, h - r / 2, -w, -h + r / 2,
        -w, -h, w, -h);

    g('0',
        -w, h, -w, -h,
        -w, h, w, h,
        w, h, w, -h,
        -w, -h, w, -h,
        0, -h/8, 0, h/8);
    g('1',
        -w, h, 0 - r, h,
        0, h, 0, -h,
        -w, -h, w, -h);
    g('2',
        -w * 2 / 3, h, w, h,
        w, h, w, 0,
        w, 0, -w, 0,
        -w, 0, -w, -h,
        -w, -h, w, -h);
    g('3',
        -w, h, w, h,
        w, h, w, -h,
        -w, -h, w, -h,
        -w / 2, 0, w, 0);
    g('4',
        -w, h * 2 / 3, -w, 0,
        -w, 0, w, 0,
        w, h, w, -h);
    g('5',
        -w, h, w, h,
        -w, h, -w, 0,
        w, 0, -w, 0,
        w, 0, w, -h,
        -w, -h, w, -h);
    g('6',
        w * 2 / 3, h, -w, h,
        -w, h, -w, -h,
        -w, -h, w, -h,
        w, -h, w, 0,
        w, 0, -w, 0);
    g('7',
        -w, h, w, h,
        w, h - r, 0, -h);
    g('8',
        w, h, -w, h,
        -w, h, -w, -h,
        -w, -h, w, -h,
        w, -h, w, h,
        w, 0, -w, 0);
    g('9',
        w, 0, -w, 0,
        -w, 0, -w, h,
        -w, h, w, h,
        w, h, w, -h);

    g(' ');
    g('.',
        -r/2, -h, -r/2, -h+r,
        -r/2, -h+r, r/2, -h+r,
        r/2, -h+r, r/2, -h,
        -r/2, -h, r/2, -h);
    g(',',
        0, -h, -w / 3, -h * 1.5);
    g('\'',
        0, h, 0, h * 4 / 3);
    g('"',
        r * 2, h, r * 2, h * 4 / 3,
        -r * 2, h, -r * 2, h * 4 / 3);
    g('?',
        0, -h, 0, -h,
        0, -h / 3, 0, 0,
        0, 0, w, 0,
        w, 0, w, h,
        w, h, -w, h,
        -w, h, -w, h * 2 / 3);
    g('!',
        0, -h, 0, -h,
        0, -h / 3, 0, h);
    g(':',
        0, -h, 0, -h,
        0, h / 3, 0, h / 3);
    g(';',
        0, -h, -w / 3, -h * 4 / 3,
        0, h / 3, 0, h / 3);
    g('-',
        -w, 0, w, 0);
    g('+',
        -w, 0, w, 0,
        0, -w, 0, w);
    g('/',
        w, h, -w, -h);
    g('*',
        -w*0.9, h/3, w*0.9, -h/3,
        -w*0.9, -h/3, w*0.9, h/3,
        0, -w, 0, w);
    g('#',
        -w*0.4, h*0.9, -w*0.6, -h*0.9,
        -w, h*0.4, w, h*0.4,
        w*0.6, h*0.9, w*0.4, -h*0.9,
        -w, -h*0.4, w, -h*0.4);
  }
  return this.models;
};

Glyphs.prototype.initStamps = function(gl) {
  if (!this.stamps) {
    this.initModels();
    this.stamps = {};
    for (let key in this.models) {
      this.stamps[key] = this.models[key].createModelStamp(gl);
    }
  }
  return this.stamps;
};
