var app, stats;

var STAT_NAMES = {
  ANIMATION_MS: 'animation_ms',
  DRAW_SPIRITS_MS: 'draw_spirits_ms',
  WORLD_TIME: 'world_time'
};

function main() {
  stats = new Stats();
  app = new Test40App('vertex-shader.txt', 'fragment-shader.txt');
  app.start();
}

