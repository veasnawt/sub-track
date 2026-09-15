import app from '../server/index';

export default app;

try {
  // @ts-ignore
  module.exports = app;
  // @ts-ignore
  module.exports.default = app;
} catch (e) {}
